import "server-only";
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { refreshCityCounts, refreshCountryVisibility } from "./visibility";

/**
 * Test data is every account on this domain and everything those accounts own. `.test`
 * is reserved (RFC 2606), so no real person can sign up with it. The seed creates test
 * accounts here and so do the end-to-end tests.
 */
export const TEST_EMAIL_DOMAIN = "bizimevent.test";

/**
 * Deletes every @bizimevent.test account and what belongs to it: their businesses
 * (listings, media rows, prices, subscriptions… cascade), enquiries and bookings on those
 * businesses or by those customers, and reviews. Real accounts and their own data stay,
 * so this is safe on the live database.
 * INTERNAL: for the seed script and tests, never reachable from a request.
 */
export async function removeTestData(db: DB) {
  const pattern = `%@${TEST_EMAIL_DOMAIN}`;
  const removed = await db.transaction(async (tx) => {
    await tx.execute(sql`
      create temp table test_users on commit drop as
        select id from "user" where email like ${pattern}`);
    await tx.execute(sql`
      create temp table test_businesses on commit drop as
        select id, organization_id from businesses where owner_id in (select id from test_users)`);
    await tx.execute(sql`
      create temp table test_listings on commit drop as
        select id from listings where business_id in (select id from test_businesses)`);
    // Children first: these foreign keys don't cascade.
    await tx.execute(sql`
      delete from reviews
      where listing_id in (select id from test_listings) or customer_id in (select id from test_users)`);
    await tx.execute(sql`
      delete from bookings
      where listing_id in (select id from test_listings) or business_id in (select id from test_businesses)
         or customer_id in (select id from test_users)`);
    await tx.execute(sql`
      delete from enquiries
      where listing_id in (select id from test_listings) or business_id in (select id from test_businesses)
         or customer_id in (select id from test_users)`);
    await tx.execute(sql`delete from messages where sender_id in (select id from test_users)`);
    await tx.execute(sql`update reports set resolved_by_id = null where resolved_by_id in (select id from test_users)`);
    const businesses = await tx.execute(sql`delete from businesses where id in (select id from test_businesses)`);
    await tx.execute(sql`delete from cancellation_policies where business_id in (select id from test_businesses)`);
    await tx.execute(sql`
      delete from organization
      where id in (select organization_id from test_businesses where organization_id is not null)`);
    const users = await tx.execute(sql`delete from "user" where id in (select id from test_users)`);
    await tx.execute(sql`delete from verification where identifier like ${`%@${TEST_EMAIL_DOMAIN}%`}`);
    return { businesses: businesses.rowCount ?? 0, users: users.rowCount ?? 0 };
  });
  await refreshCityCounts(db);
  await refreshCountryVisibility(db);
  return removed;
}
