/**
 * Better Auth tables (user, session, account, verification) and the organization
 * plugin tables (organization, member, invitation). TS property names must match
 * Better Auth's field names; columns are snake_case.
 */
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { id, softDelete, timestamps } from "./_shared";

export const userRoleEnum = pgEnum("user_role", ["customer", "business", "admin"]);
export const localeEnum = pgEnum("app_locale", ["tr", "en"]);

export const user = pgTable(
  "user",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // Bizim Event extensions
    role: userRoleEnum("role").notNull().default("customer"),
    phone: varchar("phone", { length: 20 }), // E.164
    preferredLocale: localeEnum("preferred_locale").notNull().default("tr"),
    countryIso2: varchar("country_iso2", { length: 2 }),
    marketingOptInEmail: boolean("marketing_opt_in_email").notNull().default(false),
    marketingOptInSms: boolean("marketing_opt_in_sms").notNull().default(false),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex("user_email_uq").on(t.email), index("user_role_idx").on(t.role)],
);

export const session = pgTable(
  "session",
  {
    id: id(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: uuid("active_organization_id"),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_token_uq").on(t.token), index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const organization = pgTable(
  "organization",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("organization_slug_uq").on(t.slug)],
);

export const member = pgTable(
  "member",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Better Auth roles: owner | admin | member. We map "manager" → member.
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("member_org_user_uq").on(t.organizationId, t.userId),
    index("member_user_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitation_org_idx").on(t.organizationId), index("invitation_email_idx").on(t.email)],
);
