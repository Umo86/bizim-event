import "server-only";
import { eq, or } from "drizzle-orm";
import type Stripe from "stripe";
import type { DB, Queryable } from "@/db";
import { auditLog, businesses, processedWebhooks, subscriptionPlans, subscriptions, user } from "@/db/schema";
import { sendNotice } from "@/emails/notices";
import { snapshotFromStripe, type SubscriptionSnapshot } from "@/lib/adapters/billing";
import { logger } from "@/lib/logger";
import { PLANS, type PlanKey } from "@/lib/plans";
import {
  billingNoticeFor,
  mapStripeStatus,
  nextGraceUntil,
  type BillingNoticeKind,
  type SubscriptionStatus,
} from "@/server/rules";
import { notifyUser } from "./notify";
import { refreshBusinessVisibility } from "./visibility";

/**
 * Applies Stripe's view of a subscription to ours. Webhooks, the checkout return page and
 * the dev simulator all come through here, so a subscription changes in exactly one way.
 * INTERNAL: callers have already verified the source (signed webhook, the owner's own
 * checkout session, or the dev simulator).
 */

export type BillingResult = {
  businessId: string;
  notice: { kind: BillingNoticeKind; date: Date | null; plan: PlanKey | null } | null;
};

/** Stripe events that change a subscription; register exactly these on the webhook endpoint. */
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

const LIVE = new Set(["active", "past_due"]);

export async function applySubscriptionSnapshot(
  db: Queryable,
  snap: SubscriptionSnapshot,
  now = new Date(),
): Promise<BillingResult | null> {
  // Lock the row: the webhook and the checkout return can arrive together.
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      snap.businessId
        ? or(eq(subscriptions.stripeSubscriptionId, snap.subscriptionId), eq(subscriptions.businessId, snap.businessId))
        : eq(subscriptions.stripeSubscriptionId, snap.subscriptionId),
    )
    .orderBy(subscriptions.createdAt)
    .limit(1)
    .for("update");
  if (!row) {
    logger.warn("billing.unknown_subscription", { subscription: snap.subscriptionId, business: snap.businessId });
    return null;
  }

  const mapped = mapStripeStatus(snap.stripeStatus, snap.cancellationReason);
  const snapLive = mapped !== null && LIVE.has(mapped);
  if (
    row.stripeSubscriptionId &&
    row.stripeSubscriptionId !== snap.subscriptionId &&
    (LIVE.has(row.status) || !snapLive)
  ) {
    // Another subscription is on record. A live one is never replaced by a second one (two
    // checkouts finished in two tabs) or an old one; and a subscription that isn't live (a
    // late event about an old one, an abandoned checkout) never replaces whatever is there.
    // Only a new live subscription takes over from one that has ended.
    if (LIVE.has(row.status) && snapLive) {
      logger.error("billing.duplicate_subscription", {
        business: row.businessId,
        kept: row.stripeSubscriptionId,
        other: snap.subscriptionId,
      });
      await db.insert(auditLog).values({
        action: "billing.duplicate_subscription",
        entity: "business",
        entityId: row.businessId,
        diff: { kept: row.stripeSubscriptionId, other: snap.subscriptionId },
      });
    }
    return null;
  }

  // A complimentary business stays complimentary whatever Stripe says.
  const status: SubscriptionStatus = row.status === "comped" ? "comped" : (mapped ?? row.status);
  const graceUntil =
    status === "past_due" ? nextGraceUntil(row, status, now) : status === "expired" ? row.graceUntil : null;
  const [plan] = snap.plan
    ? await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.key, snap.plan))
    : [];
  const next = {
    stripeSubscriptionId: snap.subscriptionId,
    stripeCustomerId: snap.customerId,
    stripeStatus: snap.stripeStatus,
    status,
    planId: plan?.id ?? row.planId,
    currentPeriodEnd: snap.currentPeriodEnd,
    cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
    graceUntil,
  };
  await db.update(subscriptions).set(next).where(eq(subscriptions.id, row.id));
  await refreshBusinessVisibility(db, row.businessId, now);

  const notice = billingNoticeFor(row, { ...row, ...next });
  if (notice) {
    const [biz] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, row.businessId));
    if (biz) {
      await notifyUser(db, biz.ownerId, `billing_${notice.kind}`, {
        businessId: row.businessId,
        date: notice.date?.toISOString() ?? null,
      });
    }
  }
  return { businessId: row.businessId, notice: notice ? { ...notice, plan: snap.plan } : null };
}

/** The subscription a Stripe event is about, and the business when the event knows it. */
function subscriptionRef(event: Stripe.Event): { id: string; businessId: string | null } | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.mode !== "subscription" || !s.subscription) return null;
      return {
        id: typeof s.subscription === "string" ? s.subscription : s.subscription.id,
        businessId: s.client_reference_id ?? s.metadata?.businessId ?? null,
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return { id: event.data.object.id, businessId: event.data.object.metadata?.businessId ?? null };
    case "invoice.paid":
    case "invoice.payment_failed": {
      const ref = event.data.object.parent?.subscription_details?.subscription;
      return ref ? { id: typeof ref === "string" ? ref : ref.id, businessId: null } : null;
    }
    default:
      return null;
  }
}

export type WebhookOutcome =
  { status: "ignored" } | { status: "duplicate" } | { status: "processed"; result: BillingResult | null };

/**
 * Handles a verified Stripe event once (processed_webhooks), in one transaction: if anything
 * fails, nothing is recorded and Stripe's retry gets a clean second attempt. Events can
 * arrive out of order, so the subscription is re-read from Stripe rather than trusted from
 * the payload (except a deletion, whose payload is final).
 */
export async function handleStripeEvent(
  db: DB,
  event: Stripe.Event,
  retrieve: (subscriptionId: string) => Promise<SubscriptionSnapshot>,
  now = new Date(),
): Promise<WebhookOutcome> {
  const ref = subscriptionRef(event);
  if (!ref) return { status: "ignored" };
  const snap =
    event.type === "customer.subscription.deleted" ? snapshotFromStripe(event.data.object) : await retrieve(ref.id);
  return db.transaction(async (tx) => {
    const fresh = await tx
      .insert(processedWebhooks)
      .values({ stripeEventId: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: processedWebhooks.stripeEventId });
    if (fresh.length === 0) return { status: "duplicate" as const };
    const result = await applySubscriptionSnapshot(tx, { ...snap, businessId: snap.businessId ?? ref.businessId }, now);
    return { status: "processed" as const, result };
  });
}

/** Emails the owner about a billing change, in their language. Never throws. */
export async function deliverBillingNotice(db: Queryable, result: BillingResult | null) {
  if (!result?.notice) return;
  const [row] = await db
    .select({
      email: user.email,
      locale: user.preferredLocale,
      nameTr: businesses.nameTr,
      nameEn: businesses.nameEn,
    })
    .from(businesses)
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .where(eq(businesses.id, result.businessId));
  if (!row) return;
  const name = (row.locale === "en" ? (row.nameEn ?? row.nameTr) : (row.nameTr ?? row.nameEn)) ?? "";
  await sendNotice(result.notice.kind, row.email, row.locale, {
    business: name,
    date: result.notice.date,
    plan: result.notice.plan,
    path: `/business/${result.businessId}/billing`,
  });
}

/** Plan names for admin screens and emails. */
export const planName = (plan: PlanKey | null, locale: "tr" | "en") =>
  plan ? (locale === "tr" ? PLANS[plan].nameTr : PLANS[plan].nameEn) : "";
