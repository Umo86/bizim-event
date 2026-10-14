import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/content/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { formatPlanAmount } from "@/lib/plans";
import { asLocale } from "@/server/page-helpers";

type Props = PageProps<"/[locale]/about">;

export async function generateMetadata(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { languages: { tr: "/tr/about", en: "/en/about" } },
  };
}

const POINTS = ["free", "fair", "checked"] as const;

export default async function AboutPage(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "about" });
  const amounts = { monthly: formatPlanAmount("monthly", locale), yearly: formatPlanAmount("yearly", locale) };

  return (
    <>
      <PageHero photo="about" title={t("title")} intro={t("intro")} />
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-ink">{t("whyTitle")}</h2>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink">{t("whyBody")}</p>

        <ul className="mt-14 grid gap-10 md:grid-cols-3">
          {POINTS.map((key) => (
            <li key={key} className="border-t-4 border-primary pt-5">
              <h3 className="text-lg font-bold text-ink">{t(`${key}Title`)}</h3>
              <p className="mt-2 leading-relaxed text-ink">{t(`${key}Body`, amounts)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link href="/search?type=venue" className={buttonVariants({ variant: "primary", size: "lg" })}>
            {t("ctaFind")}
          </Link>
          <Link href="/list-your-business" className={buttonVariants({ variant: "outline", size: "lg" })}>
            {t("ctaList")}
          </Link>
        </div>
      </section>
    </>
  );
}
