import "server-only";
import { desc, eq } from "drizzle-orm";
import { bookings } from "@/db/schema";
import { effectiveBookingStatus } from "@/server/rules";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { requireBookingParty, requireBusinessMember, requireUser } from "./guards";

type BookingRow = typeof bookings.$inferSelect;

/** Applies lazy time-based states (expired requests) on read. */
function withEffectiveStatus(ctx: DalContext, b: BookingRow) {
  return { ...b, status: effectiveBookingStatus(b, nowOf(ctx)) as BookingRow["status"] };
}

export async function getBooking(ctx: DalContext, bookingId: string) {
  const { booking, side } = await requireBookingParty(ctx, bookingId);
  return { booking: withEffectiveStatus(ctx, booking), side };
}

export async function listMyBookings(ctx: DalContext, limit = 50) {
  const user = requireUser(ctx);
  const rows = await ctx.db
    .select()
    .from(bookings)
    .where(eq(bookings.customerId, user.id))
    .orderBy(desc(bookings.eventDate))
    .limit(Math.min(limit, 100));
  return rows.map((b) => withEffectiveStatus(ctx, b));
}

export async function listBusinessBookings(ctx: DalContext, businessId: string, limit = 50) {
  await requireBusinessMember(ctx, businessId);
  const rows = await ctx.db
    .select()
    .from(bookings)
    .where(eq(bookings.businessId, businessId))
    .orderBy(desc(bookings.eventDate))
    .limit(Math.min(limit, 100));
  return rows.map((b) => withEffectiveStatus(ctx, b));
}
