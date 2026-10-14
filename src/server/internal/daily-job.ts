import "server-only";
import { and, eq, gt, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, businesses, offers, processedWebhooks, subscriptions, user } from "@/db/schema";
import { sendNotice, type NoticeKind } from "@/emails/notices";
import { logger } from "@/lib/logger";
import { daysUntil, dueTrialReminder, effectiveSubscriptionStatus } from "@/server/rules";
import { refreshBusinessVisibility, refreshCityCounts, refreshCountryVisibility } from "./visibility";

/** Resend's free plan takes 2 requests a second; stay under it. */
const EMAIL_GAP_MS = 600;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Owner email, language and business name, for billing emails. */
async function ownersOf(db: DB, businessIds: string[]) {
  if (businessIds.length === 0) return new Map<string, { email: string; locale: "tr" | "en"; name: string }>();
  const rows = await db
    .select({
      id: businesses.id,
      email: user.email,
      locale: user.preferredLocale,
      nameTr: businesses.nameTr,
      nameEn: businesses.nameEn,
    })
    .from(businesses)
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .where(inArray(businesses.id, businessIds));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        email: r.email,
        locale: r.locale,
        name: (r.locale === "en" ? (r.nameEn ?? r.nameTr) : (r.nameTr ?? r.nameEn)) ?? "",
      },
    ]),
  );
}

/**
 * The ONE daily housekeeping job (Vercel Hobby cron runs at most once a day).
 * Every task is idempotent and time-based states are also evaluated lazily on
 * read, so a missed run never shows users a wrong state — it only delays tidying.
 * Tasks for later phases are registered here as they land.
 */
type Deps = {
  /** How emails go out (tests pass a recorder). */
  send: typeof sendNotice;
  /** Gap between emails, to stay inside the email provider's rate limit. */
  emailGapMs: number;
};
type Task = { name: string; run: (db: DB, now: Date, deps: Deps) => Promise<Record<string, unknown> | void> };

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
    run: async (db, now, { send, emailGapMs }) => {
      const candidates = await db
        .select()
        .from(subscriptions)
        .where(inArray(subscriptions.status, ["trialing", "past_due", "canceled"]));
      const changed: { businessId: string; from: string }[] = [];
      for (const sub of candidates) {
        const next = effectiveSubscriptionStatus(sub, now);
        if (next !== sub.status) {
          await db.update(subscriptions).set({ status: next }).where(eq(subscriptions.id, sub.id));
          changed.push({ businessId: sub.businessId, from: sub.status });
        }
      }
      for (const { businessId } of changed) await refreshBusinessVisibility(db, businessId, now);

      // Tell owners their listings are now hidden (an owner-cancelled plan was told at cancellation).
      const owners = await ownersOf(
        db,
        changed.map((c) => c.businessId),
      );
      let emailed = 0;
      for (const c of changed) {
        const kind: NoticeKind | null =
          c.from === "trialing" ? "trialEnded" : c.from === "past_due" ? "graceEnded" : null;
        const owner = owners.get(c.businessId);
        if (!kind || !owner) continue;
        await send(kind, owner.email, owner.locale, {
          business: owner.name,
          path: `/business/${c.businessId}/billing`,
        });
        emailed++;
        await pause(emailGapMs);
      }
      return { changed: changed.length, emailed };
    },
  },
  {
    name: "send_trial_reminders",
    run: async (db, now, { send, emailGapMs }) => {
      // Free trials ending within the reminder window, on live (approved, not deleted) businesses.
      const subs = await db
        .select({
          id: subscriptions.id,
          businessId: subscriptions.businessId,
          status: subscriptions.status,
          trialEndsAt: subscriptions.trialEndsAt,
          trialRemindersSent: subscriptions.trialRemindersSent,
        })
        .from(subscriptions)
        .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
        .where(
          and(
            eq(subscriptions.status, "trialing"),
            gt(subscriptions.trialEndsAt, now),
            lte(subscriptions.trialEndsAt, new Date(now.getTime() + 31 * 864e5)),
            eq(businesses.status, "approved"),
            isNull(businesses.deletedAt),
          ),
        );
      const due = subs.flatMap((s) => {
        const reminder = dueTrialReminder(s, now);
        return reminder ? [{ ...s, reminder }] : [];
      });
      const owners = await ownersOf(
        db,
        due.map((d) => d.businessId),
      );
      for (const d of due) {
        const owner = owners.get(d.businessId);
        if (owner) {
          await send("trialEnding", owner.email, owner.locale, {
            business: owner.name,
            date: d.trialEndsAt,
            days: daysUntil(d.trialEndsAt!, now),
            path: `/business/${d.businessId}/billing`,
          });
          await pause(emailGapMs);
        }
        // Marked even without an owner row, so a broken business never blocks the queue.
        await db
          .update(subscriptions)
          .set({ trialRemindersSent: d.reminder.markSent })
          .where(eq(subscriptions.id, d.id));
      }
      return { sent: due.length };
    },
  },
  {
    name: "prune_processed_webhooks",
    run: async (db, now) => {
      // Stripe retries for up to 3 days; a month of event ids is plenty for de-duplication.
      const rows = await db
        .delete(processedWebhooks)
        .where(lt(processedWebhooks.processedAt, new Date(now.getTime() - 30 * 864e5)))
        .returning({ id: processedWebhooks.stripeEventId });
      return { deleted: rows.length };
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

export async function runDailyJob(db: DB, now = new Date(), deps: Partial<Deps> = {}) {
  const resolved: Deps = { send: sendNotice, emailGapMs: EMAIL_GAP_MS, ...deps };
  const results: Record<string, unknown> = {};
  for (const task of tasks) {
    const started = Date.now();
    try {
      const output = await task.run(db, now, resolved);
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
