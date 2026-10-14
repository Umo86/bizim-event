import "server-only";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Tx } from "@/db";
import { auditLog, businesses, subscriptionPlans, subscriptions, user } from "@/db/schema";
import { billing } from "@/lib/adapters/billing";
import { env } from "@/lib/env";
import { isPlanKey, PLANS } from "@/lib/plans";
import { STRIPE_WEBHOOK_EVENTS } from "@/server/internal/billing";
import { TEST_EMAIL_DOMAIN } from "@/server/internal/test-data";
import { refreshBusinessVisibility } from "@/server/internal/visibility";
import { billingState, mrrMinor } from "@/server/rules";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { DalError } from "./errors";
import { requireAdmin } from "./guards";

/**
 * Admin billing tools: is Stripe set up, how many businesses pay, MRR, and the two manual
 * levers — extend a free trial, or make a business complimentary. Everything is audited.
 * Test accounts (@bizimevent.test) are counted separately so they never inflate MRR.
 */

const isTestOwner = sql<boolean>`${user.email} like ${`%@${TEST_EMAIL_DOMAIN}`}`;

/** Effective state in SQL, mirroring billingState() — time-based changes count without the daily job. */
function stateFilter(filter: SubscriptionFilter, now: Date): SQL | undefined {
  const s = subscriptions;
  switch (filter) {
    case "trial":
      return sql`${s.status} = 'trialing' and ${s.trialEndsAt} > ${now}`;
    case "paying":
      return sql`${s.status} = 'active' and coalesce(${s.stripeStatus}, '') <> 'trialing'`;
    case "scheduled":
      return sql`${s.status} = 'active' and ${s.stripeStatus} = 'trialing'`;
    case "past_due":
      return sql`${s.status} = 'past_due' and ${s.graceUntil} > ${now}`;
    case "comped":
      return sql`${s.status} = 'comped'`;
    case "hidden":
      return sql`(${s.status} = 'expired'
        or (${s.status} = 'trialing' and (${s.trialEndsAt} is null or ${s.trialEndsAt} <= ${now}))
        or (${s.status} = 'past_due' and (${s.graceUntil} is null or ${s.graceUntil} <= ${now}))
        or (${s.status} = 'canceled' and (${s.currentPeriodEnd} is null or ${s.currentPeriodEnd} <= ${now})))`;
    default:
      return undefined;
  }
}

export const SUBSCRIPTION_FILTERS = ["all", "trial", "paying", "scheduled", "past_due", "hidden", "comped"] as const;
export type SubscriptionFilter = (typeof SUBSCRIPTION_FILTERS)[number];

/** Setup checklist + headline numbers for the admin billing page. */
export async function billingSummary(ctx: DalContext) {
  await requireAdmin(ctx);
  const now = nowOf(ctx);
  const e = env();
  const p = billing();
  const counts = Object.fromEntries(
    await Promise.all(
      (["trial", "paying", "scheduled", "past_due", "comped", "hidden"] as const).map(async (f) => {
        const [row] = await ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(subscriptions)
          .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
          .innerJoin(user, eq(user.id, businesses.ownerId))
          .where(and(isNull(businesses.deletedAt), sql`not ${isTestOwner}`, stateFilter(f, now)));
        return [f, row?.n ?? 0] as const;
      }),
    ),
  ) as Record<"trial" | "paying" | "scheduled" | "past_due" | "comped" | "hidden", number>;

  const paying = await ctx.db
    .select({ plan: subscriptionPlans.key, n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
    .where(and(isNull(businesses.deletedAt), sql`not ${isTestOwner}`, stateFilter("paying", now)))
    .groupBy(subscriptionPlans.key);
  const byPlan = { monthly: 0, yearly: 0 };
  let mrr = 0;
  for (const r of paying) {
    if (!isPlanKey(r.plan)) continue;
    byPlan[r.plan] += r.n;
    mrr += r.n * mrrMinor(PLANS[r.plan].interval, PLANS[r.plan].amountMinor);
  }

  const [ending] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .where(
      and(
        isNull(businesses.deletedAt),
        sql`not ${isTestOwner}`,
        stateFilter("trial", now),
        sql`${subscriptions.trialEndsAt} <= ${new Date(now.getTime() + 7 * 864e5)}`,
      ),
    );
  const [test] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .where(and(isNull(businesses.deletedAt), isTestOwner));

  return {
    setup: {
      provider: p.name,
      mode: p.mode,
      secretKey: !!e.STRIPE_SECRET_KEY,
      webhookSecret: !!e.STRIPE_WEBHOOK_SECRET,
      webhookPath: "/api/stripe/webhook",
      webhookEvents: [...STRIPE_WEBHOOK_EVENTS],
      tax: e.STRIPE_TAX_ENABLED === "true",
    },
    counts: {
      ...counts,
      trialEndingThisWeek: ending?.n ?? 0,
      payingMonthly: byPlan.monthly,
      payingYearly: byPlan.yearly,
    },
    mrrMinor: mrr,
    testBusinesses: test?.n ?? 0,
  };
}

const PAGE_SIZE = 25;

/** One page of subscriptions, newest businesses first (trials by end date). */
export async function listSubscriptions(ctx: DalContext, opts: { filter?: string; page?: number }) {
  await requireAdmin(ctx);
  const now = nowOf(ctx);
  const filter = (SUBSCRIPTION_FILTERS as readonly string[]).includes(opts.filter ?? "")
    ? (opts.filter as SubscriptionFilter)
    : "all";
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const rows = await ctx.db
    .select({
      sub: subscriptions,
      planKey: subscriptionPlans.key,
      businessId: businesses.id,
      nameTr: businesses.nameTr,
      nameEn: businesses.nameEn,
      type: businesses.type,
      ownerEmail: user.email,
      isTest: isTestOwner,
    })
    .from(subscriptions)
    .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
    .where(and(isNull(businesses.deletedAt), stateFilter(filter, now)))
    .orderBy(filter === "trial" ? asc(subscriptions.trialEndsAt) : desc(businesses.createdAt), asc(subscriptions.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return {
    filter,
    page,
    hasMore: rows.length > PAGE_SIZE,
    rows: rows.slice(0, PAGE_SIZE).map((r) => {
      const plan = isPlanKey(r.planKey) ? r.planKey : null;
      return {
        businessId: r.businessId,
        nameTr: r.nameTr,
        nameEn: r.nameEn,
        type: r.type,
        ownerEmail: r.ownerEmail,
        isTest: r.isTest,
        plan,
        stripeSubscriptionId: r.sub.stripeSubscriptionId,
        stripeCustomerId: r.sub.stripeCustomerId,
        state: billingState({ ...r.sub, plan }, now),
        canExtendTrial: !isPaying(r.sub.status, r.sub.stripeSubscriptionId) && r.sub.status !== "comped",
        canComp: r.sub.status !== "comped" && !isPaying(r.sub.status, r.sub.stripeSubscriptionId),
        canUncomp: r.sub.status === "comped",
      };
    }),
  };
}

/** A live paid subscription in Stripe: admins mustn't trial or comp over it (they'd double up). */
const isPaying = (status: string, stripeSubscriptionId: string | null) =>
  !!stripeSubscriptionId && (status === "active" || status === "past_due");

async function lockedSubscription(tx: Tx, businessId: string) {
  const [row] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1)
    .for("update");
  if (!row) throw new DalError("CONFLICT", "not_approved_yet");
  return row;
}

/** Gives a business more free time: from today or from its current trial end, whichever is later. */
export async function extendTrial(ctx: DalContext, businessId: string, days: number) {
  const admin = await requireAdmin(ctx);
  if (![7, 14, 30, 90].includes(days)) throw new DalError("INVALID");
  const now = nowOf(ctx);
  return ctx.db.transaction(async (tx) => {
    const row = await lockedSubscription(tx, businessId);
    if (row.status === "comped") throw new DalError("CONFLICT", "comped");
    if (isPaying(row.status, row.stripeSubscriptionId)) throw new DalError("CONFLICT", "has_paid_subscription");
    const from = row.trialEndsAt && row.trialEndsAt > now ? row.trialEndsAt : now;
    const trialEndsAt = new Date(from.getTime() + days * 864e5);
    await tx
      .update(subscriptions)
      .set({ status: "trialing", trialEndsAt, trialRemindersSent: [], graceUntil: null })
      .where(eq(subscriptions.id, row.id));
    await tx.insert(auditLog).values({
      actorId: admin.id,
      action: "billing.trial_extended",
      entity: "business",
      entityId: businessId,
      diff: { days, from: row.trialEndsAt?.toISOString() ?? null, to: trialEndsAt.toISOString() },
    });
    await refreshBusinessVisibility(tx, businessId, now);
    return { trialEndsAt };
  });
}

/** Complimentary: live with no payment, until an admin takes it back. */
export async function setComped(ctx: DalContext, businessId: string, comped: boolean) {
  const admin = await requireAdmin(ctx);
  const now = nowOf(ctx);
  return ctx.db.transaction(async (tx) => {
    const row = await lockedSubscription(tx, businessId);
    if (comped) {
      if (row.status === "comped") return { status: row.status };
      if (isPaying(row.status, row.stripeSubscriptionId)) throw new DalError("CONFLICT", "has_paid_subscription");
    } else if (row.status !== "comped") {
      return { status: row.status };
    }
    const status = comped ? "comped" : row.trialEndsAt && row.trialEndsAt > now ? "trialing" : "expired";
    await tx.update(subscriptions).set({ status, graceUntil: null }).where(eq(subscriptions.id, row.id));
    await tx.insert(auditLog).values({
      actorId: admin.id,
      action: comped ? "billing.comped" : "billing.uncomped",
      entity: "business",
      entityId: businessId,
      diff: { from: row.status, to: status },
    });
    await refreshBusinessVisibility(tx, businessId, now);
    return { status };
  });
}
