/**
 * Pure business rules (no I/O) — unit-tested in tests/unit/rules.test.ts.
 */

export type SubscriptionLike = {
  status: "trialing" | "active" | "past_due" | "canceled" | "expired" | "comped";
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
