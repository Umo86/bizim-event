import { boolean, index, integer, pgEnum, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { geographyPoint, id, timestamps } from "./_shared";

export const distanceUnitEnum = pgEnum("distance_unit", ["km", "mi"]);
export const imageSourceEnum = pgEnum("image_source", ["upload", "unsplash", "none"]);

export const countries = pgTable(
  "countries",
  {
    iso2: varchar("iso2", { length: 2 }).primaryKey(),
    nameTr: text("name_tr").notNull(),
    nameEn: text("name_en").notNull(),
    slugTr: text("slug_tr").notNull(),
    slugEn: text("slug_en").notNull(),
    defaultCurrency: varchar("default_currency", { length: 3 }).notNull(),
    distanceUnit: distanceUnitEnum("distance_unit").notNull().default("km"),
    defaultTimezone: text("default_timezone"),
    // Shown in menus only once it has an approved listing (maintained by DAL + daily job)
    isVisible: boolean("is_visible").notNull().default(false),
    heroImageUrl: text("hero_image_url"),
    imageCreditName: text("image_credit_name"),
    imageCreditUrl: text("image_credit_url"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("countries_slug_tr_uq").on(t.slugTr),
    uniqueIndex("countries_slug_en_uq").on(t.slugEn),
    index("countries_visible_idx").on(t.isVisible),
  ],
);

export const cities = pgTable(
  "cities",
  {
    id: id(),
    countryIso2: varchar("country_iso2", { length: 2 })
      .notNull()
      .references(() => countries.iso2),
    googlePlaceId: text("google_place_id"),
    nameEn: text("name_en").notNull(),
    nameTr: text("name_tr").notNull(),
    slugEn: text("slug_en").notNull(),
    slugTr: text("slug_tr").notNull(),
    adminArea: text("admin_area"),
    centre: geographyPoint("centre"),
    timezone: text("timezone").notNull(),
    listingCount: integer("listing_count").notNull().default(0),
    taglineTr: text("tagline_tr"),
    taglineEn: text("tagline_en"),
    heroImageUrl: text("hero_image_url"),
    tileImageUrl: text("tile_image_url"),
    imageSource: imageSourceEnum("image_source").notNull().default("none"),
    imageCreditName: text("image_credit_name"),
    imageCreditUrl: text("image_credit_url"),
    isFeaturedWorldwide: boolean("is_featured_worldwide").notNull().default(false),
    // When admin merges duplicates, the losing row points to the winner.
    mergedIntoId: uuid("merged_into_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("cities_google_place_uq").on(t.googlePlaceId),
    uniqueIndex("cities_country_slug_en_uq").on(t.countryIso2, t.slugEn),
    uniqueIndex("cities_country_slug_tr_uq").on(t.countryIso2, t.slugTr),
    index("cities_country_idx").on(t.countryIso2),
    index("cities_featured_idx").on(t.isFeaturedWorldwide),
    index("cities_centre_gist").using("gist", t.centre),
    index("cities_name_en_trgm").using("gin", sql`${t.nameEn} gin_trgm_ops`),
    index("cities_name_tr_trgm").using("gin", sql`${t.nameTr} gin_trgm_ops`),
  ],
);

export const areas = pgTable(
  "areas",
  {
    id: id(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    nameTr: text("name_tr").notNull(),
    nameEn: text("name_en").notNull(),
    slugTr: text("slug_tr").notNull(),
    slugEn: text("slug_en").notNull(),
    centre: geographyPoint("centre"),
    ...timestamps,
  },
  (t) => [uniqueIndex("areas_city_slug_en_uq").on(t.cityId, t.slugEn), index("areas_city_idx").on(t.cityId)],
);
