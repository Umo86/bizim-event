import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Queryable } from "@/db";
import { auditLog, subscriptionPlans, subscriptions, user } from "@/db/schema";
import {
  billing,
  isDevBilling,
  readDevToken,
  type DevCheckoutToken,
  type DevPortalToken,
  type Locale,
  type SubscriptionSnapshot,
} from "@/lib/adapters/billing";
import { isPlanKey, PLANS, type PlanKey } from "@/lib/plans";
import { applySubscriptionSnapshot } from "@/server/internal/billing";
import { billingState, firstPaymentAt, type BillingRow } from "@/server/rules";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { DalError } from "./errors";
import { requireBusinessMember } from "./guards";

/**
 * Billing for business owners. Only the owner (and organization owners/admins) can see or
 * change a business's subscription; managers can't. Plans can be chosen once the business
 * is approved, which is also when the free trial starts.
 */

type SubscriptionRow = typeof subscriptions.$inferSelect & { plan: PlanKey | null };

async function subscriptionFor(db: Queryable, businessId: string): Promise<SubscriptionRow | null> {
  const [row] = await db
    .select({ sub: subscriptions, planKey: subscriptionPlans.key })
    .from(subscriptions)
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  if (!row) return null;
  return { ...row.sub, plan: isPlanKey(row.planKey) ? row.planKey : null };
}

export const toBillingRow = (row: SubscriptionRow): BillingRow => ({
  status: row.status,
  trialEndsAt: row.trialEndsAt,
  currentPeriodEnd: row.currentPeriodEnd,
  graceUntil: row.graceUntil,
  stripeStatus: row.stripeStatus,
  stripeSubscriptionId: row.stripeSubscriptionId,
  cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  plan: row.plan,
});

/** Customer ids from the dev simulator mean nothing to Stripe, and the reverse. */
const belongsToProvider = (customerId: string | null) =>
  !!customerId && customerId.startsWith("dev_") === isDevBilling();

const CHOOSABLE = new Set(["trial", "expired", "canceled"]);

/** The billing page: where the subscription stands and what the owner can do next. */
export async function getBilling(ctx: DalContext, businessId: string) {
  const { business } = await requireBusinessMember(ctx, businessId, "owner");
  const row = await subscriptionFor(ctx.db, businessId);
  const now = nowOf(ctx);
  const state = row ? billingState(toBillingRow(row), now) : null;
  const p = billing();
  return {
    business: {
      id: business.id,
      type: business.type,
      nameTr: business.nameTr,
      nameEn: business.nameEn,
      status: business.status,
      timezone: business.timezone,
    },
    state,
    plan: row?.plan ?? null,
    trialEndsAt: row?.trialEndsAt ?? null,
    /** When a plan chosen now is first charged (null: straight away). */
    firstPaymentAt: state ? firstPaymentAt(state, now) : null,
    provider: { name: p.name, enabled: p.enabled, mode: p.mode },
    canChoosePlan: business.status === "approved" && !!state && CHOOSABLE.has(state.kind),
    canManage: p.enabled && belongsToProvider(row?.stripeCustomerId ?? null) && !!row?.stripeSubscriptionId,
  };
}
export type BillingView = Awaited<ReturnType<typeof getBilling>>;

/** Starts Stripe Checkout for a plan. During the free trial, the first charge waits for its end. */
export async function startCheckout(
  ctx: DalContext,
  businessId: string,
  plan: string,
  opts: { locale: Locale; baseUrl: string },
) {
  const { user: actor, business } = await requireBusinessMember(ctx, businessId, "owner");
  if (!isPlanKey(plan)) throw new DalError("INVALID");
  if (business.status !== "approved") throw new DalError("CONFLICT", "not_approved_yet");
  const p = billing();
  if (!p.enabled) throw new DalError("CONFLICT", "billing_disabled");
  const row = await subscriptionFor(ctx.db, businessId);
  if (!row) throw new DalError("CONFLICT", "not_approved_yet");
  const now = nowOf(ctx);
  const state = billingState(toBillingRow(row), now);
  if (state.kind === "comped") throw new DalError("CONFLICT", "comped");
  if (!CHOOSABLE.has(state.kind)) throw new DalError("CONFLICT", "already_subscribed");

  let customerId = row.stripeCustomerId;
  if (!belongsToProvider(customerId)) {
    const [owner] = await ctx.db
      .select({ email: user.email, locale: user.preferredLocale })
      .from(user)
      .where(eq(user.id, business.ownerId));
    customerId = await p.createCustomer({
      businessId,
      email: owner.email,
      name: business.nameEn ?? business.nameTr ?? owner.email,
      locale: owner.locale,
    });
    await ctx.db.update(subscriptions).set({ stripeCustomerId: customerId }).where(eq(subscriptions.id, row.id));
  }

  const trialEnd = firstPaymentAt(state, now);
  const billingUrl = `${opts.baseUrl}/${opts.locale}/business/${businessId}/billing`;
  const { url } = await p.createCheckout({
    businessId,
    customerId: customerId!,
    plan,
    trialEnd,
    locale: opts.locale,
    returnUrl: `${opts.baseUrl}/api/billing/return?business=${businessId}&locale=${opts.locale}&session_id={CHECKOUT_SESSION_ID}`,
    billingUrl,
    cancelUrl: `${billingUrl}?checkout=cancelled`,
  });
  await ctx.db.insert(auditLog).values({
    actorId: actor.id,
    action: "billing.checkout_started",
    entity: "business",
    entityId: businessId,
    diff: { plan, trialEnd: trialEnd?.toISOString() ?? null },
  });
  return { url };
}

/** Stripe's Customer Portal: card, invoices, monthly ↔ yearly, cancel at the period end. */
export async function openPortal(ctx: DalContext, businessId: string, opts: { locale: Locale; baseUrl: string }) {
  await requireBusinessMember(ctx, businessId, "owner");
  const p = billing();
  if (!p.enabled) throw new DalError("CONFLICT", "billing_disabled");
  const row = await subscriptionFor(ctx.db, businessId);
  if (!row?.stripeCustomerId || !belongsToProvider(row.stripeCustomerId)) {
    throw new DalError("CONFLICT", "no_billing_account");
  }
  return p.createPortal({
    businessId,
    customerId: row.stripeCustomerId,
    returnUrl: `${opts.baseUrl}/${opts.locale}/business/${businessId}/billing`,
    locale: opts.locale,
  });
}

/** After Checkout: apply the new subscription now rather than wait for the webhook. */
export async function completeCheckout(ctx: DalContext, businessId: string, sessionId: string) {
  await requireBusinessMember(ctx, businessId, "owner");
  if (!sessionId.startsWith("cs_") || billing().name !== "stripe") return null;
  const snap = await billing().checkoutSubscription(sessionId);
  if (!snap) return null;
  if (snap.businessId !== businessId) throw new DalError("FORBIDDEN");
  return ctx.db.transaction((tx) => applySubscriptionSnapshot(tx, snap, nowOf(ctx)));
}

// ── Dev simulator (local development and tests only) ──────────────────────────

function requireDev() {
  if (!isDevBilling()) throw new DalError("NOT_FOUND");
}

/** What the dev checkout page shows. */
export async function devCheckoutDetails(ctx: DalContext, token: string) {
  requireDev();
  const data = readDevToken<DevCheckoutToken>(token);
  if (!data) throw new DalError("INVALID", "token_expired");
  const { business } = await requireBusinessMember(ctx, data.businessId, "owner");
  return { ...data, nameTr: business.nameTr, nameEn: business.nameEn };
}

/** "Pay" on the dev checkout page: what Stripe + the webhook would do. */
export async function devCompleteCheckout(ctx: DalContext, token: string) {
  const data = await devCheckoutDetails(ctx, token);
  const now = nowOf(ctx);
  const trialEnd = data.trialEnd ? new Date(data.trialEnd) : null;
  const snap: SubscriptionSnapshot = {
    subscriptionId: `dev_sub_${randomUUID()}`,
    customerId: data.customerId,
    businessId: data.businessId,
    stripeStatus: trialEnd ? "trialing" : "active",
    cancellationReason: null,
    plan: data.plan,
    currentPeriodEnd: trialEnd ?? addInterval(now, data.plan),
    cancelAtPeriodEnd: false,
  };
  const result = await ctx.db.transaction((tx) => applySubscriptionSnapshot(tx, snap, now));
  return { result, billingUrl: data.billingUrl };
}

export const DEV_PORTAL_ACTIONS = [
  "switch_monthly",
  "switch_yearly",
  "cancel_at_period_end",
  "resume",
  "cancel_now",
  "payment_failed",
  "payment_succeeded",
] as const;
export type DevPortalAction = (typeof DEV_PORTAL_ACTIONS)[number];

/** What the dev portal page shows. */
export async function devPortalDetails(ctx: DalContext, token: string) {
  requireDev();
  const data = readDevToken<DevPortalToken>(token);
  if (!data) throw new DalError("INVALID", "token_expired");
  const { business } = await requireBusinessMember(ctx, data.businessId, "owner");
  const row = await subscriptionFor(ctx.db, data.businessId);
  return {
    ...data,
    nameTr: business.nameTr,
    nameEn: business.nameEn,
    state: row ? billingState(toBillingRow(row), nowOf(ctx)) : null,
    stripeStatus: row?.stripeStatus ?? null,
  };
}

/** A button on the dev portal: change the subscription the way Stripe would. */
export async function devPortalAction(ctx: DalContext, token: string, action: string) {
  const data = await devPortalDetails(ctx, token);
  if (!(DEV_PORTAL_ACTIONS as readonly string[]).includes(action)) throw new DalError("INVALID");
  const row = await subscriptionFor(ctx.db, data.businessId);
  if (!row?.stripeSubscriptionId) throw new DalError("CONFLICT", "no_billing_account");
  const now = nowOf(ctx);
  const plan = row.plan ?? "monthly";
  const snap: SubscriptionSnapshot = {
    subscriptionId: row.stripeSubscriptionId,
    customerId: row.stripeCustomerId ?? data.customerId,
    businessId: data.businessId,
    stripeStatus: row.stripeStatus ?? "active",
    cancellationReason: null,
    plan,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
  switch (action as DevPortalAction) {
    case "switch_monthly":
    case "switch_yearly":
      snap.plan = action === "switch_monthly" ? "monthly" : "yearly";
      if (snap.stripeStatus !== "trialing") snap.currentPeriodEnd = addInterval(now, snap.plan);
      break;
    case "cancel_at_period_end":
      snap.cancelAtPeriodEnd = true;
      break;
    case "resume":
      snap.cancelAtPeriodEnd = false;
      break;
    case "cancel_now":
      snap.stripeStatus = "canceled";
      snap.cancellationReason = "cancellation_requested";
      break;
    case "payment_failed":
      snap.stripeStatus = "past_due";
      break;
    case "payment_succeeded":
      snap.stripeStatus = "active";
      snap.currentPeriodEnd = addInterval(now, plan);
      break;
  }
  return ctx.db.transaction((tx) => applySubscriptionSnapshot(tx, snap, now));
}

function addInterval(from: Date, plan: PlanKey) {
  const d = new Date(from);
  if (PLANS[plan].interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}
