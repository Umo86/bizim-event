import { z } from "zod";
import {
  ALCOHOL_POLICIES,
  AREA_TYPES,
  CANCELLATION_KEYS,
  CAPACITY_LAYOUTS,
  PRICE_SESSIONS,
  PRICING_MODELS,
  PRICING_MODELS_BY_TYPE,
  type ListingType,
} from "@/lib/listing-config";
import { iso2, money, optionalText, smallInt } from "./common";
import { MIN_DESCRIPTION } from "./business";

const keyList = (max: number) => z.array(z.string().trim().min(1).max(60)).max(max);
const nullableInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), smallInt(min, max).nullable()).optional();
const nullableMoney = z.preprocess((v) => (v === "" || v === undefined ? null : v), money.nullable()).optional();

// Basics ("listing" step) ------------------------------------------------------------

export const listingBasicsFields = {
  titleTr: optionalText(140),
  titleEn: optionalText(140),
  descriptionTr: optionalText(8000),
  descriptionEn: optionalText(8000),
  // venue
  areaType: z.enum(AREA_TYPES).nullable().optional(),
  venueTypeKey: z.string().trim().max(60).nullable().optional(),
  capacities: z
    .partialRecord(
      z.enum(CAPACITY_LAYOUTS),
      z.preprocess((v) => (v === "" ? null : v), smallInt(1, 100_000).nullable()),
    )
    .optional(),
  // shared
  minGuests: nullableInt(1, 100_000),
  maxGuests: nullableInt(1, 100_000),
  // caterer
  cuisines: keyList(20).optional(),
  serviceStyles: keyList(20).optional(),
  // performer
  actTypes: keyList(20).optional(),
  languages: keyList(20).optional(),
  setLengthMinutes: nullableInt(5, 600),
  setsPerEvent: nullableInt(1, 10),
  membersCount: nullableInt(1, 200),
};

export function listingBasicsStrict(type: ListingType) {
  return z.object(listingBasicsFields).superRefine((v, ctx) => {
    if (!v.titleTr && !v.titleEn) ctx.addIssue({ code: "custom", path: ["titleTr"], message: "title_required" });
    if (!v.descriptionTr && !v.descriptionEn)
      ctx.addIssue({ code: "custom", path: ["descriptionTr"], message: "description_required" });
    for (const key of ["descriptionTr", "descriptionEn"] as const) {
      const text = v[key];
      if (text && text.length < MIN_DESCRIPTION)
        ctx.addIssue({ code: "custom", path: [key], message: "description_too_short" });
    }
    if (v.minGuests && v.maxGuests && v.minGuests > v.maxGuests)
      ctx.addIssue({ code: "custom", path: ["minGuests"], message: "min_above_max" });
    if (type === "venue") {
      if (!v.areaType) ctx.addIssue({ code: "custom", path: ["areaType"], message: "required" });
      const caps = Object.values(v.capacities ?? {}).filter((n) => typeof n === "number" && n > 0);
      if (!caps.length) ctx.addIssue({ code: "custom", path: ["capacities"], message: "capacity_required" });
    }
    if (type === "caterer") {
      if (!v.cuisines?.length) ctx.addIssue({ code: "custom", path: ["cuisines"], message: "pick_at_least_one" });
      if (!v.serviceStyles?.length)
        ctx.addIssue({ code: "custom", path: ["serviceStyles"], message: "pick_at_least_one" });
    }
    if (type === "performer") {
      if (!v.actTypes?.length) ctx.addIssue({ code: "custom", path: ["actTypes"], message: "pick_at_least_one" });
      if (!v.languages?.length) ctx.addIssue({ code: "custom", path: ["languages"], message: "pick_at_least_one" });
    }
  });
}
export type ListingBasicsValues = z.input<ReturnType<typeof listingBasicsStrict>>;

// Pricing ------------------------------------------------------------------------------

export const weeklyPrice = z.object({
  dayOfWeek: smallInt(0, 6),
  session: z.enum(PRICE_SESSIONS),
  price: money,
});

export const listingPricingFields = {
  pricingModel: z.enum(PRICING_MODELS).optional(),
  priceFrom: nullableMoney,
  depositPercent: nullableInt(0, 100),
  bookingRequestsEnabled: z.boolean().optional(),
  weeklyPrices: z.array(weeklyPrice).max(28).optional(),
  travelFee: nullableMoney,
};

export function listingPricingStrict(type: ListingType) {
  return z.object(listingPricingFields).superRefine((v, ctx) => {
    if (!v.pricingModel || !PRICING_MODELS_BY_TYPE[type].includes(v.pricingModel))
      ctx.addIssue({ code: "custom", path: ["pricingModel"], message: "required" });
    if (v.pricingModel && v.pricingModel !== "custom_quote" && !(typeof v.priceFrom === "number" && v.priceFrom > 0))
      ctx.addIssue({ code: "custom", path: ["priceFrom"], message: "price_required" });
  });
}
export type ListingPricingValues = z.input<ReturnType<typeof listingPricingStrict>>;

// Event types -----------------------------------------------------------------------------

export const listingEventTypesFields = { eventTypeKeys: keyList(40) };
export const listingEventTypesStrict = z
  .object(listingEventTypesFields)
  .refine((v) => v.eventTypeKeys.length > 0, { path: ["eventTypeKeys"], message: "pick_at_least_one" });
export type ListingEventTypesValues = z.input<typeof listingEventTypesStrict>;

// Details & amenities --------------------------------------------------------------------

const bool = z.boolean().optional();

export const listingDetailsFields = {
  // venue
  inHouseCatering: bool,
  externalCateringAllowed: bool,
  alcohol: z.enum(ALCOHOL_POLICIES).optional(),
  halalKitchen: bool,
  alcoholFreeOption: bool,
  liveMusicAllowed: bool,
  davulZurnaAllowed: bool,
  ownDjAllowed: bool,
  lateLicenceUntil: z
    .union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "invalid_time" })])
    .transform((v) => v || null)
    .nullable()
    .optional(),
  parkingSpaces: nullableInt(0, 10_000),
  prayerRoom: bool,
  separateWomensArea: bool,
  nearestTransport: optionalText(200),
  // caterer
  halalCertified: bool,
  halalCertBody: optionalText(120),
  staffIncluded: bool,
  equipmentIncluded: bool,
  travelRadiusKm: nullableInt(0, 2000),
  hygieneRatingText: optionalText(120),
  // performer
  ownPaIncluded: bool,
  travelsInternationally: bool,
  countriesCovered: z.array(iso2).max(60).optional(),
  // all types
  amenityKeys: keyList(80).optional(),
};
export const listingDetailsStrict = z.object(listingDetailsFields);
export type ListingDetailsValues = z.input<typeof listingDetailsStrict>;

// Cancellation -----------------------------------------------------------------------------

export const listingCancellationFields = {
  policyKey: z.enum(CANCELLATION_KEYS).optional(),
  customTermsTr: optionalText(3000),
  customTermsEn: optionalText(3000),
};
export const listingCancellationStrict = z.object(listingCancellationFields).superRefine((v, ctx) => {
  if (!v.policyKey) ctx.addIssue({ code: "custom", path: ["policyKey"], message: "required" });
  if (v.policyKey === "custom" && !v.customTermsTr && !v.customTermsEn)
    ctx.addIssue({ code: "custom", path: ["customTermsTr"], message: "terms_required" });
});
export type ListingCancellationValues = z.input<typeof listingCancellationStrict>;

// Media ---------------------------------------------------------------------------------------

export const mediaUploadRequest = z.object({
  kind: z.enum(["image", "video", "audio", "pdf_menu"]),
  files: z
    .array(
      z.object({
        variant: z.enum(["small", "medium", "large", "original"]),
        contentType: z.string().max(100),
        bytes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(3),
});

export const registerMediaInput = z.object({
  kind: z.enum(["image", "video", "audio", "pdf_menu"]),
  keyBase: z.string().max(300),
  variants: z
    .array(z.enum(["small", "medium", "large", "original"]))
    .min(1)
    .max(3),
  extension: z.enum(["webp", "jpg", "mp4", "webm", "mov", "mp3", "m4a", "ogg", "wav", "pdf"]),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  blurDataUrl: z
    .string()
    .max(2000)
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});

export const youtubeInput = z.object({ url: z.string().trim().max(300) });

export const mediaCaptionInput = z.object({
  captionTr: optionalText(200),
  captionEn: optionalText(200),
});
