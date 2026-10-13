/**
 * Phase 2 flow through the DAL against real Postgres + PostGIS:
 * draft → info → location/city → currency → listing sections → photos →
 * submit → changes requested → resubmit → approve (trial) → public,
 * plus a second listing reviewed on its own, and the authorisation edges.
 */
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { ResolvedAddress, ResolvedCity } from "@/lib/adapters/geocode";
import {
  adminDal,
  businessWrite,
  listingWrite,
  mediaDal,
  publicData,
  type DalContext,
  type SessionUser,
} from "@/server/dal";
import { freshTestDb, TEST_DATABASE_URL } from "../support/db";

const london: ResolvedAddress = {
  provider: "photon",
  placeId: "photon:abc",
  formattedAddress: "12 Green Lanes, London N4 1AA, United Kingdom",
  location: { lat: 51.5705, lng: -0.0961 },
  countryIso2: "GB",
  locality: "London",
  adminArea: "England",
  postalCode: "N4 1AA",
  types: [],
};
const londonCity: ResolvedCity = {
  placeId: "osm:R65606",
  nameEn: "London",
  nameTr: "Londra",
  adminArea: "England",
  centre: { lat: 51.5072, lng: -0.1276 },
};

describe.skipIf(!TEST_DATABASE_URL)("business onboarding flow", () => {
  let db: DB;
  let close: () => Promise<void>;
  const u: Record<string, SessionUser> = {};
  const ids: Record<string, string> = {};
  const ctx = (who: string | null): DalContext => ({ db, user: who ? u[who] : null });

  async function makeUser(key: string, role: SessionUser["role"]) {
    const [row] = await db
      .insert(s.user)
      .values({ email: `${key}@test.local`, name: key, role, emailVerified: true })
      .returning();
    u[key] = { id: row.id, email: row.email, name: row.name, role, preferredLocale: "tr" };
  }

  async function addPhotos(listingId: string, n: number, who = "owner") {
    for (let i = 0; i < n; i++) {
      await mediaDal.addListingMedia(ctx(who), listingId, {
        kind: "image",
        r2Key: `listings/${listingId}/${crypto.randomUUID()}`,
        urlSmall: `/s${i}.webp`,
        urlMedium: `/m${i}.webp`,
        urlLarge: `/l${i}.webp`,
        width: 2000,
        height: 1333,
        bytes: 300_000,
      });
    }
  }

  async function completeVenueListing(listingId: string, title: string) {
    await listingWrite.saveListingBasics(ctx("owner"), listingId, {
      titleTr: title,
      titleEn: title,
      descriptionTr: "Geniş, aydınlık ve şık bir salon; düğün, nişan ve kına geceleri için ideal bir mekan.",
      areaType: "whole_venue",
      venueTypeKey: "wedding_hall",
      capacities: { seated_dinner: 350, standing: 500, theatre: "" },
    });
    await listingWrite.saveListingPricing(ctx("owner"), listingId, {
      pricingModel: "hire_fee_session",
      priceFrom: "4500",
      depositPercent: "25",
    });
    await listingWrite.saveListingEventTypes(ctx("owner"), listingId, { eventTypeKeys: ["wedding", "henna_night"] });
    await listingWrite.saveListingCancellation(ctx("owner"), listingId, { policyKey: "moderate" });
  }

  beforeAll(async () => {
    ({ db, close } = await freshTestDb());
    await db.insert(s.countries).values([
      {
        iso2: "GB",
        nameEn: "United Kingdom",
        nameTr: "İngiltere",
        slugEn: "united-kingdom",
        slugTr: "ingiltere",
        defaultCurrency: "GBP",
        distanceUnit: "mi",
      },
      {
        iso2: "TR",
        nameEn: "Türkiye",
        nameTr: "Türkiye",
        slugEn: "turkiye",
        slugTr: "turkiye",
        defaultCurrency: "TRY",
        distanceUnit: "km",
      },
    ]);
    await db.insert(s.eventTypes).values([
      { key: "wedding", labelTr: "Düğün", labelEn: "Wedding", slugTr: "dugun", slugEn: "wedding" },
      {
        key: "henna_night",
        labelTr: "Kına gecesi",
        labelEn: "Henna night",
        slugTr: "kina-gecesi",
        slugEn: "henna-night",
      },
      {
        key: "venue_only",
        labelTr: "Sadece mekan",
        labelEn: "Venue only",
        slugTr: "sadece-mekan",
        slugEn: "venue-only",
        appliesTo: ["caterer"],
      },
    ]);
    await db.insert(s.venueTypes).values({
      key: "wedding_hall",
      labelTr: "Düğün salonu",
      labelEn: "Wedding hall",
      slugTr: "dugun-salonu",
      slugEn: "wedding-hall",
    });
    await db.insert(s.amenities).values([
      {
        key: "garden",
        labelTr: "Bahçe",
        labelEn: "Garden",
        slugTr: "bahce",
        slugEn: "garden",
        group: "outdoor",
        appliesTo: ["venue"],
      },
      {
        key: "tasting_available",
        labelTr: "Tadım",
        labelEn: "Tasting",
        slugTr: "tadim",
        slugEn: "tasting",
        group: "service",
        appliesTo: ["caterer"],
      },
    ]);
    await db.insert(s.cancellationPolicies).values([
      { key: "flexible", nameTr: "Esnek", nameEn: "Flexible", termsTr: "…", termsEn: "…" },
      { key: "moderate", nameTr: "Orta", nameEn: "Moderate", termsTr: "…", termsEn: "…" },
    ]);
    await makeUser("owner", "customer");
    await makeUser("stranger", "customer");
    await makeUser("manager", "customer");
    await makeUser("admin", "admin");
  });

  afterAll(async () => {
    await close?.();
  });

  it("creates a draft business with an empty first listing and upgrades the role", async () => {
    const res = await businessWrite.createBusinessDraft(ctx("owner"), { type: "venue" });
    ids.biz = res.businessId;
    ids.listing = res.listingId;
    const [row] = await db.select().from(s.user).where(eq(s.user.id, u.owner.id));
    expect(row.role).toBe("business");
    const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.id, ids.biz));
    expect(biz.status).toBe("draft");
    expect(biz.slug.startsWith("draft-")).toBe(true);
    const [m] = await db.select().from(s.member).where(eq(s.member.organizationId, biz.organizationId!));
    expect(m.role).toBe("owner");
  });

  it("refuses anonymous callers and strangers on every write", async () => {
    await expect(businessWrite.createBusinessDraft(ctx(null), { type: "venue" })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(businessWrite.updateBusinessInfo(ctx("stranger"), ids.biz, { nameTr: "Hack" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      listingWrite.saveListingBasics(ctx("stranger"), ids.listing, { titleTr: "Hack" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listingWrite.getListingEditorData(ctx("stranger"), ids.listing)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(mediaDal.assertMediaCapacity(ctx("stranger"), ids.listing, "image")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(businessWrite.submitBusinessForReview(ctx("stranger"), ids.biz)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(adminDal.reviewQueue(ctx("owner"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("autosaves valid fields and reports invalid ones", async () => {
    const r = await businessWrite.updateBusinessInfo(ctx("owner"), ids.biz, {
      nameTr: "Lale Bahçesi Düğün Salonu",
      nameEn: "Tulip Garden Wedding Hall",
      descriptionTr: "Kuzey Londra'nın kalbinde 500 kişilik düğün salonu, geniş bahçe ve kendi mutfağımız.",
      email: "info@", // invalid, skipped
      website: "lalebahcesi.co.uk",
    });
    expect(r.invalid).toEqual(["email"]);
    const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.id, ids.biz));
    expect(biz.nameEn).toBe("Tulip Garden Wedding Hall");
    expect(biz.website).toBe("https://lalebahcesi.co.uk");
    expect(biz.email).toBeNull();
  });

  it("reads a national phone number using the visitor's country before the address is known", async () => {
    const r = await businessWrite.updateBusinessInfo(ctx("owner"), ids.biz, {
      phone: "07911 123456",
      phoneCountry: "GB",
    });
    expect(r.invalid).toEqual([]);
    expect(r.phoneE164).toBe("+447911123456");
  });

  it("stores the location, creates the city with its Turkish name, and prefills currency + time zone", async () => {
    await businessWrite.setBusinessLocation(ctx("owner"), ids.biz, {
      address: london,
      city: londonCity,
      addressExtra: "Unit 3",
      timezone: "Europe/London",
      currency: "GBP",
    });
    const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.id, ids.biz));
    expect(biz.countryIso2).toBe("GB");
    expect(biz.currency).toBe("GBP");
    expect(biz.timezone).toBe("Europe/London");
    expect(biz.addressLine).toBe("Unit 3, 12 Green Lanes, London N4 1AA, United Kingdom");
    expect(biz.location?.lat).toBeCloseTo(51.5705, 4);
    const [city] = await db.select().from(s.cities).where(eq(s.cities.id, biz.cityId!));
    expect(city.nameTr).toBe("Londra");
    expect(city.slugEn).toBe("london");
    ids.city = city.id;
    // Phone now normalises against the business's country.
    const r = await businessWrite.updateBusinessInfo(ctx("owner"), ids.biz, {
      phone: "020 7946 0958",
      email: "info@lalebahcesi.co.uk",
    });
    expect(r.invalid).toEqual([]);
    expect(r.phoneE164).toBe("+442079460958");
  });

  it("reuses an existing city found through another provider", async () => {
    await makeUser("owner2", "customer");
    const { businessId } = await businessWrite.createBusinessDraft(ctx("owner2"), { type: "caterer" });
    await businessWrite.setBusinessLocation(ctx("owner2"), businessId, {
      address: { ...london, provider: "google", placeId: "ChIJ-google" },
      city: { ...londonCity, placeId: "google:ChIJdd4hrwug2EcRmSrV3Vo6llI" },
      timezone: "Europe/London",
      currency: "GBP",
    });
    const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.id, businessId));
    expect(biz.cityId).toBe(ids.city);
    expect((await db.select().from(s.cities)).length).toBe(1);
  });

  it("switching currency carries over to the listings", async () => {
    await businessWrite.updateBusinessSettings(ctx("owner"), ids.biz, { currency: "EUR", timezone: "Europe/London" });
    let [l] = await db.select().from(s.listings).where(eq(s.listings.id, ids.listing));
    expect(l.currency).toBe("EUR");
    await businessWrite.updateBusinessSettings(ctx("owner"), ids.biz, { currency: "GBP", timezone: "Europe/London" });
    [l] = await db.select().from(s.listings).where(eq(s.listings.id, ids.listing));
    expect(l.currency).toBe("GBP");
    await expect(
      businessWrite.updateBusinessSettings(ctx("owner"), ids.biz, { currency: "XYZ", timezone: "Europe/London" }),
    ).rejects.toBeTruthy();
  });

  it("saves listing sections, skipping invalid or foreign values", async () => {
    await completeVenueListing(ids.listing, "Ana Salon");
    const pricing = await listingWrite.saveListingPricing(ctx("owner"), ids.listing, { pricingModel: "per_set" });
    expect(pricing.invalid).toContain("pricingModel"); // not a venue pricing model
    const et = await listingWrite.saveListingEventTypes(ctx("owner"), ids.listing, {
      eventTypeKeys: ["wedding", "henna_night", "venue_only", "nope"],
    });
    expect(et.invalid).toEqual([]);
    await listingWrite.saveListingDetails(ctx("owner"), ids.listing, {
      halalKitchen: true,
      davulZurnaAllowed: true,
      lateLicenceUntil: "01:30",
      amenityKeys: ["garden", "tasting_available"],
    });

    const data = await listingWrite.getListingEditorData(ctx("owner"), ids.listing);
    expect(data.listing.maxGuests).toBe(500);
    expect(data.capacities).toEqual({ seated_dinner: 350, standing: 500 });
    expect(data.listing.pricingModel).toBe("hire_fee_session");
    expect(data.listing.priceFrom).toBe(4500);
    expect(data.eventTypeKeys.sort()).toEqual(["henna_night", "wedding"]); // caterer-only + unknown dropped
    expect(data.amenityKeys).toEqual(["garden"]); // caterer amenity dropped
    expect(data.venue?.halalKitchen).toBe(true);
    expect(data.venue?.lateLicenceUntil).toBe("01:30:00");
    expect(data.venue?.venueTypeKey).toBe("wedding_hall");
    expect(data.cancellation.policyKey).toBe("moderate");
  });

  it("custom cancellation terms create a business-specific policy", async () => {
    await listingWrite.saveListingCancellation(ctx("owner"), ids.listing, {
      policyKey: "custom",
      customTermsEn: "Deposit refundable until 45 days before.",
    });
    const data = await listingWrite.getListingEditorData(ctx("owner"), ids.listing);
    expect(data.cancellation).toEqual({
      policyKey: "custom",
      customTermsTr: "Deposit refundable until 45 days before.",
      customTermsEn: "Deposit refundable until 45 days before.",
    });
  });

  it("won't submit until the venue has 5 photos", async () => {
    await expect(businessWrite.submitBusinessForReview(ctx("owner"), ids.biz)).rejects.toMatchObject({
      message: "incomplete",
    });
    await addPhotos(ids.listing, 5);
    const res = await businessWrite.submitBusinessForReview(ctx("owner"), ids.biz);
    expect(res.submittedListings).toBe(1);
    expect(res.admins.map((a) => a.email)).toEqual(["admin@test.local"]);
    const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.id, ids.biz));
    const [l] = await db.select().from(s.listings).where(eq(s.listings.id, ids.listing));
    expect(biz.status).toBe("pending_review");
    expect(biz.slug).toBe("tulip-garden-wedding-hall-london");
    expect(l.status).toBe("pending_review");
    expect(l.slug).toBe("ana-salon-tulip-garden-wedding-hall-london");
  });

  it("admin can request changes; the owner sees the note and resubmits", async () => {
    const queue = await adminDal.reviewQueue(ctx("admin"));
    expect(queue.pendingBusinesses.map((b) => b.id)).toEqual([ids.biz]);
    const review = await adminDal.getBusinessForReview(ctx("admin"), ids.biz);
    expect(review.listings[0].media).toHaveLength(5);
    expect(review.owner?.email).toBe("owner@test.local");

    await adminDal.requestBusinessChanges(ctx("admin"), ids.biz, { note: "Please add an English description." });
    const view = await businessWrite.getOwnerBusiness(ctx("owner"), ids.biz);
    expect(view.business.status).toBe("changes_requested");
    expect(view.business.reviewNote).toBe("Please add an English description.");
    expect(view.listings[0].status).toBe("changes_requested");
    // Correlated subqueries must point at the outer listing (regression: they once bound to the media row's own id).
    expect(view.listings[0].imageCount).toBe(5);
    expect(view.listings[0].coverUrl).toBe("/s0.webp");
    expect(queue.pendingBusinesses[0].listingCount).toBe(1);
    const notes = await db.select().from(s.notifications).where(eq(s.notifications.userId, u.owner.id));
    expect(notes.map((n) => n.kind)).toContain("business_changes_requested");

    await businessWrite.updateBusinessInfo(ctx("owner"), ids.biz, {
      descriptionEn: "A 500-guest wedding hall in north London with a big garden and our own kitchen.",
    });
    await businessWrite.submitBusinessForReview(ctx("owner"), ids.biz);
    const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.id, ids.biz));
    expect(biz.status).toBe("pending_review");
    expect(biz.reviewNote).toBeNull();
    expect(biz.slug).toBe("tulip-garden-wedding-hall-london"); // slug kept on resubmission
  });

  it("approval starts the trial and puts the listing live", async () => {
    const res = await adminDal.approveBusiness(ctx("admin"), ids.biz);
    expect(res.owner.email).toBe("owner@test.local");
    expect(res.trialEndsAt).toBeInstanceOf(Date);
    const listing = await publicData.getPublicListingBySlug(ctx(null), "ana-salon-tulip-garden-wedding-hall-london");
    expect(listing?.titleTr).toBe("Ana Salon");
    const [city] = await db.select().from(s.cities).where(eq(s.cities.id, ids.city));
    expect(city.listingCount).toBe(1);
    const [gb] = await db.select().from(s.countries).where(eq(s.countries.iso2, "GB"));
    expect(gb.isVisible).toBe(true);
    const view = await businessWrite.getOwnerBusiness(ctx("owner"), ids.biz);
    expect(view.subscription?.status).toBe("trialing");
    const trialEndsAt = res.trialEndsAt!;
    expect(view.subscription?.trialEndsAt?.getTime()).toBe(trialEndsAt.getTime());
    // Lazily evaluated: once the trial date passes it reads as expired, even before the daily job.
    const later = await businessWrite.getOwnerBusiness(
      { ...ctx("owner"), now: new Date(trialEndsAt.getTime() + 1000) },
      ids.biz,
    );
    expect(later.subscription?.status).toBe("expired");
  });

  it("a team manager can edit listings but the business owner's billing stays private", async () => {
    const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.id, ids.biz));
    await db.insert(s.member).values({ organizationId: biz.organizationId!, userId: u.manager.id, role: "member" });
    const r = await listingWrite.saveListingDetails(ctx("manager"), ids.listing, { prayerRoom: true });
    expect(r.invalid).toEqual([]);
    const [venue] = await db.select().from(s.venueDetails).where(eq(s.venueDetails.listingId, ids.listing));
    expect(venue.prayerRoom).toBe(true);
    expect(venue.alcohol).toBeNull(); // never answered, so not claimed as alcohol-free
    const asManager = await businessWrite.getOwnerBusiness(ctx("manager"), ids.biz);
    expect(asManager.role).toBe("manager");
    expect(asManager.subscription).toBeNull();
  });

  it("a new listing on a live business is reviewed on its own", async () => {
    const { listingId } = await listingWrite.createListing(ctx("owner"), ids.biz);
    ids.second = listingId;
    await expect(listingWrite.submitListingForReview(ctx("owner"), listingId)).rejects.toMatchObject({
      message: "incomplete",
    });
    await completeVenueListing(listingId, "Garden Terrace");
    await addPhotos(listingId, 5);
    await listingWrite.submitListingForReview(ctx("owner"), listingId);
    const queue = await adminDal.reviewQueue(ctx("admin"));
    expect(queue.pendingListings.map((l) => l.id)).toEqual([listingId]);
    await adminDal.approveListing(ctx("admin"), listingId);
    const live = await publicData.listPublicListings(ctx(null));
    expect(live.items.map((i) => i.slug).sort()).toEqual([
      "ana-salon-tulip-garden-wedding-hall-london",
      "garden-terrace-tulip-garden-wedding-hall-london",
    ]);
  });

  it("pausing hides a listing without deleting it", async () => {
    await listingWrite.setListingPaused(ctx("owner"), ids.second, true);
    expect((await publicData.listPublicListings(ctx(null))).items).toHaveLength(1);
    await listingWrite.setListingPaused(ctx("owner"), ids.second, false);
    expect((await publicData.listPublicListings(ctx(null))).items).toHaveLength(2);
  });

  it("media: order must cover exactly the listing's own items; strangers can't delete", async () => {
    const data = await listingWrite.getListingEditorData(ctx("owner"), ids.listing);
    const mediaIds = data.media.map((m) => m.id);
    await expect(
      mediaDal.reorderListingMedia(ctx("owner"), ids.listing, [...mediaIds.slice(1), crypto.randomUUID()]),
    ).rejects.toMatchObject({ code: "INVALID" });
    await mediaDal.reorderListingMedia(ctx("owner"), ids.listing, [...mediaIds].reverse());
    const after = await listingWrite.getListingEditorData(ctx("owner"), ids.listing);
    expect(after.media.map((m) => m.id)).toEqual([...mediaIds].reverse());
    await expect(mediaDal.removeListingMedia(ctx("stranger"), mediaIds[0])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("caps photos per listing to protect the free storage tier", async () => {
    await addPhotos(ids.second, 25); // 5 + 25 = 30
    await expect(addPhotos(ids.second, 1)).rejects.toMatchObject({ message: "too_many_media" });
  });

  it("can't delete the only listing, nor an approved one", async () => {
    await expect(listingWrite.deleteDraftListing(ctx("owner"), ids.listing)).rejects.toMatchObject({
      message: "not_deletable",
    });
    const { listingId } = await listingWrite.createListing(ctx("owner"), ids.biz);
    await listingWrite.deleteDraftListing(ctx("owner"), listingId);
    const [l] = await db
      .select()
      .from(s.listings)
      .where(and(eq(s.listings.id, listingId)));
    expect(l.deletedAt).not.toBeNull();
  });

  it("suspended businesses are read-only for their owners", async () => {
    await db.update(s.businesses).set({ status: "suspended" }).where(eq(s.businesses.id, ids.biz));
    await expect(listingWrite.saveListingBasics(ctx("owner"), ids.listing, { titleTr: "X" })).rejects.toMatchObject({
      message: "suspended",
    });
    await expect(businessWrite.updateBusinessInfo(ctx("owner"), ids.biz, { nameTr: "X" })).rejects.toMatchObject({
      message: "suspended",
    });
  });
});
