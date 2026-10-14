/**
 * Phase 3 billing against real Postgres: Stripe's view of a subscription applied to ours
 * (every transition, once), signed webhook events, owner checkout through the dev
 * simulator, admin tools, and the daily job's trial reminders.
 */
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { snapshotFromStripe, verifyStripeEvent, type SubscriptionSnapshot } from "@/lib/adapters/billing";
import { adminBillingDal, billingDal, type DalContext, type SessionUser } from "@/server/dal";
import { applySubscriptionSnapshot, handleStripeEvent } from "@/server/internal/billing";
import { runDailyJob } from "@/server/internal/daily-job";
import { refreshBusinessVisibility } from "@/server/internal/visibility";
import { freshTestDb, TEST_DATABASE_URL } from "../support/db";

const DAY = 864e5;
const NOW = new Date("2026-10-14T12:00:00Z");
const at = (days: number) => new Date(NOW.getTime() + days * DAY);
const secs = (d: Date) => Math.floor(d.getTime() / 1000);

describe.skipIf(!TEST_DATABASE_URL)("billing", () => {
  let db: DB;
  let close: () => Promise<void>;
  const u: Record<string, SessionUser> = {};
  const biz: Record<string, string> = {};
  const ctx = (who: string | null, now = NOW): DalContext => ({ db, user: who ? u[who] : null, now });

  async function makeUser(key: string, role: SessionUser["role"], email = `${key}@test.local`) {
    const [row] = await db.insert(s.user).values({ email, name: key, role, emailVerified: true }).returning();
    u[key] = { id: row.id, email: row.email, name: row.name, role, preferredLocale: "tr" };
  }

  /** An approved venue with one approved listing and the given subscription. */
  async function makeBusiness(
    key: string,
    owner: string,
    sub: Partial<typeof s.subscriptions.$inferInsert> | null,
    status: "approved" | "pending_review" = "approved",
  ) {
    const [org] = await db
      .insert(s.organization)
      .values({ name: key, slug: `${key}-org` })
      .returning();
    await db.insert(s.member).values({ organizationId: org.id, userId: u[owner].id, role: "owner" });
    const [b] = await db
      .insert(s.businesses)
      .values({
        ownerId: u[owner].id,
        organizationId: org.id,
        type: "venue",
        nameEn: key,
        nameTr: key,
        slug: key,
        status,
        countryIso2: "GB",
        timezone: "Europe/London",
        currency: "GBP",
      })
      .returning();
    biz[key] = b.id;
    await db.insert(s.listings).values({
      businessId: b.id,
      type: "venue",
      titleEn: `${key} hall`,
      slug: `${key}-hall`,
      status: status === "approved" ? "approved" : "pending_review",
      currency: "GBP",
    });
    if (sub) await db.insert(s.subscriptions).values({ businessId: b.id, status: "trialing", ...sub });
    await refreshBusinessVisibility(db, b.id, NOW);
    return b.id;
  }

  const subOf = async (key: string) =>
    (await db.select().from(s.subscriptions).where(eq(s.subscriptions.businessId, biz[key])))[0];
  const isLive = async (key: string) =>
    (await db.select({ p: s.listings.isPublic }).from(s.listings).where(eq(s.listings.businessId, biz[key])))[0].p;

  const snap = (key: string, over: Partial<SubscriptionSnapshot>): SubscriptionSnapshot => ({
    subscriptionId: `sub_${key}`,
    customerId: `cus_${key}`,
    businessId: biz[key],
    stripeStatus: "active",
    cancellationReason: null,
    plan: "monthly",
    currentPeriodEnd: at(30),
    cancelAtPeriodEnd: false,
    ...over,
  });
  const apply = (sn: SubscriptionSnapshot, now = NOW) => db.transaction((tx) => applySubscriptionSnapshot(tx, sn, now));

  beforeAll(async () => {
    ({ db, close } = await freshTestDb());
    await db.insert(s.countries).values({
      iso2: "GB",
      nameEn: "United Kingdom",
      nameTr: "İngiltere",
      slugEn: "united-kingdom",
      slugTr: "ingiltere",
      defaultCurrency: "GBP",
      distanceUnit: "mi",
    });
    await db.insert(s.subscriptionPlans).values([
      { key: "monthly", nameTr: "Aylık", nameEn: "Monthly", interval: "month" },
      { key: "yearly", nameTr: "Yıllık", nameEn: "Yearly", interval: "year" },
    ]);
    await makeUser("owner", "business");
    await makeUser("manager", "business");
    await makeUser("stranger", "business");
    await makeUser("admin", "admin");
    await makeUser("testOwner", "business", "venue99@bizimevent.test");
    await makeBusiness("trial", "owner", { trialStartedAt: at(-30), trialEndsAt: at(60) });
    const [org] = await db.select().from(s.organization).where(eq(s.organization.slug, "trial-org"));
    await db.insert(s.member).values({ organizationId: org.id, userId: u.manager.id, role: "member" });
  });
  afterAll(async () => close?.());

  describe("Stripe → our subscription", () => {
    it("a plan chosen during the free trial keeps the business live and starts at the trial end", async () => {
      await makeBusiness("chooser", "owner", { trialStartedAt: at(-10), trialEndsAt: at(80) });
      const res = await apply(snap("chooser", { stripeStatus: "trialing", plan: "yearly", currentPeriodEnd: at(80) }));
      expect(res?.notice).toMatchObject({ kind: "planScheduled", plan: "yearly" });
      const sub = await subOf("chooser");
      expect(sub).toMatchObject({ status: "active", stripeStatus: "trialing", stripeSubscriptionId: "sub_chooser" });
      expect(await isLive("chooser")).toBe(true);
      // The same state again (webhook + return page) sends nothing new.
      expect(
        (await apply(snap("chooser", { stripeStatus: "trialing", plan: "yearly", currentPeriodEnd: at(80) })))?.notice,
      ).toBeNull();
    });

    it("a failed renewal starts a 7-day grace period once, and recovery clears it", async () => {
      await makeBusiness("payer", "owner", { trialStartedAt: at(-200), trialEndsAt: at(-110) });
      await apply(snap("payer", {}));
      const failed = await apply(snap("payer", { stripeStatus: "past_due" }));
      expect(failed?.notice).toMatchObject({ kind: "paymentFailed", date: at(7) });
      expect((await subOf("payer")).graceUntil).toEqual(at(7));
      expect(await isLive("payer")).toBe(true);

      // Stripe retries and fails again 3 days later: same deadline, no second email.
      const again = await apply(snap("payer", { stripeStatus: "past_due" }), at(3));
      expect(again?.notice).toBeNull();
      expect((await subOf("payer")).graceUntil).toEqual(at(7));

      // After the grace period the listings hide, before any daily job runs.
      await refreshBusinessVisibility(db, biz.payer, at(8));
      expect(await isLive("payer")).toBe(false);

      const paid = await apply(snap("payer", { currentPeriodEnd: at(38) }), at(8));
      expect(paid?.notice).toMatchObject({ kind: "paymentRecovered" });
      expect((await subOf("payer")).graceUntil).toBeNull();
      expect(await isLive("payer")).toBe(true);
    });

    it("cancelling keeps the listings live until the period the owner paid for ends", async () => {
      await makeBusiness("leaver", "owner", { trialEndsAt: at(-100) });
      await apply(snap("leaver", {}));
      const scheduled = await apply(snap("leaver", { cancelAtPeriodEnd: true }));
      expect(scheduled?.notice).toMatchObject({ kind: "cancelScheduled", date: at(30) });
      const ended = await apply(
        snap("leaver", { stripeStatus: "canceled", cancellationReason: "cancellation_requested" }),
      );
      expect(ended?.notice).toMatchObject({ kind: "subscriptionEnded" });
      expect((await subOf("leaver")).status).toBe("canceled");
      expect(await isLive("leaver")).toBe(true);
      await refreshBusinessVisibility(db, biz.leaver, at(31));
      expect(await isLive("leaver")).toBe(false);
    });

    it("a subscription Stripe cancelled for non-payment ends straight away", async () => {
      await makeBusiness("unpaid", "owner", { trialEndsAt: at(-100) });
      await apply(snap("unpaid", { stripeStatus: "past_due" }));
      await apply(snap("unpaid", { stripeStatus: "canceled", cancellationReason: "payment_failed" }));
      expect((await subOf("unpaid")).status).toBe("expired");
      expect(await isLive("unpaid")).toBe(false);
    });

    it("never lets a second paid subscription replace the first, and records it for an admin", async () => {
      await makeBusiness("double", "owner", { trialEndsAt: at(-100) });
      await apply(snap("double", {}));
      const res = await apply(snap("double", { subscriptionId: "sub_double_2" }));
      expect(res).toBeNull();
      expect((await subOf("double")).stripeSubscriptionId).toBe("sub_double");
      const audits = await db.select().from(s.auditLog).where(eq(s.auditLog.action, "billing.duplicate_subscription"));
      expect(audits).toHaveLength(1);
    });

    it("a new plan takes over from one that ended; late news about the old one changes nothing", async () => {
      await makeBusiness("returner", "owner", { trialEndsAt: at(-100) });
      await apply(snap("returner", {}));
      await apply(snap("returner", { stripeStatus: "canceled", cancellationReason: "cancellation_requested" }));
      expect((await subOf("returner")).status).toBe("canceled");

      // Comes back with a new subscription: it replaces the ended one.
      const back = await apply(
        snap("returner", { subscriptionId: "sub_returner_2", plan: "yearly", currentPeriodEnd: at(365) }),
      );
      expect(back?.notice).toMatchObject({ kind: "subscriptionStarted" });
      expect(await subOf("returner")).toMatchObject({ status: "active", stripeSubscriptionId: "sub_returner_2" });

      // The new one is cancelled too; a late event about the first one must not bring back its dates.
      await apply(
        snap("returner", {
          subscriptionId: "sub_returner_2",
          stripeStatus: "canceled",
          cancellationReason: "cancellation_requested",
          currentPeriodEnd: at(365),
        }),
      );
      const late = await apply(
        snap("returner", { stripeStatus: "canceled", cancellationReason: "cancellation_requested" }),
      );
      expect(late).toBeNull();
      expect(await subOf("returner")).toMatchObject({
        stripeSubscriptionId: "sub_returner_2",
        currentPeriodEnd: at(365),
      });
    });

    it("a complimentary business stays complimentary", async () => {
      await makeBusiness("gift", "owner", { status: "comped" });
      await apply(snap("gift", { stripeStatus: "past_due" }));
      expect((await subOf("gift")).status).toBe("comped");
    });

    it("reads the period end from the subscription item and the business from metadata", () => {
      const sub = {
        id: "sub_x",
        customer: "cus_x",
        metadata: { businessId: "b1" },
        status: "trialing",
        cancellation_details: null,
        cancel_at: null,
        cancel_at_period_end: false,
        trial_end: secs(at(80)),
        items: { data: [{ current_period_end: secs(at(80)), price: { lookup_key: "bizim_event_yearly_gbp" } }] },
      } as unknown as Stripe.Subscription;
      expect(snapshotFromStripe(sub)).toEqual({
        subscriptionId: "sub_x",
        customerId: "cus_x",
        businessId: "b1",
        stripeStatus: "trialing",
        cancellationReason: null,
        plan: "yearly",
        currentPeriodEnd: new Date(secs(at(80)) * 1000),
        cancelAtPeriodEnd: false,
      });
    });
  });

  describe("webhooks", () => {
    const secret = "whsec_test_secret";
    const stripeSub = (key: string, status: string) =>
      ({
        id: `sub_${key}`,
        object: "subscription",
        customer: `cus_${key}`,
        metadata: { businessId: biz[key] },
        status,
        cancellation_details: null,
        cancel_at: null,
        cancel_at_period_end: false,
        trial_end: null,
        items: { data: [{ current_period_end: secs(at(30)), price: { lookup_key: "bizim_event_monthly_gbp" } }] },
      }) as unknown as Stripe.Subscription;
    const event = (id: string, type: string, object: unknown) =>
      ({ id, object: "event", type, data: { object }, created: secs(NOW), livemode: false }) as unknown as Stripe.Event;

    it("accepts only correctly signed events", async () => {
      const payload = JSON.stringify(event("evt_sig", "customer.subscription.updated", { id: "sub_1" }));
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
      await expect(verifyStripeEvent(payload, header, secret)).resolves.toMatchObject({ id: "evt_sig" });
      await expect(verifyStripeEvent(payload, header, "whsec_other")).rejects.toThrow();
      await expect(verifyStripeEvent(payload, null, secret)).rejects.toThrow();
    });

    it("applies each event once, re-reading the subscription from Stripe", async () => {
      await makeBusiness("hooked", "owner", { trialEndsAt: at(-5) });
      const reads: string[] = [];
      const retrieve = async (id: string) => {
        reads.push(id);
        return snapshotFromStripe(stripeSub("hooked", "active"));
      };
      const e = event("evt_1", "customer.subscription.created", stripeSub("hooked", "incomplete"));
      const first = await handleStripeEvent(db, e, retrieve, NOW);
      expect(first).toMatchObject({ status: "processed", result: { notice: { kind: "subscriptionStarted" } } });
      expect(reads).toEqual(["sub_hooked"]);
      expect(await isLive("hooked")).toBe(true);
      expect(await handleStripeEvent(db, e, retrieve, NOW)).toEqual({ status: "duplicate" });
    });

    it("finds the subscription behind an invoice, and ignores events it doesn't need", async () => {
      const reads: string[] = [];
      const retrieve = async (id: string) => {
        reads.push(id);
        return snapshotFromStripe(stripeSub("hooked", "past_due"));
      };
      const invoice = { id: "in_1", parent: { subscription_details: { subscription: "sub_hooked" } } };
      const res = await handleStripeEvent(db, event("evt_2", "invoice.payment_failed", invoice), retrieve, NOW);
      expect(res).toMatchObject({ status: "processed", result: { notice: { kind: "paymentFailed" } } });
      expect(reads).toEqual(["sub_hooked"]);
      expect(await handleStripeEvent(db, event("evt_3", "charge.refunded", {}), retrieve, NOW)).toEqual({
        status: "ignored",
      });
    });

    it("records nothing when handling fails, so Stripe's retry starts clean", async () => {
      const failing = async () => {
        throw new Error("Stripe is down");
      };
      const e = event("evt_fail", "customer.subscription.updated", stripeSub("hooked", "active"));
      await expect(handleStripeEvent(db, e, failing, NOW)).rejects.toThrow("Stripe is down");
      const rows = await db.select().from(s.processedWebhooks).where(eq(s.processedWebhooks.stripeEventId, "evt_fail"));
      expect(rows).toHaveLength(0);
    });
  });

  describe("owner billing (dev simulator)", () => {
    it("only owners see billing; managers and strangers don't", async () => {
      await expect(billingDal.getBilling(ctx("owner"), biz.trial)).resolves.toMatchObject({
        state: { kind: "trial", daysLeft: 60 },
        canChoosePlan: true,
        canManage: false,
        provider: { name: "dev" },
      });
      await expect(billingDal.getBilling(ctx("manager"), biz.trial)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(billingDal.getBilling(ctx("stranger"), biz.trial)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(billingDal.getBilling(ctx(null), biz.trial)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    });

    it("checkout during the trial carries the trial end, then the portal can cancel and resume", async () => {
      const opts = { locale: "tr" as const, baseUrl: "http://localhost:3000" };
      await expect(billingDal.openPortal(ctx("owner"), biz.trial, opts)).rejects.toMatchObject({
        message: "no_billing_account",
      });
      const { url } = await billingDal.startCheckout(ctx("owner"), biz.trial, "monthly", opts);
      expect(url).toMatch(/^\/tr\/dev\/checkout\?token=/);
      const token = new URL(url, "http://x").searchParams.get("token")!;
      const details = await billingDal.devCheckoutDetails(ctx("owner"), token);
      expect(details).toMatchObject({ plan: "monthly", trialEnd: at(60).toISOString() });
      await expect(billingDal.devCheckoutDetails(ctx("stranger"), token)).rejects.toMatchObject({ code: "FORBIDDEN" });

      const { result } = await billingDal.devCompleteCheckout(ctx("owner"), token);
      expect(result?.notice?.kind).toBe("planScheduled");
      const view = await billingDal.getBilling(ctx("owner"), biz.trial);
      expect(view).toMatchObject({
        state: { kind: "scheduled", plan: "monthly" },
        canChoosePlan: false,
        canManage: true,
      });
      await expect(billingDal.startCheckout(ctx("owner"), biz.trial, "yearly", opts)).rejects.toMatchObject({
        message: "already_subscribed",
      });

      const portal = await billingDal.openPortal(ctx("owner"), biz.trial, opts);
      const portalToken = new URL(portal.url, "http://x").searchParams.get("token")!;
      await billingDal.devPortalAction(ctx("owner"), portalToken, "cancel_at_period_end");
      expect((await billingDal.getBilling(ctx("owner"), biz.trial)).state).toMatchObject({ kind: "ending" });
      await billingDal.devPortalAction(ctx("owner"), portalToken, "resume");
      expect((await billingDal.getBilling(ctx("owner"), biz.trial)).state).toMatchObject({ kind: "scheduled" });
      await expect(billingDal.devPortalAction(ctx("owner"), portalToken, "drop_tables")).rejects.toMatchObject({
        code: "INVALID",
      });
    });

    it("plans can't be chosen before approval", async () => {
      await makeBusiness("waiting", "owner", null, "pending_review");
      await expect(
        billingDal.startCheckout(ctx("owner"), biz.waiting, "monthly", { locale: "en", baseUrl: "http://x" }),
      ).rejects.toMatchObject({ message: "not_approved_yet" });
      expect((await billingDal.getBilling(ctx("owner"), biz.waiting)).state).toBeNull();
    });

    it("ignores a return from checkout that isn't a Stripe session", async () => {
      expect(await billingDal.completeCheckout(ctx("owner"), biz.trial, "dev_whatever")).toBeNull();
    });
  });

  describe("admin tools", () => {
    it("are admin-only", async () => {
      for (const who of ["owner", "manager"]) {
        await expect(adminBillingDal.billingSummary(ctx(who))).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(adminBillingDal.extendTrial(ctx(who), biz.trial, 30)).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(adminBillingDal.setComped(ctx(who), biz.trial, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    });

    it("extends a trial from its end (or from today if it has ended) and brings listings back", async () => {
      await makeBusiness("lapsed", "owner", {
        trialStartedAt: at(-95),
        trialEndsAt: at(-5),
        trialRemindersSent: [30, 7, 1],
      });
      expect(await isLive("lapsed")).toBe(false);
      const res = await adminBillingDal.extendTrial(ctx("admin"), biz.lapsed, 14);
      expect(res.trialEndsAt).toEqual(at(14));
      expect(await subOf("lapsed")).toMatchObject({ status: "trialing", trialRemindersSent: [] });
      expect(await isLive("lapsed")).toBe(true);
      expect((await adminBillingDal.extendTrial(ctx("admin"), biz.lapsed, 7)).trialEndsAt).toEqual(at(21));
      await expect(adminBillingDal.extendTrial(ctx("admin"), biz.lapsed, 5)).rejects.toMatchObject({ code: "INVALID" });
      await expect(adminBillingDal.extendTrial(ctx("admin"), biz.payer, 30)).rejects.toMatchObject({
        message: "has_paid_subscription",
      });
    });

    it("makes a business free and takes it back", async () => {
      await makeBusiness("charity", "owner", { trialEndsAt: at(-20) });
      await adminBillingDal.setComped(ctx("admin"), biz.charity, true);
      expect(await isLive("charity")).toBe(true);
      await adminBillingDal.setComped(ctx("admin"), biz.charity, false);
      expect((await subOf("charity")).status).toBe("expired");
      expect(await isLive("charity")).toBe(false);
      const audits = await db
        .select({ action: s.auditLog.action })
        .from(s.auditLog)
        .where(eq(s.auditLog.entityId, biz.charity));
      expect(audits.map((a) => a.action)).toEqual(["billing.comped", "billing.uncomped"]);
    });

    it("counts MRR from paying businesses only, leaving test accounts out", async () => {
      await makeBusiness("yearlyPayer", "owner", { trialEndsAt: at(-100) });
      await apply(snap("yearlyPayer", { plan: "yearly", currentPeriodEnd: at(300) }));
      await makeBusiness("testPayer", "testOwner", { trialEndsAt: at(-100) });
      await apply(snap("testPayer", {}));
      const summary = await adminBillingDal.billingSummary(ctx("admin"));
      // Paying: "payer" and "double" (monthly) and "yearlyPayer"; plans starting after a trial,
      // cancelled, past-due and test businesses don't count.
      expect(summary.counts.payingMonthly).toBe(2);
      expect(summary.counts.payingYearly).toBe(1);
      expect(summary.mrrMinor).toBe(2 * 600 + 500);
      expect(summary.testBusinesses).toBe(1);
      expect(summary.setup).toMatchObject({ provider: "dev", secretKey: false, webhookPath: "/api/stripe/webhook" });

      const trials = await adminBillingDal.listSubscriptions(ctx("admin"), { filter: "trial" });
      expect(trials.rows.every((r) => r.state.kind === "trial")).toBe(true);
      const testRow = (await adminBillingDal.listSubscriptions(ctx("admin"), { filter: "paying" })).rows.find(
        (r) => r.businessId === biz.testPayer,
      );
      expect(testRow).toMatchObject({ isTest: true, canComp: false, canExtendTrial: false });
    });
  });

  describe("daily job", () => {
    it("sends each trial reminder once, at 30, 7 and 1 days left", async () => {
      await makeBusiness("reminded", "owner", { trialStartedAt: at(-60), trialEndsAt: at(30) });
      const sent: string[] = [];
      const deps = { send: async (kind: string, to: string) => void sent.push(`${kind}:${to}`), emailGapMs: 0 };
      await runDailyJob(db, NOW, deps);
      expect(sent.filter((x) => x === "trialEnding:owner@test.local").length).toBeGreaterThanOrEqual(1);
      expect((await subOf("reminded")).trialRemindersSent).toEqual([30]);
      sent.length = 0;
      await runDailyJob(db, at(1), deps);
      expect((await subOf("reminded")).trialRemindersSent).toEqual([30]);
      await runDailyJob(db, at(24), deps);
      expect((await subOf("reminded")).trialRemindersSent).toEqual([30, 7]);
    });
  });
});
