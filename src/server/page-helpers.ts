import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { isLocale, type AppLocale } from "@/i18n/routing";
import { allCountries } from "@/lib/countries-data";
import { COUNTRY_COOKIE, DEFAULT_COUNTRY, normaliseCountry } from "@/lib/country";
import { enCollator, trCollator } from "@/lib/slug";
import { isDalError, type DalContext } from "@/server/dal";
import { getDalContext } from "@/server/session";

export function asLocale(v: string): AppLocale {
  return isLocale(v) ? v : "tr";
}

/** Signed-in DAL context for a page, or a redirect to log in and come back. */
export async function requirePageContext(locale: string, returnPath: string): Promise<DalContext> {
  const ctx = await getDalContext();
  if (!ctx.user) {
    const loc = asLocale(locale);
    redirect({ href: `/sign-in?next=${encodeURIComponent(`/${loc}${returnPath}`)}`, locale: loc });
  }
  return ctx;
}

/** Admin pages: anyone who isn't an admin gets a plain 404. */
export async function requireAdminContext(): Promise<DalContext> {
  const ctx = await getDalContext();
  if (!ctx.user || ctx.user.role !== "admin") notFound();
  return ctx;
}

/** Runs a DAL read for a page; "not yours" and "missing" both become a 404. */
export async function loadOr404<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isDalError(err) && ["FORBIDDEN", "NOT_FOUND"].includes(err.code)) notFound();
    throw err;
  }
}

export function countryOptions(locale: AppLocale) {
  const collator = locale === "tr" ? trCollator : enCollator;
  return allCountries()
    .map((c) => ({ iso2: c.iso2, name: locale === "tr" ? c.nameTr : c.nameEn }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

const PREFERRED_CURRENCIES = ["GBP", "EUR", "TRY", "USD"];

export function currencyOptions(locale: AppLocale) {
  const names = new Intl.DisplayNames([locale === "tr" ? "tr" : "en-GB"], { type: "currency" });
  const all = Intl.supportedValuesOf("currency");
  const label = (code: string) => `${code} — ${names.of(code) ?? code}`;
  const rest = all.filter((c) => !PREFERRED_CURRENCIES.includes(c)).sort();
  return [...PREFERRED_CURRENCIES, ...rest].map((code) => ({ code, label: label(code) }));
}

export function timeZoneOptions(current?: string | null) {
  const zones = Intl.supportedValuesOf("timeZone");
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

export async function visitorCountry(): Promise<string> {
  const jar = await cookies();
  return normaliseCountry(jar.get(COUNTRY_COOKIE)?.value) ?? DEFAULT_COUNTRY;
}
