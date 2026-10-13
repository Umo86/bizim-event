"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, Notice, Select } from "@/components/ui/form";
import { businessSettingsStrict } from "@/lib/validation/business";
import { saveSettingsAction } from "@/server/actions/business";
import { useAutosave } from "../autosave";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";

export function SettingsForm({
  businessId,
  initial,
  currencies,
  timeZones,
  backHref,
  nextHref,
}: {
  businessId: string;
  initial: { currency: string; timezone: string };
  currencies: { code: string; label: string }[];
  timeZones: string[];
  backHref: string;
  nextHref: string;
}) {
  const t = useTranslations("fields");
  const [values, setValues] = useState(initial);
  const { errors, validate } = useStepValidation(businessSettingsStrict);
  const valid = businessSettingsStrict.safeParse(values).success;
  const { state, flush } = useAutosave(values, (v) => saveSettingsAction(businessId, v), { enabled: valid });

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="currency" label={t("currency")} error={errors.currency}>
          <Select value={values.currency} onChange={(e) => setValues((v) => ({ ...v, currency: e.target.value }))}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="timezone" label={t("timezone")} hint={t("timezoneHint")} error={errors.timezone}>
          <Select value={values.timezone} onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}>
            {timeZones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {values.currency !== initial.currency ? <Notice tone="warning">{t("currencyChangeWarning")}</Notice> : null}
      <StepActions
        state={state}
        backHref={backHref}
        nextHref={nextHref}
        onBeforeLeave={async () => (await flush()).ok}
        onContinue={async () => validate(values) && (await flush()).ok}
      />
    </form>
  );
}
