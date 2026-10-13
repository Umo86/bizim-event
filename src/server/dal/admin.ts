import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { auditLog, businesses, listings, subscriptions } from "@/db/schema";
import { TRIAL_DAYS } from "@/lib/adapters/billing";
import { refreshBusinessVisibility } from "@/server/internal/visibility";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { DalError } from "./errors";
import { requireAdmin } from "./guards";

export async function listPendingBusinesses(ctx: DalContext) {
  requireAdmin(ctx);
  return ctx.db
    .select()
    .from(businesses)
    .where(eq(businesses.status, "pending_review"))
    .orderBy(asc(businesses.submittedAt))
    .limit(100);
}

/**
 * Approves a business and its submitted listings, and starts the 90-day free
 * trial (the trial starts at approval, not sign-up). Idempotent.
 */
export async function approveBusiness(ctx: DalContext, businessId: string) {
  const admin = requireAdmin(ctx);
  const now = nowOf(ctx);
  return ctx.db.transaction(async (tx) => {
    const [biz] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!biz) throw new DalError("NOT_FOUND");
    if (biz.status !== "pending_review" && biz.status !== "approved") throw new DalError("CONFLICT", "not_pending");

    await tx
      .update(businesses)
      .set({ status: "approved", approvedAt: biz.approvedAt ?? now, verifiedAt: biz.verifiedAt ?? now, rejectionReason: null })
      .where(eq(businesses.id, businessId));
    await tx
      .update(listings)
      .set({ status: "approved" })
      .where(and(eq(listings.businessId, businessId), eq(listings.status, "pending_review")));

    const [existing] = await tx.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1);
    if (!existing) {
      await tx.insert(subscriptions).values({
        businessId,
        status: "trialing",
        trialStartedAt: now,
        trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 864e5),
      });
    }
    await tx.insert(auditLog).values({ actorId: admin.id, action: "business.approve", entity: "business", entityId: businessId });
    await refreshBusinessVisibility(tx as unknown as typeof ctx.db, businessId, now);
    return { ok: true as const };
  });
}

export async function rejectBusiness(ctx: DalContext, businessId: string, reason: string) {
  const admin = requireAdmin(ctx);
  if (!reason.trim()) throw new DalError("INVALID", "reason_required");
  await ctx.db.update(businesses).set({ status: "rejected", rejectionReason: reason.trim() }).where(eq(businesses.id, businessId));
  await ctx.db.insert(auditLog).values({ actorId: admin.id, action: "business.reject", entity: "business", entityId: businessId, diff: { reason } });
  await refreshBusinessVisibility(ctx.db, businessId, nowOf(ctx));
}

export async function subscriptionCountsByStatus(ctx: DalContext) {
  requireAdmin(ctx);
  return ctx.db.select({ status: subscriptions.status, n: count() }).from(subscriptions).groupBy(subscriptions.status);
}

/** System usage page: database size and the biggest tables (free-tier watch). */
export async function systemUsage(ctx: DalContext) {
  requireAdmin(ctx);
  const size = await ctx.db.execute<{ bytes: string }>(sql`select pg_database_size(current_database())::text as bytes`);
  const tables = await ctx.db.execute<{ table: string; rows: string; bytes: string }>(sql`
    select relname as "table", n_live_tup::text as rows, pg_total_relation_size(relid)::text as bytes
    from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 15`);
  return {
    databaseBytes: Number(size.rows[0]?.bytes ?? 0),
    freeTierBytes: 1024 ** 3,
    tables: tables.rows.map((r) => ({ table: r.table, rows: Number(r.rows), bytes: Number(r.bytes) })),
  };
}
