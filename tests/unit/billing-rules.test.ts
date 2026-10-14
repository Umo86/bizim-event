import { describe, expect, it } from "vitest";
import { formatPlanAmount, planForPrice, PLANS, YEARLY_MONTHS_PAID } from "@/lib/plans";
import {
  billingState,
  daysUntil,
  dueTrialReminder,
  firstPaymentAt,
  isSubscriptionInGoodStanding,
  mapStripeStatus,
  nextGraceUntil,
  type BillingRow,
} from "@/server/rules";

const now = new Date("2026-10-14T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 864e5);

const row = (over: Partial<BillingRow>): BillingRow => ({
  status: "trialing",
  trialEndsAt: days(60),
  currentPeriodEnd: null,
  graceUntil: null,
  stripeStatus: null,
  stripeSubscriptionId: null,
  cancelAtPeriodEnd: false,
  plan: null,
  ...over,
});

describe("plans", () => {
  it("are £6 a month and £60 a year, a year costing ten months", () => {
    expect(PLANS.monthly).toMatchObject({ interval: "month", amountMinor: 600 });
    expect(PLANS.yearly).toMatchObject({ interval: "year", amountMinor: 6000 });
    expect(YEARLY_MONTHS_PAID).toBe(10);
    expect(formatPlanAmount("monthly", "en")).toBe("£6");
    expect(formatPlanAmount("yearly", "tr")).toContain("60");
  });

  it("recognises a Stripe price by lookup key, else by interval", () => {
    expect(planForPrice({ lookup_key: "bizim_event_yearly_gbp" })).toBe("yearly");
    expect(planForPrice({ lookup_key: null, recurring: { interval: "month" } })).toBe("monthly");
    expect(planForPrice({ lookup_key: "something_else", recurring: { interval: "week" } })).toBeNull();
  });
});

describe("Stripe status → ours", () => {
  it("treats a plan chosen during the free trial as active (Stripe charges at trial end)", () => {
    expect(mapStripeStatus("trialing")).toBe("active");
    expect(mapStripeStatus("active")).toBe("active");
  });
  it("gives failed payments the grace period, and ignores checkouts still in progress", () => {
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("incomplete")).toBeNull();
    expect(mapStripeStatus("incomplete_expired")).toBeNull();
  });
  it("keeps an owner-cancelled plan live to the end of the period, but not one cancelled for non-payment", () => {
    expect(mapStripeStatus("canceled", "cancellation_requested")).toBe("canceled");
    expect(mapStripeStatus("canceled", null)).toBe("canceled");
    expect(mapStripeStatus("canceled", "payment_failed")).toBe("expired");
    expect(mapStripeStatus("canceled", "payment_disputed")).toBe("expired");
    expect(mapStripeStatus("paused")).toBe("expired");
  });
});

describe("grace period", () => {
  it("starts 7 days from the first failure and doesn't move on later failures", () => {
    const first = nextGraceUntil({ status: "active", graceUntil: null }, "past_due", now);
    expect(first).toEqual(days(7));
    const later = nextGraceUntil({ status: "past_due", graceUntil: first }, "past_due", days(3));
    expect(later).toEqual(first);
    expect(nextGraceUntil({ status: "past_due", graceUntil: first }, "active", days(3))).toBeNull();
  });

  it("keeps listings live during the grace period only", () => {
    const sub = { status: "past_due" as const, trialEndsAt: null, currentPeriodEnd: null, graceUntil: days(7) };
    expect(isSubscriptionInGoodStanding(sub, days(6))).toBe(true);
    expect(isSubscriptionInGoodStanding(sub, days(8))).toBe(false);
  });
});

describe("billing state", () => {
  it("free trial, with a warning in the last week", () => {
    expect(billingState(row({}), now)).toEqual({ kind: "trial", endsAt: days(60), daysLeft: 60, endingSoon: false });
    expect(billingState(row({ trialEndsAt: days(6.5) }), now)).toMatchObject({ daysLeft: 7, endingSoon: true });
  });

  it("an ended trial reads as ended before the daily job runs", () => {
    expect(billingState(row({ trialEndsAt: days(-1) }), now)).toEqual({ kind: "expired", reason: "trial_ended" });
  });

  it("plan chosen during the trial starts when the trial ends", () => {
    const r = row({
      status: "active",
      stripeStatus: "trialing",
      stripeSubscriptionId: "sub_1",
      plan: "yearly",
      currentPeriodEnd: days(60),
    });
    expect(billingState(r, now)).toEqual({ kind: "scheduled", plan: "yearly", startsAt: days(60) });
  });

  it("active, ending, past due, cancelled", () => {
    const base = { stripeSubscriptionId: "sub_1", plan: "monthly" as const, currentPeriodEnd: days(20) };
    expect(billingState(row({ ...base, status: "active", stripeStatus: "active" }), now)).toEqual({
      kind: "active",
      plan: "monthly",
      renewsAt: days(20),
    });
    expect(billingState(row({ ...base, status: "active", cancelAtPeriodEnd: true }), now)).toEqual({
      kind: "ending",
      plan: "monthly",
      endsAt: days(20),
    });
    expect(billingState(row({ ...base, status: "past_due", graceUntil: days(5) }), now)).toEqual({
      kind: "past_due",
      plan: "monthly",
      graceUntil: days(5),
    });
    expect(billingState(row({ ...base, status: "canceled" }), now)).toEqual({ kind: "canceled", liveUntil: days(20) });
  });

  it("explains why listings are hidden", () => {
    const paid = { stripeSubscriptionId: "sub_1", plan: "monthly" as const };
    expect(billingState(row({ ...paid, status: "past_due", graceUntil: days(-1) }), now)).toEqual({
      kind: "expired",
      reason: "payment_failed",
    });
    expect(billingState(row({ ...paid, status: "canceled", currentPeriodEnd: days(-1) }), now)).toEqual({
      kind: "expired",
      reason: "canceled",
    });
    expect(billingState(row({ status: "comped" }), now)).toEqual({ kind: "comped" });
  });
});

describe("first payment for a plan chosen now", () => {
  it("waits for the end of the free trial", () => {
    expect(firstPaymentAt(billingState(row({ trialEndsAt: days(60) }), now), now)).toEqual(days(60));
  });

  it("in the trial's last two days, waits the 48 hours Stripe needs (the extra time is free)", () => {
    const paidFrom = firstPaymentAt(billingState(row({ trialEndsAt: days(1) }), now), now)!;
    expect(paidFrom.getTime() - now.getTime()).toBe(49 * 3600e3);
  });

  it("is straight away once the trial is over, or after a cancelled plan", () => {
    expect(firstPaymentAt(billingState(row({ trialEndsAt: days(-1) }), now), now)).toBeNull();
    const cancelled = row({ status: "canceled", stripeSubscriptionId: "sub_1", currentPeriodEnd: days(20) });
    expect(firstPaymentAt(billingState(cancelled, now), now)).toBeNull();
  });
});

describe("trial reminders", () => {
  const trial = (left: number, sent: number[] = []) => ({
    status: "trialing" as const,
    trialEndsAt: days(left),
    trialRemindersSent: sent,
  });

  it("go out at 30, 7 and 1 days left, once each", () => {
    expect(dueTrialReminder(trial(45), now)).toBeNull();
    expect(dueTrialReminder(trial(30), now)).toEqual({ send: 30, markSent: [30] });
    expect(dueTrialReminder(trial(29, [30]), now)).toBeNull();
    expect(dueTrialReminder(trial(7, [30]), now)).toEqual({ send: 7, markSent: [30, 7] });
    expect(dueTrialReminder(trial(0.5, [30, 7]), now)).toEqual({ send: 1, markSent: [30, 7, 1] });
  });

  it("send only the most urgent one after a missed run", () => {
    expect(dueTrialReminder(trial(5), now)).toEqual({ send: 7, markSent: [30, 7] });
  });

  it("stop once the trial is over or a plan is chosen", () => {
    expect(dueTrialReminder(trial(-1), now)).toBeNull();
    expect(dueTrialReminder({ ...trial(5), status: "active" }, now)).toBeNull();
  });

  it("count whole days, rounding up", () => {
    expect(daysUntil(new Date(now.getTime() + 3 * 3600e3), now)).toBe(1);
    expect(daysUntil(days(-2), now)).toBe(0);
  });
});
