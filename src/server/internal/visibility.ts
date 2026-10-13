import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { businesses, cities, countries, listings, subscriptions } from "@/db/schema";
import { computeListingIsPublic } from "@/server/rules";

/**
 * Recomputes listings.is_public for one business, then the denormalised
 * country visibility and city listing counts it affects.
 * INTERNAL: callers must already have authorised the change (admin approval,
 * webhook, daily job). Not exported through the DAL.
 */
export async function refreshBusinessVisibility(db: DB, businessId: string, now = new Date()) {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return { changed: 0 };
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1);
  const rows = await db
    .select({ id: listings.id, status: listings.status, deletedAt: listings.deletedAt, isPublic: listings.isPublic })
    .from(listings)
    .where(eq(listings.businessId, businessId));

  const toPublic: string[] = [];
  const toHidden: string[] = [];
  for (const l of rows) {
    const next = computeListingIsPublic({
      businessStatus: biz.status,
      listingStatus: l.status,
      businessDeleted: !!biz.deletedAt,
      listingDeleted: !!l.deletedAt,
      subscription: sub ?? null,
      now,
    });
    if (next !== l.isPublic) (next ? toPublic : toHidden).push(l.id);
  }
  if (toPublic.length) await db.update(listings).set({ isPublic: true }).where(inArray(listings.id, toPublic));
  if (toHidden.length) await db.update(listings).set({ isPublic: false }).where(inArray(listings.id, toHidden));

  if (toPublic.length || toHidden.length) {
    if (biz.cityId) await refreshCityCounts(db, [biz.cityId]);
    if (biz.countryIso2) await refreshCountryVisibility(db, [biz.countryIso2]);
  }
  return { changed: toPublic.length + toHidden.length };
}

export async function refreshCityCounts(db: DB, cityIds?: string[]) {
  const counts = db
    .select({ cityId: businesses.cityId, n: sql<number>`count(*)::int`.as("n") })
    .from(listings)
    .innerJoin(businesses, eq(businesses.id, listings.businessId))
    .where(and(eq(listings.isPublic, true), isNull(listings.deletedAt)))
    .groupBy(businesses.cityId)
    .as("counts");
  const target = cityIds?.length ? inArray(cities.id, cityIds) : sql`true`;
  await db
    .update(cities)
    .set({ listingCount: sql`coalesce((select n from ${counts} where ${counts.cityId} = ${cities.id}), 0)` })
    .where(target);
}

export async function refreshCountryVisibility(db: DB, isoCodes?: string[]) {
  const target = isoCodes?.length ? inArray(countries.iso2, isoCodes) : sql`true`;
  await db
    .update(countries)
    .set({
      isVisible: sql`exists (
        select 1 from ${listings} l join ${businesses} b on b.id = l.business_id
        where l.is_public and l.deleted_at is null and b.country_iso2 = ${countries.iso2}
      )`,
    })
    .where(target);
}
