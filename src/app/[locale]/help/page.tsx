import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/content/page-hero";
import { textLinkClass } from "@/components/content/rich-text";
import { formatPlanAmount } from "@/lib/plans";
import { asLocale } from "@/server/page-helpers";

type Props = PageProps<"/[locale]/help">;

export async function generateMetadata(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "help" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { languages: { tr: "/tr/help", en: "/en/help" } },
  };
}

const GROUPS = [
  { id: "customers", questions: ["free", "pay", "cancel", "language"] },
  { id: "businesses", questions: ["cost", "trial", "need", "approval", "multiple", "billingCancel", "failed"] },
] as const;

export default async function HelpPage(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "help" });
  const values = {
    monthly: formatPlanAmount("monthly", locale),
    yearly: formatPlanAmount("yearly", locale),
    pricing: (chunks: ReactNode) => (
      <Link href="/pricing" className={textLinkClass}>
        {chunks}
      </Link>
    ),
    contact: (chunks: ReactNode) => (
      <Link href="/contact" className={textLinkClass}>
        {chunks}
      </Link>
    ),
  };

  return (
    <>
      <PageHero photo="help" title={t("title")} intro={t("intro")} />
      <div className="mx-auto max-w-3xl space-y-12 px-4 py-14 sm:px-6">
        {GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`${group.id}-title`}>
            <h2 id={`${group.id}-title`} className="text-2xl font-bold text-ink">
              {t(`${group.id}Title`)}
            </h2>
            <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
              {group.questions.map((key) => (
                <details key={key} className="group p-5">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                    {t(`${key}Q`)}
                    <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink">{t.rich(`${key}A`, values)}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <p className="text-lg text-ink">{t.rich("stillStuck", values)}</p>
      </div>
    </>
  );
}
