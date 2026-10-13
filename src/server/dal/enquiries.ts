import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { enquiries, listings } from "@/db/schema";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { DalError } from "./errors";
import { requireBusinessMember, requireEnquiryParty, requireUser } from "./guards";

export const createEnquiryInput = z.object({
  listingId: z.string().uuid(),
  eventPlanId: z.string().uuid().optional(),
  eventTypeId: z.string().uuid().optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  guests: z.number().int().positive().max(10_000).optional(),
  budget: z.number().nonnegative().max(10_000_000).optional(),
  budgetCurrency: z.string().length(3).toUpperCase().optional(),
  message: z.string().trim().min(10).max(4000),
});
export type CreateEnquiryInput = z.infer<typeof createEnquiryInput>;

/** Customer sends an enquiry to a PUBLIC listing. */
export async function createEnquiry(ctx: DalContext, raw: CreateEnquiryInput) {
  const user = requireUser(ctx);
  const input = createEnquiryInput.parse(raw);
  const [listing] = await ctx.db
    .select({ id: listings.id, businessId: listings.businessId, isPublic: listings.isPublic })
    .from(listings)
    .where(eq(listings.id, input.listingId))
    .limit(1);
  if (!listing || !listing.isPublic) throw new DalError("NOT_FOUND");

  const now = nowOf(ctx);
  const [row] = await ctx.db
    .insert(enquiries)
    .values({
      customerId: user.id,
      listingId: listing.id,
      businessId: listing.businessId,
      eventPlanId: input.eventPlanId,
      eventTypeId: input.eventTypeId,
      eventDate: input.eventDate,
      startTime: input.startTime,
      endTime: input.endTime,
      guests: input.guests,
      budget: input.budget,
      budgetCurrency: input.budgetCurrency,
      message: input.message,
      lastMessageAt: now,
    })
    .returning();
  return row;
}

/** The signed-in customer's own enquiries. */
export async function listMyEnquiries(ctx: DalContext, limit = 50) {
  const user = requireUser(ctx);
  return ctx.db
    .select()
    .from(enquiries)
    .where(eq(enquiries.customerId, user.id))
    .orderBy(desc(enquiries.lastMessageAt))
    .limit(Math.min(limit, 100));
}

/** One enquiry — only the customer or the receiving business may read it. */
export async function getEnquiry(ctx: DalContext, enquiryId: string) {
  const { enquiry, side } = await requireEnquiryParty(ctx, enquiryId);
  return { enquiry, side };
}

/** Business inbox. */
export async function listBusinessEnquiries(
  ctx: DalContext,
  businessId: string,
  opts: { status?: (typeof enquiries.$inferSelect)["status"]; limit?: number } = {},
) {
  await requireBusinessMember(ctx, businessId);
  return ctx.db
    .select()
    .from(enquiries)
    .where(and(eq(enquiries.businessId, businessId), opts.status ? eq(enquiries.status, opts.status) : undefined))
    .orderBy(desc(enquiries.lastMessageAt))
    .limit(Math.min(opts.limit ?? 50, 100));
}
