import "server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { auditLog, businesses, cities, listings, member, organization, subscriptions, user } from "@/db/schema";
import type { LngLat } from "@/db/schema/_shared";
import { qualified } from "@/db/sql";
import type { ResolvedAddress, ResolvedCity } from "@/lib/adapters/geocode";
import { onboardingCompleteness, listingChecks, summarise } from "@/lib/completeness";
import { MAX_BUSINESSES_PER_USER, type ListingType } from "@/lib/listing-config";
import { slugify } from "@/lib/slug";
import { normalisePhone, pickValidFields } from "@/lib/validation/common";
import { businessInfoFields, businessSettingsStrict, createBusinessInput } from "@/lib/validation/business";
import { adminContacts } from "@/server/internal/notify";
import { effectiveSubscriptionStatus } from "@/server/rules";
import { businessSnapshot, listingSnapshot } from "@/server/internal/snapshots";
import { draftSlug, isDraftSlug, uniqueSlug } from "@/server/internal/slugs";
import { refreshBusinessVisibility } from "@/server/internal/visibility";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { DalError } from "./errors";
import { requireBusinessMember, requireUser } from "./guards";

/** Owners can't edit a suspended business; everything else stays editable. */
async function requireEditableBusiness(ctx: DalContext, businessId: string) {
  const res = await requireBusinessMember(ctx, businessId);
  if (res.business.status === "suspended") throw new DalError("FORBIDDEN", "suspended");
  return res;
}

/**
 * Step 0: the owner picks venue / caterer / performer. Creates the business
 * (draft), its team organization, and an empty first listing.
 */
export async function createBusinessDraft(ctx: DalContext, raw: { type: ListingType }) {
  const u = requireUser(ctx);
  const { type } = createBusinessInput.parse(raw);
  const [{ n }] = await ctx.db
    .select({ n: count() })
    .from(businesses)
    .where(and(eq(businesses.ownerId, u.id), isNull(businesses.deletedAt)));
  if (n >= MAX_BUSINESSES_PER_USER) throw new DalError("CONFLICT", "too_many_businesses");

  return ctx.db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organization)
      .values({ name: "Business", slug: `biz-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    await tx.insert(member).values({ organizationId: org.id, userId: u.id, role: "owner" });
    const [biz] = await tx
      .insert(businesses)
      .values({ ownerId: u.id, organizationId: org.id, type, slug: draftSlug(), status: "draft" })
      .returning({ id: businesses.id });
    const [listing] = await tx
      .insert(listings)
      .values({ businessId: biz.id, type, slug: draftSlug(), status: "draft", currency: "GBP" })
      .returning({ id: listings.id });
    // A customer who lists a business becomes a business user (admins keep their role).
    if (u.role === "customer") await tx.update(user).set({ role: "business" }).where(eq(user.id, u.id));
    await tx
      .insert(auditLog)
      .values({ actorId: u.id, action: "business.create", entity: "business", entityId: biz.id, diff: { type } });
    return { businessId: biz.id, listingId: listing.id };
  });
}

/** Owner view of one business: profile, city, listings and the onboarding score. */
export async function getOwnerBusiness(ctx: DalContext, businessId: string) {
  const { business, role } = await requireBusinessMember(ctx, businessId);
  const [city] = business.cityId
    ? await ctx.db
        .select({ id: cities.id, nameEn: cities.nameEn, nameTr: cities.nameTr, countryIso2: cities.countryIso2 })
        .from(cities)
        .where(eq(cities.id, business.cityId))
    : [];
  const rows = await ctx.db
    .select({
      id: listings.id,
      type: listings.type,
      titleTr: listings.titleTr,
      titleEn: listings.titleEn,
      slug: listings.slug,
      status: listings.status,
      isPublic: listings.isPublic,
      reviewNote: listings.reviewNote,
      rejectionReason: listings.rejectionReason,
      createdAt: listings.createdAt,
      coverUrl: sql<string | null>`(select coalesce(m.url_small, m.url_medium) from listing_media m
        where m.listing_id = ${qualified(listings, listings.id)} and m.kind = 'image' order by m.sort_order limit 1)`,
      imageCount: sql<number>`(select count(*)::int from listing_media m where m.listing_id = ${qualified(listings, listings.id)} and m.kind = 'image')`,
    })
    .from(listings)
    .where(and(eq(listings.businessId, businessId), isNull(listings.deletedAt)))
    .orderBy(asc(listings.createdAt));

  const snapshots = await Promise.all(rows.map((r) => listingSnapshot(ctx.db, r.id)));
  const completeness = onboardingCompleteness(businessSnapshot(business), snapshots[0] ?? null);
  // Billing is the owner's business: managers don't see the subscription.
  const [subscription] =
    role === "owner"
      ? await ctx.db
          .select({
            status: subscriptions.status,
            trialEndsAt: subscriptions.trialEndsAt,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            graceUntil: subscriptions.graceUntil,
          })
          .from(subscriptions)
          .where(eq(subscriptions.businessId, businessId))
          .limit(1)
      : [];
  return {
    business,
    role,
    city: city ?? null,
    listings: rows.map((r, i) => ({
      ...r,
      completeness: snapshots[i] ? summarise(listingChecks(snapshots[i])) : null,
    })),
    firstListingId: rows[0]?.id ?? null,
    completeness,
    // Status evaluated lazily, so an ended trial reads as ended even before the daily job runs.
    subscription: subscription
      ? { ...subscription, status: effectiveSubscriptionStatus(subscription, nowOf(ctx)) }
      : null,
  };
}

/** Autosave for the "Business info" step. Invalid fields are skipped and reported, never fatal. */
export async function updateBusinessInfo(ctx: DalContext, businessId: string, raw: Record<string, unknown>) {
  const { business } = await requireEditableBusiness(ctx, businessId);
  const { valid, invalid } = pickValidFields(businessInfoFields, raw);
  const patch: Partial<typeof businesses.$inferInsert> = {};
  if ("nameTr" in valid) patch.nameTr = valid.nameTr ?? null;
  if ("nameEn" in valid) patch.nameEn = valid.nameEn ?? null;
  if ("descriptionTr" in valid) patch.descriptionTr = valid.descriptionTr ?? null;
  if ("descriptionEn" in valid) patch.descriptionEn = valid.descriptionEn ?? null;
  if ("email" in valid) patch.email = valid.email ?? null;
  if ("website" in valid) patch.website = valid.website ?? null;
  if ("instagram" in valid) patch.instagram = valid.instagram ?? null;
  if ("phone" in valid) {
    const rawPhone = valid.phone?.trim();
    // Before the address step we don't know the country yet: fall back to the visitor's country.
    const hint = typeof raw.phoneCountry === "string" && /^[A-Z]{2}$/.test(raw.phoneCountry) ? raw.phoneCountry : null;
    if (!rawPhone) patch.phoneE164 = null;
    else {
      const e164 = normalisePhone(rawPhone, business.countryIso2 ?? hint);
      if (e164) patch.phoneE164 = e164;
      else invalid.push("phone");
    }
  }
  if (Object.keys(patch).length) await ctx.db.update(businesses).set(patch).where(eq(businesses.id, businessId));
  return { saved: Object.keys(patch), invalid, phoneE164: patch.phoneE164 ?? business.phoneE164 };
}

/**
 * Finds or creates the city for a resolved address. Cities are deduplicated by
 * provider place id first, then by country + English name (+ admin area when
 * two places share a name).
 */
export async function upsertCityForAddress(
  ctx: DalContext,
  addr: ResolvedAddress,
  resolved: ResolvedCity | null,
  timezone: string,
): Promise<string> {
  requireUser(ctx);
  const placeId =
    resolved?.placeId ??
    `${addr.provider === "manual" ? "manual" : addr.provider}:${addr.countryIso2}:${slugify(addr.locality)}`;
  const [byPlace] = await ctx.db
    .select({ id: cities.id, mergedIntoId: cities.mergedIntoId })
    .from(cities)
    .where(eq(cities.googlePlaceId, placeId));
  if (byPlace) return byPlace.mergedIntoId ?? byPlace.id;

  const nameEn = (resolved?.nameEn ?? addr.locality).slice(0, 120);
  const nameTr = (resolved?.nameTr ?? addr.locality).slice(0, 120);
  const slugEn = slugify(nameEn);
  const [byName] = await ctx.db
    .select({ id: cities.id, adminArea: cities.adminArea, mergedIntoId: cities.mergedIntoId })
    .from(cities)
    .where(and(eq(cities.countryIso2, addr.countryIso2), eq(cities.slugEn, slugEn)));
  const adminArea = resolved?.adminArea ?? addr.adminArea;
  if (byName && (!byName.adminArea || !adminArea || byName.adminArea === adminArea))
    return byName.mergedIntoId ?? byName.id;

  // Same name, different region (e.g. two Richmonds) → disambiguate the slugs.
  const suffix = byName && adminArea ? `-${slugify(adminArea)}` : "";
  const centre: LngLat | null = resolved?.centre ?? null;
  const [created] = await ctx.db
    .insert(cities)
    .values({
      countryIso2: addr.countryIso2,
      googlePlaceId: placeId,
      nameEn,
      nameTr,
      slugEn: `${slugEn}${suffix}`,
      slugTr: `${slugify(nameTr)}${suffix}`,
      adminArea,
      centre,
      timezone,
    })
    .onConflictDoNothing()
    .returning({ id: cities.id });
  if (created) return created.id;
  // Lost a race with a concurrent insert — read the winner.
  const [winner] = await ctx.db
    .select({ id: cities.id })
    .from(cities)
    .where(and(eq(cities.countryIso2, addr.countryIso2), eq(cities.slugEn, `${slugEn}${suffix}`)));
  if (!winner) throw new DalError("CONFLICT", "city_upsert_failed");
  return winner.id;
}

/** "Location" step: stores the address, point, city, and (first time) currency and time zone. */
export async function setBusinessLocation(
  ctx: DalContext,
  businessId: string,
  input: {
    address: ResolvedAddress;
    city: ResolvedCity | null;
    addressExtra?: string | null;
    timezone: string;
    currency: string;
  },
) {
  const { business } = await requireEditableBusiness(ctx, businessId);
  const cityId = await upsertCityForAddress(ctx, input.address, input.city, input.timezone);
  const addressLine = [input.addressExtra, input.address.formattedAddress].filter(Boolean).join(", ").slice(0, 300);
  const countryChanged = business.countryIso2 !== input.address.countryIso2;
  await ctx.db
    .update(businesses)
    .set({
      addressLine,
      addressComponents: {
        locality: input.address.locality,
        ...(input.address.adminArea ? { adminArea: input.address.adminArea } : {}),
        ...(input.address.postalCode ? { postalCode: input.address.postalCode } : {}),
        provider: input.address.provider,
      },
      location: input.address.location,
      countryIso2: input.address.countryIso2,
      cityId,
      // Prefill on first save or when the country changes; the owner can edit both on the next step.
      timezone: !business.timezone || countryChanged ? input.timezone : business.timezone,
      currency: !business.currency || countryChanged ? input.currency : business.currency,
    })
    .where(eq(businesses.id, businessId));
  if (!business.currency || countryChanged) {
    await ctx.db.update(listings).set({ currency: input.currency }).where(eq(listings.businessId, businessId));
  }
  if (business.status === "approved") await refreshBusinessVisibility(ctx.db, businessId, nowOf(ctx));
  return { cityId };
}

/** "Currency & time zone" step. Listing prices follow the business currency. */
export async function updateBusinessSettings(
  ctx: DalContext,
  businessId: string,
  raw: { currency: string; timezone: string },
) {
  const { business } = await requireEditableBusiness(ctx, businessId);
  const { currency, timezone } = businessSettingsStrict.parse(raw);
  await ctx.db.update(businesses).set({ currency, timezone }).where(eq(businesses.id, businessId));
  if (currency !== business.currency) {
    await ctx.db
      .update(listings)
      .set({ currency, priceFromGbp: currency === "GBP" ? sql`${listings.priceFrom}` : null })
      .where(eq(listings.businessId, businessId));
  }
  return { currency, timezone };
}

export async function setBusinessLogo(ctx: DalContext, businessId: string, logoUrl: string | null) {
  await requireEditableBusiness(ctx, businessId);
  const [prev] = await ctx.db
    .select({ logoUrl: businesses.logoUrl })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  await ctx.db.update(businesses).set({ logoUrl }).where(eq(businesses.id, businessId));
  return { previousLogoUrl: prev?.logoUrl ?? null };
}

/**
 * Sends the business (and every complete listing) to the admin approval queue.
 * Final, readable slugs are assigned here. Returns admin contacts for the email.
 */
export async function submitBusinessForReview(ctx: DalContext, businessId: string) {
  const { business, user: u } = await requireEditableBusiness(ctx, businessId);
  if (!["draft", "changes_requested", "rejected"].includes(business.status))
    throw new DalError("CONFLICT", "not_submittable");

  const rows = await ctx.db
    .select({
      id: listings.id,
      titleTr: listings.titleTr,
      titleEn: listings.titleEn,
      slug: listings.slug,
      status: listings.status,
    })
    .from(listings)
    .where(and(eq(listings.businessId, businessId), isNull(listings.deletedAt)))
    .orderBy(asc(listings.createdAt));
  const snapshots = await Promise.all(rows.map((r) => listingSnapshot(ctx.db, r.id)));
  const complete = rows.filter((_, i) => snapshots[i] && summarise(listingChecks(snapshots[i]!)).canSubmit);
  const completeness = onboardingCompleteness(businessSnapshot(business), snapshots[0] ?? null);
  const businessReady = completeness.checks
    .filter((c) => c.key.startsWith("business_") && c.required)
    .every((c) => c.done);
  if (!businessReady || complete.length === 0) {
    throw new DalError("INVALID", "incomplete");
  }

  const [city] = business.cityId
    ? await ctx.db.select({ nameEn: cities.nameEn }).from(cities).where(eq(cities.id, business.cityId))
    : [];
  const cityPart = city?.nameEn ?? "";
  const businessName = business.nameEn ?? business.nameTr ?? "business";
  const now = nowOf(ctx);

  return ctx.db.transaction(async (tx) => {
    const slug = isDraftSlug(business.slug)
      ? await uniqueSlug(tx, "businesses", `${businessName} ${cityPart}`, businessId)
      : business.slug;
    await tx
      .update(businesses)
      .set({ status: "pending_review", submittedAt: now, reviewNote: null, rejectionReason: null, slug })
      .where(eq(businesses.id, businessId));
    for (const l of complete) {
      const title = l.titleEn ?? l.titleTr ?? businessName;
      const base = slugify(title).includes(slugify(businessName))
        ? `${title} ${cityPart}`
        : `${title} ${businessName} ${cityPart}`;
      const lslug = isDraftSlug(l.slug) ? await uniqueSlug(tx, "listings", base, l.id) : l.slug;
      await tx
        .update(listings)
        .set({ status: "pending_review", submittedAt: now, reviewNote: null, rejectionReason: null, slug: lslug })
        .where(eq(listings.id, l.id));
    }
    await tx.insert(auditLog).values({
      actorId: u.id,
      action: "business.submit",
      entity: "business",
      entityId: businessId,
      diff: { listings: complete.map((l) => l.id) },
    });
    return {
      businessName,
      submittedListings: complete.length,
      skippedListings: rows.length - complete.length,
      admins: await adminContacts(tx),
    };
  });
}

/** Minimal list of the caller's businesses with their first listing — used by /business. */
export async function listMyBusinessesWithListings(ctx: DalContext) {
  const u = requireUser(ctx);
  const orgIds = ctx.db.select({ id: member.organizationId }).from(member).where(eq(member.userId, u.id));
  const bizRows = await ctx.db
    .select({
      id: businesses.id,
      type: businesses.type,
      nameTr: businesses.nameTr,
      nameEn: businesses.nameEn,
      status: businesses.status,
      reviewNote: businesses.reviewNote,
      cityNameEn: cities.nameEn,
      cityNameTr: cities.nameTr,
      createdAt: businesses.createdAt,
    })
    .from(businesses)
    .leftJoin(cities, eq(cities.id, businesses.cityId))
    .where(
      and(
        isNull(businesses.deletedAt),
        sql`(${businesses.ownerId} = ${u.id} or ${businesses.organizationId} in ${orgIds})`,
      ),
    )
    .orderBy(asc(businesses.createdAt));
  if (!bizRows.length) return [];
  const counts = await ctx.db
    .select({
      businessId: listings.businessId,
      n: count(),
      live: sql<number>`count(*) filter (where ${listings.isPublic})::int`,
    })
    .from(listings)
    .where(
      and(
        inArray(
          listings.businessId,
          bizRows.map((b) => b.id),
        ),
        isNull(listings.deletedAt),
      ),
    )
    .groupBy(listings.businessId);
  const byBiz = new Map(counts.map((c) => [c.businessId, c]));
  return bizRows.map((b) => ({ ...b, listingCount: byBiz.get(b.id)?.n ?? 0, liveCount: byBiz.get(b.id)?.live ?? 0 }));
}
