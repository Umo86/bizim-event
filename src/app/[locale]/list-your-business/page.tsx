import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { CommissionCalculator } from "@/components/business/commission-calculator";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { backdrop } from "@/content/cities";
import { TESTIMONIALS } from "@/content/testimonials";
import { asLocale } from "@/server/page-helpers";

export async function generateMetadata(props: PageProps<"/[locale]/list-your-business">) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "businessLanding" });
  return {
    title: t("metaTitle"),
    description: t("heroBody"),
    alternates: { languages: { tr: "/tr/list-your-business", en: "/en/list-your-business" } },
  };
}

export default async function ListYourBusinessPage(props: PageProps<"/[locale]/list-your-business">) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "businessLanding" });
  const tl = await getTranslations({ locale, namespace: "listingTypes" });
  const faqs = [1, 2, 3, 4, 5] as const;
  const steps = [1, 2, 3] as const;

  return (
    <>
      <PhotoBackdrop backdrop={backdrop("businessHero")} overlay="left" priority>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-24">
          <div className={`text-white ${onPhotoText}`}>
            <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">{t("heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-lg text-white">{t("heroBody")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/business/start" className={buttonVariants({ variant: "cta", size: "lg" })}>
                {t("heroCta")}
              </Link>
              <a href="#how" className="min-h-11 px-2 py-3 font-semibold text-white underline-offset-4 hover:underline">
                {t("heroSecondary")}
              </a>
            </div>
            <p className="mt-4 text-sm text-white">{t("priceNote")}</p>
          </div>
          <CommissionCalculator />
        </div>
      </PhotoBackdrop>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-ink">{t("whoTitle")}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {(["venue", "caterer", "performer"] as const).map((k) => (
            <div key={k} className="border-l-4 border-primary pl-5">
              <h3 className="font-heading text-lg font-bold text-ink">{tl(k)}</h3>
              <p className="mt-2 text-muted">
                {t(k === "venue" ? "whoVenue" : k === "caterer" ? "whoCaterer" : "whoPerformer")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PhotoBackdrop id="how" backdrop={backdrop("businessHow")} overlay="even">
        <div className={`mx-auto max-w-7xl px-4 pb-20 pt-16 text-white sm:px-6 ${onPhotoText}`}>
          <h2 className="text-3xl font-bold">{t("howTitle")}</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {steps.map((n) => (
              <li key={n}>
                <span
                  className="flex size-10 items-center justify-center rounded-full bg-white font-heading text-lg font-bold text-primary-deeper [text-shadow:none]"
                  aria-hidden
                >
                  {n}
                </span>
                <h3 className="mt-4 text-xl font-bold">{t(`how${n}Title`)}</h3>
                <p className="mt-2">{t(`how${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </PhotoBackdrop>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-ink">{t("pricingTitle")}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl bg-primary-soft p-8">
            <p className="font-heading text-3xl font-extrabold text-primary-deeper">{t("pricingFree")}</p>
            <p className="mt-3 text-ink">{t("pricingFreeBody")}</p>
          </div>
          <ul className="space-y-4 rounded-3xl border border-line p-8">
            {[t("pricingMonthly"), t("pricingYearly"), t("pricingNoCommission")].map((line) => (
              <li key={line} className="flex items-start gap-3 text-lg text-ink">
                <Check className="mt-1 size-5 shrink-0 text-success" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/pricing"
          className="mt-6 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline"
        >
          {t("pricingLink")}
        </Link>
      </section>

      {TESTIMONIALS.length ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <h2 className="text-3xl font-bold text-ink">{t("testimonialsTitle")}</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((q) => (
              <li key={q.name}>
                <figure className="h-full rounded-2xl border border-line p-6">
                  <blockquote className="text-ink">“{locale === "tr" ? q.quoteTr : q.quoteEn}”</blockquote>
                  <figcaption className="mt-4 text-sm text-muted">
                    {q.name}, {q.business}, {q.city}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-section">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold text-ink">{t("faqTitle")}</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
            {faqs.map((n) => (
              <details key={n} className="group p-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                  {t(`faq${n}q`)}
                  <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted">{t(`faq${n}a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <PhotoBackdrop backdrop={backdrop("businessFinal")} overlay="even">
        <div className={`mx-auto max-w-7xl px-4 pb-24 pt-20 text-center sm:px-6 ${onPhotoText}`}>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">{t("finalTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white">{t("finalBody")}</p>
          <Link href="/business/start" className={buttonVariants({ variant: "cta", size: "lg", className: "mt-8" })}>
            {t("heroCta")}
          </Link>
        </div>
      </PhotoBackdrop>
    </>
  );
}
