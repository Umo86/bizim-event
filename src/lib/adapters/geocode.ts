import "server-only";
import type { LngLat } from "@/db/schema/_shared";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { countryName } from "@/lib/countries-data";

/**
 * Worldwide address lookup for business onboarding.
 *  - Google Places API (New) when GOOGLE_PLACES_API_KEY is set (stays inside its free monthly usage
 *    because autocomplete + details share one session token).
 *  - Photon (photon.komoot.io, OpenStreetMap, no key) otherwise — free, fair-use.
 * Owners can always enter an address manually if the lookup can't find it.
 */
export type PlaceSuggestion = { placeId: string; primary: string; secondary: string };

export type ResolvedAddress = {
  provider: "google" | "photon" | "manual";
  placeId: string;
  formattedAddress: string;
  location: LngLat | null;
  countryIso2: string;
  locality: string;
  adminArea: string | null;
  postalCode: string | null;
  types: string[];
};

export type ResolvedCity = {
  placeId: string;
  nameEn: string;
  nameTr: string;
  adminArea: string | null;
  centre: LngLat | null;
};

type Lang = "tr" | "en";

export interface GeocodeProvider {
  readonly name: "google" | "photon";
  autocomplete(input: string, opts: { language: Lang; sessionToken?: string }): Promise<PlaceSuggestion[]>;
  placeDetails(placeId: string, opts: { language: Lang; sessionToken?: string }): Promise<ResolvedAddress | null>;
  resolveCity(addr: ResolvedAddress): Promise<ResolvedCity | null>;
}

// Google Places (New) -------------------------------------------------------------------

type GoogleComponent = { longText: string; shortText: string; types: string[] };

class GooglePlacesProvider implements GeocodeProvider {
  readonly name = "google" as const;
  constructor(private apiKey: string) {}

  private headers(fieldMask?: string) {
    return {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.apiKey,
      ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
    };
  }

  async autocomplete(input: string, { language, sessionToken }: { language: Lang; sessionToken?: string }) {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ input, languageCode: language, sessionToken, includeQueryPredictions: false }),
    });
    if (!res.ok) {
      logger.warn("geocode.google.autocomplete_failed", { status: res.status });
      return [];
    }
    const json = (await res.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId: string;
          text?: { text: string };
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        };
      }[];
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  }

  async placeDetails(placeId: string, { language, sessionToken }: { language: Lang; sessionToken?: string }) {
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
    const qs = new URLSearchParams({ languageCode: language, ...(sessionToken ? { sessionToken } : {}) });
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?${qs}`, {
      headers: this.headers("id,formattedAddress,location,addressComponents,types"),
    });
    if (!res.ok) return null;
    const p = (await res.json()) as {
      id: string;
      formattedAddress: string;
      location?: { latitude: number; longitude: number };
      addressComponents?: GoogleComponent[];
      types?: string[];
    };
    const find = (type: string, short = false) => {
      const c = p.addressComponents?.find((x) => x.types.includes(type));
      return c ? (short ? c.shortText : c.longText) : null;
    };
    const country = find("country", true);
    const locality = find("locality") ?? find("postal_town") ?? find("administrative_area_level_2");
    if (!country || !locality) return null;
    return {
      provider: "google" as const,
      placeId: p.id,
      formattedAddress: p.formattedAddress,
      location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
      countryIso2: country.toUpperCase(),
      locality,
      adminArea: find("administrative_area_level_1"),
      postalCode: find("postal_code"),
      types: p.types ?? [],
    };
  }

  async resolveCity(addr: ResolvedAddress): Promise<ResolvedCity | null> {
    const query = [addr.locality, addr.adminArea, countryName(addr.countryIso2, "en")].filter(Boolean).join(", ");
    const search = async (includedType?: string) => {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: this.headers("places.id,places.displayName,places.location"),
        body: JSON.stringify({
          textQuery: query,
          languageCode: "en",
          maxResultCount: 1,
          ...(includedType ? { includedType } : {}),
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        places?: { id: string; displayName?: { text: string }; location?: { latitude: number; longitude: number } }[];
      };
      return json.places?.[0] ?? null;
    };
    const place = (await search("locality")) ?? (await search());
    if (!place) return null;
    // Turkish display name (e.g. London → Londra, Munich → Münih).
    let nameTr = place.displayName?.text ?? addr.locality;
    const trRes = await fetch(`https://places.googleapis.com/v1/places/${place.id}?languageCode=tr`, {
      headers: this.headers("displayName"),
    });
    if (trRes.ok) nameTr = ((await trRes.json()) as { displayName?: { text: string } }).displayName?.text ?? nameTr;
    return {
      placeId: `google:${place.id}`,
      nameEn: place.displayName?.text ?? addr.locality,
      nameTr,
      adminArea: addr.adminArea,
      centre: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null,
    };
  }
}

// Photon (OpenStreetMap, no key) ---------------------------------------------------------

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

type PhotonPayload = {
  lat: number;
  lng: number;
  cc: string;
  city: string;
  state: string | null;
  postcode: string | null;
  label: string;
};

const PHOTON = "https://photon.komoot.io/api/";
const PHOTON_HEADERS = { "User-Agent": "BizimEvent/1.0 (business onboarding)" };

function b64url(s: string) {
  return Buffer.from(s, "utf8").toString("base64url");
}
function fromB64url(s: string) {
  return Buffer.from(s, "base64url").toString("utf8");
}

class PhotonProvider implements GeocodeProvider {
  readonly name = "photon" as const;

  async autocomplete(input: string, { language }: { language: Lang; sessionToken?: string }) {
    // Photon has no Turkish labels; English keeps names consistent.
    const qs = new URLSearchParams({ q: input, limit: "6", lang: language === "tr" ? "default" : "en" });
    try {
      const res = await fetch(`${PHOTON}?${qs}`, { headers: PHOTON_HEADERS });
      if (!res.ok) return [];
      const json = (await res.json()) as { features?: PhotonFeature[] };
      return (json.features ?? []).flatMap((f) => {
        const p = f.properties;
        const cc = p.countrycode?.toUpperCase();
        const isSettlement = ["city", "town", "village", "hamlet", "locality"].includes(p.type ?? "");
        const city = p.city ?? (isSettlement ? p.name : undefined) ?? p.county;
        if (!cc || !city) return [];
        const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ");
        const primary = p.street
          ? p.name && p.name !== p.street
            ? `${p.name}, ${streetLine}`
            : streetLine
          : (p.name ?? city);
        const secondary = [p.postcode, city === primary ? null : city, p.state, p.country].filter(Boolean).join(", ");
        const payload: PhotonPayload = {
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          cc,
          city,
          state: p.state ?? null,
          postcode: p.postcode ?? null,
          label: [primary, secondary].filter(Boolean).join(", "),
        };
        return [{ placeId: `photon:${b64url(JSON.stringify(payload))}`, primary, secondary }];
      });
    } catch (err) {
      logger.warn("geocode.photon.autocomplete_failed", { message: (err as Error).message });
      return [];
    }
  }

  async placeDetails(placeId: string): Promise<ResolvedAddress | null> {
    if (!placeId.startsWith("photon:")) return null;
    try {
      const p = JSON.parse(fromB64url(placeId.slice(7))) as PhotonPayload;
      if (typeof p.lat !== "number" || typeof p.lng !== "number" || !/^[A-Z]{2}$/.test(p.cc) || !p.city) return null;
      if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return null;
      return {
        provider: "photon" as const,
        placeId,
        formattedAddress: String(p.label).slice(0, 300),
        location: { lat: p.lat, lng: p.lng },
        countryIso2: p.cc,
        locality: String(p.city).slice(0, 120),
        adminArea: p.state ? String(p.state).slice(0, 120) : null,
        postalCode: p.postcode ? String(p.postcode).slice(0, 20) : null,
        types: [],
      };
    } catch {
      return null;
    }
  }

  async resolveCity(addr: ResolvedAddress): Promise<ResolvedCity | null> {
    const qs = new URLSearchParams({
      q: `${addr.locality}, ${countryName(addr.countryIso2, "en")}`,
      limit: "1",
      lang: "en",
      layer: "city",
    });
    try {
      const res = await fetch(`${PHOTON}?${qs}`, { headers: PHOTON_HEADERS });
      if (!res.ok) return null;
      const f = ((await res.json()) as { features?: PhotonFeature[] }).features?.[0];
      if (!f?.properties.osm_id || f.properties.countrycode?.toUpperCase() !== addr.countryIso2) return null;
      return {
        placeId: `osm:${f.properties.osm_type ?? "X"}${f.properties.osm_id}`,
        nameEn: f.properties.name ?? addr.locality,
        nameTr: f.properties.name ?? addr.locality,
        adminArea: f.properties.state ?? addr.adminArea,
        centre: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
      };
    } catch {
      return null;
    }
  }
}

let provider: GeocodeProvider | undefined;

export function geocode(): GeocodeProvider {
  if (!provider) {
    const key = env().GOOGLE_PLACES_API_KEY;
    provider = key ? new GooglePlacesProvider(key) : new PhotonProvider();
  }
  return provider;
}

/** Test hook: swap in a fake provider. */
export function setGeocodeProviderForTests(p: GeocodeProvider | undefined) {
  provider = p;
}

/** Default search radius by place type (km). Used by Phase 4 search. */
export function defaultRadiusKm(types: string[]): number {
  if (types.includes("country")) return 0; // 0 = filter by country, no radius
  if (types.includes("administrative_area_level_1")) return 80;
  if (types.includes("locality") || types.includes("postal_town")) return 25;
  return 10;
}
