"use client";

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { businessInfoStrict } from "@/lib/validation/business";
import { saveBusinessInfoAction } from "@/server/actions/business";
import { useAutosave } from "../autosave";
import { BilingualField } from "../bilingual-field";
import { LogoUploader } from "../logo-uploader";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";

type Values = {
  nameTr: string;
  nameEn: string;
  descriptionTr: string;
  descriptionEn: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
};

export function BusinessInfoForm({
  businessId,
  initial,
  logoUrl,
  translateEnabled,
  nextHref,
  phoneCountry,
}: {
  businessId: string;
  initial: Values;
  logoUrl: string | null;
  translateEnabled: boolean;
  nextHref: string;
  /** Country used to read national phone numbers before an address is saved. */
  phoneCountry: string;
}) {
  const t = useTranslations("fields");
  const ta = useTranslations("actionErrors");
  const [values, setValues] = useState<Values>(initial);
  const { validate, withServerInvalid } = useStepValidation(businessInfoStrict);
  const { state, invalid, flush } = useAutosave(values, (v) =>
    saveBusinessInfoAction(businessId, { ...v, phoneCountry }),
  );
  const [error, setError] = useState<string | null>(null);
  const shown = withServerInvalid(invalid, {
    phone: "phone_invalid",
    email: "invalid_email",
    website: "invalid_url",
    instagram: "invalid_instagram",
  });
  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const locale = useLocale();

  // Show how a number without a country code will be read (same rule as the server),
  // so "030 …" typed in the wrong country is caught before it's saved.
  const phonePreview = useMemo(() => {
    const parsed = values.phone.trim()
      ? parsePhoneNumberFromString(values.phone, phoneCountry as CountryCode)
      : undefined;
    if (!parsed?.isValid()) return null;
    let country: string = parsed.country ?? "";
    try {
      country = (parsed.country && new Intl.DisplayNames([locale], { type: "region" }).of(parsed.country)) || country;
    } catch {
      // Unknown region code: show the code itself.
    }
    return { number: parsed.formatInternational(), country };
  }, [values.phone, phoneCountry, locale]);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-8">
      <BilingualField
        id="name"
        label={t("businessName")}
        valueTr={values.nameTr}
        valueEn={values.nameEn}
        onChange={(lang, v) => setValues((s) => ({ ...s, [lang === "tr" ? "nameTr" : "nameEn"]: v }))}
        maxLength={120}
        error={shown.nameTr ?? shown.nameEn}
        translateEnabled={translateEnabled}
      />
      <BilingualField
        id="description"
        label={t("businessDescription")}
        hint={t("descriptionHint")}
        multiline
        maxLength={5000}
        valueTr={values.descriptionTr}
        valueEn={values.descriptionEn}
        onChange={(lang, v) => setValues((s) => ({ ...s, [lang === "tr" ? "descriptionTr" : "descriptionEn"]: v }))}
        error={shown.descriptionTr ?? shown.descriptionEn}
        translateEnabled={translateEnabled}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Field id="phone" label={t("phone")} hint={t("phoneHint")} error={shown.phone}>
            <Input type="tel" autoComplete="tel" inputMode="tel" value={values.phone} onChange={set("phone")} />
          </Field>
          <p className="mt-1.5 min-h-5 text-sm text-ink" aria-live="polite">
            {phonePreview && !shown.phone ? t("phoneReadAs", phonePreview) : null}
          </p>
        </div>
        <Field id="email" label={t("email")} error={shown.email}>
          <Input type="email" autoComplete="email" value={values.email} onChange={set("email")} />
        </Field>
        <Field id="website" label={t("website")} optional optionalLabel={t("optional")} error={shown.website}>
          <Input
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            value={values.website}
            onChange={set("website")}
          />
        </Field>
        <Field id="instagram" label={t("instagram")} optional optionalLabel={t("optional")} error={shown.instagram}>
          <Input value={values.instagram} placeholder="@" onChange={set("instagram")} />
        </Field>
      </div>
      <LogoUploader businessId={businessId} initialUrl={logoUrl} />
      <StepActions
        state={state}
        error={error}
        nextHref={nextHref}
        onBeforeLeave={async () => (await flush()).ok}
        onContinue={async () => {
          setError(null);
          if (!validate(values)) return false;
          const r = await flush();
          if (!r.ok) setError(ta.has(r.error ?? "") ? ta(r.error!) : ta("UNKNOWN"));
          return r.ok && r.invalid.length === 0;
        }}
      />
    </form>
  );
}
