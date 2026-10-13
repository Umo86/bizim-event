import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, softDelete, timestamps, tsvector } from "./_shared";
import { businesses } from "./business";
import { amenities, cancellationPolicies, eventTypes, listingTypeEnum, venueTypes } from "./taxonomy";

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "rejected",
  "paused",
]);

export const pricingModelEnum = pgEnum("pricing_model", [
  "hire_fee_hour",
  "hire_fee_session",
  "hire_fee_day",
  "minimum_spend",
  "per_person",
  "per_set",
  "per_event",
  "custom_quote",
]);

export const listings = pgTable(
  "listings",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    type: listingTypeEnum("type").notNull(),
    titleTr: text("title_tr"),
    titleEn: text("title_en"),
    slug: text("slug").notNull(),
    descriptionTr: text("description_tr"),
    descriptionEn: text("description_en"),
    status: listingStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    reviewNote: text("review_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    // Derived: business approved AND listing approved AND subscription in good standing.
    // Maintained by src/server/visibility.ts — never set by hand.
    isPublic: boolean("is_public").notNull().default(false),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    cancellationPolicyId: uuid("cancellation_policy_id").references(() => cancellationPolicies.id),
    minGuests: integer("min_guests"),
    maxGuests: integer("max_guests"),
    // Null until the owner saves the pricing step (custom_quote is a real choice, not a default).
    pricingModel: pricingModelEnum("pricing_model"),
    priceFrom: numeric("price_from", { precision: 12, scale: 2, mode: "number" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    // Normalised daily (Frankfurter rates) for cross-currency sort/filter.
    priceFromGbp: numeric("price_from_gbp", { precision: 12, scale: 2, mode: "number" }),
    depositPercent: smallint("deposit_percent"),
    bookingRequestsEnabled: boolean("booking_requests_enabled").notNull().default(false),
    sortScore: numeric("sort_score", { precision: 8, scale: 3, mode: "number" }).notNull().default(0),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2, mode: "number" }),
    reviewCount: integer("review_count").notNull().default(0),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`
        setweight(to_tsvector('simple', public.immutable_unaccent(coalesce(title_tr, '') || ' ' || coalesce(title_en, ''))), 'A') ||
        setweight(to_tsvector('simple', public.immutable_unaccent(coalesce(description_tr, '') || ' ' || coalesce(description_en, ''))), 'B')`,
    ),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("listings_slug_uq").on(t.slug),
    index("listings_business_idx").on(t.businessId),
    index("listings_type_idx").on(t.type),
    index("listings_status_idx").on(t.status),
    index("listings_public_idx").on(t.isPublic),
    index("listings_public_type_idx").on(t.isPublic, t.type),
    index("listings_price_gbp_idx").on(t.priceFromGbp),
    index("listings_sort_score_idx").on(t.sortScore),
    index("listings_max_guests_idx").on(t.maxGuests),
    index("listings_min_guests_idx").on(t.minGuests),
    index("listings_rating_idx").on(t.ratingAvg),
    index("listings_featured_idx").on(t.featuredUntil),
    index("listings_created_idx").on(t.createdAt),
    index("listings_search_gin").using("gin", t.searchVector),
    index("listings_title_en_trgm").using("gin", sql`${t.titleEn} gin_trgm_ops`),
    index("listings_title_tr_trgm").using("gin", sql`${t.titleTr} gin_trgm_ops`),
  ],
);

export const capacityLayoutEnum = pgEnum("capacity_layout", [
  "standing",
  "seated_dinner",
  "banquet",
  "theatre",
  "cabaret",
  "boardroom",
  "classroom",
]);

export const listingCapacities = pgTable(
  "listing_capacities",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    layout: capacityLayoutEnum("layout").notNull(),
    capacity: integer("capacity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.layout] }),
    index("listing_capacities_layout_cap_idx").on(t.layout, t.capacity),
  ],
);

export const sessionEnum = pgEnum("price_session", ["morning", "afternoon", "evening", "full_day"]);

export const listingPrices = pgTable(
  "listing_prices",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0 = Sunday … 6 = Saturday
    session: sessionEnum("session").notNull(),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    pricingModel: pricingModelEnum("pricing_model").notNull(),
  },
  (t) => [uniqueIndex("listing_prices_slot_uq").on(t.listingId, t.dayOfWeek, t.session)],
);

export const mediaKindEnum = pgEnum("media_kind", ["image", "video", "audio", "youtube", "pdf_menu"]);

export const listingMedia = pgTable(
  "listing_media",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull(),
    r2Key: text("r2_key"),
    urlSmall: text("url_small"),
    urlMedium: text("url_medium"),
    urlLarge: text("url_large"),
    blurDataUrl: text("blur_data_url"), // tiny (<1 KB) placeholder generated client-side at upload
    contentType: text("content_type"),
    bytes: integer("bytes"), // total size of all stored variants, for the R2 usage page
    width: integer("width"),
    height: integer("height"),
    captionTr: text("caption_tr"),
    captionEn: text("caption_en"),
    altTr: text("alt_tr"),
    altEn: text("alt_en"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("listing_media_listing_sort_idx").on(t.listingId, t.sortOrder)],
);

export const areaTypeEnum = pgEnum("area_type", ["whole_venue", "private_room", "semi_private", "private_outdoor"]);
export const alcoholPolicyEnum = pgEnum("alcohol_policy", ["venue_provides", "byo", "none"]);

export const venueDetails = pgTable(
  "venue_details",
  {
    listingId: uuid("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    areaType: areaTypeEnum("area_type").notNull().default("whole_venue"),
    venueTypeId: uuid("venue_type_id").references(() => venueTypes.id),
    inHouseCatering: boolean("in_house_catering").notNull().default(false),
    externalCateringAllowed: boolean("external_catering_allowed").notNull().default(false),
    // null = the business hasn't said. Never default to "none": that would claim an alcohol-free venue.
    alcohol: alcoholPolicyEnum("alcohol"),
    halalKitchen: boolean("halal_kitchen").notNull().default(false),
    alcoholFreeOption: boolean("alcohol_free_option").notNull().default(false),
    liveMusicAllowed: boolean("live_music_allowed").notNull().default(false),
    davulZurnaAllowed: boolean("davul_zurna_allowed").notNull().default(false),
    ownDjAllowed: boolean("own_dj_allowed").notNull().default(false),
    lateLicenceUntil: time("late_licence_until"),
    parkingSpaces: integer("parking_spaces"),
    prayerRoom: boolean("prayer_room").notNull().default(false),
    separateWomensArea: boolean("separate_womens_area").notNull().default(false),
    nearestTransport: text("nearest_transport"),
  },
  (t) => [
    index("venue_details_area_type_idx").on(t.areaType),
    index("venue_details_venue_type_idx").on(t.venueTypeId),
    index("venue_details_halal_idx").on(t.halalKitchen),
    index("venue_details_davul_idx").on(t.davulZurnaAllowed),
    index("venue_details_alcohol_idx").on(t.alcohol),
  ],
);

export const catererDetails = pgTable(
  "caterer_details",
  {
    listingId: uuid("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    cuisines: text("cuisines").array().notNull().default([]), // cuisine keys
    serviceStyles: text("service_styles").array().notNull().default([]), // service_style keys
    halalCertified: boolean("halal_certified").notNull().default(false),
    halalCertBody: text("halal_cert_body"),
    minGuests: integer("min_guests"),
    pricePerHeadFrom: numeric("price_per_head_from", { precision: 10, scale: 2, mode: "number" }),
    staffIncluded: boolean("staff_included").notNull().default(false),
    equipmentIncluded: boolean("equipment_included").notNull().default(false),
    travelRadiusKm: integer("travel_radius_km"),
    hygieneRatingText: text("hygiene_rating_text"),
  },
  (t) => [
    index("caterer_details_cuisines_gin").using("gin", t.cuisines),
    index("caterer_details_styles_gin").using("gin", t.serviceStyles),
    index("caterer_details_halal_idx").on(t.halalCertified),
    index("caterer_details_pph_idx").on(t.pricePerHeadFrom),
  ],
);

export const performerDetails = pgTable(
  "performer_details",
  {
    listingId: uuid("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    actTypes: text("act_types").array().notNull().default([]), // act_type keys
    languages: text("languages").array().notNull().default([]), // language keys (tr, en, ku, de…)
    setLengthMinutes: integer("set_length_minutes"),
    setsPerEvent: smallint("sets_per_event"),
    ownPaIncluded: boolean("own_pa_included").notNull().default(false),
    travelFee: numeric("travel_fee", { precision: 10, scale: 2, mode: "number" }),
    countriesCovered: varchar("countries_covered", { length: 2 }).array().notNull().default([]),
    travelsInternationally: boolean("travels_internationally").notNull().default(false),
    membersCount: smallint("members_count"),
  },
  (t) => [
    index("performer_details_acts_gin").using("gin", t.actTypes),
    index("performer_details_langs_gin").using("gin", t.languages),
    index("performer_details_countries_gin").using("gin", t.countriesCovered),
    index("performer_details_intl_idx").on(t.travelsInternationally),
  ],
);

export const listingAmenities = pgTable(
  "listing_amenities",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.amenityId] }), index("listing_amenities_amenity_idx").on(t.amenityId)],
);

export const listingEventTypes = pgTable(
  "listing_event_types",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.eventTypeId] }),
    index("listing_event_types_event_idx").on(t.eventTypeId),
  ],
);

// Availability ------------------------------------------------------------------

export const availabilityReasonEnum = pgEnum("availability_reason", ["booked", "blocked", "held"]);

export const availabilityBlocks = pgTable(
  "availability_blocks",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: availabilityReasonEnum("reason").notNull(),
    bookingId: uuid("booking_id"),
    icalFeedId: uuid("ical_feed_id"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("availability_listing_range_idx").on(t.listingId, t.startsAt, t.endsAt),
    index("availability_booking_idx").on(t.bookingId),
  ],
);

export const icalFeeds = pgTable(
  "ical_feeds",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(), // import | export
    url: text("url"), // import source
    exportToken: text("export_token"), // secret token in the public export URL
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [index("ical_feeds_listing_idx").on(t.listingId), uniqueIndex("ical_feeds_export_token_uq").on(t.exportToken)],
);
