import "server-only";
import tzLookup from "@photostructure/tz-lookup";
import { allCountries } from "./countries-data";

/** IANA time zone for a point (offline lookup), falling back to the country's main zone. */
export function timezoneFor(location: { lat: number; lng: number } | null, countryIso2: string): string {
  if (location) {
    try {
      return tzLookup(location.lat, location.lng);
    } catch {
      // fall through
    }
  }
  return allCountries().find((c) => c.iso2 === countryIso2)?.defaultTimezone ?? "UTC";
}

export function defaultCurrencyFor(countryIso2: string): string {
  return allCountries().find((c) => c.iso2 === countryIso2)?.defaultCurrency ?? "USD";
}
