import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/content/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { formatPlanAmount } from "@/lib/plans";
import { asLocale } from "@/server/page-helpers";

type Props = PageProps<"/[locale]/how-it-works">;

export async function generateMetadata(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { languages: { tr: "/tr/how-it-works", en: "/en/how-it-works" } },
  };
}

const CUSTOMER_STEPS = ["search", "compare", "enquire", "book"] as const;
const BUSINESS_STEPS = ["create", "check", "live", "leads"] as const;

export default async function HowItWorksPage(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  const amounts = { monthly: formatPlanAmount("monthly", locale), yearly: formatPlanAmount("yearly", locale) };

  const columns = [
    { id: "customers", steps: CUSTOMER_STEPS, href: "/search?type=venue", cta: t("ctaFind"), variant: "primary" },
    { id: "businesses", steps: BUSINESS_STEPS, href: "/list-your-business", cta: t("ctaList"), variant: "cta" },
  ] as const;

  return (
    <>
      <PageHero photo="howItWorks" title={t("title")} intro={t("intro")} />
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-14 sm:px-6 lg:grid-cols-2">
        {columns.map((col) => (
          <section key={col.id} aria-labelledby={`${col.id}-title`}>
            <h2 id={`${col.id}-title`} className="text-2xl font-bold text-ink">
              {t(`${col.id}Title`)}
            </h2>
            <ol className="mt-8 space-y-6">
              {col.steps.map((key, i) => (
                <li key={key} className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-strong font-heading text-lg font-bold text-white"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-ink">{t(`${key}Title`)}</h3>
                    <p className="mt-1 leading-relaxed text-ink">{t(`${key}Body`, amounts)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href={col.href} className={buttonVariants({ variant: col.variant, size: "lg", className: "mt-8" })}>
              {col.cta}
            </Link>
          </section>
        ))}
      </div>
    </>
  );
}
