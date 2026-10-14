"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { geocode, type ResolvedAddress } from "@/lib/adapters/geocode";
import { rateLimit } from "@/lib/adapters/redis";
import type { ListingType } from "@/lib/listing-config";
import { defaultCurrencyFor, timezoneFor } from "@/lib/timezone";
import { locationInput, type BusinessSettingsValues } from "@/lib/validation/business";
import { sendNotice } from "@/emails/notices";
import { businessWrite, DalError, requireUser } from "@/server/dal";
import { refreshSessionCache } from "@/server/session";
import { runAction, type ActionResult } from "./run";

/** Step 0 — create the draft business and jump into the wizard. */
export async function createBusinessAction(type: ListingType, locale: string) {
  const result = await runAction(async (ctx) => {
    const u = requireUser(ctx);
    const { success } = await rateLimit("enquiry", `create-business:${u.id}`);
    if (!success) throw new DalError("CONFLICT", "rate_limited");
    const created = await businessWrite.createBusinessDraft(ctx, { type });
    // A customer has just become a business user: update the cached session now, or the
    // account page would keep saying "customer" for up to five minutes.
    if (u.role === "customer") await refreshSessionCache();
    return created;
  });
  if (!result.ok) return result;
  redirect({ href: `/business/${result.data.businessId}/setup/info`, locale: isLocale(locale) ? locale : "tr" });
}

export async function saveBusinessInfoAction(businessId: string, values: Record<string, unknown>) {
  return runAction((ctx) => businessWrite.updateBusinessInfo(ctx, businessId, values));
}

/**
 * "Location" step. Resolves a picked place (Google/Photon) or a manual address,
 * finds/creates the city, and prefills time zone + currency.
 */
export async function saveLocationAction(
  businessId: string,
  raw: unknown,
): Promise<ActionResult<{ cityId: string; address: string }>> {
  return runAction(async (ctx) => {
    const u = requireUser(ctx);
    const { success } = await rateLimit("upload", `places:${u.id}`);
    if (!success) throw new DalError("CONFLICT", "rate_limited");
    const input = locationInput.parse(raw);
    let address: ResolvedAddress | null;
    if (input.mode === "place") {
      address = await geocode().placeDetails(input.placeId, { language: "en", sessionToken: input.sessionToken });
      if (!address) throw new DalError("INVALID", "place_not_found");
    } else {
      address = {
        provider: "manual",
        placeId: "manual",
        formattedAddress: [input.addressLine, input.postalCode, input.city].filter(Boolean).join(", "),
        location: null,
        countryIso2: input.countryIso2,
        locality: input.city,
        adminArea: null,
        postalCode: input.postalCode ?? null,
        types: [],
      };
    }
    // Best effort: a canonical city (with its centre and Turkish name) from the provider.
    const city = await geocode()
      .resolveCity(address)
      .catch(() => null);
    const timezone = timezoneFor(address.location ?? city?.centre ?? null, address.countryIso2);
    const currency = defaultCurrencyFor(address.countryIso2);
    const res = await businessWrite.setBusinessLocation(ctx, businessId, {
      address,
      city,
      addressExtra: input.mode === "place" ? input.addressExtra : null,
      timezone,
      currency,
    });
    revalidateTag("listings", "max");
    return { cityId: res.cityId, address: address.formattedAddress };
  });
}

export async function saveSettingsAction(businessId: string, values: BusinessSettingsValues) {
  return runAction((ctx) => businessWrite.updateBusinessSettings(ctx, businessId, values));
}

/** Final wizard step — send everything to the approval queue and tell the admins. */
export async function submitBusinessAction(businessId: string) {
  return runAction(async (ctx) => {
    const res = await businessWrite.submitBusinessForReview(ctx, businessId);
    await Promise.all(
      res.admins.map((a) =>
        sendNotice("businessSubmitted", a.email, a.preferredLocale, {
          business: res.businessName,
          path: `/admin/approvals/${businessId}`,
        }),
      ),
    );
    return { submittedListings: res.submittedListings, skippedListings: res.skippedListings };
  });
}
