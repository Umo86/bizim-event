"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AffixInput } from "@/components/ui/input";
import { CheckRow, Field, Group, RadioCards } from "@/components/ui/form";
import { PRICE_SESSIONS, PRICING_MODELS_BY_TYPE, type ListingType, type PricingModel } from "@/lib/listing-config";
import { listingPricingStrict } from "@/lib/validation/listing";
import { saveListingSectionAction } from "@/server/actions/listing";
import type { ListingEditorData } from "@/server/dal/listing-write";
import { useAutosave } from "../autosave";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";

const DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function currencySymbol(currency: string, locale: string) {
  try {
    return (
      new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

export function PricingForm({
  data,
  backHref,
  nextHref,
  nextLabel,
}: {
  data: ListingEditorData;
  backHref?: string | null;
  nextHref?: string | null;
  nextLabel?: string;
}) {
  const t = useTranslations("fields");
  const to = useTranslations("options");
  const ta = useTranslations("actionErrors");
  const locale = useLocale();
  const type = data.listing.type as ListingType;
  const symbol = currencySymbol(data.listing.currency, locale);

  const [values, setValues] = useState({
    pricingModel: (data.listing.pricingModel ?? null) as PricingModel | null,
    priceFrom: str(data.listing.priceFrom),
    depositPercent: str(data.listing.depositPercent),
    bookingRequestsEnabled: data.listing.bookingRequestsEnabled,
    travelFee: str(data.performer?.travelFee),
    grid: Object.fromEntries(data.weeklyPrices.map((p) => [`${p.dayOfWeek}-${p.session}`, String(p.price)])) as Record<
      string,
      string
    >,
  });
  type V = typeof values;
  const schema = useMemo(() => listingPricingStrict(type), [type]);
  const { errors, validate, withServerInvalid } = useStepValidation(schema);
  const { state, invalid, flush } = useAutosave(values, (v) =>
    saveListingSectionAction(data.listing.id, "pricing", payload(v, type)),
  );
  const [error, setError] = useState<string | null>(null);
  const shown = withServerInvalid(invalid);
  const set = <K extends keyof V>(key: K, value: V[K]) => setValues((v) => ({ ...v, [key]: value }));
  const needsPrice = values.pricingModel && values.pricingModel !== "custom_quote";

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-8">
      <Group legend={t("pricingModel")} error={shown.pricingModel}>
        <RadioCards
          name="pricingModel"
          columns={2}
          value={values.pricingModel}
          onChange={(v) => set("pricingModel", v)}
          options={PRICING_MODELS_BY_TYPE[type].map((m) => ({
            value: m,
            label: to(`pricingModel.${m}`),
            description: to(`pricingModelHint.${m}`),
          }))}
        />
      </Group>

      {needsPrice ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="price-from" label={t("priceFrom")} hint={t("priceFromHint")} error={shown.priceFrom}>
            <AffixInput
              type="number"
              min={0}
              step="1"
              inputMode="decimal"
              prefix={symbol}
              suffix={to(`priceSuffix.${values.pricingModel}`)}
              value={values.priceFrom}
              onChange={(e) => set("priceFrom", e.target.value)}
            />
          </Field>
          <Field
            id="deposit"
            label={t("deposit")}
            hint={t("depositHint")}
            optional
            optionalLabel={t("optional")}
            error={shown.depositPercent}
          >
            {/* Turkish writes the percent sign first: %25 */}
            <AffixInput
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              {...(locale === "tr" ? { prefix: "%" } : { suffix: "%" })}
              value={values.depositPercent}
              onChange={(e) => set("depositPercent", e.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {type === "performer" ? (
        <Field
          id="travel-fee"
          label={t("travelFee")}
          optional
          optionalLabel={t("optional")}
          error={shown.travelFee}
          className="max-w-xs"
        >
          <AffixInput
            type="number"
            min={0}
            inputMode="decimal"
            prefix={symbol}
            value={values.travelFee}
            onChange={(e) => set("travelFee", e.target.value)}
          />
        </Field>
      ) : null}

      {type === "venue" && needsPrice ? (
        <Group legend={t("weeklyPrices")} hint={t("weeklyPricesHint", { currency: data.listing.currency })}>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-section">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink" />
                  {PRICE_SESSIONS.map((s) => (
                    <th key={s} scope="col" className="px-3 py-2 text-left font-semibold text-ink">
                      {to(`session.${s}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d} className="border-t border-line">
                    <th scope="row" className="px-3 py-1.5 text-left font-medium text-ink">
                      {to(`day.${d}`)}
                    </th>
                    {PRICE_SESSIONS.map((s) => {
                      const key = `${d}-${s}`;
                      return (
                        <td key={s} className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            aria-label={`${to(`day.${d}`)} — ${to(`session.${s}`)}`}
                            value={values.grid[key] ?? ""}
                            onChange={(e) => set("grid", { ...values.grid, [key]: e.target.value })}
                            className="h-10 w-full min-w-20 rounded-lg border border-line px-2 text-right focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Group>
      ) : null}

      <CheckRow
        id="booking-requests"
        label={t("bookingRequests")}
        hint={t("bookingRequestsHint")}
        checked={values.bookingRequestsEnabled}
        onChange={(v) => set("bookingRequestsEnabled", v)}
      />

      <StepActions
        state={state}
        error={error}
        backHref={backHref}
        nextHref={nextHref}
        nextLabel={nextLabel}
        onBeforeLeave={async () => (await flush()).ok}
        onContinue={async () => {
          setError(null);
          if (!validate(payload(values, type))) return false;
          const r = await flush();
          if (!r.ok) setError(ta.has(r.error ?? "") ? ta(r.error!) : ta("UNKNOWN"));
          return r.ok && r.invalid.length === 0;
        }}
      />
      {errors._form ? <p className="text-sm text-danger">{errors._form}</p> : null}
    </form>
  );
}

function payload(
  v: {
    pricingModel: PricingModel | null;
    priceFrom: string;
    depositPercent: string;
    bookingRequestsEnabled: boolean;
    travelFee: string;
    grid: Record<string, string>;
  },
  type: ListingType,
) {
  const base = {
    pricingModel: v.pricingModel ?? undefined,
    priceFrom: v.pricingModel === "custom_quote" ? "" : v.priceFrom,
    depositPercent: v.depositPercent,
    bookingRequestsEnabled: v.bookingRequestsEnabled,
  };
  if (type === "venue") {
    const weeklyPrices = Object.entries(v.grid)
      .filter(([, price]) => price !== "" && Number(price) > 0)
      .map(([key, price]) => {
        const [day, session] = key.split("-");
        return { dayOfWeek: Number(day), session, price: Number(price) };
      });
    return { ...base, weeklyPrices };
  }
  if (type === "performer") return { ...base, travelFee: v.travelFee };
  return base;
}
