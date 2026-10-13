import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { businesses, member, subscriptions } from "@/db/schema";
import { isSubscriptionInGoodStanding } from "@/server/rules";
import type { DalContext } from "./context";
import { nowOf } from "./context";
import { requireBusinessMember, requireUser } from "./guards";

/** Businesses the caller owns or is a team member of. */
export async function listMyBusinesses(ctx: DalContext) {
  const user = requireUser(ctx);
  const orgIds = ctx.db.select({ id: member.organizationId }).from(member).where(eq(member.userId, user.id));
  return ctx.db
    .select({
      id: businesses.id,
      type: businesses.type,
      nameTr: businesses.nameTr,
      nameEn: businesses.nameEn,
      slug: businesses.slug,
      status: businesses.status,
      countryIso2: businesses.countryIso2,
    })
    .from(businesses)
    .where(
      and(
        isNull(businesses.deletedAt),
        or(eq(businesses.ownerId, user.id), inArray(businesses.organizationId, orgIds)),
      ),
    );
}

/** Subscription for one business — billing is owner-only. */
export async function getBusinessSubscription(ctx: DalContext, businessId: string) {
  await requireBusinessMember(ctx, businessId, "owner");
  const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1);
  if (!sub) return null;
  const now = nowOf(ctx);
  const trialDaysLeft =
    sub.status === "trialing" && sub.trialEndsAt
      ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 864e5))
      : null;
  return { ...sub, inGoodStanding: isSubscriptionInGoodStanding(sub, now), trialDaysLeft };
}
