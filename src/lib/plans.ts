/**
 * The subscription offer, in one place: £6 a month or £60 a year per business page,
 * billed in GBP, after a 90-day free trial that starts when the business is approved.
 * Pure data — the seed, the pricing page, the billing page and Stripe all read it.
 */

export const PLAN_KEYS = ["monthly", "yearly"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const BILLING_CURRENCY = "GBP";

export const PLANS: Record<
  PlanKey,
  { interval: "month" | "year"; amountMinor: number; lookupKey: string; nameTr: string; nameEn: string }
> = {
  monthly: {
    interval: "month",
    amountMinor: 600,
    lookupKey: "bizim_event_monthly_gbp",
    nameTr: "Aylık",
    nameEn: "Monthly",
  },
  yearly: {
    interval: "year",
    amountMinor: 6000,
    lookupKey: "bizim_event_yearly_gbp",
    nameTr: "Yıllık",
    nameEn: "Yearly",
  },
};

/** A year on the yearly plan costs this many months of the monthly plan (10 → "2 months free"). */
export const YEARLY_MONTHS_PAID = PLANS.yearly.amountMinor / PLANS.monthly.amountMinor;

export const TRIAL_DAYS = 90;
/** After a failed renewal, listings stay live this long while Stripe retries the card. */
export const GRACE_DAYS = 7;
/** Trial reminders go out when this many days are left (30, 7 and 1). */
export const TRIAL_REMINDER_DAYS_LEFT = [30, 7, 1] as const;
/** Stripe only accepts a trial end at least 48 hours ahead; leave an hour's margin. */
export const MIN_STRIPE_TRIAL_HOURS = 49;

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === "string" && (PLAN_KEYS as readonly string[]).includes(v);
}

/** The plan a Stripe price stands for: by lookup key, else by billing interval. */
export function planForPrice(price: { lookup_key?: string | null; recurring?: { interval?: string } | null }) {
  const byKey = PLAN_KEYS.find((k) => PLANS[k].lookupKey === price.lookup_key);
  if (byKey) return byKey;
  const interval = price.recurring?.interval;
  return PLAN_KEYS.find((k) => PLANS[k].interval === interval) ?? null;
}

/** "£6" / "£60": whole pounds without decimals, in the visitor's language. */
export function formatPlanAmount(planKey: PlanKey, locale: "tr" | "en") {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    style: "currency",
    currency: BILLING_CURRENCY,
    maximumFractionDigits: 0,
  }).format(PLANS[planKey].amountMinor / 100);
}
