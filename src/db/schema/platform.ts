import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { localeEnum, user } from "./auth";
import { areas, cities, countries } from "./geo";
import { businesses } from "./business";
import { listings } from "./listings";
import { eventTypes, listingTypeEnum, venueTypes } from "./taxonomy";

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    email: boolean("email").notNull().default(true),
    inApp: boolean("in_app").notNull().default(true),
    sms: boolean("sms").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

export const reportStatusEnum = pgEnum("report_status", ["open", "investigating", "resolved", "dismissed"]);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid("reporter_id").references(() => user.id, { onDelete: "set null" }),
    targetType: text("target_type").notNull(), // listing | business | review | message | booking | user
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    resolvedById: uuid("resolved_by_id").references(() => user.id),
    resolutionNote: text("resolution_note"),
    ...timestamps,
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt), index("reports_target_idx").on(t.targetType, t.targetId)],
);

export type FaqItem = { q: string; a: string };

export const seoPages = pgTable(
  "seo_pages",
  {
    id: id(),
    locale: localeEnum("locale").notNull(),
    path: text("path").notNull(),
    countryIso2: varchar("country_iso2", { length: 2 }).references(() => countries.iso2),
    cityId: uuid("city_id").references(() => cities.id),
    areaId: uuid("area_id").references(() => areas.id),
    eventTypeId: uuid("event_type_id").references(() => eventTypes.id),
    listingType: listingTypeEnum("listing_type"),
    venueTypeId: uuid("venue_type_id").references(() => venueTypes.id),
    actTypeKey: text("act_type_key"),
    h1: text("h1").notNull(),
    introMd: text("intro_md"),
    faq: jsonb("faq").$type<FaqItem[]>().notNull().default([]),
    stats: jsonb("stats").$type<Record<string, unknown>>(), // price ranges / capacity bands (daily job)
    statsComputedAt: timestamp("stats_computed_at", { withTimezone: true }),
    isPublished: boolean("is_published").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("seo_pages_locale_path_uq").on(t.locale, t.path),
    index("seo_pages_city_idx").on(t.cityId),
    index("seo_pages_country_idx").on(t.countryIso2),
  ],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: id(),
    locale: localeEnum("locale").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    bodyMd: text("body_md").notNull(),
    coverUrl: text("cover_url"),
    authorId: uuid("author_id").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    translationGroupId: uuid("translation_group_id").notNull().defaultRandom(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("blog_posts_locale_slug_uq").on(t.locale, t.slug),
    index("blog_posts_published_idx").on(t.locale, t.publishedAt),
    index("blog_posts_group_idx").on(t.translationGroupId),
  ],
);

export const helpArticles = pgTable(
  "help_articles",
  {
    id: id(),
    locale: localeEnum("locale").notNull(),
    slug: text("slug").notNull(),
    audience: text("audience").notNull().default("all"), // customer | business | all
    category: text("category").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    translationGroupId: uuid("translation_group_id").notNull().defaultRandom(),
    ...timestamps,
  },
  (t) => [uniqueIndex("help_articles_locale_slug_uq").on(t.locale, t.slug)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId), index("audit_log_created_idx").on(t.createdAt)],
);

export const processedWebhooks = pgTable(
  "processed_webhooks",
  {
    stripeEventId: text("stripe_event_id").primaryKey(),
    type: text("type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("processed_webhooks_processed_idx").on(t.processedAt)],
);

/** Per-listing daily counters, flushed from Upstash Redis by the daily job. */
export const listingStatsDaily = pgTable(
  "listing_stats_daily",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
    enquiries: integer("enquiries").notNull().default(0),
    bookings: integer("bookings").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);

/** Daily FX snapshot (Frankfurter / ECB), used to normalise prices to GBP. */
export const fxRates = pgTable(
  "fx_rates",
  {
    day: date("day").notNull(),
    base: varchar("base", { length: 3 }).notNull(),
    quote: varchar("quote", { length: 3 }).notNull(),
    rate: text("rate").notNull(), // stored as text to keep full precision
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.day, t.base, t.quote] })],
);

/** Saved quick-reply templates for the business inbox. */
export const quickReplies = pgTable(
  "quick_replies",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("quick_replies_business_idx").on(t.businessId)],
);
