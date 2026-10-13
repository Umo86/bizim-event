import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { geographyPoint, id, softDelete, timestamps } from "./_shared";
import { organization, user } from "./auth";
import { areas, cities, countries } from "./geo";
import { listingTypeEnum } from "./taxonomy";

export const businessStatusEnum = pgEnum("business_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "suspended",
]);

export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id),
    organizationId: uuid("organization_id").references(() => organization.id, { onDelete: "set null" }),
    type: listingTypeEnum("type").notNull(),
    nameTr: text("name_tr"),
    nameEn: text("name_en"),
    slug: text("slug").notNull(),
    descriptionTr: text("description_tr"),
    descriptionEn: text("description_en"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    phoneE164: varchar("phone_e164", { length: 20 }),
    email: text("email"),
    website: text("website"),
    instagram: text("instagram"),
    addressLine: text("address_line"),
    addressComponents: jsonb("address_components").$type<Record<string, string>>(),
    location: geographyPoint("location"),
    countryIso2: varchar("country_iso2", { length: 2 }).references(() => countries.iso2),
    cityId: uuid("city_id").references(() => cities.id),
    areaId: uuid("area_id").references(() => areas.id),
    timezone: text("timezone"),
    currency: varchar("currency", { length: 3 }),
    status: businessStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    responseRate: numeric("response_rate", { precision: 5, scale: 2, mode: "number" }),
    avgResponseMinutes: integer("avg_response_minutes"),
    isStarBusiness: boolean("is_star_business").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("businesses_slug_uq").on(t.slug),
    index("businesses_owner_idx").on(t.ownerId),
    index("businesses_org_idx").on(t.organizationId),
    index("businesses_status_idx").on(t.status),
    index("businesses_country_idx").on(t.countryIso2),
    index("businesses_city_idx").on(t.cityId),
    index("businesses_type_idx").on(t.type),
    index("businesses_location_gist").using("gist", t.location),
  ],
);

// Subscriptions -----------------------------------------------------------------

export const planIntervalEnum = pgEnum("plan_interval", ["month", "year"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
  "comped",
]);

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: id(),
    key: text("key").notNull(), // monthly | yearly
    nameTr: text("name_tr").notNull(),
    nameEn: text("name_en").notNull(),
    interval: planIntervalEnum("interval").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("subscription_plans_key_uq").on(t.key)],
);

export const planPrices = pgTable(
  "plan_prices",
  {
    id: id(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    stripePriceId: text("stripe_price_id"),
    ...timestamps,
  },
  (t) => [uniqueIndex("plan_prices_plan_currency_uq").on(t.planId, t.currency)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => subscriptionPlans.id),
    currency: varchar("currency", { length: 3 }).notNull().default("GBP"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    graceUntil: timestamp("grace_until", { withTimezone: true }),
    // Which trial reminders (day 60/83/89) have gone out, to keep the daily job idempotent.
    trialRemindersSent: integer("trial_reminders_sent").array().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("subscriptions_business_uq").on(t.businessId),
    uniqueIndex("subscriptions_stripe_sub_uq").on(t.stripeSubscriptionId),
    index("subscriptions_status_idx").on(t.status),
    index("subscriptions_trial_ends_idx").on(t.trialEndsAt),
    index("subscriptions_stripe_customer_idx").on(t.stripeCustomerId),
  ],
);
