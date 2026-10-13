"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

const RATES = [0.1, 0.125, 0.15] as const;
const YEARLY_FEE = 60;

/**
 * The page's one memorable element: what a commission would cost a business
 * a year, next to our flat £60. Inputs stay deliberately simple.
 */
export function CommissionCalculator() {
  const t = useTranslations("businessLanding");
  const locale = useLocale() as "tr" | "en";
  const id = useId();
  const [value, setValue] = useState("6000");
  const [bookings, setBookings] = useState("20");
  const [rate, setRate] = useState<(typeof RATES)[number]>(0.125);

  const v = Math.max(0, Number(value) || 0);
  const n = Math.max(0, Math.round(Number(bookings) || 0));
  const commission = v * n * rate;
  const saving = Math.max(0, commission - YEARLY_FEE);
  const money = (x: number) => formatMoney(Math.round(x), "GBP", locale);
  const pct = (r: number) =>
    new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "percent", maximumFractionDigits: 1 }).format(
      r,
    );

  return (
    <div className="rounded-3xl bg-white p-6 text-ink shadow-card sm:p-8">
      <h2 className="font-heading text-2xl font-bold">{t("calcTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{t("calcBody")}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${id}-v`} className="space-y-1.5">
          <span className="block text-sm font-semibold">{t("calcBookingValue")}</span>
          <input
            id={`${id}-v`}
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 w-full rounded-xl border border-line px-3 text-lg font-semibold focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label htmlFor={`${id}-n`} className="space-y-1.5">
          <span className="block text-sm font-semibold">{t("calcBookings")}</span>
          <input
            id={`${id}-n`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={bookings}
            onChange={(e) => setBookings(e.target.value)}
            className="h-12 w-full rounded-xl border border-line px-3 text-lg font-semibold focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">{t("calcRate")}</legend>
        <div className="mt-2 flex gap-2">
          {RATES.map((r) => (
            <label
              key={r}
              className={cn(
                "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-strong",
                rate === r ? "border-primary-strong bg-primary-soft text-primary-deeper" : "border-line",
              )}
            >
              <input
                type="radio"
                name={`${id}-rate`}
                className="sr-only"
                checked={rate === r}
                onChange={() => setRate(r)}
              />
              {pct(r)}
            </label>
          ))}
        </div>
      </fieldset>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6" aria-live="polite">
        <div>
          <dt className="text-sm text-muted">{t("calcCommission")}</dt>
          <dd className="mt-1 font-heading text-3xl font-extrabold text-cta-strong tabular-nums">
            {money(commission)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t("calcOurs")}</dt>
          <dd className="mt-1 font-heading text-3xl font-extrabold text-primary-strong tabular-nums">
            {money(YEARLY_FEE)}
          </dd>
        </div>
      </dl>
      {saving > 0 ? <p className="mt-4 font-semibold text-ink">{t("calcSaving", { amount: money(saving) })}</p> : null}
      <p className="mt-2 text-xs text-muted">{t("calcFootnote")}</p>
    </div>
  );
}
