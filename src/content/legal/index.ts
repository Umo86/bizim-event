import { COMPANY, operatorSentence } from "@/content/company";
import { businessTerms } from "./business-terms";
import { cookies } from "./cookies";
import { privacy } from "./privacy";
import { terms } from "./terms";
import type { LegalDoc, LegalSource } from "./types";

export type { LegalBlock, LegalDoc, LegalSection } from "./types";

/** URL slug → document. Linked from the footer, sign-up, the set-up wizard and each other. */
export const LEGAL_DOCS = {
  terms,
  "business-terms": businessTerms,
  privacy,
  cookies,
} satisfies Record<string, LegalSource>;

export type LegalSlug = keyof typeof LEGAL_DOCS;
export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS) as LegalSlug[];

export function isLegalSlug(v: string): v is LegalSlug {
  return Object.hasOwn(LEGAL_DOCS, v);
}

export function legalDoc(slug: LegalSlug, locale: "tr" | "en"): LegalDoc & { updated: string } {
  const source = LEGAL_DOCS[slug];
  const doc = source[locale]({ operator: operatorSentence(locale), jurisdiction: COMPANY.jurisdiction[locale] });
  return { ...doc, updated: source.updated };
}
