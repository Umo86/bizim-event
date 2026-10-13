import { z } from "zod";
import { LISTING_TYPES } from "@/lib/listing-config";
import { currencyCode, iso2, normaliseInstagram, normaliseWebsite, optionalText, timeZone } from "./common";

/**
 * Business-level wizard steps. Each section exports:
 *  - `…Fields`: per-field schemas used by autosave (invalid fields are skipped, not fatal)
 *  - `…Strict`: the full rule set checked when the owner presses Continue
 * Error messages are i18n keys under `validation.*`.
 */

export const createBusinessInput = z.object({ type: z.enum(LISTING_TYPES) });

const nullableText = (max: number) => optionalText(max);

export const businessInfoFields = {
  nameTr: nullableText(120),
  nameEn: nullableText(120),
  descriptionTr: nullableText(5000),
  descriptionEn: nullableText(5000),
  // Normalised to E.164 in the DAL, which knows the business's country.
  phone: z.string().trim().max(40).nullable().optional(),
  email: z
    .union([z.literal(""), z.email({ message: "invalid_email" }).max(254)])
    .transform((v) => (v ? v.toLowerCase() : null))
    .nullable()
    .optional(),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((v, ctx) => {
      if (!v) return null;
      const url = normaliseWebsite(v);
      if (!url) ctx.addIssue({ code: "custom", message: "invalid_url" });
      return url;
    })
    .nullable()
    .optional(),
  instagram: z
    .string()
    .trim()
    .max(120)
    .transform((v, ctx) => {
      if (!v) return null;
      const handle = normaliseInstagram(v);
      if (!handle) ctx.addIssue({ code: "custom", message: "invalid_instagram" });
      return handle;
    })
    .nullable()
    .optional(),
};

export const MIN_DESCRIPTION = 50;

export const businessInfoStrict = z.object(businessInfoFields).superRefine((v, ctx) => {
  if (!v.nameTr && !v.nameEn) ctx.addIssue({ code: "custom", path: ["nameTr"], message: "name_required" });
  if (!v.descriptionTr && !v.descriptionEn)
    ctx.addIssue({ code: "custom", path: ["descriptionTr"], message: "description_required" });
  for (const key of ["descriptionTr", "descriptionEn"] as const) {
    const text = v[key];
    if (text && text.length < MIN_DESCRIPTION)
      ctx.addIssue({ code: "custom", path: [key], message: "description_too_short" });
  }
  if (!v.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "phone_required" });
  if (!v.email) ctx.addIssue({ code: "custom", path: ["email"], message: "email_required" });
});
export type BusinessInfoValues = z.input<typeof businessInfoStrict>;

// Location ---------------------------------------------------------------------

export const placeLocationInput = z.object({
  mode: z.literal("place"),
  placeId: z.string().min(3).max(4000),
  sessionToken: z.string().max(100).optional(),
  addressExtra: optionalText(120), // flat / unit / building name
});

export const manualLocationInput = z.object({
  mode: z.literal("manual"),
  countryIso2: iso2,
  city: z.string().trim().min(1, { message: "city_required" }).max(120),
  addressLine: z.string().trim().min(3, { message: "address_required" }).max(300),
  postalCode: optionalText(20),
});

export const locationInput = z.discriminatedUnion("mode", [placeLocationInput, manualLocationInput]);
export type LocationInput = z.infer<typeof locationInput>;

// Currency & time zone ------------------------------------------------------------

export const businessSettingsStrict = z.object({ currency: currencyCode, timezone: timeZone });
export type BusinessSettingsValues = z.input<typeof businessSettingsStrict>;

// Admin review --------------------------------------------------------------------

export const reviewNoteInput = z.object({
  note: z.string().trim().min(5, { message: "note_too_short" }).max(2000),
});
