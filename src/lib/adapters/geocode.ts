import "server-only";
import { env } from "@/lib/env";

/**
 * Worldwide place lookup. Google Places (within its free monthly usage) by
 * default; swap for Photon/Nominatim by adding a provider here.
 */
export type PlaceDetails = {
  placeId: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  countryIso2: string | null;
  locality: string | null;
  adminArea: string | null;
  postalCode: string | null;
  types: string[];
};

export interface GeocodeProvider {
  readonly name: string;
  placeDetails(placeId: string, language: "tr" | "en"): Promise<PlaceDetails | null>;
}

type GoogleComponent = { longText: string; shortText: string; types: string[] };

class GooglePlacesProvider implements GeocodeProvider {
  readonly name = "google";
  constructor(private apiKey: string) {}
  async placeDetails(placeId: string, language: "tr" | "en") {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${language}`, {
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents,types",
      },
    });
    if (!res.ok) return null;
    const p = (await res.json()) as {
      id: string;
      formattedAddress: string;
      location: { latitude: number; longitude: number };
      addressComponents?: GoogleComponent[];
      types?: string[];
    };
    const find = (type: string, short = false) => {
      const c = p.addressComponents?.find((x) => x.types.includes(type));
      return c ? (short ? c.shortText : c.longText) : null;
    };
    return {
      placeId: p.id,
      formattedAddress: p.formattedAddress,
      location: { lat: p.location.latitude, lng: p.location.longitude },
      countryIso2: find("country", true),
      locality: find("locality") ?? find("postal_town") ?? find("administrative_area_level_2"),
      adminArea: find("administrative_area_level_1"),
      postalCode: find("postal_code"),
      types: p.types ?? [],
    };
  }
}

class StubGeocode implements GeocodeProvider {
  readonly name = "stub";
  async placeDetails() {
    return null;
  }
}

let provider: GeocodeProvider | undefined;

export function geocode(): GeocodeProvider {
  if (!provider) {
    const key = env().GOOGLE_PLACES_API_KEY;
    provider = key ? new GooglePlacesProvider(key) : new StubGeocode();
  }
  return provider;
}

/** Default search radius by place type (km). */
export function defaultRadiusKm(types: string[]): number {
  if (types.includes("country")) return 0; // 0 = filter by country, no radius
  if (types.includes("administrative_area_level_1")) return 80;
  if (types.includes("locality") || types.includes("postal_town")) return 25;
  return 10;
}
