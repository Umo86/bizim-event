import { expect, type Page } from "@playwright/test";
import { samplePhotos, snap, ui, visible, type Locale } from "./app";

/** What a business owner types for one listing; the same steps run in the setup wizard and the listing editor. */
export type ListingInput = {
  title: string;
  description: string;
  /** Venue only. */
  areaType?: string;
  venueType?: string;
  /** Venue only: layout key → guests. */
  capacities?: Record<string, string>;
  /** Chip values to tick on the listing step (cuisines, service styles, acts, languages). */
  chips?: string[];
  /** Other inputs on the listing step, by selector (#min-guests, #set-length …). */
  fields?: Record<string, string>;
  photos: number;
  pricingModel: string;
  priceFrom: string;
  deposit: string;
  /** Venue only: [day 0–6, session] → price. */
  weekly?: [number, string, string][];
  travelFee?: string;
  eventTypes: string[];
  /** Detail checkboxes by key (inHouseCatering, staffIncluded …). */
  checks?: string[];
  countryCovered?: string;
  amenities: string[];
  policy: "flexible" | "moderate" | "strict" | "custom";
  customTerms?: string;
};

const $ = (page: Page, selector: string) => visible(page.locator(selector));
const chip = (page: Page, value: string) => $(page, `label:has(> input[value="${value}"])`).first().click();
const radio = (page: Page, name: string, value: string) =>
  $(page, `label:has(input[name="${name}"][value="${value}"])`).first().click();

/** "Save and continue", then wait for the next step's address. */
export async function saveAndContinue(page: Page, locale: Locale, nextPath: string) {
  await page.getByRole("button", { name: ui[locale].wizard.next, exact: true }).click();
  await page.waitForURL((url) => url.pathname.endsWith(nextPath));
}

export async function fillListingStep(page: Page, locale: Locale, input: ListingInput) {
  const options = ui[locale].options;
  await $(page, `#title-${locale}`).fill(input.title);
  await $(page, `#listing-description-${locale}`).fill(input.description);
  if (input.areaType) await radio(page, "areaType", input.areaType);
  if (input.venueType) await $(page, "#venue-type").selectOption(input.venueType);
  for (const [layout, guests] of Object.entries(input.capacities ?? {})) {
    const label = options.layout[layout as keyof typeof options.layout];
    await visible(page.getByLabel(new RegExp(`^${label} — `))).fill(guests);
  }
  for (const value of input.chips ?? []) await chip(page, value);
  for (const [selector, value] of Object.entries(input.fields ?? {})) await $(page, selector).fill(value);
}

export async function uploadPhotos(page: Page, input: ListingInput) {
  const files = await samplePhotos(page, input.photos, input.title);
  await $(page, "input[type=file][multiple]").setInputFiles(files);
  // Each photo is resized in the browser, uploaded, checked by the server and then shown.
  await expect($(page, "ul li img")).toHaveCount(input.photos, { timeout: 120_000 });
}

export async function fillPricingStep(page: Page, locale: Locale, input: ListingInput) {
  const options = ui[locale].options;
  await radio(page, "pricingModel", input.pricingModel);
  await $(page, "#price-from").fill(input.priceFrom);
  await $(page, "#deposit").fill(input.deposit);
  for (const [day, session, price] of input.weekly ?? []) {
    const label = `${options.day[String(day) as keyof typeof options.day]} — ${options.session[session as keyof typeof options.session]}`;
    await visible(page.getByLabel(label, { exact: true })).fill(price);
  }
  if (input.travelFee) await $(page, "#travel-fee").fill(input.travelFee);
}

export async function fillEventTypesStep(page: Page, input: ListingInput) {
  for (const value of input.eventTypes) await chip(page, value);
}

export async function fillDetailsStep(page: Page, input: ListingInput) {
  for (const key of input.checks ?? []) await $(page, `label[for="d-${key}"]`).click();
  if (input.countryCovered) await $(page, "main select").last().selectOption(input.countryCovered);
  for (const value of input.amenities) await chip(page, value);
}

export async function fillCancellationStep(page: Page, locale: Locale, input: ListingInput) {
  await radio(page, "policy", input.policy);
  if (input.customTerms) await $(page, `#custom-terms-${locale}`).fill(input.customTerms);
}

/**
 * The listing steps of the setup wizard (listing → … → cancellation → review) or the
 * listing editor's sections (listing → … → cancellation, which only saves).
 */
export async function completeListingSteps(
  page: Page,
  locale: Locale,
  input: ListingInput,
  opts: { name: string; editor: boolean },
) {
  await fillListingStep(page, locale, input);
  await snap(page, `${opts.name}-listing`);
  await saveAndContinue(page, locale, "/photos");

  await uploadPhotos(page, input);
  await snap(page, `${opts.name}-photos`);
  await saveAndContinue(page, locale, "/pricing");

  await fillPricingStep(page, locale, input);
  await snap(page, `${opts.name}-pricing`);
  await saveAndContinue(page, locale, "/event-types");

  await fillEventTypesStep(page, input);
  await snap(page, `${opts.name}-event-types`);
  await saveAndContinue(page, locale, "/details");

  await fillDetailsStep(page, input);
  await snap(page, `${opts.name}-details`);
  await saveAndContinue(page, locale, "/cancellation");

  await fillCancellationStep(page, locale, input);
  await snap(page, `${opts.name}-cancellation`);
  if (opts.editor) {
    await page.getByRole("button", { name: ui[locale].wizard.saveOnly, exact: true }).click();
    await expect(visible(page.getByText(ui[locale].wizard.saved))).toBeVisible();
  } else {
    await saveAndContinue(page, locale, "/review");
  }
}
