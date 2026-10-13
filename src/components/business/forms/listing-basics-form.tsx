"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ChipGroup, Field, Group, RadioCards, Select } from "@/components/ui/form";
import { AREA_TYPES, CAPACITY_LAYOUTS, type ListingType } from "@/lib/listing-config";
import { listingBasicsStrict } from "@/lib/validation/listing";
import { saveListingSectionAction } from "@/server/actions/listing";
import type { ListingEditorData, ListingFormOptions } from "@/server/dal/listing-write";
import { useAutosave } from "../autosave";
import { BilingualField } from "../bilingual-field";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function ListingBasicsForm({
  data,
  options,
  translateEnabled,
  backHref,
  nextHref,
  nextLabel,
}: {
  data: ListingEditorData;
  options: ListingFormOptions;
  translateEnabled: boolean;
  backHref?: string | null;
  nextHref?: string | null;
  nextLabel?: string;
}) {
  const t = useTranslations("fields");
  const to = useTranslations("options");
  const ta = useTranslations("actionErrors");
  const locale = useLocale() as "tr" | "en";
  const type = data.listing.type as ListingType;
  const label = (o: { labelTr: string; labelEn: string }) => (locale === "tr" ? o.labelTr : o.labelEn);

  const [values, setValues] = useState({
    titleTr: data.listing.titleTr ?? "",
    titleEn: data.listing.titleEn ?? "",
    descriptionTr: data.listing.descriptionTr ?? "",
    descriptionEn: data.listing.descriptionEn ?? "",
    areaType: data.venue?.areaType ?? null,
    venueTypeKey: data.venue?.venueTypeKey ?? "",
    capacities: Object.fromEntries(CAPACITY_LAYOUTS.map((l) => [l, str(data.capacities[l])])) as Record<
      (typeof CAPACITY_LAYOUTS)[number],
      string
    >,
    minGuests: str(data.listing.minGuests ?? data.caterer?.minGuests),
    maxGuests: str(data.listing.maxGuests),
    cuisines: data.caterer?.cuisines ?? [],
    serviceStyles: data.caterer?.serviceStyles ?? [],
    actTypes: data.performer?.actTypes ?? [],
    languages: data.performer?.languages ?? [],
    setLengthMinutes: str(data.performer?.setLengthMinutes),
    setsPerEvent: str(data.performer?.setsPerEvent),
    membersCount: str(data.performer?.membersCount),
  });
  type V = typeof values;
  const schema = useMemo(() => listingBasicsStrict(type), [type]);
  const { validate, withServerInvalid } = useStepValidation(schema);
  const { state, invalid, flush } = useAutosave(values, (v) =>
    saveListingSectionAction(data.listing.id, "listing", payload(v, type)),
  );
  const [error, setError] = useState<string | null>(null);
  const shown = withServerInvalid(invalid);
  const set = <K extends keyof V>(key: K, value: V[K]) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-8">
      <BilingualField
        id="title"
        label={t(`listingTitle_${type}`)}
        hint={t("listingTitleHint")}
        valueTr={values.titleTr}
        valueEn={values.titleEn}
        maxLength={140}
        onChange={(lang, v) => set(lang === "tr" ? "titleTr" : "titleEn", v)}
        error={shown.titleTr ?? shown.titleEn}
        translateEnabled={translateEnabled}
      />
      <BilingualField
        id="listing-description"
        label={t("listingDescription")}
        hint={t("descriptionHint")}
        multiline
        maxLength={8000}
        valueTr={values.descriptionTr}
        valueEn={values.descriptionEn}
        onChange={(lang, v) => set(lang === "tr" ? "descriptionTr" : "descriptionEn", v)}
        error={shown.descriptionTr ?? shown.descriptionEn}
        translateEnabled={translateEnabled}
      />

      {type === "venue" ? (
        <>
          <Group legend={t("areaType")} error={shown.areaType}>
            <RadioCards
              name="areaType"
              columns={2}
              value={values.areaType}
              onChange={(v) => set("areaType", v)}
              options={AREA_TYPES.map((a) => ({ value: a, label: to(`areaType.${a}`) }))}
            />
          </Group>
          <Field id="venue-type" label={t("venueType")} optional optionalLabel={t("optional")}>
            <Select value={values.venueTypeKey} onChange={(e) => set("venueTypeKey", e.target.value)}>
              <option value="">{t("chooseOne")}</option>
              {options.venueTypes.map((v) => (
                <option key={v.key} value={v.key}>
                  {label(v)}
                </option>
              ))}
            </Select>
          </Field>
          <Group legend={t("capacities")} hint={t("capacitiesHint")} error={shown.capacities}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAPACITY_LAYOUTS.map((layout) => (
                <label
                  key={layout}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2"
                >
                  <span className="text-sm text-ink">{to(`layout.${layout}`)}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      inputMode="numeric"
                      value={values.capacities[layout]}
                      onChange={(e) => set("capacities", { ...values.capacities, [layout]: e.target.value })}
                      className="h-10 w-24 rounded-lg border border-line px-2 text-right text-base focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={`${to(`layout.${layout}`)} — ${t("guests")}`}
                    />
                    <span className="text-xs text-muted">{t("guests")}</span>
                  </span>
                </label>
              ))}
            </div>
          </Group>
          <Field
            id="min-guests"
            label={t("minGuests")}
            optional
            optionalLabel={t("optional")}
            error={shown.minGuests}
            className="max-w-xs"
          >
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={values.minGuests}
              onChange={(e) => set("minGuests", e.target.value)}
            />
          </Field>
        </>
      ) : null}

      {type === "caterer" ? (
        <>
          <Group legend={t("cuisines")} error={shown.cuisines}>
            <ChipGroup
              name="cuisines"
              value={values.cuisines}
              onChange={(v) => set("cuisines", v)}
              options={options.cuisines.map((c) => ({ value: c.key, label: label(c) }))}
            />
          </Group>
          <Group legend={t("serviceStyles")} error={shown.serviceStyles}>
            <ChipGroup
              name="serviceStyles"
              value={values.serviceStyles}
              onChange={(v) => set("serviceStyles", v)}
              options={options.serviceStyles.map((c) => ({ value: c.key, label: label(c) }))}
            />
          </Group>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="min-guests"
              label={t("minGuests")}
              optional
              optionalLabel={t("optional")}
              error={shown.minGuests}
            >
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={values.minGuests}
                onChange={(e) => set("minGuests", e.target.value)}
              />
            </Field>
            <Field
              id="max-guests"
              label={t("maxGuests")}
              optional
              optionalLabel={t("optional")}
              error={shown.maxGuests}
            >
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={values.maxGuests}
                onChange={(e) => set("maxGuests", e.target.value)}
              />
            </Field>
          </div>
        </>
      ) : null}

      {type === "performer" ? (
        <>
          <Group legend={t("actTypes")} error={shown.actTypes}>
            <ChipGroup
              name="actTypes"
              value={values.actTypes}
              onChange={(v) => set("actTypes", v)}
              options={options.actTypes.map((c) => ({ value: c.key, label: label(c) }))}
            />
          </Group>
          <Group legend={t("languages")} error={shown.languages}>
            <ChipGroup
              name="languages"
              value={values.languages}
              onChange={(v) => set("languages", v)}
              options={options.languages.map((c) => ({ value: c.key, label: label(c) }))}
            />
          </Group>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              id="set-length"
              label={t("setLength")}
              optional
              optionalLabel={t("optional")}
              error={shown.setLengthMinutes}
            >
              <Input
                type="number"
                min={5}
                max={600}
                inputMode="numeric"
                value={values.setLengthMinutes}
                onChange={(e) => set("setLengthMinutes", e.target.value)}
              />
            </Field>
            <Field
              id="sets"
              label={t("setsPerEvent")}
              optional
              optionalLabel={t("optional")}
              error={shown.setsPerEvent}
            >
              <Input
                type="number"
                min={1}
                max={10}
                inputMode="numeric"
                value={values.setsPerEvent}
                onChange={(e) => set("setsPerEvent", e.target.value)}
              />
            </Field>
            <Field id="members" label={t("members")} optional optionalLabel={t("optional")} error={shown.membersCount}>
              <Input
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                value={values.membersCount}
                onChange={(e) => set("membersCount", e.target.value)}
              />
            </Field>
          </div>
        </>
      ) : null}

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
    </form>
  );
}

/** Only send the fields that belong to this listing type. */
function payload(v: Record<string, unknown> & { capacities: Record<string, string> }, type: ListingType) {
  const base = {
    titleTr: v.titleTr,
    titleEn: v.titleEn,
    descriptionTr: v.descriptionTr,
    descriptionEn: v.descriptionEn,
    minGuests: v.minGuests,
  };
  if (type === "venue")
    return {
      ...base,
      areaType: v.areaType ?? undefined,
      venueTypeKey: v.venueTypeKey || null,
      capacities: v.capacities,
    };
  if (type === "caterer")
    return { ...base, maxGuests: v.maxGuests, cuisines: v.cuisines, serviceStyles: v.serviceStyles };
  return {
    ...base,
    actTypes: v.actTypes,
    languages: v.languages,
    setLengthMinutes: v.setLengthMinutes,
    setsPerEvent: v.setsPerEvent,
    membersCount: v.membersCount,
  };
}
