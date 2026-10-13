/**
 * Per-listing-type rules shared by the client wizard, server validation and
 * the completeness score. Pure data — safe to import anywhere.
 */
export const LISTING_TYPES = ["venue", "caterer", "performer"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const PRICING_MODELS = [
  "hire_fee_hour",
  "hire_fee_session",
  "hire_fee_day",
  "minimum_spend",
  "per_person",
  "per_set",
  "per_event",
  "custom_quote",
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const PRICING_MODELS_BY_TYPE: Record<ListingType, readonly PricingModel[]> = {
  venue: ["hire_fee_session", "hire_fee_hour", "hire_fee_day", "minimum_spend", "per_person", "custom_quote"],
  caterer: ["per_person", "per_event", "custom_quote"],
  performer: ["per_set", "per_event", "hire_fee_hour", "custom_quote"],
};

export const CAPACITY_LAYOUTS = [
  "standing",
  "seated_dinner",
  "banquet",
  "theatre",
  "cabaret",
  "boardroom",
  "classroom",
] as const;
export type CapacityLayout = (typeof CAPACITY_LAYOUTS)[number];

export const AREA_TYPES = ["whole_venue", "private_room", "semi_private", "private_outdoor"] as const;
export const ALCOHOL_POLICIES = ["venue_provides", "byo", "none"] as const;
export const PRICE_SESSIONS = ["morning", "afternoon", "evening", "full_day"] as const;
export const CANCELLATION_KEYS = ["flexible", "moderate", "strict", "custom"] as const;

/** Minimum photos before a listing can be submitted (Tagvenue-style: venues need more). */
export const MIN_PHOTOS: Record<ListingType, number> = { venue: 5, caterer: 3, performer: 3 };
/** Hard caps that keep R2 usage inside the free tier. */
export const MAX_MEDIA = { image: 30, video: 3, audio: 10, youtube: 10, pdf_menu: 3 } as const;
export const MAX_LISTINGS_PER_BUSINESS = 20;
export const MAX_BUSINESSES_PER_USER = 10;

/** Image variants generated in the browser (longest edge, px). */
export const IMAGE_VARIANTS = [
  { name: "small", size: 400, quality: 0.75, maxSizeMB: 0.15 },
  { name: "medium", size: 1200, quality: 0.8, maxSizeMB: 0.6 },
  { name: "large", size: 2000, quality: 0.82, maxSizeMB: 1.5 },
] as const;
export type ImageVariantName = (typeof IMAGE_VARIANTS)[number]["name"];

/** Wizard steps, in order. The first three are about the business, the rest about its first listing. */
export const WIZARD_STEPS = [
  "info",
  "location",
  "currency",
  "listing",
  "photos",
  "pricing",
  "event-types",
  "details",
  "cancellation",
  "review",
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Sections of the stand-alone listing editor (same components as the wizard's listing steps). */
export const LISTING_SECTIONS = ["listing", "photos", "pricing", "event-types", "details", "cancellation"] as const;
export type ListingSection = (typeof LISTING_SECTIONS)[number];

export function isWizardStep(v: string): v is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(v);
}
export function isListingSection(v: string): v is ListingSection {
  return (LISTING_SECTIONS as readonly string[]).includes(v);
}

/** Pull a YouTube video id out of the usual URL shapes. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") {
        const v = u.searchParams.get("v");
        return v && /^[\w-]{11}$/.test(v) ? v : null;
      }
      const m = /^\/(?:embed|shorts|live)\/([\w-]{11})/.exec(u.pathname);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}
