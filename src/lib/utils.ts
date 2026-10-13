import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pick the current-locale value of a bilingual field, falling back to the other language. */
export function pickLocalized<T extends string | null | undefined>(
  locale: "tr" | "en",
  tr: T,
  en: T,
): { value: string; isFallback: boolean } {
  const primary = locale === "tr" ? tr : en;
  const secondary = locale === "tr" ? en : tr;
  if (primary && primary.trim()) return { value: primary, isFallback: false };
  return { value: secondary ?? "", isFallback: !!secondary };
}

/** Format a price in the listing's own currency. */
export function formatMoney(amount: number, currency: string, locale: "tr" | "en") {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
