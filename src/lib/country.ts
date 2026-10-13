export const COUNTRY_COOKIE = "BE_COUNTRY";
export const DEFAULT_COUNTRY = "GB";

/** Accepts an ISO 3166-1 alpha-2 code in any case; returns it upper-cased or null. */
export function normaliseCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

/** Regional-indicator flag emoji for an ISO2 code ("TR" → 🇹🇷). */
export function flagEmoji(iso2: string): string {
  const code = normaliseCountry(iso2);
  if (!code) return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
