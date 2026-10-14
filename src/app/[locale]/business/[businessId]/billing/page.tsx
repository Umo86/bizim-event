import { ChevronLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { BillingStatusPanel } from "@/components/billing/billing-status";
import { ManageBillingButton, PlanPicker } from "@/components/billing/plan-picker";
import { Notice } from "@/components/ui/form";
import { pickLocalized } from "@/lib/utils";
import { billingDal } from "@/server/dal";
import { asLocale, loadOr404, requirePageContext } from "@/server/page-helpers";

export const metadata = { robots: { index: false } };

type Props = PageProps<"/[locale]/business/[businessId]/billing">;

export default function BillingPage(props: Props) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-section" />}>
        <Billing {...props} />
      </Suspense>
    </section>
  );
}

async function Billing({ params, searchParams }: Props) {
  const { locale: raw, businessId } = await params;
  const sp = await searchParams;
  const locale = asLocale(raw);
  const ctx = await requirePageContext(locale, `/business/${businessId}/billing`);
  const view = await loadOr404(() => billingDal.getBilling(ctx, businessId));
  const t = await getTranslations({ locale, namespace: "billing" });
  const format = await getFormatter({ locale });
  const name = pickLocalized(locale, view.business.nameTr, view.business.nameEn).value;
  const checkout = typeof sp.checkout === "string" ? sp.checkout : null;
  const date = (d: Date) =>
    format.dateTime(d, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: view.business.timezone ?? "Europe/London",
    });
  // The same date the checkout uses, so the page never promises something Stripe won't do.
  const paymentNote = view.firstPaymentAt
    ? view.state?.kind === "trial" && view.firstPaymentAt > view.state.endsAt
      ? t("startsAfterTrialExtra", { date: date(view.firstPaymentAt) })
      : t("startsAfterTrial", { date: date(view.firstPaymentAt) })
    : view.state?.kind === "canceled"
      ? t("startsNowLive")
      : t("startsNow");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/business/${businessId}`}
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary-strong hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-ink">{t("title")}</h1>
        {name ? <p className="mt-1 text-muted">{name}</p> : null}
      </div>

      {checkout === "success" ? <Notice tone="success">{t("checkoutSuccess")}</Notice> : null}
      {checkout === "processing" ? <Notice>{t("checkoutProcessing")}</Notice> : null}
      {checkout === "cancelled" ? <Notice tone="warning">{t("checkoutCancelled")}</Notice> : null}

      {view.state ? (
        <BillingStatusPanel state={view.state} locale={locale} timeZone={view.business.timezone} />
      ) : (
        <div className="rounded-2xl border border-line p-6">
          <h2 className="text-xl font-bold text-ink">{t("notApprovedTitle")}</h2>
          <p className="mt-2 max-w-prose text-ink">{t("notApprovedBody")}</p>
        </div>
      )}

      {view.canChoosePlan ? (
        view.provider.enabled ? (
          <section aria-labelledby="choose-plan">
            <h2 id="choose-plan" className="text-xl font-bold text-ink">
              {t("choosePlan")}
            </h2>
            <div className="mt-4">
              <PlanPicker businessId={businessId} note={paymentNote} />
            </div>
          </section>
        ) : (
          <Notice>{t("disabled")}</Notice>
        )
      ) : null}

      {view.canManage ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line p-6">
          <p className="max-w-md text-sm text-muted">{t("manageHint")}</p>
          <ManageBillingButton businessId={businessId} variant={view.canChoosePlan ? "outline" : "primary"} />
        </section>
      ) : null}

      <div className="space-y-2 border-t border-line pt-6 text-sm text-muted">
        {view.provider.mode === "dev" ? <p>{t("devMode")}</p> : null}
        {view.provider.mode === "test" ? <p>{t("stripeTestMode")}</p> : null}
        <p>{t("noCommission")}</p>
        <p>{t("billedInGbp")}</p>
      </div>
    </div>
  );
}
