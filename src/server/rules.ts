/**
 * Pure business rules (no I/O) — unit-tested in tests/unit/rules.test.ts and tests/unit/billing-rules.test.ts.
 */
import { GRACE_DAYS, MIN_STRIPE_TRIAL_HOURS, TRIAL_REMINDER_DAYS_LEFT, type PlanKey } from "@/lib/plans";

const DAY = 864e5;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired" | "comped";

export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceUntil: Date | null;
};

/**
 * Listings are public while the subscription is trialing (and the trial hasn't
 * ended), active, comped, or past_due within the 7-day grace period. A
 * cancelled subscription stays visible until current_period_end.
 * Time-based states are evaluated lazily so they're correct even before the
 * daily job tidies the rows.
 */
export function isSubscriptionInGoodStanding(sub: SubscriptionLike | null | undefined, now = new Date()): boolean {
  if (!sub) return false;
  switch (sub.status) {
    case "comped":
      return true;
    case "active":
      // Stripe moves an unpaid renewal to past_due, so active is always good standing.
      return true;
    case "trialing":
      return !!sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime();
    case "past_due":
      return !!sub.graceUntil && sub.graceUntil.getTime() > now.getTime();
    case "canceled":
      return !!sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now.getTime();
    case "expired":
    default:
      return false;
  }
}

/** The status the daily job should persist for a subscription at `now`. */
export function effectiveSubscriptionStatus(sub: SubscriptionLike, now = new Date()): SubscriptionLike["status"] {
  if (sub.status === "trialing" && sub.trialEndsAt && sub.trialEndsAt <= now) return "expired";
  if (sub.status === "past_due" && sub.graceUntil && sub.graceUntil <= now) return "expired";
  if (sub.status === "canceled" && (!sub.currentPeriodEnd || sub.currentPeriodEnd <= now)) return "expired";
  return sub.status;
}

export function computeListingIsPublic(input: {
  businessStatus: string;
  listingStatus: string;
  businessDeleted: boolean;
  listingDeleted: boolean;
  subscription: SubscriptionLike | null | undefined;
  now?: Date;
}): boolean {
  return (
    input.businessStatus === "approved" &&
    input.listingStatus === "approved" &&
    !input.businessDeleted &&
    !input.listingDeleted &&
    isSubscriptionInGoodStanding(input.subscription, input.now)
  );
}

/** A booking request past request_expires_at reads as expired before the daily job updates it. */
export function effectiveBookingStatus<T extends { status: string; requestExpiresAt: Date | null }>(
  booking: T,
  now = new Date(),
): T["status"] | "expired" {
  if (booking.status === "requested" && booking.requestExpiresAt && booking.requestExpiresAt <= now) return "expired";
  return booking.status;
}

/**
 * Adds N business days (Mon–Fri) in the given IANA time zone and returns the
 * instant at the end of that local day — used for the 2-business-day window.
 */
export function addBusinessDays(from: Date, days: number, timeZone: string): Date {
  const local = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    return { y: +get("year"), m: +get("month"), d: +get("day"), wd: get("weekday") };
  };
  let cursor = new Date(from);
  let added = 0;
  while (added < days) {
    cursor = new Date(cursor.getTime() + 864e5);
    const { wd } = local(cursor);
    if (wd !== "Sat" && wd !== "Sun") added++;
  }
  const { y, m, d } = local(cursor);
  // End of that local day: find the UTC instant for 23:59:59 local.
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59);
  const offsetMin = tzOffsetMinutes(new Date(guess), timeZone);
  return new Date(guess - offsetMin * 60_000);
}

/** Offset of `timeZone` from UTC at `at`, in minutes (e.g. +60 for BST). */
export function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => +parts.find((p) => p.type === t)!.value;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Day number of a trial (day 1 = approval day). */
export function trialDay(trialStartedAt: Date, now = new Date()): number {
  return Math.floor((now.getTime() - trialStartedAt.getTime()) / 864e5) + 1;
}

/** Monthly recurring revenue contribution in GBP minor units; yearly £60 counts as £5/month. */
export function mrrMinor(interval: "month" | "year", amountMinor: number): number {
  return interval === "year" ? Math.round(amountMinor / 12) : amountMinor;
}

// ── Billing ───────────────────────────────────────────────────────────────────

/** A subscription row as the billing screens see it. */
export type BillingRow = SubscriptionLike & {
  /** Stripe's own status, kept as reported ("trialing" while a chosen plan waits for the free trial to end). */
  stripeStatus: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  plan: PlanKey | null;
};

/** What the owner should be told about billing — one case per screen state. */
export type BillingState =
  | { kind: "trial"; endsAt: Date; daysLeft: number; endingSoon: boolean }
  | { kind: "scheduled"; plan: PlanKey | null; startsAt: Date }
  | { kind: "active"; plan: PlanKey | null; renewsAt: Date | null }
  | { kind: "ending"; plan: PlanKey | null; endsAt: Date | null }
  | { kind: "past_due"; plan: PlanKey | null; graceUntil: Date }
  | { kind: "canceled"; liveUntil: Date }
  | { kind: "expired"; reason: "trial_ended" | "payment_failed" | "canceled" }
  | { kind: "comped" };

/** Whole days left until `at`, rounded up (a trial ending in 3 hours has 1 day left). */
export function daysUntil(at: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((at.getTime() - now.getTime()) / DAY));
}

/** Derives the owner-facing billing state, evaluating time-based changes lazily. */
export function billingState(row: BillingRow, now = new Date()): BillingState {
  const status = effectiveSubscriptionStatus(row, now);
  switch (status) {
    case "comped":
      return { kind: "comped" };
    case "trialing": {
      const daysLeft = daysUntil(row.trialEndsAt!, now);
      return { kind: "trial", endsAt: row.trialEndsAt!, daysLeft, endingSoon: daysLeft <= 7 };
    }
    case "active":
      if (row.cancelAtPeriodEnd) return { kind: "ending", plan: row.plan, endsAt: row.currentPeriodEnd };
      if (row.stripeStatus === "trialing" && row.currentPeriodEnd && row.currentPeriodEnd > now) {
        return { kind: "scheduled", plan: row.plan, startsAt: row.currentPeriodEnd };
      }
      return { kind: "active", plan: row.plan, renewsAt: row.currentPeriodEnd };
    case "past_due":
      return { kind: "past_due", plan: row.plan, graceUntil: row.graceUntil! };
    case "canceled":
      return { kind: "canceled", liveUntil: row.currentPeriodEnd! };
    case "expired":
    default:
      if (!row.stripeSubscriptionId) return { kind: "expired", reason: "trial_ended" };
      if (row.graceUntil || row.status === "past_due") return { kind: "expired", reason: "payment_failed" };
      return { kind: "expired", reason: "canceled" };
  }
}

/**
 * Our status for a Stripe subscription status. A plan chosen during the free trial is
 * Stripe-"trialing" but already ours-"active": the card is on file and Stripe charges it
 * when the trial ends. `null` means "leave our status alone" (checkout still in progress).
 * A subscription Stripe cancelled because it couldn't collect payment ends straight away;
 * one the owner cancelled stays live until the end of the period they paid for.
 */
export function mapStripeStatus(
  stripeStatus: string,
  cancellationReason?: string | null,
): Exclude<SubscriptionStatus, "trialing" | "comped"> | null {
  switch (stripeStatus) {
    case "trialing":
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return cancellationReason === "payment_failed" || cancellationReason === "payment_disputed"
        ? "expired"
        : "canceled";
    case "paused":
      return "expired";
    default:
      return null;
  }
}

/** The grace deadline: set once when payment first fails, kept while it stays unpaid, cleared after. */
export function nextGraceUntil(
  previous: { status: SubscriptionStatus; graceUntil: Date | null },
  nextStatus: SubscriptionStatus,
  now = new Date(),
): Date | null {
  if (nextStatus !== "past_due") return null;
  if (previous.status === "past_due" && previous.graceUntil) return previous.graceUntil;
  return new Date(now.getTime() + GRACE_DAYS * DAY);
}

/**
 * Which trial reminder is due (30, 7 or 1 days left), if any. When several are due (the
 * daily job missed a run) only the most urgent goes out; all of them are marked as sent.
 * Only for free trials with no plan chosen yet.
 */
export function dueTrialReminder(
  sub: { status: SubscriptionStatus; trialEndsAt: Date | null; trialRemindersSent: number[] },
  now = new Date(),
): { send: number; markSent: number[] } | null {
  if (sub.status !== "trialing" || !sub.trialEndsAt || sub.trialEndsAt <= now) return null;
  const left = daysUntil(sub.trialEndsAt, now);
  const due = TRIAL_REMINDER_DAYS_LEFT.filter((d) => left <= d && !sub.trialRemindersSent.includes(d));
  if (due.length === 0) return null;
  return { send: Math.min(...due), markSent: [...sub.trialRemindersSent, ...due] };
}

/**
 * When the first payment falls for a plan chosen now. During the free trial it waits for the
 * trial to end; Stripe needs that date at least 48 hours ahead, so a plan chosen in the
 * trial's last two days starts a little later (the extra days are free). Otherwise the
 * owner pays straight away (null).
 */
export function firstPaymentAt(state: BillingState, now = new Date()): Date | null {
  if (state.kind !== "trial") return null;
  return new Date(Math.max(state.endsAt.getTime(), now.getTime() + MIN_STRIPE_TRIAL_HOURS * 3600e3));
}

export type BillingNoticeKind =
  | "planScheduled"
  | "subscriptionStarted"
  | "paymentFailed"
  | "paymentRecovered"
  | "cancelScheduled"
  | "subscriptionEnded";

type NoticeRow = {
  status: SubscriptionStatus;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  graceUntil: Date | null;
};

/**
 * The email (if any) a change to a subscription deserves. Computed from the row before and
 * after the change, so replaying the same Stripe state never sends the same email twice.
 */
export function billingNoticeFor(
  before: NoticeRow,
  after: NoticeRow,
): { kind: BillingNoticeKind; date: Date | null } | null {
  if (after.status === "active") {
    if (before.status === "past_due" || (before.status === "expired" && before.graceUntil)) {
      return { kind: "paymentRecovered", date: after.currentPeriodEnd };
    }
    if (before.status !== "active" || before.stripeSubscriptionId !== after.stripeSubscriptionId) {
      return after.stripeStatus === "trialing"
        ? { kind: "planScheduled", date: after.currentPeriodEnd }
        : { kind: "subscriptionStarted", date: after.currentPeriodEnd };
    }
    if (!before.cancelAtPeriodEnd && after.cancelAtPeriodEnd) {
      return { kind: "cancelScheduled", date: after.currentPeriodEnd };
    }
    return null;
  }
  if (after.status === "past_due" && before.status !== "past_due")
    return { kind: "paymentFailed", date: after.graceUntil };
  if (
    (after.status === "canceled" || after.status === "expired") &&
    (before.status === "active" || before.status === "past_due")
  ) {
    return { kind: "subscriptionEnded", date: after.status === "canceled" ? after.currentPeriodEnd : null };
  }
  return null;
}
