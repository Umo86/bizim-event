import { Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/content/page-hero";
import { textLinkClass } from "@/components/content/rich-text";
import { COMPANY } from "@/content/company";
import { contactEmail } from "@/server/contact";
import { asLocale } from "@/server/page-helpers";

type Props = PageProps<"/[locale]/contact">;

export async function generateMetadata(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { languages: { tr: "/tr/contact", en: "/en/contact" } },
  };
}

const BEFORE = ["beforeBooking", "beforeBusiness", "beforeReport"] as const;

export default async function ContactPage(props: Props) {
  const locale = asLocale((await props.params).locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  const email = contactEmail();
  const help = (chunks: ReactNode) => (
    <Link href="/help" className={textLinkClass}>
      {chunks}
    </Link>
  );

  return (
    <>
      <PageHero photo="contact" title={t("title")} intro={t("intro")} />
      <div className="mx-auto max-w-3xl space-y-12 px-4 py-14 sm:px-6">
        {email ? (
          <section aria-labelledby="email-title" className="rounded-2xl border border-line p-6 sm:p-8">
            <h2 id="email-title" className="text-xl font-bold text-ink">
              {t("emailTitle")}
            </h2>
            <p className="mt-2 text-ink">{t("emailBody")}</p>
            <a
              href={`mailto:${email}`}
              className="mt-4 inline-flex min-h-11 items-center gap-2 break-all text-lg font-semibold text-primary-strong underline underline-offset-4 hover:decoration-2"
            >
              <Mail className="size-5 shrink-0" aria-hidden />
              {email}
            </a>
          </section>
        ) : (
          <p className="rounded-2xl bg-section p-6 text-ink">{t.rich("noEmail", { help })}</p>
        )}

        <section aria-labelledby="before-title">
          <h2 id="before-title" className="text-xl font-bold text-ink">
            {t("beforeTitle")}
          </h2>
          <ul className="mt-4 list-disc space-y-3 pl-6 leading-relaxed text-ink marker:text-muted">
            {BEFORE.map((key) => (
              <li key={key}>{t.rich(key, { help })}</li>
            ))}
          </ul>
        </section>

        {COMPANY.legalName ? (
          <section aria-labelledby="company-title" className="border-t border-line pt-8 text-sm text-muted">
            <h2 id="company-title" className="font-bold text-ink">
              {t("companyTitle")}
            </h2>
            <p className="mt-2">{COMPANY.legalName}</p>
            {COMPANY.companyNumber ? <p>{t("companyNumber", { number: COMPANY.companyNumber })}</p> : null}
            {COMPANY.registeredAddress ? <p>{t("registeredAddress", { address: COMPANY.registeredAddress })}</p> : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
