"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPlanAmount, PLAN_KEYS, PLANS, type PlanKey } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { openPortalAction, startCheckoutAction } from "@/server/actions/billing";

/**
 * Monthly or yearly → Stripe Checkout. During the free trial the first charge waits for
 * the trial to end; after it, the plan starts (and the listings go live) on payment.
 * `note` says when the first payment falls (worked out on the server).
 */
export function PlanPicker({ businessId, note }: { businessId: string; note: string }) {
  const t = useTranslations("billing");
  const ta = useTranslations("actionErrors");
  const locale = useLocale() as "tr" | "en";
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: PlanKey) {
    setBusy(plan);
    setError(null);
    const res = await startCheckoutAction(businessId, plan, locale);
    if (res.ok) {
      window.location.assign(res.data.url);
      return;
    }
    setError(ta.has(res.error) ? ta(res.error) : ta("UNKNOWN"));
    setBusy(null);
  }

  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {PLAN_KEYS.map((plan) => {
          const yearly = plan === "yearly";
          const per = PLANS[plan].interval === "month" ? t("perMonth") : t("perYear");
          const amount = formatPlanAmount(plan, locale);
          return (
            <li
              key={plan}
              className={cn(
                "flex flex-col rounded-2xl border p-6",
                yearly ? "border-primary-strong bg-primary-soft/40" : "border-line",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-lg font-bold text-ink">
                  {locale === "tr" ? PLANS[plan].nameTr : PLANS[plan].nameEn}
                </h3>
                {yearly ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {t("yearlySaving")}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-ink">
                {locale === "tr" ? <span className="mr-1.5 text-muted">{per}</span> : null}
                <span className="font-heading text-4xl font-extrabold">{amount}</span>
                {locale === "en" ? <span className="ml-1.5 text-muted">{per}</span> : null}
              </p>
              <Button
                type="button"
                variant={yearly ? "cta" : "outline"}
                className="mt-6"
                disabled={busy !== null}
                onClick={() => choose(plan)}
              >
                {busy === plan ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy === plan ? t("redirecting") : yearly ? t("chooseYearly") : t("chooseMonthly")}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted">{note}</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Opens Stripe's Customer Portal. */
export function ManageBillingButton({
  businessId,
  variant = "primary",
}: {
  businessId: string;
  variant?: "primary" | "outline";
}) {
  const t = useTranslations("billing");
  const ta = useTranslations("actionErrors");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        variant={variant}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await openPortalAction(businessId, locale);
          if (res.ok) {
            window.location.assign(res.data.url);
            return;
          }
          setError(ta.has(res.error) ? ta(res.error) : ta("UNKNOWN"));
          setBusy(false);
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("manage")}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
