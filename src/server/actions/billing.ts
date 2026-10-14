"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { isLocale } from "@/i18n/routing";
import { checkStripeSetup } from "@/lib/adapters/billing";
import { adminBillingDal, billingDal, requireAdmin } from "@/server/dal";
import { deliverBillingNotice } from "@/server/internal/billing";
import { appBaseUrl } from "@/server/url";
import { runAction } from "./run";

const asLocale = (l: string) => (isLocale(l) ? l : "tr");

/** Owner picks a plan → URL of Stripe Checkout (or the dev simulator) to send the browser to. */
export async function startCheckoutAction(businessId: string, plan: string, locale: string) {
  return runAction(async (ctx) =>
    billingDal.startCheckout(ctx, businessId, plan, { locale: asLocale(locale), baseUrl: await appBaseUrl() }),
  );
}

/** Owner → Stripe's Customer Portal (card, invoices, switch plan, cancel). */
export async function openPortalAction(businessId: string, locale: string) {
  return runAction(async (ctx) =>
    billingDal.openPortal(ctx, businessId, { locale: asLocale(locale), baseUrl: await appBaseUrl() }),
  );
}

// ── Dev simulator ───────────────────────────────────────────────────────────

export async function devPayAction(token: string) {
  const res = await runAction(async (ctx) => {
    const { result, billingUrl } = await billingDal.devCompleteCheckout(ctx, token);
    revalidateTag("listings", "max");
    after(() => deliverBillingNotice(ctx.db, result));
    return billingUrl;
  });
  if (res.ok) redirect(`${res.data}?checkout=success`);
  return res;
}

export async function devPortalAction(token: string, action: string) {
  return runAction(async (ctx) => {
    const result = await billingDal.devPortalAction(ctx, token, action);
    revalidateTag("listings", "max");
    after(() => deliverBillingNotice(ctx.db, result));
    return null;
  });
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function extendTrialAction(businessId: string, days: number) {
  return runAction(async (ctx) => {
    const res = await adminBillingDal.extendTrial(ctx, businessId, days);
    revalidateTag("listings", "max");
    return { trialEndsAt: res.trialEndsAt.toISOString() };
  });
}

export async function setCompedAction(businessId: string, comped: boolean) {
  return runAction(async (ctx) => {
    const res = await adminBillingDal.setComped(ctx, businessId, comped);
    revalidateTag("listings", "max");
    return res;
  });
}

/** Admin "check Stripe": finds (or creates) the two prices, proving the keys work. */
export async function checkStripeAction() {
  return runAction(async (ctx) => {
    await requireAdmin(ctx);
    const res = await checkStripeSetup();
    return res ? { ok: true as const } : null;
  });
}
