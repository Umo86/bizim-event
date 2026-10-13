import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Queryable } from "@/db";
import { businesses, catererDetails, listings, performerDetails, venueDetails } from "@/db/schema";
import { qualified } from "@/db/sql";
import type { BusinessSnapshot, ListingSnapshot } from "@/lib/completeness";

/** Everything the completeness score needs about one listing, in a single query. */
export async function listingSnapshot(db: Queryable, listingId: string): Promise<ListingSnapshot | null> {
  const [row] = await db
    .select({
      type: listings.type,
      titleTr: listings.titleTr,
      titleEn: listings.titleEn,
      descriptionTr: listings.descriptionTr,
      descriptionEn: listings.descriptionEn,
      pricingModel: listings.pricingModel,
      priceFrom: listings.priceFrom,
      cancellationPolicyId: listings.cancellationPolicyId,
      areaType: venueDetails.areaType,
      cuisineCount: sql<number>`coalesce(cardinality(${catererDetails.cuisines}), 0)::int`,
      serviceStyleCount: sql<number>`coalesce(cardinality(${catererDetails.serviceStyles}), 0)::int`,
      actTypeCount: sql<number>`coalesce(cardinality(${performerDetails.actTypes}), 0)::int`,
      languageCount: sql<number>`coalesce(cardinality(${performerDetails.languages}), 0)::int`,
      imageCount: sql<number>`(select count(*)::int from listing_media m where m.listing_id = ${qualified(listings, listings.id)} and m.kind = 'image')`,
      eventTypeCount: sql<number>`(select count(*)::int from listing_event_types e where e.listing_id = ${qualified(listings, listings.id)})`,
      capacityCount: sql<number>`(select count(*)::int from listing_capacities c where c.listing_id = ${qualified(listings, listings.id)})`,
      amenityCount: sql<number>`(select count(*)::int from listing_amenities a where a.listing_id = ${qualified(listings, listings.id)})`,
    })
    .from(listings)
    .leftJoin(venueDetails, eq(venueDetails.listingId, listings.id))
    .leftJoin(catererDetails, eq(catererDetails.listingId, listings.id))
    .leftJoin(performerDetails, eq(performerDetails.listingId, listings.id))
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!row) return null;
  return { ...row, areaType: row.areaType ?? null };
}

export function businessSnapshot(b: typeof businesses.$inferSelect): BusinessSnapshot {
  return {
    nameTr: b.nameTr,
    nameEn: b.nameEn,
    descriptionTr: b.descriptionTr,
    descriptionEn: b.descriptionEn,
    phoneE164: b.phoneE164,
    email: b.email,
    website: b.website,
    instagram: b.instagram,
    logoUrl: b.logoUrl,
    cityId: b.cityId,
    addressLine: b.addressLine,
    currency: b.currency,
    timezone: b.timezone,
  };
}
