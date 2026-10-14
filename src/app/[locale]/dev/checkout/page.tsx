import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DevPayButton } from "@/components/billing/dev-simulator";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { isDevBilling } from "@/lib/adapters/billing";
import { formatPlanAmount, PLANS } from "@/lib/plans";
import { pickLocalized } from "@/lib/utils";
import { billingDal, isDalError } from "@/server/dal";
import { asLocale, requirePageContext } from "@/server/page-helpers";

export const metadata = { robots: { index: false, follow: false } };

type Props = PageProps<"/[locale]/dev/checkout">;

/** Stand-in for Stripe Checkout on development copies without Stripe keys. */
export default function DevCheckoutPage(props: Props) {
  return (
    <section className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-section" />}>
        <DevCheckout {...props} />
      </Suspense>
    </section>
  );
}

async function DevCheckout({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const token = (await searchParams).token;
  if (!isDevBilling() || typeof token !== "string") notFound();
  const ctx = await requirePageContext(locale, `/dev/checkout?token=${token}`);
  const t = await getTranslations({ locale, namespace: "devBilling" });
  const format = await getFormatter({ locale });
  let details;
  try {
    details = await billingDal.devCheckoutDetails(ctx, token);
  } catch (err) {
    if (isDalError(err) && err.code === "INVALID") return <Notice tone="warning">{t("expired")}</Notice>;
    if (isDalError(err)) notFound();
    throw err;
  }
  const plan = PLANS[details.plan];
  return (
    <div className="space-y-6 rounded-2xl border border-line p-6 shadow-card">
      <h1 className="text-2xl font-bold text-ink">{t("checkoutTitle")}</h1>
      <Notice>{t("note")}</Notice>
      <p className="text-lg text-ink">
        {t("summary", {
          plan: locale === "tr" ? plan.nameTr : plan.nameEn,
          business: pickLocalized(locale, details.nameTr, details.nameEn).value,
          amount: formatPlanAmount(details.plan, locale),
          interval: plan.interval,
        })}
      </p>
      {details.trialEnd ? (
        <p className="text-muted">
          {t("trialNote", {
            date: format.dateTime(new Date(details.trialEnd), { day: "numeric", month: "long", year: "numeric" }),
          })}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <DevPayButton token={token} />
        <a href={details.cancelUrl} className={buttonVariants({ variant: "ghost" })}>
          {t("cancel")}
        </a>
      </div>
    </div>
  );
}
