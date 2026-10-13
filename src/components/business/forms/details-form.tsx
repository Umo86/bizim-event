"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CheckRow, ChipGroup, Field, Group, RadioCards, Select } from "@/components/ui/form";
import { ALCOHOL_POLICIES, type ListingType } from "@/lib/listing-config";
import { saveListingSectionAction } from "@/server/actions/listing";
import type { ListingEditorData, ListingFormOptions } from "@/server/dal/listing-write";
import { useAutosave } from "../autosave";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";
import { listingDetailsStrict } from "@/lib/validation/listing";

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function DetailsForm({
  data,
  options,
  countryOptions,
  backHref,
  nextHref,
  nextLabel,
}: {
  data: ListingEditorData;
  options: ListingFormOptions;
  countryOptions: { iso2: string; name: string }[];
  backHref?: string | null;
  nextHref?: string | null;
  nextLabel?: string;
}) {
  const t = useTranslations("fields");
  const to = useTranslations("options");
  const ta = useTranslations("actionErrors");
  const locale = useLocale() as "tr" | "en";
  const type = data.listing.type as ListingType;
  const v = data.venue;
  const c = data.caterer;
  const p = data.performer;

  const [values, setValues] = useState({
    inHouseCatering: v?.inHouseCatering ?? false,
    externalCateringAllowed: v?.externalCateringAllowed ?? false,
    // No default: an unanswered question must not read as "no alcohol".
    alcohol: (v?.alcohol ?? null) as (typeof ALCOHOL_POLICIES)[number] | null,
    halalKitchen: v?.halalKitchen ?? false,
    alcoholFreeOption: v?.alcoholFreeOption ?? false,
    liveMusicAllowed: v?.liveMusicAllowed ?? false,
    davulZurnaAllowed: v?.davulZurnaAllowed ?? false,
    ownDjAllowed: v?.ownDjAllowed ?? false,
    lateLicenceUntil: v?.lateLicenceUntil ? v.lateLicenceUntil.slice(0, 5) : "",
    parkingSpaces: str(v?.parkingSpaces),
    prayerRoom: v?.prayerRoom ?? false,
    separateWomensArea: v?.separateWomensArea ?? false,
    nearestTransport: v?.nearestTransport ?? "",
    halalCertified: c?.halalCertified ?? false,
    halalCertBody: c?.halalCertBody ?? "",
    staffIncluded: c?.staffIncluded ?? false,
    equipmentIncluded: c?.equipmentIncluded ?? false,
    travelRadiusKm: str(c?.travelRadiusKm),
    hygieneRatingText: c?.hygieneRatingText ?? "",
    ownPaIncluded: p?.ownPaIncluded ?? false,
    travelsInternationally: p?.travelsInternationally ?? false,
    countriesCovered: p?.countriesCovered ?? [],
    amenityKeys: data.amenityKeys,
  });
  type V = typeof values;
  const { validate, withServerInvalid } = useStepValidation(listingDetailsStrict);
  const { state, invalid, flush } = useAutosave(values, (val) =>
    saveListingSectionAction(data.listing.id, "details", payload(val, type)),
  );
  const [error, setError] = useState<string | null>(null);
  const shown = withServerInvalid(invalid);
  const set = <K extends keyof V>(key: K, value: V[K]) => setValues((s) => ({ ...s, [key]: value }));
  const check = (key: keyof V, label: string) => (
    <CheckRow
      id={`d-${String(key)}`}
      label={label}
      checked={Boolean(values[key])}
      onChange={(val) => set(key, val as V[typeof key])}
    />
  );

  const groups = [...new Set(options.amenities.map((a) => a.group))];
  const countryName = (iso2: string) => countryOptions.find((co) => co.iso2 === iso2)?.name ?? iso2;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-10">
      {type === "venue" ? (
        <>
          <Group legend={t("cateringDrinks")}>
            <div className="grid gap-1 sm:grid-cols-2">
              {check("inHouseCatering", t("inHouseCatering"))}
              {check("externalCateringAllowed", t("externalCatering"))}
              {check("halalKitchen", t("halalKitchen"))}
              {check("alcoholFreeOption", t("alcoholFree"))}
            </div>
          </Group>
          <Group legend={t("alcohol")}>
            <RadioCards
              name="alcohol"
              columns={3}
              value={values.alcohol}
              onChange={(val) => set("alcohol", val)}
              options={ALCOHOL_POLICIES.map((a) => ({ value: a, label: to(`alcohol.${a}`) }))}
            />
          </Group>
          <Group legend={t("music")}>
            <div className="grid gap-1 sm:grid-cols-2">
              {check("liveMusicAllowed", t("liveMusic"))}
              {check("davulZurnaAllowed", t("davulZurna"))}
              {check("ownDjAllowed", t("ownDj"))}
            </div>
            <Field
              id="late-licence"
              label={t("lateLicence")}
              optional
              optionalLabel={t("optional")}
              error={shown.lateLicenceUntil}
              className="max-w-xs pt-2"
            >
              <Input
                type="time"
                value={values.lateLicenceUntil}
                onChange={(e) => set("lateLicenceUntil", e.target.value)}
              />
            </Field>
          </Group>
          <Group legend={t("facilities")}>
            <div className="grid gap-1 sm:grid-cols-2">
              {check("prayerRoom", t("prayerRoom"))}
              {check("separateWomensArea", t("separateWomensArea"))}
            </div>
            <div className="grid gap-5 pt-2 sm:grid-cols-2">
              <Field
                id="parking"
                label={t("parkingSpaces")}
                optional
                optionalLabel={t("optional")}
                error={shown.parkingSpaces}
              >
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values.parkingSpaces}
                  onChange={(e) => set("parkingSpaces", e.target.value)}
                />
              </Field>
              <Field id="transport" label={t("nearestTransport")} optional optionalLabel={t("optional")}>
                <Input
                  maxLength={200}
                  value={values.nearestTransport}
                  onChange={(e) => set("nearestTransport", e.target.value)}
                />
              </Field>
            </div>
          </Group>
        </>
      ) : null}

      {type === "caterer" ? (
        <Group legend={t("facilities")}>
          <div className="grid gap-1 sm:grid-cols-2">
            {check("halalCertified", t("halalCertified"))}
            {check("staffIncluded", t("staffIncluded"))}
            {check("equipmentIncluded", t("equipmentIncluded"))}
          </div>
          <div className="grid gap-5 pt-2 sm:grid-cols-3">
            {values.halalCertified ? (
              <Field id="cert-body" label={t("halalCertBody")} optional optionalLabel={t("optional")}>
                <Input
                  maxLength={120}
                  value={values.halalCertBody}
                  onChange={(e) => set("halalCertBody", e.target.value)}
                />
              </Field>
            ) : null}
            <Field
              id="radius"
              label={t("travelRadius")}
              optional
              optionalLabel={t("optional")}
              error={shown.travelRadiusKm}
            >
              <Input
                type="number"
                min={0}
                max={2000}
                inputMode="numeric"
                value={values.travelRadiusKm}
                onChange={(e) => set("travelRadiusKm", e.target.value)}
              />
            </Field>
            <Field id="hygiene" label={t("hygieneRating")} optional optionalLabel={t("optional")}>
              <Input
                maxLength={120}
                value={values.hygieneRatingText}
                onChange={(e) => set("hygieneRatingText", e.target.value)}
              />
            </Field>
          </div>
        </Group>
      ) : null}

      {type === "performer" ? (
        <Group legend={t("facilities")}>
          <div className="grid gap-1 sm:grid-cols-2">
            {check("ownPaIncluded", t("ownPa"))}
            {check("travelsInternationally", t("travelsInternationally"))}
          </div>
          <div className="space-y-2 pt-2">
            <p className="text-sm font-semibold text-ink">{t("countriesCovered")}</p>
            <ul className="flex flex-wrap gap-2">
              {values.countriesCovered.map((iso2) => (
                <li
                  key={iso2}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-sm text-primary-deeper"
                >
                  {countryName(iso2)}
                  <button
                    type="button"
                    aria-label={`${t("remove")}: ${countryName(iso2)}`}
                    className="flex size-7 items-center justify-center rounded-full hover:bg-white"
                    onClick={() =>
                      set(
                        "countriesCovered",
                        values.countriesCovered.filter((x) => x !== iso2),
                      )
                    }
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Select
              aria-label={t("addCountry")}
              value=""
              className="max-w-xs"
              onChange={(e) => e.target.value && set("countriesCovered", [...values.countriesCovered, e.target.value])}
            >
              <option value="">{t("addCountry")}</option>
              {countryOptions
                .filter((co) => !values.countriesCovered.includes(co.iso2))
                .map((co) => (
                  <option key={co.iso2} value={co.iso2}>
                    {co.name}
                  </option>
                ))}
            </Select>
          </div>
        </Group>
      ) : null}

      {groups.length ? (
        <Group legend={t("amenities")}>
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-2 text-sm text-muted">{to(`amenityGroup.${g}`)}</p>
                <ChipGroup
                  name={`amenities-${g}`}
                  value={values.amenityKeys}
                  onChange={(next) => set("amenityKeys", next)}
                  options={options.amenities
                    .filter((a) => a.group === g)
                    .map((a) => ({ value: a.key, label: locale === "tr" ? a.labelTr : a.labelEn }))}
                />
              </div>
            ))}
          </div>
        </Group>
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

function payload(v: Record<string, unknown>, type: ListingType) {
  // Unanswered (null) fields are left out, so they stay unanswered.
  const pick = (keys: string[]) => Object.fromEntries(keys.filter((k) => v[k] !== null).map((k) => [k, v[k]]));
  const amenities = { amenityKeys: v.amenityKeys };
  if (type === "venue")
    return {
      ...pick([
        "inHouseCatering",
        "externalCateringAllowed",
        "alcohol",
        "halalKitchen",
        "alcoholFreeOption",
        "liveMusicAllowed",
        "davulZurnaAllowed",
        "ownDjAllowed",
        "lateLicenceUntil",
        "parkingSpaces",
        "prayerRoom",
        "separateWomensArea",
        "nearestTransport",
      ]),
      ...amenities,
    };
  if (type === "caterer")
    return {
      ...pick([
        "halalCertified",
        "halalCertBody",
        "staffIncluded",
        "equipmentIncluded",
        "travelRadiusKm",
        "hygieneRatingText",
      ]),
      ...amenities,
    };
  return { ...pick(["ownPaIncluded", "travelsInternationally", "countriesCovered"]), ...amenities };
}
