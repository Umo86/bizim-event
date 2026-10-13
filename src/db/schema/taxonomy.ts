import { boolean, index, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";

export const listingTypeEnum = pgEnum("listing_type", ["venue", "caterer", "performer"]);

/** Columns shared by every bilingual lookup table. */
const lookupColumns = () => ({
  id: id(),
  key: text("key").notNull(),
  labelTr: text("label_tr").notNull(),
  labelEn: text("label_en").notNull(),
  slugTr: text("slug_tr").notNull(),
  slugEn: text("slug_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const eventTypes = pgTable(
  "event_types",
  {
    ...lookupColumns(),
    appliesTo: listingTypeEnum("applies_to").array().notNull().default(["venue", "caterer", "performer"]),
    isTurkishCultural: boolean("is_turkish_cultural").notNull().default(false),
  },
  (t) => [
    uniqueIndex("event_types_key_uq").on(t.key),
    uniqueIndex("event_types_slug_en_uq").on(t.slugEn),
    uniqueIndex("event_types_slug_tr_uq").on(t.slugTr),
  ],
);

export const venueTypes = pgTable("venue_types", lookupColumns(), (t) => [
  uniqueIndex("venue_types_key_uq").on(t.key),
]);
export const actTypes = pgTable("act_types", lookupColumns(), (t) => [uniqueIndex("act_types_key_uq").on(t.key)]);
export const cuisines = pgTable("cuisines", lookupColumns(), (t) => [uniqueIndex("cuisines_key_uq").on(t.key)]);
export const serviceStyles = pgTable("service_styles", lookupColumns(), (t) => [
  uniqueIndex("service_styles_key_uq").on(t.key),
]);
export const languages = pgTable("languages", lookupColumns(), (t) => [uniqueIndex("languages_key_uq").on(t.key)]);

export const amenities = pgTable(
  "amenities",
  {
    ...lookupColumns(),
    group: text("group").notNull(), // e.g. accessibility, catering_drinks, music, outdoor, facilities, cultural
    appliesTo: listingTypeEnum("applies_to").array().notNull().default(["venue"]),
  },
  (t) => [uniqueIndex("amenities_key_uq").on(t.key), index("amenities_group_idx").on(t.group)],
);

export const cancellationPolicies = pgTable(
  "cancellation_policies",
  {
    id: id(),
    key: text("key").notNull(), // flexible | moderate | strict | custom
    nameTr: text("name_tr").notNull(),
    nameEn: text("name_en").notNull(),
    termsTr: text("terms_tr").notNull(),
    termsEn: text("terms_en").notNull(),
    // Custom policies belong to one business; system ones have businessId = null.
    businessId: uuid("business_id"),
    ...timestamps,
  },
  (t) => [index("cancellation_policies_key_idx").on(t.key), index("cancellation_policies_business_idx").on(t.businessId)],
);
