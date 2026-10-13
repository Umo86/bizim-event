/**
 * Removing test data must never touch real accounts: it runs against the live database
 * (Database workflow → "remove test data", or `pnpm db:seed --reset / --remove-demo`).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { removeTestData } from "@/server/internal/test-data";
import { freshTestDb, TEST_DATABASE_URL } from "../support/db";

describe.skipIf(!TEST_DATABASE_URL)("removing test data", () => {
  let db: DB;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await freshTestDb());
  });
  afterAll(async () => close?.());

  const user = async (email: string, role: "customer" | "business") =>
    (await db.insert(s.user).values({ email, name: email, role, emailVerified: true }).returning())[0];
  const business = async (ownerId: string, slug: string) =>
    (
      await db
        .insert(s.businesses)
        .values({ ownerId, type: "venue", nameEn: slug, slug, status: "approved" })
        .returning()
    )[0];
  const listing = async (businessId: string, slug: string) =>
    (
      await db
        .insert(s.listings)
        .values({ businessId, type: "venue", titleEn: slug, slug, status: "approved", currency: "GBP" })
        .returning()
    )[0];
  const enquiry = async (customerId: string, l: { id: string; businessId: string }) =>
    (
      await db
        .insert(s.enquiries)
        .values({ customerId, listingId: l.id, businessId: l.businessId, eventDate: "2027-06-05", message: "Merhaba" })
        .returning()
    )[0];

  it("deletes the @bizimevent.test accounts and what they own, and nothing else", async () => {
    const realOwner = await user("owner@real.example", "business");
    const realCustomer = await user("customer@real.example", "customer");
    // Contains the test domain but isn't on it.
    const lookalike = await user("someone@bizimevent.test.example", "customer");
    const testOwner = await user("venue1@bizimevent.test", "business");
    const testCustomer = await user("customer1@bizimevent.test", "customer");

    const realListing = await listing((await business(realOwner.id, "real-hall")).id, "real-room");
    const testBusiness = await business(testOwner.id, "test-hall");
    const testListing = await listing(testBusiness.id, "test-room");
    const [org] = await db.insert(s.organization).values({ name: "Test Hall", slug: "test-hall-org" }).returning();
    await db.update(s.businesses).set({ organizationId: org.id }).where(eq(s.businesses.id, testBusiness.id));
    await db.insert(s.member).values({ organizationId: org.id, userId: testOwner.id, role: "owner" });

    const realOnReal = await enquiry(realCustomer.id, realListing);
    await db.insert(s.messages).values({ enquiryId: realOnReal.id, senderId: realCustomer.id, body: "Merhaba" });
    await enquiry(testCustomer.id, realListing); // a test customer asked a real business
    const realOnTest = await enquiry(realCustomer.id, testListing); // a real customer asked a test business
    const [booking] = await db
      .insert(s.bookings)
      .values({
        enquiryId: realOnTest.id,
        listingId: testListing.id,
        businessId: testBusiness.id,
        customerId: realCustomer.id,
        eventDate: "2026-06-05",
        timezone: "Europe/London",
        currency: "GBP",
        status: "completed",
      })
      .returning();
    await db.insert(s.reviews).values({
      bookingId: booking.id,
      listingId: testListing.id,
      customerId: realCustomer.id,
      rating: 5,
      status: "published",
    });

    expect(await removeTestData(db)).toEqual({ businesses: 1, users: 2 });

    const emails = (await db.select({ email: s.user.email }).from(s.user)).map((r) => r.email).sort();
    expect(emails).toEqual(["customer@real.example", "owner@real.example", lookalike.email]);
    expect((await db.select({ id: s.listings.id }).from(s.listings)).map((r) => r.id)).toEqual([realListing.id]);
    expect((await db.select({ id: s.enquiries.id }).from(s.enquiries)).map((r) => r.id)).toEqual([realOnReal.id]);
    expect(await db.select().from(s.messages)).toHaveLength(1);
    expect(await db.select().from(s.bookings)).toHaveLength(0);
    expect(await db.select().from(s.reviews)).toHaveLength(0);
    expect(await db.select().from(s.organization)).toHaveLength(0);
    expect(await db.select().from(s.member)).toHaveLength(0);

    // Running it again finds nothing more to remove.
    expect(await removeTestData(db)).toEqual({ businesses: 0, users: 0 });
  });
});
