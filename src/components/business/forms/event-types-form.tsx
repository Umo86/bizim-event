"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ChipGroup, Group } from "@/components/ui/form";
import { listingEventTypesStrict } from "@/lib/validation/listing";
import { saveListingSectionAction } from "@/server/actions/listing";
import type { ListingEditorData, ListingFormOptions } from "@/server/dal/listing-write";
import { useAutosave } from "../autosave";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";

export function EventTypesForm({
  data,
  options,
  backHref,
  nextHref,
  nextLabel,
}: {
  data: ListingEditorData;
  options: ListingFormOptions;
  backHref?: string | null;
  nextHref?: string | null;
  nextLabel?: string;
}) {
  const t = useTranslations("fields");
  const ta = useTranslations("actionErrors");
  const locale = useLocale() as "tr" | "en";
  const [values, setValues] = useState({ eventTypeKeys: data.eventTypeKeys });
  const { errors, validate } = useStepValidation(listingEventTypesStrict);
  const { state, flush } = useAutosave(values, (v) => saveListingSectionAction(data.listing.id, "event-types", v));
  const [error, setError] = useState<string | null>(null);
  const toOption = (e: ListingFormOptions["eventTypes"][number]) => ({
    value: e.key,
    label: locale === "tr" ? e.labelTr : e.labelEn,
  });
  const cultural = options.eventTypes.filter((e) => e.isTurkishCultural);
  const other = options.eventTypes.filter((e) => !e.isTurkishCultural);
  const allKeys = options.eventTypes.map((e) => e.key);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-8">
      <Group legend={t("turkishCelebrations")} error={errors.eventTypeKeys}>
        <ChipGroup
          name="eventTypes-cultural"
          options={cultural.map(toOption)}
          value={values.eventTypeKeys}
          onChange={(v) => setValues({ eventTypeKeys: v })}
        />
      </Group>
      <Group legend={t("otherEvents")}>
        <ChipGroup
          name="eventTypes-other"
          options={other.map(toOption)}
          value={values.eventTypeKeys}
          onChange={(v) => setValues({ eventTypeKeys: v })}
        />
      </Group>
      <button
        type="button"
        className="text-sm font-semibold text-primary-strong hover:underline"
        onClick={() => setValues({ eventTypeKeys: allKeys })}
      >
        {t("selectAll")}
      </button>
      <StepActions
        state={state}
        error={error}
        backHref={backHref}
        nextHref={nextHref}
        nextLabel={nextLabel}
        onBeforeLeave={async () => (await flush()).ok}
        onContinue={async () => {
          setError(null);
          if (!validate(values)) return false;
          const r = await flush();
          if (!r.ok) setError(ta.has(r.error ?? "") ? ta(r.error!) : ta("UNKNOWN"));
          return r.ok;
        }}
      />
    </form>
  );
}
