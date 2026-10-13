import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { bookings, businesses, enquiries, member } from "@/db/schema";
import type { DalContext, SessionUser } from "./context";
import { DalError } from "./errors";

/**
 * Authorisation guards. Every DAL function calls at least one of these before
 * touching data. There is no RLS — these ARE the security boundary.
 */

export function requireUser(ctx: DalContext): SessionUser {
  if (!ctx.user) throw new DalError("UNAUTHENTICATED");
  return ctx.user;
}

export function requireAdmin(ctx: DalContext): SessionUser {
  const u = requireUser(ctx);
  if (u.role !== "admin") throw new DalError("FORBIDDEN", "admin_only");
  return u;
}

export type BusinessRole = "owner" | "manager";

/**
 * The caller must own the business, or be a member of its organization.
 * `minRole: "owner"` restricts to the owner and organization owners/admins
 * (billing, team management, deleting listings).
 */
export async function requireBusinessMember(
  ctx: DalContext,
  businessId: string,
  minRole: BusinessRole = "manager",
): Promise<{ user: SessionUser; business: typeof businesses.$inferSelect; role: BusinessRole }> {
  const u = requireUser(ctx);
  const [business] = await ctx.db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)))
    .limit(1);
  // Same error for "doesn't exist" and "not yours" so IDs can't be probed.
  if (!business) throw new DalError("FORBIDDEN");

  if (business.ownerId === u.id) return { user: u, business, role: "owner" };

  if (business.organizationId) {
    const [m] = await ctx.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, business.organizationId), eq(member.userId, u.id)))
      .limit(1);
    if (m) {
      const role: BusinessRole = m.role === "owner" || m.role === "admin" ? "owner" : "manager";
      if (minRole === "owner" && role !== "owner") throw new DalError("FORBIDDEN", "owner_only");
      return { user: u, business, role };
    }
  }
  throw new DalError("FORBIDDEN");
}

/** Customer on the booking, or a member of the business that owns it. */
export async function requireBookingParty(ctx: DalContext, bookingId: string) {
  const u = requireUser(ctx);
  const [booking] = await ctx.db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new DalError("FORBIDDEN");
  if (booking.customerId === u.id) return { user: u, booking, side: "customer" as const };
  await requireBusinessMember(ctx, booking.businessId);
  return { user: u, booking, side: "business" as const };
}

/** Customer who sent the enquiry, or a member of the business it was sent to. */
export async function requireEnquiryParty(ctx: DalContext, enquiryId: string) {
  const u = requireUser(ctx);
  const [enquiry] = await ctx.db.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
  if (!enquiry) throw new DalError("FORBIDDEN");
  if (enquiry.customerId === u.id) return { user: u, enquiry, side: "customer" as const };
  await requireBusinessMember(ctx, enquiry.businessId);
  return { user: u, enquiry, side: "business" as const };
}
