import { defineRouting } from "next-intl/routing";

export const locales = ["tr", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "tr";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always prefix: /tr/... and /en/...
  localePrefix: "always",
  // Detect from Accept-Language on first visit, then remember in a cookie.
  localeDetection: true,
  localeCookie: {
    name: "BE_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
