import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, businesses, offers, subscriptions } from "@/db/schema";
import { logger } from "@/lib/logger";
import { effectiveSubscriptionStatus } from "@/server/rules";
import { refreshBusinessVisibility, refreshCityCounts, refreshCountryVisibility } from "./visibility";

/**
 * The ONE daily housekeeping job (Vercel Hobby cron runs at most once a day).
 * Every task is idempotent and time-based states are also evaluated lazily on
 * read, so a missed run never shows users a wrong state — it only delays tidying.
 * Tasks for later phases are registered here as they land.
 */
type Task = { name: string; run: (db: DB, now: Date) => Promise<Record<string, unknown> | void> };

const tasks: Task[] = [
  {
    name: "expire_booking_requests",
    run: async (db, now) => {
      const rows = await db
        .update(bookings)
        .set({ status: "expired" })
        .where(and(eq(bookings.status, "requested"), lte(bookings.requestExpiresAt, now)))
        .returning({ id: bookings.id });
      return { expired: rows.length };
    },
  },
  {
    name: "expire_offers",
    run: async (db, now) => {
      const rows = await db
        .update(offers)
        .set({ status: "expired" })
        .where(and(eq(offers.status, "sent"), lte(offers.validUntil, now)))
        .returning({ id: offers.id });
      return { expired: rows.length };
    },
  },
  {
    name: "complete_past_bookings",
    run: async (db) => {
      // "Day after the event" in the listing's own time zone.
      const rows = await db
        .update(bookings)
        .set({ status: "completed", completedAt: sql`now()` })
        .where(
          and(
            eq(bookings.status, "confirmed"),
            sql`${bookings.eventDate} < (now() at time zone ${bookings.timezone})::date`,
          ),
        )
        .returning({ id: bookings.id });
      return { completed: rows.length };
    },
  },
  {
    name: "settle_subscription_states",
    run: async (db, now) => {
      const candidates = await db
        .select()
        .from(subscriptions)
        .where(inArray(subscriptions.status, ["trialing", "past_due", "canceled"]));
      const changed: string[] = [];
      for (const sub of candidates) {
        const next = effectiveSubscriptionStatus(sub, now);
        if (next !== sub.status) {
          await db.update(subscriptions).set({ status: next }).where(eq(subscriptions.id, sub.id));
          changed.push(sub.businessId);
        }
      }
      for (const businessId of changed) await refreshBusinessVisibility(db, businessId, now);
      return { changed: changed.length };
    },
  },
  {
    name: "refresh_geo_counts",
    run: async (db) => {
      await refreshCityCounts(db);
      await refreshCountryVisibility(db);
    },
  },
  {
    name: "sanity_counts",
    run: async (db) => {
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(businesses);
      return { businesses: row?.n ?? 0 };
    },
  },
];

export async function runDailyJob(db: DB, now = new Date()) {
  const results: Record<string, unknown> = {};
  for (const task of tasks) {
    const started = Date.now();
    try {
      const output = await task.run(db, now);
      results[task.name] = { ok: true, ms: Date.now() - started, ...output };
    } catch (err) {
      // One failing task never blocks the others.
      logger.error("cron.task_failed", { task: task.name, message: (err as Error).message });
      results[task.name] = { ok: false, error: (err as Error).message };
    }
  }
  logger.info("cron.daily", results);
  return results;
}
