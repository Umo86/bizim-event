import "server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Queryable } from "@/db";
import {
  amenities,
  auditLog,
  businesses,
  cancellationPolicies,
  catererDetails,
  cities,
  eventTypes,
  listingAmenities,
  listingCapacities,
  listingEventTypes,
  listingMedia,
  listings,
  performerDetails,
  subscriptions,
  user,
  venueDetails,
  venueTypes,
} from "@/db/schema";
import { qualified } from "@/db/sql";
import { TRIAL_DAYS } from "@/lib/plans";
import { reviewNoteInput } from "@/lib/validation/business";
import { notifyUser } from "@/server/internal/notify";
import { refreshBusinessVisibility } from "@/server/internal/visibility";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { DalError } from "./errors";
import { requireAdmin } from "./guards";

export type OwnerContact = { id: string; email: string; name: string; preferredLocale: "tr" | "en" };

async function ownerOf(db: Queryable, businessId: string) {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      preferredLocale: user.preferredLocale,
      businessNameTr: businesses.nameTr,
      businessNameEn: businesses.nameEn,
    })
    .from(businesses)
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!row) throw new DalError("NOT_FOUND");
  const owner: OwnerContact = { id: row.id, email: row.email, name: row.name, preferredLocale: row.preferredLocale };
  const businessName =
    (row.preferredLocale === "en"
      ? (row.businessNameEn ?? row.businessNameTr)
      : (row.businessNameTr ?? row.businessNameEn)) ?? "";
  return { owner, businessName };
}

export async function listPendingBusinesses(ctx: DalContext) {
  await requireAdmin(ctx);
  return ctx.db
    .select()
    .from(businesses)
    .where(eq(businesses.status, "pending_review"))
    .orderBy(asc(businesses.submittedAt))
    .limit(100);
}

/** The approval queue: new businesses, plus new listings from businesses that are already live. */
export async function reviewQueue(ctx: DalContext) {
  await requireAdmin(ctx);
  const pendingBusinesses = await ctx.db
    .select({
      id: businesses.id,
      type: businesses.type,
      nameTr: businesses.nameTr,
      nameEn: businesses.nameEn,
      submittedAt: businesses.submittedAt,
      countryIso2: businesses.countryIso2,
      cityNameEn: cities.nameEn,
      cityNameTr: cities.nameTr,
      ownerName: user.name,
      ownerEmail: user.email,
      listingCount: sql<number>`(select count(*)::int from listings l where l.business_id = ${qualified(businesses, businesses.id)} and l.status = 'pending_review')`,
    })
    .from(businesses)
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .leftJoin(cities, eq(cities.id, businesses.cityId))
    .where(eq(businesses.status, "pending_review"))
    .orderBy(asc(businesses.submittedAt))
    .limit(100);
  const pendingListings = await ctx.db
    .select({
      id: listings.id,
      businessId: listings.businessId,
      type: listings.type,
      titleTr: listings.titleTr,
      titleEn: listings.titleEn,
      submittedAt: listings.submittedAt,
      businessNameTr: businesses.nameTr,
      businessNameEn: businesses.nameEn,
      cityNameEn: cities.nameEn,
      cityNameTr: cities.nameTr,
    })
    .from(listings)
    .innerJoin(businesses, eq(businesses.id, listings.businessId))
    .leftJoin(cities, eq(cities.id, businesses.cityId))
    .where(and(eq(listings.status, "pending_review"), eq(businesses.status, "approved"), isNull(listings.deletedAt)))
    .orderBy(asc(listings.submittedAt))
    .limit(100);
  return { pendingBusinesses, pendingListings };
}

/** Everything an admin needs to judge a submission, including photos and the owner's contact. */
export async function getBusinessForReview(ctx: DalContext, businessId: string) {
  await requireAdmin(ctx);
  const [business] = await ctx.db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) throw new DalError("NOT_FOUND");
  const [owner] = await ctx.db
    .select({ name: user.name, email: user.email, createdAt: user.createdAt, preferredLocale: user.preferredLocale })
    .from(user)
    .where(eq(user.id, business.ownerId));
  const [city] = business.cityId ? await ctx.db.select().from(cities).where(eq(cities.id, business.cityId)) : [];
  const rows = await ctx.db
    .select()
    .from(listings)
    .where(and(eq(listings.businessId, businessId), isNull(listings.deletedAt)))
    .orderBy(asc(listings.createdAt));
  const ids = rows.map((r) => r.id);
  const [media, caps, ets, ams, venues, caterers, performers] = ids.length
    ? await Promise.all([
        ctx.db
          .select()
          .from(listingMedia)
          .where(inArray(listingMedia.listingId, ids))
          .orderBy(asc(listingMedia.sortOrder)),
        ctx.db.select().from(listingCapacities).where(inArray(listingCapacities.listingId, ids)),
        ctx.db
          .select({ listingId: listingEventTypes.listingId, labelTr: eventTypes.labelTr, labelEn: eventTypes.labelEn })
          .from(listingEventTypes)
          .innerJoin(eventTypes, eq(eventTypes.id, listingEventTypes.eventTypeId))
          .where(inArray(listingEventTypes.listingId, ids)),
        ctx.db
          .select({ listingId: listingAmenities.listingId, labelTr: amenities.labelTr, labelEn: amenities.labelEn })
          .from(listingAmenities)
          .innerJoin(amenities, eq(amenities.id, listingAmenities.amenityId))
          .where(inArray(listingAmenities.listingId, ids)),
        ctx.db
          .select({ details: venueDetails, venueTypeTr: venueTypes.labelTr, venueTypeEn: venueTypes.labelEn })
          .from(venueDetails)
          .leftJoin(venueTypes, eq(venueTypes.id, venueDetails.venueTypeId))
          .where(inArray(venueDetails.listingId, ids)),
        ctx.db.select().from(catererDetails).where(inArray(catererDetails.listingId, ids)),
        ctx.db.select().from(performerDetails).where(inArray(performerDetails.listingId, ids)),
      ])
    : [[], [], [], [], [], [], []];
  const policyIds = rows.map((r) => r.cancellationPolicyId).filter((x): x is string => !!x);
  const policies = policyIds.length
    ? await ctx.db.select().from(cancellationPolicies).where(inArray(cancellationPolicies.id, policyIds))
    : [];
  return {
    business,
    owner: owner ?? null,
    city: city ?? null,
    listings: rows.map((l) => ({
      ...l,
      media: media.filter((m) => m.listingId === l.id),
      capacities: caps.filter((c) => c.listingId === l.id),
      eventTypes: ets.filter((e) => e.listingId === l.id),
      amenities: ams.filter((a) => a.listingId === l.id),
      venue: venues.find((v) => v.details.listingId === l.id) ?? null,
      caterer: caterers.find((c) => c.listingId === l.id) ?? null,
      performer: performers.find((p) => p.listingId === l.id) ?? null,
      policy: policies.find((p) => p.id === l.cancellationPolicyId) ?? null,
    })),
  };
}
export type BusinessReview = Awaited<ReturnType<typeof getBusinessForReview>>;

/**
 * Approves a business and its submitted listings, and starts the 90-day free
 * trial (the trial starts at approval, not sign-up). Idempotent.
 */
export async function approveBusiness(ctx: DalContext, businessId: string) {
  const admin = await requireAdmin(ctx);
  const now = nowOf(ctx);
  return ctx.db.transaction(async (tx) => {
    const [biz] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!biz) throw new DalError("NOT_FOUND");
    if (biz.status !== "pending_review" && biz.status !== "approved") throw new DalError("CONFLICT", "not_pending");

    await tx
      .update(businesses)
      .set({
        status: "approved",
        approvedAt: biz.approvedAt ?? now,
        verifiedAt: biz.verifiedAt ?? now,
        rejectionReason: null,
        reviewNote: null,
      })
      .where(eq(businesses.id, businessId));
    await tx
      .update(listings)
      .set({ status: "approved", reviewNote: null, rejectionReason: null })
      .where(and(eq(listings.businessId, businessId), eq(listings.status, "pending_review")));

    const [existing] = await tx.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1);
    let trialEndsAt = existing?.trialEndsAt ?? null;
    if (!existing) {
      trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 864e5);
      await tx.insert(subscriptions).values({ businessId, status: "trialing", trialStartedAt: now, trialEndsAt });
    }
    await tx
      .insert(auditLog)
      .values({ actorId: admin.id, action: "business.approve", entity: "business", entityId: businessId });
    await refreshBusinessVisibility(tx, businessId, now);
    const { owner, businessName } = await ownerOf(tx, businessId);
    await notifyUser(tx, owner.id, "business_approved", {
      businessId,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
    });
    return { ok: true as const, owner, businessName, trialEndsAt };
  });
}

/** Sends the submission back with a note; the owner edits and resubmits. */
export async function requestBusinessChanges(ctx: DalContext, businessId: string, raw: { note: string }) {
  const admin = await requireAdmin(ctx);
  const { note } = reviewNoteInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [biz] = await tx
      .select({ status: businesses.status })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz) throw new DalError("NOT_FOUND");
    if (biz.status !== "pending_review") throw new DalError("CONFLICT", "not_pending");
    await tx
      .update(businesses)
      .set({ status: "changes_requested", reviewNote: note })
      .where(eq(businesses.id, businessId));
    await tx
      .update(listings)
      .set({ status: "changes_requested" })
      .where(and(eq(listings.businessId, businessId), eq(listings.status, "pending_review")));
    await tx.insert(auditLog).values({
      actorId: admin.id,
      action: "business.request_changes",
      entity: "business",
      entityId: businessId,
      diff: { note },
    });
    const { owner, businessName } = await ownerOf(tx, businessId);
    await notifyUser(tx, owner.id, "business_changes_requested", { businessId, note });
    return { owner, businessName, note };
  });
}

export async function rejectBusiness(ctx: DalContext, businessId: string, reason: string) {
  const admin = await requireAdmin(ctx);
  const { note } = reviewNoteInput.parse({ note: reason });
  return ctx.db.transaction(async (tx) => {
    const [biz] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!biz) throw new DalError("NOT_FOUND");
    await tx.update(businesses).set({ status: "rejected", rejectionReason: note }).where(eq(businesses.id, businessId));
    await tx
      .update(listings)
      .set({ status: "rejected", rejectionReason: note })
      .where(
        and(
          eq(listings.businessId, businessId),
          inArray(listings.status, ["pending_review", "changes_requested", "draft"]),
        ),
      );
    await tx.insert(auditLog).values({
      actorId: admin.id,
      action: "business.reject",
      entity: "business",
      entityId: businessId,
      diff: { reason: note },
    });
    await refreshBusinessVisibility(tx, businessId, nowOf(ctx));
    const { owner, businessName } = await ownerOf(tx, businessId);
    await notifyUser(tx, owner.id, "business_rejected", { businessId, reason: note });
    return { owner, businessName, reason: note };
  });
}

// Listing-level review (new listings on approved businesses) --------------------------------

async function pendingListing(db: Queryable, listingId: string) {
  const [l] = await db
    .select({
      id: listings.id,
      businessId: listings.businessId,
      status: listings.status,
      titleTr: listings.titleTr,
      titleEn: listings.titleEn,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!l) throw new DalError("NOT_FOUND");
  if (l.status !== "pending_review") throw new DalError("CONFLICT", "not_pending");
  return l;
}

export async function approveListing(ctx: DalContext, listingId: string) {
  const admin = await requireAdmin(ctx);
  return ctx.db.transaction(async (tx) => {
    const l = await pendingListing(tx, listingId);
    await tx
      .update(listings)
      .set({ status: "approved", reviewNote: null, rejectionReason: null })
      .where(eq(listings.id, listingId));
    await tx
      .insert(auditLog)
      .values({ actorId: admin.id, action: "listing.approve", entity: "listing", entityId: listingId });
    await refreshBusinessVisibility(tx, l.businessId, nowOf(ctx));
    const { owner, businessName } = await ownerOf(tx, l.businessId);
    await notifyUser(tx, owner.id, "listing_approved", { listingId });
    return { owner, businessName, listingTitle: l.titleEn ?? l.titleTr ?? "" };
  });
}

export async function requestListingChanges(ctx: DalContext, listingId: string, raw: { note: string }) {
  const admin = await requireAdmin(ctx);
  const { note } = reviewNoteInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const l = await pendingListing(tx, listingId);
    await tx.update(listings).set({ status: "changes_requested", reviewNote: note }).where(eq(listings.id, listingId));
    await tx.insert(auditLog).values({
      actorId: admin.id,
      action: "listing.request_changes",
      entity: "listing",
      entityId: listingId,
      diff: { note },
    });
    const { owner, businessName } = await ownerOf(tx, l.businessId);
    await notifyUser(tx, owner.id, "listing_changes_requested", { listingId, note });
    return { owner, businessName, listingTitle: l.titleEn ?? l.titleTr ?? "", note };
  });
}

export async function rejectListing(ctx: DalContext, listingId: string, raw: { note: string }) {
  const admin = await requireAdmin(ctx);
  const { note } = reviewNoteInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const l = await pendingListing(tx, listingId);
    await tx.update(listings).set({ status: "rejected", rejectionReason: note }).where(eq(listings.id, listingId));
    await tx.insert(auditLog).values({
      actorId: admin.id,
      action: "listing.reject",
      entity: "listing",
      entityId: listingId,
      diff: { reason: note },
    });
    const { owner, businessName } = await ownerOf(tx, l.businessId);
    await notifyUser(tx, owner.id, "listing_rejected", { listingId, reason: note });
    return { owner, businessName, listingTitle: l.titleEn ?? l.titleTr ?? "", reason: note };
  });
}

export async function subscriptionCountsByStatus(ctx: DalContext) {
  await requireAdmin(ctx);
  return ctx.db.select({ status: subscriptions.status, n: count() }).from(subscriptions).groupBy(subscriptions.status);
}

/** System usage page: database size and the biggest tables (free-tier watch). */
export async function systemUsage(ctx: DalContext) {
  await requireAdmin(ctx);
  const size = await ctx.db.execute<{ bytes: string }>(sql`select pg_database_size(current_database())::text as bytes`);
  const tables = await ctx.db.execute<{ table: string; rows: string; bytes: string }>(sql`
    select relname as "table", n_live_tup::text as rows, pg_total_relation_size(relid)::text as bytes
    from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 15`);
  const [media] = await ctx.db
    .select({ objects: count(), bytes: sql<number>`coalesce(sum(${listingMedia.bytes}), 0)::bigint` })
    .from(listingMedia);
  return {
    databaseBytes: Number(size.rows[0]?.bytes ?? 0),
    freeTierBytes: 1024 ** 3,
    tables: tables.rows.map((r) => ({ table: r.table, rows: Number(r.rows), bytes: Number(r.bytes) })),
    media: { objects: Number(media?.objects ?? 0), bytes: Number(media?.bytes ?? 0) },
  };
}
