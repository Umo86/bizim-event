import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { buttonVariants } from "@/components/ui/button";
import { backdrop } from "@/content/cities";
import { formatPlanAmount, PLAN_KEYS, PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { asLocale } from "@/server/page-helpers";

/** Public pricing: one price per business page, the free trial, and the no-commission promise. */

export async function generateMetadata(props: PageProps<"/[locale]/pricing">) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "pricing" });
  const amounts = { monthly: formatPlanAmount("monthly", locale), yearly: formatPlanAmount("yearly", locale) };
  return {
    title: t("metaTitle"),
    description: t("metaDescription", amounts),
    alternates: { languages: { tr: "/tr/pricing", en: "/en/pricing" } },
  };
}

const INCLUDED = ["listings", "languages", "details", "direct", "noCommission", "cancel"] as const;
const STEPS = ["add", "approve", "choose", "hidden"] as const;
const FAQ = ["customers", "commission", "currency", "multiple", "cancel", "failed"] as const;

export default async function PricingPage(props: PageProps<"/[locale]/pricing">) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "pricing" });
  const amounts = { monthly: formatPlanAmount("monthly", locale), yearly: formatPlanAmount("yearly", locale) };

  return (
    <>
      <PhotoBackdrop backdrop={backdrop("pricing")} overlay="left" priority>
        <div className={`mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 ${onPhotoText}`}>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-white sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-xl text-lg text-white">{t("intro", amounts)}</p>
        </div>
      </PhotoBackdrop>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <ul className="grid gap-6 md:grid-cols-2">
          {PLAN_KEYS.map((plan) => {
            const yearly = plan === "yearly";
            const per = PLANS[plan].interval === "month" ? t("perMonth") : t("perYear");
            return (
              <li
                key={plan}
                className={cn(
                  "rounded-3xl border p-8",
                  yearly ? "border-primary-strong bg-primary-soft" : "border-line bg-white",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-heading text-2xl font-bold text-ink">{yearly ? t("yearly") : t("monthly")}</h2>
                  {yearly ? (
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-800">
                      {t("yearlyNote")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-6 text-ink">
                  {locale === "tr" ? <span className="mr-2 text-lg text-muted">{per}</span> : null}
                  <span className="font-heading text-6xl font-extrabold tracking-tight">
                    {formatPlanAmount(plan, locale)}
                  </span>
                  {locale === "en" ? <span className="ml-2 text-lg text-muted">{per}</span> : null}
                </p>
                <p className="mt-2 text-muted">{t("afterTrial")}</p>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-14 text-2xl font-bold text-ink">{t("includedTitle")}</h2>
        <ul className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {INCLUDED.map((key) => (
            <li key={key} className="flex items-start gap-3 text-lg text-ink">
              <Check className="mt-1 size-5 shrink-0 text-success" aria-hidden />
              {t(`included.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-section">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-ink">{t("howTitle")}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-2">
            {STEPS.map((key, i) => (
              <li key={key} className="flex gap-4 rounded-2xl bg-white p-6">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-strong font-heading text-lg font-bold text-white"
                >
                  {i + 1}
                </span>
                <p className="text-ink">{t(`how.${key}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-ink">{t("faqTitle")}</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
          {FAQ.map((key) => (
            <details key={key} className="group p-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {t(`faq.${key}Q`)}
                <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink">{t(`faq.${key}A`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto mb-4 max-w-5xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-primary-deeper p-8 text-white sm:p-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
            <p className="mt-2">{t("ctaBody")}</p>
          </div>
          <Link href="/business/start" className={buttonVariants({ variant: "cta", size: "lg" })}>
            {t("cta")}
          </Link>
        </div>
      </section>
    </>
  );
}
