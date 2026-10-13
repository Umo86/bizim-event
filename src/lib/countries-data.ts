import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import tr from "i18n-iso-countries/langs/tr.json";
import countryToCurrency from "country-to-currency";
import ct from "countries-and-timezones";
import { slugify } from "./slug";

countries.registerLocale(en);
countries.registerLocale(tr);

/** Countries that use miles for everyday distances. */
const MILES = new Set(["GB", "US", "LR", "MM"]);

/** Short English names that read better than the ISO long forms. */
const EN_OVERRIDES: Record<string, string> = {
  GB: "United Kingdom",
  US: "United States",
  TR: "Türkiye",
  RU: "Russia",
  KR: "South Korea",
  KP: "North Korea",
  IR: "Iran",
  SY: "Syria",
  VN: "Vietnam",
  LA: "Laos",
  BO: "Bolivia",
  VE: "Venezuela",
  TZ: "Tanzania",
  MD: "Moldova",
  CZ: "Czechia",
};
const TR_OVERRIDES: Record<string, string> = {
  GB: "İngiltere",
  US: "Amerika Birleşik Devletleri",
};
/** Slugs used in URLs — kept short and familiar ("ingiltere", "united-kingdom"). */
const SLUG_TR_OVERRIDES: Record<string, string> = { GB: "ingiltere", US: "abd" };

export type CountryRecord = {
  iso2: string;
  nameTr: string;
  nameEn: string;
  slugTr: string;
  slugEn: string;
  defaultCurrency: string;
  distanceUnit: "km" | "mi";
  defaultTimezone: string | null;
};

let cache: CountryRecord[] | undefined;

/** Every ISO 3166-1 country with TR/EN names, currency and default time zone. */
export function allCountries(): CountryRecord[] {
  if (cache) return cache;
  const codes = Object.keys(countries.getAlpha2Codes());
  cache = codes
    .map((iso2) => {
      const nameEn = EN_OVERRIDES[iso2] ?? countries.getName(iso2, "en", { select: "official" }) ?? iso2;
      const nameTr = TR_OVERRIDES[iso2] ?? countries.getName(iso2, "tr", { select: "official" }) ?? nameEn;
      const tz = ct.getCountry(iso2)?.timezones?.[0] ?? null;
      return {
        iso2,
        nameEn,
        nameTr,
        slugEn: slugify(nameEn),
        slugTr: SLUG_TR_OVERRIDES[iso2] ?? slugify(nameTr),
        defaultCurrency: (countryToCurrency as Record<string, string>)[iso2] ?? "USD",
        distanceUnit: MILES.has(iso2) ? ("mi" as const) : ("km" as const),
        defaultTimezone: tz,
      };
    })
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn, "en"));
  return cache;
}

export function countryName(iso2: string, locale: "tr" | "en"): string {
  const c = allCountries().find((x) => x.iso2 === iso2);
  return c ? (locale === "tr" ? c.nameTr : c.nameEn) : iso2;
}
