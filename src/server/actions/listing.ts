"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { rateLimit } from "@/lib/adapters/redis";
import { translator } from "@/lib/adapters/translate";
import type { ListingSection } from "@/lib/listing-config";
import { sendNotice } from "@/emails/notices";
import { DalError, listingWrite, requireUser } from "@/server/dal";
import { runAction } from "./run";

const savers = {
  listing: listingWrite.saveListingBasics,
  pricing: listingWrite.saveListingPricing,
  "event-types": listingWrite.saveListingEventTypes,
  details: listingWrite.saveListingDetails,
  cancellation: listingWrite.saveListingCancellation,
} as const satisfies Partial<Record<ListingSection, unknown>>;

/** Autosave / Continue for one listing section. Live listings refresh their public pages. */
export async function saveListingSectionAction(
  listingId: string,
  section: keyof typeof savers,
  values: Record<string, unknown>,
) {
  return runAction(async (ctx) => {
    const saver = savers[section];
    if (!saver) throw new DalError("INVALID", "unknown_section");
    const res = await saver(ctx, listingId, values);
    revalidateTag(`listing:${listingId}`, "max");
    return res;
  });
}

export async function createListingAction(businessId: string, locale: string) {
  const result = await runAction((ctx) => listingWrite.createListing(ctx, businessId));
  if (!result.ok) return result;
  redirect({
    href: `/business/${businessId}/listings/${result.data.listingId}/listing`,
    locale: isLocale(locale) ? locale : "tr",
  });
}

export async function deleteListingAction(listingId: string) {
  return runAction((ctx) => listingWrite.deleteDraftListing(ctx, listingId));
}

export async function setListingPausedAction(listingId: string, paused: boolean) {
  return runAction(async (ctx) => {
    const res = await listingWrite.setListingPaused(ctx, listingId, paused);
    revalidateTag("listings", "max");
    return res;
  });
}

export async function submitListingAction(listingId: string) {
  return runAction(async (ctx) => {
    const res = await listingWrite.submitListingForReview(ctx, listingId);
    await Promise.all(
      res.admins.map((a) =>
        sendNotice("listingSubmitted", a.email, a.preferredLocale, {
          business: res.businessName,
          listing: res.listingTitle,
          path: `/admin/approvals`,
        }),
      ),
    );
    return null;
  });
}

/** "Translate with AI": drafts the other language for the owner to review. Null when no provider is set. */
export async function translateAction(text: string, from: "tr" | "en", to: "tr" | "en") {
  return runAction(async (ctx) => {
    const u = requireUser(ctx);
    if (typeof text !== "string" || !text.trim() || text.length > 8000 || from === to) throw new DalError("INVALID");
    const t = translator();
    if (!t.enabled) return { text: null as string | null, enabled: false };
    const { success } = await rateLimit("message", `translate:${u.id}`);
    if (!success) throw new DalError("CONFLICT", "rate_limited");
    return { text: await t.translate(text, from, to), enabled: true };
  });
}
