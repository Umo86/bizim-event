"use server";

import { revalidateTag } from "next/cache";
import { sendNotice } from "@/emails/notices";
import { adminDal } from "@/server/dal";
import { runAction } from "./run";

/** Approve a business: starts its 90-day trial and puts its listings live. */
export async function approveBusinessAction(businessId: string) {
  return runAction(async (ctx) => {
    const res = await adminDal.approveBusiness(ctx, businessId);
    revalidateTag("listings", "max");
    await sendNotice("businessApproved", res.owner.email, res.owner.preferredLocale, {
      business: res.businessName,
      trialEndsAt: res.trialEndsAt,
      path: `/business/${businessId}`,
    });
    return null;
  });
}

export async function requestBusinessChangesAction(businessId: string, note: string) {
  return runAction(async (ctx) => {
    const res = await adminDal.requestBusinessChanges(ctx, businessId, { note });
    await sendNotice("businessChangesRequested", res.owner.email, res.owner.preferredLocale, {
      business: res.businessName,
      note: res.note,
      path: `/business/${businessId}`,
    });
    return null;
  });
}

export async function rejectBusinessAction(businessId: string, reason: string) {
  return runAction(async (ctx) => {
    const res = await adminDal.rejectBusiness(ctx, businessId, reason);
    revalidateTag("listings", "max");
    await sendNotice("businessRejected", res.owner.email, res.owner.preferredLocale, {
      business: res.businessName,
      note: res.reason,
      path: `/business/${businessId}`,
    });
    return null;
  });
}

export async function approveListingAction(listingId: string, businessId: string) {
  return runAction(async (ctx) => {
    const res = await adminDal.approveListing(ctx, listingId);
    revalidateTag("listings", "max");
    await sendNotice("listingApproved", res.owner.email, res.owner.preferredLocale, {
      business: res.businessName,
      listing: res.listingTitle,
      path: `/business/${businessId}`,
    });
    return null;
  });
}

export async function requestListingChangesAction(listingId: string, businessId: string, note: string) {
  return runAction(async (ctx) => {
    const res = await adminDal.requestListingChanges(ctx, listingId, { note });
    await sendNotice("listingChangesRequested", res.owner.email, res.owner.preferredLocale, {
      business: res.businessName,
      listing: res.listingTitle,
      note: res.note,
      path: `/business/${businessId}/listings/${listingId}/listing`,
    });
    return null;
  });
}

export async function rejectListingAction(listingId: string, businessId: string, reason: string) {
  return runAction(async (ctx) => {
    const res = await adminDal.rejectListing(ctx, listingId, { note: reason });
    await sendNotice("listingRejected", res.owner.email, res.owner.preferredLocale, {
      business: res.businessName,
      listing: res.listingTitle,
      note: res.reason,
      path: `/business/${businessId}`,
    });
    return null;
  });
}
