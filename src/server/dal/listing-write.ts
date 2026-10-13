import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import {
  actTypes as actTypesTable,
  amenities,
  auditLog,
  cancellationPolicies,
  catererDetails,
  cities,
  cuisines as cuisinesTable,
  eventTypes,
  languages as languagesTable,
  listingAmenities,
  listingCapacities,
  listingEventTypes,
  listingMedia,
  listingPrices,
  listings,
  performerDetails,
  serviceStyles as serviceStylesTable,
  venueDetails,
  venueTypes,
} from "@/db/schema";
import { listingChecks, summarise } from "@/lib/completeness";
import {
  CAPACITY_LAYOUTS,
  MAX_LISTINGS_PER_BUSINESS,
  PRICING_MODELS_BY_TYPE,
  type CapacityLayout,
  type ListingType,
} from "@/lib/listing-config";
import { slugify } from "@/lib/slug";
import { pickValidFields } from "@/lib/validation/common";
import {
  listingBasicsFields,
  listingCancellationFields,
  listingDetailsFields,
  listingEventTypesFields,
  listingPricingFields,
} from "@/lib/validation/listing";
import { adminContacts } from "@/server/internal/notify";
import { listingSnapshot } from "@/server/internal/snapshots";
import { draftSlug, isDraftSlug, uniqueSlug } from "@/server/internal/slugs";
import { refreshBusinessVisibility } from "@/server/internal/visibility";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { DalError } from "./errors";
import { requireBusinessMember } from "./guards";

/** Guard: caller is on the listing's business team, and neither is deleted or suspended. */
export async function requireListingEditor(ctx: DalContext, listingId: string) {
  const [listing] = await ctx.db
    .select()
    .from(listings)
    .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
    .limit(1);
  if (!listing) throw new DalError("FORBIDDEN");
  const { business, user } = await requireBusinessMember(ctx, listing.businessId);
  if (business.status === "suspended") throw new DalError("FORBIDDEN", "suspended");
  return { listing, business, user };
}

async function knownKeys(
  ctx: DalContext,
  table: typeof cuisinesTable | typeof serviceStylesTable | typeof actTypesTable | typeof languagesTable,
  keys: string[],
) {
  if (!keys.length) return [];
  const rows = await ctx.db.select({ key: table.key }).from(table).where(inArray(table.key, keys));
  const ok = new Set(rows.map((r) => r.key));
  return keys.filter((k, i) => ok.has(k) && keys.indexOf(k) === i);
}

/** Everything the listing editor/wizard needs, serialisable for client components. */
export async function getListingEditorData(ctx: DalContext, listingId: string) {
  const { listing, business } = await requireListingEditor(ctx, listingId);
  const [venue] = await ctx.db.select().from(venueDetails).where(eq(venueDetails.listingId, listingId));
  const [caterer] = await ctx.db.select().from(catererDetails).where(eq(catererDetails.listingId, listingId));
  const [performer] = await ctx.db.select().from(performerDetails).where(eq(performerDetails.listingId, listingId));
  const caps = await ctx.db.select().from(listingCapacities).where(eq(listingCapacities.listingId, listingId));
  const prices = await ctx.db
    .select({ dayOfWeek: listingPrices.dayOfWeek, session: listingPrices.session, price: listingPrices.price })
    .from(listingPrices)
    .where(eq(listingPrices.listingId, listingId));
  const ets = await ctx.db
    .select({ key: eventTypes.key })
    .from(listingEventTypes)
    .innerJoin(eventTypes, eq(eventTypes.id, listingEventTypes.eventTypeId))
    .where(eq(listingEventTypes.listingId, listingId));
  const ams = await ctx.db
    .select({ key: amenities.key })
    .from(listingAmenities)
    .innerJoin(amenities, eq(amenities.id, listingAmenities.amenityId))
    .where(eq(listingAmenities.listingId, listingId));
  const media = await ctx.db
    .select({
      id: listingMedia.id,
      kind: listingMedia.kind,
      urlSmall: listingMedia.urlSmall,
      urlMedium: listingMedia.urlMedium,
      urlLarge: listingMedia.urlLarge,
      blurDataUrl: listingMedia.blurDataUrl,
      captionTr: listingMedia.captionTr,
      captionEn: listingMedia.captionEn,
      width: listingMedia.width,
      height: listingMedia.height,
      sortOrder: listingMedia.sortOrder,
    })
    .from(listingMedia)
    .where(eq(listingMedia.listingId, listingId))
    .orderBy(asc(listingMedia.sortOrder), asc(listingMedia.createdAt));
  const [policy] = listing.cancellationPolicyId
    ? await ctx.db.select().from(cancellationPolicies).where(eq(cancellationPolicies.id, listing.cancellationPolicyId))
    : [];
  const [vt] = venue?.venueTypeId
    ? await ctx.db.select({ key: venueTypes.key }).from(venueTypes).where(eq(venueTypes.id, venue.venueTypeId))
    : [];
  const [city] = business.cityId
    ? await ctx.db
        .select({ nameEn: cities.nameEn, nameTr: cities.nameTr })
        .from(cities)
        .where(eq(cities.id, business.cityId))
    : [];
  const snapshot = await listingSnapshot(ctx.db, listingId);

  return {
    listing: {
      id: listing.id,
      businessId: listing.businessId,
      type: listing.type as ListingType,
      status: listing.status,
      isPublic: listing.isPublic,
      slug: listing.slug,
      titleTr: listing.titleTr,
      titleEn: listing.titleEn,
      descriptionTr: listing.descriptionTr,
      descriptionEn: listing.descriptionEn,
      minGuests: listing.minGuests,
      maxGuests: listing.maxGuests,
      pricingModel: listing.pricingModel,
      priceFrom: listing.priceFrom,
      currency: listing.currency,
      depositPercent: listing.depositPercent,
      bookingRequestsEnabled: listing.bookingRequestsEnabled,
      reviewNote: listing.reviewNote,
      rejectionReason: listing.rejectionReason,
    },
    business: {
      id: business.id,
      type: business.type as ListingType,
      status: business.status,
      currency: business.currency,
      countryIso2: business.countryIso2,
      nameTr: business.nameTr,
      nameEn: business.nameEn,
      cityNameEn: city?.nameEn ?? null,
      cityNameTr: city?.nameTr ?? null,
    },
    venue: venue ? { ...venue, venueTypeKey: vt?.key ?? null } : null,
    caterer: caterer ?? null,
    performer: performer ?? null,
    capacities: Object.fromEntries(caps.map((c) => [c.layout, c.capacity])) as Partial<Record<CapacityLayout, number>>,
    weeklyPrices: prices,
    eventTypeKeys: ets.map((e) => e.key),
    amenityKeys: ams.map((a) => a.key),
    media,
    cancellation: {
      policyKey: (policy?.key ?? null) as "flexible" | "moderate" | "strict" | "custom" | null,
      customTermsTr: policy?.businessId ? policy.termsTr : null,
      customTermsEn: policy?.businessId ? policy.termsEn : null,
    },
    completeness: snapshot ? summarise(listingChecks(snapshot)) : null,
  };
}
export type ListingEditorData = Awaited<ReturnType<typeof getListingEditorData>>;

/** Adds another listing (space / package / act) to a business. */
export async function createListing(ctx: DalContext, businessId: string) {
  const { business, user } = await requireBusinessMember(ctx, businessId);
  if (business.status === "suspended") throw new DalError("FORBIDDEN", "suspended");
  const [{ n }] = await ctx.db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.businessId, businessId), isNull(listings.deletedAt)));
  if (n >= MAX_LISTINGS_PER_BUSINESS) throw new DalError("CONFLICT", "too_many_listings");
  const [row] = await ctx.db
    .insert(listings)
    .values({
      businessId,
      type: business.type,
      slug: draftSlug(),
      status: "draft",
      currency: business.currency ?? "GBP",
    })
    .returning({ id: listings.id });
  await ctx.db
    .insert(auditLog)
    .values({ actorId: user.id, action: "listing.create", entity: "listing", entityId: row.id });
  return { listingId: row.id };
}

/** Soft-deletes a listing that has never been approved (and isn't the business's last one). */
export async function deleteDraftListing(ctx: DalContext, listingId: string) {
  const { listing, user } = await requireListingEditor(ctx, listingId);
  if (!["draft", "changes_requested", "rejected"].includes(listing.status))
    throw new DalError("CONFLICT", "not_deletable");
  const [{ n }] = await ctx.db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.businessId, listing.businessId), isNull(listings.deletedAt)));
  if (n <= 1) throw new DalError("CONFLICT", "last_listing");
  await ctx.db
    .update(listings)
    .set({ deletedAt: nowOf(ctx) })
    .where(eq(listings.id, listingId));
  await ctx.db
    .insert(auditLog)
    .values({ actorId: user.id, action: "listing.delete", entity: "listing", entityId: listingId });
  return { businessId: listing.businessId };
}

// Sections -----------------------------------------------------------------------------------

export async function saveListingBasics(ctx: DalContext, listingId: string, raw: Record<string, unknown>) {
  const { listing } = await requireListingEditor(ctx, listingId);
  const type = listing.type as ListingType;
  const { valid, invalid } = pickValidFields(listingBasicsFields, raw);
  const patch: Partial<typeof listings.$inferInsert> = {};
  for (const k of ["titleTr", "titleEn", "descriptionTr", "descriptionEn"] as const) {
    if (k in valid) patch[k] = valid[k] ?? null;
  }
  if ("minGuests" in valid) patch.minGuests = valid.minGuests ?? null;

  await ctx.db.transaction(async (tx) => {
    if (type === "venue") {
      if ("capacities" in valid && valid.capacities) {
        const entries = Object.entries(valid.capacities).filter(
          (e): e is [CapacityLayout, number] =>
            (CAPACITY_LAYOUTS as readonly string[]).includes(e[0]) && typeof e[1] === "number" && e[1] > 0,
        );
        await tx.delete(listingCapacities).where(eq(listingCapacities.listingId, listingId));
        if (entries.length)
          await tx
            .insert(listingCapacities)
            .values(entries.map(([layout, capacity]) => ({ listingId, layout, capacity })));
        patch.maxGuests = entries.length ? Math.max(...entries.map(([, c]) => c)) : null;
      }
      const venuePatch: Partial<typeof venueDetails.$inferInsert> = {};
      if ("areaType" in valid && valid.areaType) venuePatch.areaType = valid.areaType;
      if ("venueTypeKey" in valid) {
        const [vt] = valid.venueTypeKey
          ? await tx.select({ id: venueTypes.id }).from(venueTypes).where(eq(venueTypes.key, valid.venueTypeKey))
          : [];
        venuePatch.venueTypeId = vt?.id ?? null;
      }
      if (Object.keys(venuePatch).length) {
        await tx
          .insert(venueDetails)
          .values({ listingId, ...venuePatch })
          .onConflictDoUpdate({ target: venueDetails.listingId, set: venuePatch });
      }
    }
    if (type === "caterer") {
      if ("maxGuests" in valid) patch.maxGuests = valid.maxGuests ?? null;
      const cPatch: Partial<typeof catererDetails.$inferInsert> = {};
      if ("cuisines" in valid) cPatch.cuisines = await knownKeys(ctx, cuisinesTable, valid.cuisines ?? []);
      if ("serviceStyles" in valid)
        cPatch.serviceStyles = await knownKeys(ctx, serviceStylesTable, valid.serviceStyles ?? []);
      if ("minGuests" in valid) cPatch.minGuests = valid.minGuests ?? null;
      if (Object.keys(cPatch).length) {
        await tx
          .insert(catererDetails)
          .values({ listingId, ...cPatch })
          .onConflictDoUpdate({ target: catererDetails.listingId, set: cPatch });
      }
    }
    if (type === "performer") {
      if ("maxGuests" in valid) patch.maxGuests = valid.maxGuests ?? null;
      const pPatch: Partial<typeof performerDetails.$inferInsert> = {};
      if ("actTypes" in valid) pPatch.actTypes = await knownKeys(ctx, actTypesTable, valid.actTypes ?? []);
      if ("languages" in valid) pPatch.languages = await knownKeys(ctx, languagesTable, valid.languages ?? []);
      if ("setLengthMinutes" in valid) pPatch.setLengthMinutes = valid.setLengthMinutes ?? null;
      if ("setsPerEvent" in valid) pPatch.setsPerEvent = valid.setsPerEvent ?? null;
      if ("membersCount" in valid) pPatch.membersCount = valid.membersCount ?? null;
      if (Object.keys(pPatch).length) {
        await tx
          .insert(performerDetails)
          .values({ listingId, ...pPatch })
          .onConflictDoUpdate({ target: performerDetails.listingId, set: pPatch });
      }
    }
    if (Object.keys(patch).length) await tx.update(listings).set(patch).where(eq(listings.id, listingId));
  });
  return { invalid };
}

export async function saveListingPricing(ctx: DalContext, listingId: string, raw: Record<string, unknown>) {
  const { listing } = await requireListingEditor(ctx, listingId);
  const type = listing.type as ListingType;
  const { valid, invalid } = pickValidFields(listingPricingFields, raw);
  const patch: Partial<typeof listings.$inferInsert> = {};
  if ("pricingModel" in valid && valid.pricingModel) {
    if (PRICING_MODELS_BY_TYPE[type].includes(valid.pricingModel)) patch.pricingModel = valid.pricingModel;
    else invalid.push("pricingModel");
  }
  if ("priceFrom" in valid) {
    patch.priceFrom = valid.priceFrom ?? null;
    // Cross-currency sorting value; non-GBP prices are normalised by the daily job.
    patch.priceFromGbp = listing.currency === "GBP" ? (valid.priceFrom ?? null) : null;
  }
  if ("depositPercent" in valid) patch.depositPercent = valid.depositPercent ?? null;
  if ("bookingRequestsEnabled" in valid) patch.bookingRequestsEnabled = !!valid.bookingRequestsEnabled;

  await ctx.db.transaction(async (tx) => {
    if (Object.keys(patch).length) await tx.update(listings).set(patch).where(eq(listings.id, listingId));
    if (type === "venue" && "weeklyPrices" in valid && valid.weeklyPrices) {
      const model = patch.pricingModel ?? listing.pricingModel ?? "hire_fee_session";
      const unique = new Map(
        valid.weeklyPrices.filter((p) => p.price > 0).map((p) => [`${p.dayOfWeek}-${p.session}`, p]),
      );
      await tx.delete(listingPrices).where(eq(listingPrices.listingId, listingId));
      if (unique.size) {
        await tx.insert(listingPrices).values(
          [...unique.values()].map((p) => ({
            listingId,
            dayOfWeek: p.dayOfWeek,
            session: p.session,
            price: p.price,
            pricingModel: model,
          })),
        );
      }
    }
    if (type === "performer" && "travelFee" in valid) {
      await tx
        .insert(performerDetails)
        .values({ listingId, travelFee: valid.travelFee ?? null })
        .onConflictDoUpdate({ target: performerDetails.listingId, set: { travelFee: valid.travelFee ?? null } });
    }
    if (type === "caterer" && ("priceFrom" in valid || "pricingModel" in valid)) {
      const model = patch.pricingModel ?? listing.pricingModel;
      const perHead =
        model === "per_person" ? (("priceFrom" in valid ? valid.priceFrom : listing.priceFrom) ?? null) : null;
      await tx
        .insert(catererDetails)
        .values({ listingId, pricePerHeadFrom: perHead })
        .onConflictDoUpdate({ target: catererDetails.listingId, set: { pricePerHeadFrom: perHead } });
    }
  });
  return { invalid };
}

export async function saveListingEventTypes(ctx: DalContext, listingId: string, raw: Record<string, unknown>) {
  const { listing } = await requireListingEditor(ctx, listingId);
  const { valid, invalid } = pickValidFields(listingEventTypesFields, raw);
  if (valid.eventTypeKeys) {
    const rows = valid.eventTypeKeys.length
      ? await ctx.db
          .select({ id: eventTypes.id, appliesTo: eventTypes.appliesTo })
          .from(eventTypes)
          .where(and(inArray(eventTypes.key, valid.eventTypeKeys), eq(eventTypes.isActive, true)))
      : [];
    const ids = rows.filter((r) => r.appliesTo.includes(listing.type)).map((r) => r.id);
    await ctx.db.transaction(async (tx) => {
      await tx.delete(listingEventTypes).where(eq(listingEventTypes.listingId, listingId));
      if (ids.length) await tx.insert(listingEventTypes).values(ids.map((eventTypeId) => ({ listingId, eventTypeId })));
    });
  }
  return { invalid };
}

export async function saveListingDetails(ctx: DalContext, listingId: string, raw: Record<string, unknown>) {
  const { listing } = await requireListingEditor(ctx, listingId);
  const type = listing.type as ListingType;
  const { valid, invalid } = pickValidFields(listingDetailsFields, raw);
  const pick = <K extends keyof typeof valid>(keys: readonly K[]) =>
    Object.fromEntries(keys.filter((k) => k in valid).map((k) => [k, valid[k] ?? null])) as Partial<Record<K, unknown>>;

  await ctx.db.transaction(async (tx) => {
    if (type === "venue") {
      const v = pick([
        "inHouseCatering",
        "externalCateringAllowed",
        "alcohol",
        "halalKitchen",
        "alcoholFreeOption",
        "liveMusicAllowed",
        "davulZurnaAllowed",
        "ownDjAllowed",
        "lateLicenceUntil",
        "parkingSpaces",
        "prayerRoom",
        "separateWomensArea",
        "nearestTransport",
      ] as const) as Partial<typeof venueDetails.$inferInsert>;
      // Booleans are NOT NULL; an explicit null means "no".
      for (const [k, val] of Object.entries(v))
        if (val === null && k !== "lateLicenceUntil" && k !== "parkingSpaces" && k !== "nearestTransport")
          delete (v as Record<string, unknown>)[k];
      if (Object.keys(v).length)
        await tx
          .insert(venueDetails)
          .values({ listingId, ...v })
          .onConflictDoUpdate({ target: venueDetails.listingId, set: v });
    }
    if (type === "caterer") {
      const c = pick([
        "halalCertified",
        "halalCertBody",
        "staffIncluded",
        "equipmentIncluded",
        "travelRadiusKm",
        "hygieneRatingText",
      ] as const) as Partial<typeof catererDetails.$inferInsert>;
      if (Object.keys(c).length)
        await tx
          .insert(catererDetails)
          .values({ listingId, ...c })
          .onConflictDoUpdate({ target: catererDetails.listingId, set: c });
    }
    if (type === "performer") {
      const p = pick(["ownPaIncluded", "travelsInternationally", "countriesCovered"] as const) as Partial<
        typeof performerDetails.$inferInsert
      >;
      if (p.countriesCovered === null) p.countriesCovered = [];
      if (Object.keys(p).length)
        await tx
          .insert(performerDetails)
          .values({ listingId, ...p })
          .onConflictDoUpdate({ target: performerDetails.listingId, set: p });
    }
    if ("amenityKeys" in valid && valid.amenityKeys) {
      const rows = valid.amenityKeys.length
        ? await tx
            .select({ id: amenities.id, appliesTo: amenities.appliesTo })
            .from(amenities)
            .where(inArray(amenities.key, valid.amenityKeys))
        : [];
      const ids = rows.filter((r) => r.appliesTo.includes(type)).map((r) => r.id);
      await tx.delete(listingAmenities).where(eq(listingAmenities.listingId, listingId));
      if (ids.length) await tx.insert(listingAmenities).values(ids.map((amenityId) => ({ listingId, amenityId })));
    }
  });
  return { invalid };
}

export async function saveListingCancellation(ctx: DalContext, listingId: string, raw: Record<string, unknown>) {
  const { listing, business } = await requireListingEditor(ctx, listingId);
  const { valid, invalid } = pickValidFields(listingCancellationFields, raw);
  const key = valid.policyKey;
  if (!key) return { invalid };
  let policyId: string | null = null;
  if (key === "custom") {
    const termsTr = valid.customTermsTr ?? null;
    const termsEn = valid.customTermsEn ?? null;
    if (!termsTr && !termsEn) return { invalid: [...invalid, "customTermsTr"] };
    const [existing] = await ctx.db
      .select({ id: cancellationPolicies.id })
      .from(cancellationPolicies)
      .where(and(eq(cancellationPolicies.businessId, business.id), eq(cancellationPolicies.key, "custom")));
    const values = { termsTr: termsTr ?? termsEn!, termsEn: termsEn ?? termsTr!, nameTr: "Özel", nameEn: "Custom" };
    if (existing) {
      await ctx.db.update(cancellationPolicies).set(values).where(eq(cancellationPolicies.id, existing.id));
      policyId = existing.id;
    } else {
      const [created] = await ctx.db
        .insert(cancellationPolicies)
        .values({ key: "custom", businessId: business.id, ...values })
        .returning({ id: cancellationPolicies.id });
      policyId = created.id;
    }
  } else {
    const [system] = await ctx.db
      .select({ id: cancellationPolicies.id })
      .from(cancellationPolicies)
      .where(and(eq(cancellationPolicies.key, key), isNull(cancellationPolicies.businessId)));
    if (!system) throw new DalError("CONFLICT", "policy_missing");
    policyId = system.id;
  }
  await ctx.db.update(listings).set({ cancellationPolicyId: policyId }).where(eq(listings.id, listing.id));
  return { invalid };
}

/** The three standard policies (for the cancellation step's descriptions). */
export async function listSystemCancellationPolicies(ctx: DalContext) {
  return ctx.db
    .select({
      key: cancellationPolicies.key,
      nameTr: cancellationPolicies.nameTr,
      nameEn: cancellationPolicies.nameEn,
      termsTr: cancellationPolicies.termsTr,
      termsEn: cancellationPolicies.termsEn,
    })
    .from(cancellationPolicies)
    .where(isNull(cancellationPolicies.businessId))
    .orderBy(asc(cancellationPolicies.key));
}

/**
 * A new listing on an already-approved business goes to review on its own.
 * (For businesses still onboarding, submitBusinessForReview sends everything.)
 */
export async function submitListingForReview(ctx: DalContext, listingId: string) {
  const { listing, business, user } = await requireListingEditor(ctx, listingId);
  if (business.status !== "approved") throw new DalError("CONFLICT", "business_not_approved");
  if (!["draft", "changes_requested", "rejected"].includes(listing.status))
    throw new DalError("CONFLICT", "not_submittable");
  const snap = await listingSnapshot(ctx.db, listingId);
  if (!snap || !summarise(listingChecks(snap)).canSubmit) throw new DalError("INVALID", "incomplete");
  const [city] = business.cityId
    ? await ctx.db.select({ nameEn: cities.nameEn }).from(cities).where(eq(cities.id, business.cityId))
    : [];
  const businessName = business.nameEn ?? business.nameTr ?? "";
  const title = listing.titleEn ?? listing.titleTr ?? businessName;
  const base = slugify(title).includes(slugify(businessName))
    ? `${title} ${city?.nameEn ?? ""}`
    : `${title} ${businessName} ${city?.nameEn ?? ""}`;
  const slug = isDraftSlug(listing.slug) ? await uniqueSlug(ctx.db, "listings", base, listingId) : listing.slug;
  await ctx.db
    .update(listings)
    .set({ status: "pending_review", submittedAt: nowOf(ctx), reviewNote: null, rejectionReason: null, slug })
    .where(eq(listings.id, listingId));
  await ctx.db
    .insert(auditLog)
    .values({ actorId: user.id, action: "listing.submit", entity: "listing", entityId: listingId });
  return { businessName, listingTitle: title, admins: await adminContacts(ctx.db) };
}

/** Pause / resume a live listing (hidden from search, nothing deleted). */
export async function setListingPaused(ctx: DalContext, listingId: string, paused: boolean) {
  const { listing } = await requireListingEditor(ctx, listingId);
  if (paused && listing.status !== "approved") throw new DalError("CONFLICT", "not_live");
  if (!paused && listing.status !== "paused") throw new DalError("CONFLICT", "not_paused");
  await ctx.db
    .update(listings)
    .set({ status: paused ? "paused" : "approved" })
    .where(eq(listings.id, listingId));
  await refreshBusinessVisibility(ctx.db, listing.businessId, nowOf(ctx));
  return { slug: listing.slug };
}

/** Taxonomy options for the editor (bilingual labels; filtered client-side by locale). */
export async function listingFormOptions(ctx: DalContext, type: ListingType) {
  const byOrder = <T extends { sortOrder: number }>(rows: T[]) => rows.sort((a, b) => a.sortOrder - b.sortOrder);
  const lookup = async (
    table:
      | typeof venueTypes
      | typeof actTypesTable
      | typeof cuisinesTable
      | typeof serviceStylesTable
      | typeof languagesTable,
  ) =>
    byOrder(
      await ctx.db
        .select({ key: table.key, labelTr: table.labelTr, labelEn: table.labelEn, sortOrder: table.sortOrder })
        .from(table)
        .where(eq(table.isActive, true)),
    );
  const ets = byOrder(
    await ctx.db
      .select({
        key: eventTypes.key,
        labelTr: eventTypes.labelTr,
        labelEn: eventTypes.labelEn,
        sortOrder: eventTypes.sortOrder,
        appliesTo: eventTypes.appliesTo,
        isTurkishCultural: eventTypes.isTurkishCultural,
      })
      .from(eventTypes)
      .where(eq(eventTypes.isActive, true)),
  ).filter((e) => e.appliesTo.includes(type));
  const ams = byOrder(
    await ctx.db
      .select({
        key: amenities.key,
        labelTr: amenities.labelTr,
        labelEn: amenities.labelEn,
        sortOrder: amenities.sortOrder,
        group: amenities.group,
        appliesTo: amenities.appliesTo,
      })
      .from(amenities)
      .where(eq(amenities.isActive, true)),
  ).filter((a) => a.appliesTo.includes(type));
  return {
    venueTypes: type === "venue" ? await lookup(venueTypes) : [],
    actTypes: type === "performer" ? await lookup(actTypesTable) : [],
    cuisines: type === "caterer" ? await lookup(cuisinesTable) : [],
    serviceStyles: type === "caterer" ? await lookup(serviceStylesTable) : [],
    languages: type === "performer" ? await lookup(languagesTable) : [],
    eventTypes: ets,
    amenities: ams,
  };
}
export type ListingFormOptions = Awaited<ReturnType<typeof listingFormOptions>>;

/** Businesses are always loaded with their first listing in the wizard. */
export async function firstListingId(ctx: DalContext, businessId: string) {
  await requireBusinessMember(ctx, businessId);
  const [row] = await ctx.db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.businessId, businessId), isNull(listings.deletedAt)))
    .orderBy(asc(listings.createdAt))
    .limit(1);
  return row?.id ?? null;
}
