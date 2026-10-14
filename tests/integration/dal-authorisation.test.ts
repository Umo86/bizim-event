/**
 * Proves the DAL authorisation rules against a real Postgres + PostGIS:
 * - a customer cannot read another customer's enquiries or bookings
 * - a business cannot read another business's enquiries, bookings or subscription
 * - team managers get the inbox but not billing
 * - non-admins cannot hit admin actions
 * - public queries never leak hidden listings
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import {
  adminDal,
  bookingsDal,
  businessesDal,
  enquiriesDal,
  publicData,
  type DalContext,
  type SessionUser,
} from "@/server/dal";
import { refreshBusinessVisibility } from "@/server/internal/visibility";
import { runDailyJob } from "@/server/internal/daily-job";
import { freshTestDb, TEST_DATABASE_URL } from "../support/db";

const DAY = 864e5;

describe.skipIf(!TEST_DATABASE_URL)("DAL authorisation", () => {
  let db: DB;
  let close: () => Promise<void>;
  const u: Record<string, SessionUser> = {};
  const ids: Record<string, string> = {};
  const ctx = (who: keyof typeof u | null, now?: Date): DalContext => ({ db, user: who ? u[who] : null, now });

  async function makeUser(key: string, role: SessionUser["role"]) {
    const [row] = await db
      .insert(s.user)
      .values({ email: `${key}@test.local`, name: key, role, emailVerified: true })
      .returning();
    u[key] = { id: row.id, email: row.email, name: row.name, role, preferredLocale: "en" };
  }

  async function makeBusiness(
    key: string,
    ownerKey: string,
    subStatus: "active" | "expired" | null,
    status: "approved" | "pending_review" = "approved",
  ) {
    const [org] = await db.insert(s.organization).values({ name: key, slug: key }).returning();
    await db.insert(s.member).values({ organizationId: org.id, userId: u[ownerKey].id, role: "owner" });
    const [biz] = await db
      .insert(s.businesses)
      .values({
        ownerId: u[ownerKey].id,
        organizationId: org.id,
        type: "venue",
        nameEn: key,
        slug: key,
        status,
        countryIso2: "GB",
        cityId: ids.london,
        timezone: "Europe/London",
        currency: "GBP",
        location: { lng: -0.12, lat: 51.5 },
        submittedAt: new Date(),
      })
      .returning();
    ids[key] = biz.id;
    ids[`${key}Org`] = org.id;
    const [listing] = await db
      .insert(s.listings)
      .values({
        businessId: biz.id,
        type: "venue",
        titleEn: `${key} hall`,
        slug: `${key}-hall`,
        status: status === "approved" ? "approved" : "pending_review",
        currency: "GBP",
        priceFrom: 1000,
      })
      .returning();
    ids[`${key}Listing`] = listing.id;
    if (subStatus) {
      await db.insert(s.subscriptions).values({
        businessId: biz.id,
        status: subStatus,
        trialStartedAt: new Date(Date.now() - 100 * DAY),
        trialEndsAt: new Date(Date.now() - 10 * DAY),
        currentPeriodEnd: new Date(Date.now() + 20 * DAY),
      });
    }
    await refreshBusinessVisibility(db, biz.id);
  }

  beforeAll(async () => {
    ({ db, close } = await freshTestDb());
    await db.insert(s.countries).values({
      iso2: "GB",
      nameEn: "United Kingdom",
      nameTr: "İngiltere",
      slugEn: "united-kingdom",
      slugTr: "ingiltere",
      defaultCurrency: "GBP",
      distanceUnit: "mi",
    });
    const [london] = await db
      .insert(s.cities)
      .values({
        countryIso2: "GB",
        nameEn: "London",
        nameTr: "Londra",
        slugEn: "london",
        slugTr: "londra",
        timezone: "Europe/London",
        centre: { lng: -0.1276, lat: 51.5072 },
      })
      .returning();
    ids.london = london.id;

    await makeUser("alice", "customer");
    await makeUser("bob", "customer");
    await makeUser("ownerA", "business");
    await makeUser("ownerB", "business");
    await makeUser("managerA", "business");
    await makeUser("ownerC", "business");
    await makeUser("ownerP", "business");
    await makeUser("admin", "admin");

    await makeBusiness("bizA", "ownerA", "active");
    await makeBusiness("bizB", "ownerB", "active");
    await makeBusiness("bizC", "ownerC", "expired"); // hidden: subscription expired
    await makeBusiness("bizP", "ownerP", null, "pending_review"); // awaiting approval
    await db.insert(s.member).values({ organizationId: ids.bizAOrg, userId: u.managerA.id, role: "member" });

    const aliceEnq = await enquiriesDal.createEnquiry(ctx("alice"), {
      listingId: ids.bizAListing,
      message: "Is 12 June free for 200 guests?",
    });
    const bobEnq = await enquiriesDal.createEnquiry(ctx("bob"), {
      listingId: ids.bizBListing,
      message: "Do you allow davul-zurna at weddings?",
    });
    ids.aliceEnquiry = aliceEnq.id;
    ids.bobEnquiry = bobEnq.id;

    const [aliceBooking] = await db
      .insert(s.bookings)
      .values({
        enquiryId: aliceEnq.id,
        listingId: ids.bizAListing,
        businessId: ids.bizA,
        customerId: u.alice.id,
        eventDate: "2027-06-12",
        timezone: "Europe/London",
        currency: "GBP",
        status: "confirmed",
      })
      .returning();
    const [bobBooking] = await db
      .insert(s.bookings)
      .values({
        enquiryId: bobEnq.id,
        listingId: ids.bizBListing,
        businessId: ids.bizB,
        customerId: u.bob.id,
        eventDate: "2027-07-01",
        timezone: "Europe/London",
        currency: "GBP",
        status: "requested",
        requestExpiresAt: new Date(Date.now() - 60_000), // overdue → expired on read
      })
      .returning();
    ids.aliceBooking = aliceBooking.id;
    ids.bobBooking = bobBooking.id;
  });

  afterAll(async () => {
    await close?.();
  });

  describe("customers", () => {
    it("anonymous callers are rejected", async () => {
      await expect(enquiriesDal.listMyEnquiries(ctx(null))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
      await expect(bookingsDal.getBooking(ctx(null), ids.aliceBooking)).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
      });
    });

    it("a customer sees only their own enquiries", async () => {
      const mine = await enquiriesDal.listMyEnquiries(ctx("alice"));
      expect(mine.map((e) => e.id)).toEqual([ids.aliceEnquiry]);
    });

    it("a customer cannot read another customer's enquiry", async () => {
      await expect(enquiriesDal.getEnquiry(ctx("alice"), ids.bobEnquiry)).rejects.toMatchObject({ code: "FORBIDDEN" });
      const own = await enquiriesDal.getEnquiry(ctx("alice"), ids.aliceEnquiry);
      expect(own.side).toBe("customer");
    });

    it("a customer cannot read another customer's booking", async () => {
      await expect(bookingsDal.getBooking(ctx("alice"), ids.bobBooking)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await bookingsDal.listMyBookings(ctx("alice"))).map((b) => b.id)).toEqual([ids.aliceBooking]);
    });

    it("a customer cannot enquire to a hidden or pending listing", async () => {
      await expect(
        enquiriesDal.createEnquiry(ctx("alice"), { listingId: ids.bizCListing, message: "Hello, is this available?" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        enquiriesDal.createEnquiry(ctx("alice"), { listingId: ids.bizPListing, message: "Hello, is this available?" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("a customer cannot open a business inbox", async () => {
      await expect(enquiriesDal.listBusinessEnquiries(ctx("alice"), ids.bizA)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  describe("businesses", () => {
    it("a business sees its own enquiries and bookings", async () => {
      expect((await enquiriesDal.listBusinessEnquiries(ctx("ownerA"), ids.bizA)).map((e) => e.id)).toEqual([
        ids.aliceEnquiry,
      ]);
      expect((await bookingsDal.listBusinessBookings(ctx("ownerA"), ids.bizA)).map((b) => b.id)).toEqual([
        ids.aliceBooking,
      ]);
      expect((await enquiriesDal.getEnquiry(ctx("ownerA"), ids.aliceEnquiry)).side).toBe("business");
    });

    it("a business cannot read another business's enquiries or bookings", async () => {
      await expect(enquiriesDal.listBusinessEnquiries(ctx("ownerA"), ids.bizB)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(bookingsDal.listBusinessBookings(ctx("ownerA"), ids.bizB)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(bookingsDal.getBooking(ctx("ownerA"), ids.bobBooking)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(enquiriesDal.getEnquiry(ctx("ownerA"), ids.bobEnquiry)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("a business cannot read another business's subscription", async () => {
      await expect(businessesDal.getBusinessSubscription(ctx("ownerA"), ids.bizB)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      const own = await businessesDal.getBusinessSubscription(ctx("ownerA"), ids.bizA);
      expect(own?.status).toBe("active");
      expect(own?.inGoodStanding).toBe(true);
    });

    it("probing a non-existent business id looks the same as someone else's", async () => {
      await expect(
        enquiriesDal.listBusinessEnquiries(ctx("ownerA"), "00000000-0000-4000-8000-000000000000"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("a team manager gets the inbox but not billing", async () => {
      expect((await enquiriesDal.listBusinessEnquiries(ctx("managerA"), ids.bizA)).length).toBe(1);
      await expect(businessesDal.getBusinessSubscription(ctx("managerA"), ids.bizA)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(enquiriesDal.listBusinessEnquiries(ctx("managerA"), ids.bizB)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect((await businessesDal.listMyBusinesses(ctx("managerA"))).map((b) => b.id)).toEqual([ids.bizA]);
    });

    it("booking requests past their expiry read as expired", async () => {
      const { booking } = await bookingsDal.getBooking(ctx("ownerB"), ids.bobBooking);
      expect(booking.status).toBe("expired");
    });
  });

  describe("admin", () => {
    it("non-admins cannot hit admin actions", async () => {
      for (const who of ["alice", "ownerA", "managerA"] as const) {
        await expect(adminDal.listPendingBusinesses(ctx(who))).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(adminDal.approveBusiness(ctx(who), ids.bizP)).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(adminDal.systemUsage(ctx(who))).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await expect(adminDal.listPendingBusinesses(ctx(null))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    });

    it("approval starts a 90-day trial and makes the listing public", async () => {
      const pending = await adminDal.listPendingBusinesses(ctx("admin"));
      expect(pending.map((b) => b.id)).toContain(ids.bizP);
      expect(await publicData.getPublicListingBySlug(ctx(null), "bizP-hall")).toBeNull();

      await adminDal.approveBusiness(ctx("admin"), ids.bizP);
      const [sub] = await db.select().from(s.subscriptions).where(eq(s.subscriptions.businessId, ids.bizP));
      expect(sub.status).toBe("trialing");
      const days = (sub.trialEndsAt!.getTime() - sub.trialStartedAt!.getTime()) / DAY;
      expect(days).toBe(90);
      expect(await publicData.getPublicListingBySlug(ctx(null), "bizP-hall")).not.toBeNull();
    });

    it("reports database usage", async () => {
      const usage = await adminDal.systemUsage(ctx("admin"));
      expect(usage.databaseBytes).toBeGreaterThan(0);
      expect(usage.freeTierBytes).toBe(1024 ** 3);
    });
  });

  describe("public data", () => {
    it("never returns hidden listings", async () => {
      const { items } = await publicData.listPublicListings(ctx(null));
      const slugs = items.map((i) => i.slug);
      expect(slugs).toContain("bizA-hall");
      expect(slugs).not.toContain("bizC-hall"); // expired subscription
      expect(await publicData.getPublicListingBySlug(ctx(null), "bizC-hall")).toBeNull();
    });

    it("public listing rows carry no private fields", async () => {
      const row = await publicData.getPublicListingBySlug(ctx(null), "bizA-hall");
      expect(row).not.toBeNull();
      expect(Object.keys(row!)).not.toEqual(expect.arrayContaining(["ownerId", "phoneE164", "email"]));
    });

    it("only countries with public listings are visible", async () => {
      const visible = await publicData.listVisibleCountries(ctx(null));
      expect(visible.map((c) => c.iso2)).toEqual(["GB"]);
    });
  });

  describe("daily job", () => {
    it("expires a lapsed trial and hides its listings", async () => {
      // A trial that ended yesterday but still says "trialing".
      await makeUser("ownerT", "business");
      await makeBusiness("bizT", "ownerT", null);
      await db.insert(s.subscriptions).values({
        businessId: ids.bizT,
        status: "trialing",
        trialStartedAt: new Date(Date.now() - 91 * DAY),
        trialEndsAt: new Date(Date.now() - DAY),
      });
      // Lazy read already treats it as not public:
      await refreshBusinessVisibility(db, ids.bizT);
      expect(await publicData.getPublicListingBySlug(ctx(null), "bizT-hall")).toBeNull();

      const sent: string[] = [];
      const results = await runDailyJob(db, undefined, {
        send: async (kind, to) => void sent.push(`${kind} → ${to}`),
        emailGapMs: 0,
      });
      expect(results.settle_subscription_states).toMatchObject({ ok: true, emailed: 1 });
      expect(sent).toContain("trialEnded → ownerT@test.local");
      const [sub] = await db.select().from(s.subscriptions).where(eq(s.subscriptions.businessId, ids.bizT));
      expect(sub.status).toBe("expired");
      const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, ids.bobBooking));
      expect(booking.status).toBe("expired");
    });
  });
});
