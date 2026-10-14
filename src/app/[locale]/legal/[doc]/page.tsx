import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/content/legal-document";
import { isLegalSlug, LEGAL_SLUGS, legalDoc } from "@/content/legal";
import { asLocale } from "@/server/page-helpers";

/** Terms of use, business terms, privacy and cookies (src/content/legal), prerendered in both languages. */

type Props = PageProps<"/[locale]/legal/[doc]">;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata(props: Props) {
  const { locale: raw, doc } = await props.params;
  if (!isLegalSlug(doc)) return {};
  const d = legalDoc(doc, asLocale(raw));
  return {
    title: d.title,
    description: d.summary,
    alternates: { languages: { tr: `/tr/legal/${doc}`, en: `/en/legal/${doc}` } },
  };
}

export default async function LegalPage(props: Props) {
  const { locale: raw, doc } = await props.params;
  if (!isLegalSlug(doc)) notFound();
  return <LegalDocument slug={doc} locale={asLocale(raw)} />;
}
