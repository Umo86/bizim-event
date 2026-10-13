import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
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
import { sql } from "drizzle-orm";
import { id, timestamps } from "./_shared";
import { user, localeEnum } from "./auth";
import { businesses } from "./business";
import { cities } from "./geo";
import { listings } from "./listings";
import { cancellationPolicies, eventTypes } from "./taxonomy";

export const shortlists = pgTable(
  "shortlists",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] }), index("shortlists_listing_idx").on(t.listingId)],
);

export const eventPlans = pgTable(
  "event_plans",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventTypeId: uuid("event_type_id").references(() => eventTypes.id),
    eventDate: date("event_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    timezone: text("timezone"),
    guests: integer("guests"),
    budget: numeric("budget", { precision: 12, scale: 2, mode: "number" }),
    budgetCurrency: varchar("budget_currency", { length: 3 }),
    cityId: uuid("city_id").references(() => cities.id),
    placeLabel: text("place_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("event_plans_customer_idx").on(t.customerId)],
);

export const enquiryStatusEnum = pgEnum("enquiry_status", [
  "new",
  "replied",
  "offer_sent",
  "booking_requested",
  "booked",
  "declined",
  "expired",
  "cancelled",
]);

export const enquiries = pgTable(
  "enquiries",
  {
    id: id(),
    eventPlanId: uuid("event_plan_id").references(() => eventPlans.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => user.id),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    eventTypeId: uuid("event_type_id").references(() => eventTypes.id),
    eventDate: date("event_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    guests: integer("guests"),
    budget: numeric("budget", { precision: 12, scale: 2, mode: "number" }),
    budgetCurrency: varchar("budget_currency", { length: 3 }),
    message: text("message").notNull(),
    status: enquiryStatusEnum("status").notNull().default("new"),
    phoneShared: boolean("phone_shared").notNull().default(false), // business chose to reveal its number
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("enquiries_customer_idx").on(t.customerId, t.lastMessageAt),
    index("enquiries_business_idx").on(t.businessId, t.status, t.lastMessageAt),
    index("enquiries_listing_idx").on(t.listingId),
    index("enquiries_plan_idx").on(t.eventPlanId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiries.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    attachmentKeys: text("attachment_keys").array().notNull().default([]), // R2 keys only
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_enquiry_created_idx").on(t.enquiryId, t.createdAt)],
);

export const viewingStatusEnum = pgEnum("viewing_status", ["requested", "proposed", "confirmed", "cancelled"]);

export const viewings = pgTable(
  "viewings",
  {
    id: id(),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiries.id, { onDelete: "cascade" }),
    proposedSlots: jsonb("proposed_slots").$type<{ startsAt: string; endsAt: string }[]>().notNull().default([]),
    confirmedStartsAt: timestamp("confirmed_starts_at", { withTimezone: true }),
    confirmedEndsAt: timestamp("confirmed_ends_at", { withTimezone: true }),
    status: viewingStatusEnum("status").notNull().default("requested"),
    ...timestamps,
  },
  (t) => [index("viewings_enquiry_idx").on(t.enquiryId)],
);

export type OfferLineItem = { label: string; qty: number; unitPrice: number };

export const offerStatusEnum = pgEnum("offer_status", ["sent", "accepted", "declined", "expired", "withdrawn"]);

export const offers = pgTable(
  "offers",
  {
    id: id(),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiries.id, { onDelete: "cascade" }),
    eventDate: date("event_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    lineItems: jsonb("line_items").$type<OfferLineItem[]>().notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2, mode: "number" }).notNull(),
    depositAmount: numeric("deposit_amount", { precision: 12, scale: 2, mode: "number" }),
    balanceDueDate: date("balance_due_date"),
    paymentInstructionsTr: text("payment_instructions_tr"),
    paymentInstructionsEn: text("payment_instructions_en"),
    cancellationPolicyId: uuid("cancellation_policy_id").references(() => cancellationPolicies.id),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    status: offerStatusEnum("status").notNull().default("sent"),
    ...timestamps,
  },
  (t) => [index("offers_enquiry_idx").on(t.enquiryId), index("offers_status_valid_idx").on(t.status, t.validUntil)],
);

export const depositStatusEnum = pgEnum("deposit_status", ["not_required", "awaiting", "received"]);
export const balanceStatusEnum = pgEnum("balance_status", ["not_due", "awaiting", "received"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "requested",
  "accepted",
  "declined",
  "expired",
  "confirmed",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_business",
  "disputed",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    enquiryId: uuid("enquiry_id").references(() => enquiries.id),
    offerId: uuid("offer_id").references(() => offers.id),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => user.id),
    eventDate: date("event_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    timezone: text("timezone").notNull(),
    guests: integer("guests"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2, mode: "number" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    depositAmount: numeric("deposit_amount", { precision: 12, scale: 2, mode: "number" }),
    depositStatus: depositStatusEnum("deposit_status").notNull().default("not_required"),
    balanceStatus: balanceStatusEnum("balance_status").notNull().default("not_due"),
    balanceDueDate: date("balance_due_date"),
    status: bookingStatusEnum("status").notNull().default("requested"),
    requestExpiresAt: timestamp("request_expires_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("bookings_customer_idx").on(t.customerId, t.eventDate),
    index("bookings_business_idx").on(t.businessId, t.eventDate),
    index("bookings_listing_idx").on(t.listingId, t.eventDate),
    index("bookings_status_idx").on(t.status),
    index("bookings_request_expires_idx").on(t.requestExpiresAt),
  ],
);

export const reviewStatusEnum = pgEnum("review_status", ["pending", "published", "hidden"]);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => user.id),
    rating: smallint("rating").notNull(),
    ratingValue: smallint("rating_value"),
    ratingService: smallint("rating_service"),
    ratingQuality: smallint("rating_quality"),
    body: text("body"),
    locale: localeEnum("locale").notNull().default("tr"),
    businessReply: text("business_reply"),
    businessRepliedAt: timestamp("business_replied_at", { withTimezone: true }),
    status: reviewStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_booking_uq").on(t.bookingId),
    index("reviews_listing_status_idx").on(t.listingId, t.status, t.createdAt),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);
