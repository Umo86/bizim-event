"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Group, RadioCards } from "@/components/ui/form";
import { listingCancellationStrict } from "@/lib/validation/listing";
import { saveListingSectionAction } from "@/server/actions/listing";
import type { ListingEditorData } from "@/server/dal/listing-write";
import { useAutosave } from "../autosave";
import { BilingualField } from "../bilingual-field";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";

type PolicyKey = "flexible" | "moderate" | "strict" | "custom";

export function CancellationForm({
  data,
  policies,
  translateEnabled,
  backHref,
  nextHref,
  nextLabel,
}: {
  data: ListingEditorData;
  policies: { key: string; nameTr: string; nameEn: string; termsTr: string; termsEn: string }[];
  translateEnabled: boolean;
  backHref?: string | null;
  nextHref?: string | null;
  nextLabel?: string;
}) {
  const t = useTranslations("fields");
  const to = useTranslations("options");
  const ta = useTranslations("actionErrors");
  const locale = useLocale() as "tr" | "en";
  const [values, setValues] = useState({
    policyKey: (data.cancellation.policyKey ?? null) as PolicyKey | null,
    customTermsTr: data.cancellation.customTermsTr ?? "",
    customTermsEn: data.cancellation.customTermsEn ?? "",
  });
  const { errors, validate } = useStepValidation(listingCancellationStrict);
  const ready =
    values.policyKey && (values.policyKey !== "custom" || values.customTermsTr.trim() || values.customTermsEn.trim());
  const { state, flush } = useAutosave(
    values,
    (v) => saveListingSectionAction(data.listing.id, "cancellation", { ...v, policyKey: v.policyKey ?? undefined }),
    {
      enabled: !!ready,
    },
  );
  const [error, setError] = useState<string | null>(null);
  const order = ["flexible", "moderate", "strict"];
  const standard = [...policies].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-8">
      <Group legend={t("cancellationPolicy")} error={errors.policyKey}>
        <RadioCards
          name="policy"
          columns={1}
          value={values.policyKey}
          onChange={(key) => setValues((v) => ({ ...v, policyKey: key }))}
          options={[
            ...standard.map((p) => ({
              value: p.key as PolicyKey,
              label: locale === "tr" ? p.nameTr : p.nameEn,
              description: locale === "tr" ? p.termsTr : p.termsEn,
            })),
            { value: "custom" as PolicyKey, label: to("cancellation.custom"), description: t("customTermsHint") },
          ]}
        />
      </Group>
      {values.policyKey === "custom" ? (
        <BilingualField
          id="custom-terms"
          label={t("customTerms")}
          multiline
          maxLength={3000}
          valueTr={values.customTermsTr}
          valueEn={values.customTermsEn}
          onChange={(lang, v) => setValues((s) => ({ ...s, [lang === "tr" ? "customTermsTr" : "customTermsEn"]: v }))}
          error={errors.customTermsTr}
          translateEnabled={translateEnabled}
        />
      ) : null}
      <StepActions
        state={state}
        error={error}
        backHref={backHref}
        nextHref={nextHref}
        nextLabel={nextLabel}
        onBeforeLeave={async () => (ready ? (await flush()).ok : true)}
        onContinue={async () => {
          setError(null);
          if (!validate({ ...values, policyKey: values.policyKey ?? undefined })) return false;
          const r = await flush();
          if (!r.ok) setError(ta.has(r.error ?? "") ? ta(r.error!) : ta("UNKNOWN"));
          return r.ok;
        }}
      />
    </form>
  );
}
