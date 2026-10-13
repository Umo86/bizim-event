import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { businesses, cities, countries, eventTypes, listingMedia, listings, reviews } from "@/db/schema";
import type { DalContext } from "./context";

/**
 * Public, anonymous queries. Only ever return listings where is_public = true
 * and reviews where status = 'published'. No guard needed — but nothing here
 * may return private fields (owner ids, phone numbers, subscription data).
 */

const publicListingColumns = {
  id: listings.id,
  slug: listings.slug,
  type: listings.type,
  titleTr: listings.titleTr,
  titleEn: listings.titleEn,
  maxGuests: listings.maxGuests,
  pricingModel: listings.pricingModel,
  priceFrom: listings.priceFrom,
  currency: listings.currency,
  ratingAvg: listings.ratingAvg,
  reviewCount: listings.reviewCount,
  businessNameTr: businesses.nameTr,
  businessNameEn: businesses.nameEn,
  isStarBusiness: businesses.isStarBusiness,
  countryIso2: businesses.countryIso2,
  cityNameTr: cities.nameTr,
  cityNameEn: cities.nameEn,
};

export type PublicListingCard = Awaited<ReturnType<typeof listPublicListings>>["items"][number];

export async function listPublicListings(
  ctx: DalContext,
  opts: {
    type?: "venue" | "caterer" | "performer";
    cityId?: string;
    countryIso2?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const pageSize = Math.min(opts.pageSize ?? 24, 48);
  const page = Math.max(opts.page ?? 1, 1);
  const where = and(
    eq(listings.isPublic, true),
    isNull(listings.deletedAt),
    opts.type ? eq(listings.type, opts.type) : undefined,
    opts.cityId ? eq(businesses.cityId, opts.cityId) : undefined,
    opts.countryIso2 ? eq(businesses.countryIso2, opts.countryIso2) : undefined,
  );
  const items = await ctx.db
    .select({
      ...publicListingColumns,
      coverUrl: sql<string | null>`(
        select coalesce(m.url_medium, m.url_large) from ${listingMedia} m
        where m.listing_id = ${listings.id} and m.kind = 'image' order by m.sort_order limit 1)`,
    })
    .from(listings)
    .innerJoin(businesses, eq(businesses.id, listings.businessId))
    .leftJoin(cities, eq(cities.id, businesses.cityId))
    .where(where)
    .orderBy(desc(listings.sortScore), desc(listings.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items, page, pageSize };
}

export async function getPublicListingBySlug(ctx: DalContext, slug: string) {
  const [row] = await ctx.db
    .select({
      ...publicListingColumns,
      descriptionTr: listings.descriptionTr,
      descriptionEn: listings.descriptionEn,
      minGuests: listings.minGuests,
      businessId: listings.businessId,
      timezone: businesses.timezone,
    })
    .from(listings)
    .innerJoin(businesses, eq(businesses.id, listings.businessId))
    .leftJoin(cities, eq(cities.id, businesses.cityId))
    .where(and(eq(listings.slug, slug), eq(listings.isPublic, true), isNull(listings.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listPublishedReviews(ctx: DalContext, listingId: string, limit = 10) {
  return ctx.db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      ratingValue: reviews.ratingValue,
      ratingService: reviews.ratingService,
      ratingQuality: reviews.ratingQuality,
      body: reviews.body,
      locale: reviews.locale,
      businessReply: reviews.businessReply,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(listings, eq(listings.id, reviews.listingId))
    .where(and(eq(reviews.listingId, listingId), eq(reviews.status, "published"), eq(listings.isPublic, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(Math.min(limit, 50));
}

export async function listVisibleCountries(ctx: DalContext) {
  return ctx.db
    .select({
      iso2: countries.iso2,
      nameTr: countries.nameTr,
      nameEn: countries.nameEn,
      slugTr: countries.slugTr,
      slugEn: countries.slugEn,
    })
    .from(countries)
    .where(eq(countries.isVisible, true))
    .orderBy(asc(countries.nameEn));
}

export async function listFeaturedCities(ctx: DalContext, countryIso2?: string, limit = 12) {
  return ctx.db
    .select({
      id: cities.id,
      countryIso2: cities.countryIso2,
      nameTr: cities.nameTr,
      nameEn: cities.nameEn,
      slugTr: cities.slugTr,
      slugEn: cities.slugEn,
      taglineTr: cities.taglineTr,
      taglineEn: cities.taglineEn,
      tileImageUrl: cities.tileImageUrl,
      imageCreditName: cities.imageCreditName,
      imageCreditUrl: cities.imageCreditUrl,
      listingCount: cities.listingCount,
    })
    .from(cities)
    .where(
      and(
        isNull(cities.mergedIntoId),
        countryIso2 ? eq(cities.countryIso2, countryIso2) : eq(cities.isFeaturedWorldwide, true),
      ),
    )
    .orderBy(desc(cities.listingCount), asc(cities.nameEn))
    .limit(limit);
}

export async function listActiveEventTypes(ctx: DalContext) {
  return ctx.db
    .select({
      key: eventTypes.key,
      labelTr: eventTypes.labelTr,
      labelEn: eventTypes.labelEn,
      slugTr: eventTypes.slugTr,
      slugEn: eventTypes.slugEn,
      isTurkishCultural: eventTypes.isTurkishCultural,
    })
    .from(eventTypes)
    .where(eq(eventTypes.isActive, true))
    .orderBy(asc(eventTypes.sortOrder));
}

/** Trust bar counts (cached at page level). */
export async function platformCounts(ctx: DalContext) {
  const [row] = await ctx.db
    .execute<{ listings: number; countries: number; cities: number; reviews: number }>(
      sql`
    select
      (select count(*)::int from listings where is_public and deleted_at is null) as listings,
      (select count(*)::int from countries where is_visible) as countries,
      (select count(*)::int from cities where listing_count > 0) as cities,
      (select count(*)::int from reviews where status = 'published') as reviews
  `,
    )
    .then((r) => r.rows);
  return row;
}
