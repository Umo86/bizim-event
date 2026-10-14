/**
 * Who runs Bizim Event, as shown on the contact and legal pages. Fill these in before launch
 * (Companies House details); anything left null is simply left out. The public contact email
 * comes from the CONTACT_EMAIL environment variable (see src/server/contact.ts).
 */
export type Company = {
  /** Registered company name, e.g. "Bizim Event Ltd". */
  legalName: string | null;
  /** Companies House number. */
  companyNumber: string | null;
  /** Registered office address, on one line. */
  registeredAddress: string | null;
  /** Whose law governs the terms, and whose courts decide disputes. */
  jurisdiction: { en: string; tr: string };
};

export const COMPANY: Company = {
  legalName: null,
  companyNumber: null,
  registeredAddress: null,
  jurisdiction: { en: "England and Wales", tr: "İngiltere ve Galler" },
};

/** "Bizim Event is run by …" for the legal pages, or "" until the company details are filled in. */
export function operatorSentence(locale: "tr" | "en", c: Company = COMPANY): string {
  if (!c.legalName) return "";
  if (locale === "tr") {
    const extra = [
      c.companyNumber ? `şirket numarası: ${c.companyNumber}` : null,
      c.registeredAddress ? `kayıtlı adres: ${c.registeredAddress}` : null,
    ].filter(Boolean);
    return `Bizim Event, ${c.legalName} tarafından işletilmektedir${extra.length ? ` (${extra.join("; ")})` : ""}.`;
  }
  const extra = [
    c.companyNumber ? `company number ${c.companyNumber}` : null,
    c.registeredAddress ? `registered office ${c.registeredAddress}` : null,
  ].filter(Boolean);
  return `Bizim Event is run by ${c.legalName}${extra.length ? ` (${extra.join(", ")})` : ""}.`;
}
