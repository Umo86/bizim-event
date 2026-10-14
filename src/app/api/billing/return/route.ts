import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after, connection, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/routing";
import { captureException } from "@/lib/logger";
import { billingDal, isDalError } from "@/server/dal";
import { deliverBillingNotice } from "@/server/internal/billing";
import { getDalContext } from "@/server/session";

/**
 * Where Stripe Checkout sends the owner after paying. Confirms the session straight away,
 * so the billing page is up to date even if the webhook is a few seconds behind.
 */
export async function GET(req: NextRequest) {
  await connection();
  const params = req.nextUrl.searchParams;
  const locale = isLocale(params.get("locale")) ? params.get("locale")! : "tr";
  const businessId = params.get("business") ?? "";
  const sessionId = params.get("session_id") ?? "";
  // The id goes into the redirect path, so only a well-formed one is used.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)) {
    redirect(`/${locale}/business`);
  }
  const billingPage = `/${locale}/business/${businessId}/billing`;
  let state: "success" | "processing" = "processing";
  try {
    const ctx = await getDalContext();
    const result = await billingDal.completeCheckout(ctx, businessId, sessionId);
    if (result) {
      state = "success";
      revalidateTag("listings", "max");
      after(() => deliverBillingNotice(ctx.db, result));
    }
  } catch (err) {
    if (isDalError(err) && err.code === "UNAUTHENTICATED") {
      redirect(`/${locale}/sign-in?next=${encodeURIComponent(billingPage)}`);
    }
    if (!isDalError(err)) captureException(err, { where: "billing.return", businessId });
  }
  redirect(`${billingPage}?checkout=${state}`);
}
