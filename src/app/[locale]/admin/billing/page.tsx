import { Check, X } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { CheckStripeButton, SubscriptionActions } from "@/components/admin/billing-actions";
import { Notice } from "@/components/ui/form";
import { PLANS } from "@/lib/plans";
import { cn, pickLocalized } from "@/lib/utils";
import { adminBillingDal } from "@/server/dal";
import { SUBSCRIPTION_FILTERS } from "@/server/dal/admin-billing";
import { asLocale, requireAdminContext } from "@/server/page-helpers";
import { appBaseUrl } from "@/server/url";
import type { BillingState } from "@/server/rules";

type Props = PageProps<"/[locale]/admin/billing">;

export default function AdminBillingPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-2xl bg-section" />}>
      <AdminBilling {...props} />
    </Suspense>
  );
}

async function AdminBilling({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const ctx = await requireAdminContext();
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const [summary, list] = await Promise.all([
    adminBillingDal.billingSummary(ctx),
    adminBillingDal.listSubscriptions(ctx, { filter, page }),
  ]);
  const t = await getTranslations({ locale, namespace: "adminBilling" });
  const format = await getFormatter({ locale });
  const money = (minor: number) =>
    format.number(minor / 100, { style: "currency", currency: "GBP", maximumFractionDigits: minor % 100 ? 2 : 0 });
  const date = (d: Date | null) => (d ? format.dateTime(d, { day: "numeric", month: "short", year: "numeric" }) : "");
  const planName = (p: keyof typeof PLANS | null) => (p ? (locale === "tr" ? PLANS[p].nameTr : PLANS[p].nameEn) : "");
  const stateLabel = (s: BillingState) => {
    switch (s.kind) {
      case "trial":
        return t("state.trial", { date: date(s.endsAt) });
      case "scheduled":
        return t("state.scheduled", { plan: planName(s.plan), date: date(s.startsAt) });
      case "active":
        return t("state.active", { plan: planName(s.plan), date: date(s.renewsAt) });
      case "ending":
        return t("state.ending", { plan: planName(s.plan), date: date(s.endsAt) });
      case "past_due":
        return t("state.past_due", { date: date(s.graceUntil) });
      case "canceled":
        return t("state.canceled", { date: date(s.liveUntil) });
      case "expired":
        return t("state.expired", { reason: s.reason });
      default:
        return t("state.comped");
    }
  };
  const { setup, counts } = summary;
  const stripeDashboard = `https://dashboard.stripe.com/${setup.mode === "live" ? "" : "test/"}`;
  const tiles = [
    { label: t("trial"), value: counts.trial, note: t("trialEnding", { count: counts.trialEndingThisWeek }) },
    { label: t("scheduled"), value: counts.scheduled },
    { label: t("pastDue"), value: counts.past_due },
    { label: t("hidden"), value: counts.hidden },
    { label: t("comped"), value: counts.comped },
  ];
  const href = (f: string, p = 1) => `/admin/billing?filter=${f}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="space-y-12">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>

      <section aria-labelledby="setup" className="rounded-2xl border border-line p-6">
        <h2 id="setup" className="text-xl font-bold text-ink">
          {t("setupTitle")}
        </h2>
        <p className="mt-2 font-semibold text-ink">
          {setup.provider === "stripe"
            ? t("provider.stripe", { mode: setup.mode ?? "test" })
            : t(`provider.${setup.provider}`)}
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          {[
            { label: t("secretKey"), ok: setup.secretKey, okText: t("set"), noText: t("missing") },
            { label: t("webhookSecret"), ok: setup.webhookSecret, okText: t("set"), noText: t("missing") },
            { label: t("tax"), ok: setup.tax, okText: t("set"), noText: t("off") },
          ].map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted">{row.label}</dt>
              <dd className="flex items-center gap-1.5 font-medium text-ink">
                {row.ok ? (
                  <Check className="size-4 text-success" aria-hidden />
                ) : (
                  <X className="size-4 text-danger" aria-hidden />
                )}
                {row.ok ? row.okText : row.noText}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 max-w-prose text-sm text-ink">{t("webhookHelp")}</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-section p-4 text-sm text-ink">
          {[`${await appBaseUrl()}${setup.webhookPath}`, "", ...setup.webhookEvents].join("\n")}
        </pre>
        {setup.provider === "stripe" ? (
          <div className="mt-5">
            <CheckStripeButton />
          </div>
        ) : null}
        {setup.mode === "live" ? (
          <Notice tone="warning" className="mt-5">
            {t("liveWarning")}
          </Notice>
        ) : null}
      </section>

      <section aria-labelledby="metrics">
        <h2 id="metrics" className="text-xl font-bold text-ink">
          {t("metricsTitle")}
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_2fr]">
          <div className="rounded-2xl bg-primary-soft p-6">
            <p className="text-sm text-ink">{t("mrr")}</p>
            <p className="mt-1 text-5xl font-semibold text-ink">{money(summary.mrrMinor)}</p>
            <p className="mt-2 text-sm text-ink">
              {t("paying")}: {counts.paying}{" "}
              <span className="text-muted">
                ({t("payingSplit", { monthly: counts.payingMonthly, yearly: counts.payingYearly })})
              </span>
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {tiles.map((tile) => (
              <li key={tile.label} className="rounded-2xl border border-line p-4">
                <p className="text-sm text-muted">{tile.label}</p>
                <p className="mt-1 text-3xl font-semibold text-ink">{tile.value}</p>
                {tile.note ? <p className="mt-1 text-xs text-muted">{tile.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-sm text-muted">{t("testNote", { count: summary.testBusinesses })}</p>
      </section>

      <section aria-labelledby="list">
        <h2 id="list" className="text-xl font-bold text-ink">
          {t("listTitle")}
        </h2>
        <nav aria-label={t("listTitle")} className="mt-4 flex flex-wrap gap-2">
          {SUBSCRIPTION_FILTERS.map((f) => (
            <Link
              key={f}
              href={href(f)}
              aria-current={list.filter === f ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                list.filter === f
                  ? "border-primary-strong bg-primary-strong text-white"
                  : "border-line text-ink hover:bg-section",
              )}
            >
              {t(`filter.${f}`)}
            </Link>
          ))}
        </nav>

        {list.rows.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-section p-6 text-muted">{t("empty")}</p>
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-2xl border border-line">
            {list.rows.map((r) => {
              const name = pickLocalized(locale, r.nameTr, r.nameEn).value || "—";
              const inStripe = r.stripeCustomerId?.startsWith("cus_") && !r.isTest;
              return (
                <li key={r.businessId} className="grid gap-3 p-4 md:grid-cols-[1.3fr_1fr_17rem] md:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      <Link href={`/admin/approvals/${r.businessId}`} className="hover:underline">
                        {name}
                      </Link>
                      {r.isTest ? (
                        <span className="rounded-full bg-section px-2 py-0.5 text-xs font-semibold text-muted">
                          {t("testTag")}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted">{r.ownerEmail}</p>
                  </div>
                  <div className="text-sm text-ink">
                    <p>{stateLabel(r.state)}</p>
                    {inStripe ? (
                      <a
                        href={`${stripeDashboard}customers/${r.stripeCustomerId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-strong hover:underline"
                      >
                        {t("openInStripe")}
                      </a>
                    ) : null}
                  </div>
                  <SubscriptionActions
                    businessId={r.businessId}
                    canExtendTrial={r.canExtendTrial}
                    canComp={r.canComp}
                    canUncomp={r.canUncomp}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {list.page > 1 || list.hasMore ? (
          <div className="mt-4 flex justify-between">
            {list.page > 1 ? (
              <Link
                href={href(list.filter, list.page - 1)}
                className="font-semibold text-primary-strong hover:underline"
              >
                {t("prev")}
              </Link>
            ) : (
              <span />
            )}
            {list.hasMore ? (
              <Link
                href={href(list.filter, list.page + 1)}
                className="font-semibold text-primary-strong hover:underline"
              >
                {t("next")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
