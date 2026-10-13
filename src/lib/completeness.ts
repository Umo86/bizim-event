/**
 * Profile completeness: drives the wizard progress bar, the "complete your
 * profile" score and the submit-for-review gate. Pure — unit tested.
 */
import { MIN_PHOTOS, type ListingType, type WizardStep } from "./listing-config";
import { MIN_DESCRIPTION } from "./validation/business";

export type Check = {
  key: string;
  step: WizardStep;
  required: boolean;
  done: boolean;
};

export type BusinessSnapshot = {
  nameTr: string | null;
  nameEn: string | null;
  descriptionTr: string | null;
  descriptionEn: string | null;
  phoneE164: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  logoUrl: string | null;
  cityId: string | null;
  addressLine: string | null;
  currency: string | null;
  timezone: string | null;
};

export type ListingSnapshot = {
  type: ListingType;
  titleTr: string | null;
  titleEn: string | null;
  descriptionTr: string | null;
  descriptionEn: string | null;
  imageCount: number;
  pricingModel: string | null;
  priceFrom: number | null;
  eventTypeCount: number;
  capacityCount: number;
  areaType: string | null;
  cuisineCount: number;
  serviceStyleCount: number;
  actTypeCount: number;
  languageCount: number;
  cancellationPolicyId: string | null;
  amenityCount: number;
};

const has = (s: string | null | undefined) => !!s && s.trim().length > 0;
const longEnough = (s: string | null | undefined) => has(s) && s!.trim().length >= MIN_DESCRIPTION;

export function businessChecks(b: BusinessSnapshot): Check[] {
  return [
    { key: "business_name", step: "info", required: true, done: has(b.nameTr) || has(b.nameEn) },
    {
      key: "business_description",
      step: "info",
      required: true,
      done: longEnough(b.descriptionTr) || longEnough(b.descriptionEn),
    },
    { key: "business_phone", step: "info", required: true, done: has(b.phoneE164) },
    { key: "business_email", step: "info", required: true, done: has(b.email) },
    { key: "business_location", step: "location", required: true, done: has(b.cityId) && has(b.addressLine) },
    { key: "business_currency", step: "currency", required: true, done: has(b.currency) && has(b.timezone) },
    {
      key: "business_both_languages",
      step: "info",
      required: false,
      done: has(b.nameTr) && has(b.nameEn) && has(b.descriptionTr) && has(b.descriptionEn),
    },
    { key: "business_online", step: "info", required: false, done: has(b.website) || has(b.instagram) },
    { key: "business_logo", step: "info", required: false, done: has(b.logoUrl) },
  ];
}

export function listingChecks(l: ListingSnapshot): Check[] {
  const typeSpecific: Check[] =
    l.type === "venue"
      ? [{ key: "listing_capacity", step: "listing", required: true, done: l.capacityCount > 0 && has(l.areaType) }]
      : l.type === "caterer"
        ? [
            {
              key: "listing_menu_styles",
              step: "listing",
              required: true,
              done: l.cuisineCount > 0 && l.serviceStyleCount > 0,
            },
          ]
        : [{ key: "listing_acts", step: "listing", required: true, done: l.actTypeCount > 0 && l.languageCount > 0 }];

  const minPhotos = MIN_PHOTOS[l.type];
  return [
    { key: "listing_title", step: "listing", required: true, done: has(l.titleTr) || has(l.titleEn) },
    {
      key: "listing_description",
      step: "listing",
      required: true,
      done: longEnough(l.descriptionTr) || longEnough(l.descriptionEn),
    },
    ...typeSpecific,
    { key: "listing_photos", step: "photos", required: true, done: l.imageCount >= minPhotos },
    {
      key: "listing_pricing",
      step: "pricing",
      required: true,
      done: has(l.pricingModel) && (l.pricingModel === "custom_quote" || (l.priceFrom ?? 0) > 0),
    },
    { key: "listing_event_types", step: "event-types", required: true, done: l.eventTypeCount > 0 },
    { key: "listing_cancellation", step: "cancellation", required: true, done: has(l.cancellationPolicyId) },
    {
      key: "listing_both_languages",
      step: "listing",
      required: false,
      done: has(l.titleTr) && has(l.titleEn) && has(l.descriptionTr) && has(l.descriptionEn),
    },
    { key: "listing_more_photos", step: "photos", required: false, done: l.imageCount >= minPhotos + 3 },
    { key: "listing_amenities", step: "details", required: false, done: l.amenityCount >= 3 },
  ];
}

export type Completeness = {
  checks: Check[];
  /** 0–100, required items weigh 3×, recommended 1×. */
  score: number;
  canSubmit: boolean;
  missingRequired: Check[];
};

export function summarise(checks: Check[]): Completeness {
  const weight = (c: Check) => (c.required ? 3 : 1);
  const total = checks.reduce((n, c) => n + weight(c), 0);
  const done = checks.reduce((n, c) => n + (c.done ? weight(c) : 0), 0);
  const missingRequired = checks.filter((c) => c.required && !c.done);
  return {
    checks,
    score: total ? Math.round((done / total) * 100) : 0,
    canSubmit: missingRequired.length === 0,
    missingRequired,
  };
}

export function onboardingCompleteness(b: BusinessSnapshot, firstListing: ListingSnapshot | null): Completeness {
  return summarise([...businessChecks(b), ...(firstListing ? listingChecks(firstListing) : [])]);
}

/**
 * Which wizard steps are done: every required check for the step passes. A step
 * with only recommended checks (details & amenities) counts as done once any of
 * them passes, so an optional step doesn't look unfinished forever.
 */
export function completedSteps(c: Completeness): Set<WizardStep> {
  const allRequiredPass = new Map<WizardStep, boolean>();
  const anyRecommendedPass = new Map<WizardStep, boolean>();
  for (const check of c.checks) {
    if (check.required) allRequiredPass.set(check.step, (allRequiredPass.get(check.step) ?? true) && check.done);
    else anyRecommendedPass.set(check.step, (anyRecommendedPass.get(check.step) ?? false) || check.done);
  }
  const done = new Set<WizardStep>();
  for (const [step, ok] of allRequiredPass) if (ok) done.add(step);
  for (const [step, ok] of anyRecommendedPass) if (ok && !allRequiredPass.has(step)) done.add(step);
  return done;
}
