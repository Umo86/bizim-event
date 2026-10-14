/**
 * Legal pages are documents rather than UI strings, so they live here instead of in
 * messages/*.json. Text may contain links written as [label](/path); the page renders them.
 */
export type LegalBlock = string | { list: string[] };
export type LegalSection = { id: string; heading: string; blocks: LegalBlock[] };
export type LegalDoc = { title: string; summary: string; sections: LegalSection[] };

/** Filled in from src/content/company.ts when the page renders. */
export type LegalVars = {
  /** "Bizim Event is run by …", or "" until the company details are known. */
  operator: string;
  /** "England and Wales" / "İngiltere ve Galler". */
  jurisdiction: string;
};

export type LegalSource = {
  /** Date of the current version (YYYY-MM-DD), shown as "Last updated". */
  updated: string;
  en: (v: LegalVars) => LegalDoc;
  tr: (v: LegalVars) => LegalDoc;
};

/** The operator sentence as its own paragraph, when there is one. */
export const operatorBlock = (v: LegalVars): LegalBlock[] => (v.operator ? [v.operator] : []);
