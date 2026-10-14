import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BillingStatusPanel } from "@/components/billing/billing-status";
import { DevPortalActions } from "@/components/billing/dev-simulator";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { isDevBilling } from "@/lib/adapters/billing";
import { pickLocalized } from "@/lib/utils";
import { billingDal, isDalError } from "@/server/dal";
import { DEV_PORTAL_ACTIONS } from "@/server/dal/billing";
import { asLocale, requirePageContext } from "@/server/page-helpers";

export const metadata = { robots: { index: false, follow: false } };

type Props = PageProps<"/[locale]/dev/billing-portal">;

/** Stand-in for Stripe's Customer Portal on development copies without Stripe keys. */
export default function DevPortalPage(props: Props) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-section" />}>
        <DevPortal {...props} />
      </Suspense>
    </section>
  );
}

async function DevPortal({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const token = (await searchParams).token;
  if (!isDevBilling() || typeof token !== "string") notFound();
  const ctx = await requirePageContext(locale, `/dev/billing-portal?token=${token}`);
  const t = await getTranslations({ locale, namespace: "devBilling" });
  let details;
  try {
    details = await billingDal.devPortalDetails(ctx, token);
  } catch (err) {
    if (isDalError(err) && err.code === "INVALID") return <Notice tone="warning">{t("expired")}</Notice>;
    if (isDalError(err)) notFound();
    throw err;
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t("portalTitle")}</h1>
      <Notice>{t("note")}</Notice>
      <p className="font-semibold text-ink">{pickLocalized(locale, details.nameTr, details.nameEn).value}</p>
      {details.state ? <BillingStatusPanel state={details.state} locale={locale} timeZone={null} /> : null}
      <p className="text-sm text-muted">{t("current", { status: details.stripeStatus ?? "—" })}</p>
      <DevPortalActions token={token} actions={DEV_PORTAL_ACTIONS} />
      <a href={details.returnUrl} className={buttonVariants({ variant: "primary" })}>
        {t("back")}
      </a>
    </div>
  );
}
