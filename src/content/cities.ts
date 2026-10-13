/**
 * Featured cities: the editorial list shown with photos on the homepage and the
 * search page, and the cities the seed script creates.
 *
 * Photos are free to use under the Unsplash License (https://unsplash.com/license),
 * hotlinked from Unsplash's CDN and credited to their photographers. To swap one,
 * pick a free (not Unsplash+) photo, then copy its image id ("photo-…", from the image
 * URL) and its page id (the end of the unsplash.com/photos/… URL).
 *
 * This file is plain data: no imports, so both the app and scripts/seed.ts can use it.
 */

export type UnsplashPhoto = {
  /** Image id on images.unsplash.com, e.g. "photo-1533929736458-ca588d08c8be". */
  id: string;
  /** Photo page id on unsplash.com/photos/…, used for the credit link. */
  page: string;
  /** Photographer as they ask to be credited. */
  by: string;
  username: string;
  /** CSS object-position when the subject isn't central, e.g. "40% 50%". */
  focus?: string;
};

export type FeaturedCity = {
  /** Stable key; also the English slug used in links. */
  key: string;
  country: string;
  en: string;
  tr: string;
  /** Turkish locative ("Londra'da"). Suffixes follow pronunciation, so they're written out, not computed. */
  inTr: string;
  lat: number;
  lng: number;
  tz: string;
  /** Shown to visitors from every country; non-featured cities lead only for their own country. */
  featured: boolean;
  taglineEn: string;
  taglineTr: string;
  photo: UnsplashPhoto;
};

export const FEATURED_CITIES: readonly FeaturedCity[] = [
  {
    key: "london",
    country: "GB",
    en: "London",
    tr: "Londra",
    inTr: "Londra'da",
    lat: 51.5072,
    lng: -0.1276,
    tz: "Europe/London",
    featured: true,
    taglineEn: "Halls, gardens and rooftops across the capital",
    taglineTr: "Başkentin dört bir yanında salonlar, bahçeler ve teraslar",
    photo: {
      id: "photo-1533929736458-ca588d08c8be",
      page: "Q6UehpkBSnQ",
      by: "Charles Postiaux",
      username: "charlespostiaux",
    },
  },
  {
    key: "birmingham",
    country: "GB",
    en: "Birmingham",
    tr: "Birmingham",
    inTr: "Birmingham'da",
    lat: 52.4862,
    lng: -1.8904,
    tz: "Europe/London",
    featured: false,
    taglineEn: "Big-capacity halls in the Midlands",
    taglineTr: "Midlands'te geniş kapasiteli salonlar",
    photo: {
      id: "photo-1599424163923-f8dc273e0891",
      page: "bOGL5uq52X8",
      by: "Gabriel McCallin",
      username: "gabrielmccallin",
    },
  },
  {
    key: "manchester",
    country: "GB",
    en: "Manchester",
    tr: "Manchester",
    inTr: "Manchester'da",
    lat: 53.4808,
    lng: -2.2426,
    tz: "Europe/London",
    featured: false,
    taglineEn: "Warehouses, hotels and banquet suites",
    taglineTr: "Depo mekanlar, oteller ve davet salonları",
    photo: { id: "photo-1515586838455-8f8f940d6853", page: "1jZbU_XuyvU", by: "Will McCue", username: "mrwilliamo" },
  },
  {
    key: "istanbul",
    country: "TR",
    en: "Istanbul",
    tr: "İstanbul",
    inTr: "İstanbul'da",
    lat: 41.0082,
    lng: 28.9784,
    tz: "Europe/Istanbul",
    featured: true,
    taglineEn: "Bosphorus views for unforgettable nights",
    taglineTr: "Unutulmaz geceler için Boğaz manzarası",
    photo: { id: "photo-1623613229313-5e59f698526f", page: "XupGtwWXw5g", by: "Ibrahim Uzun", username: "ibuzn" },
  },
  {
    key: "izmir",
    country: "TR",
    en: "Izmir",
    tr: "İzmir",
    inTr: "İzmir'de",
    lat: 38.4237,
    lng: 27.1428,
    tz: "Europe/Istanbul",
    featured: true,
    taglineEn: "Seaside gardens on the Aegean",
    taglineTr: "Ege kıyısında bahçe düğünleri",
    photo: {
      id: "photo-1701428588034-5893b2512a68",
      page: "4T9AXWrh8q8",
      by: "Mehmet Korkmaz",
      username: "thewood_man",
    },
  },
  {
    key: "berlin",
    country: "DE",
    en: "Berlin",
    tr: "Berlin",
    inTr: "Berlin'de",
    lat: 52.52,
    lng: 13.405,
    tz: "Europe/Berlin",
    featured: true,
    taglineEn: "Europe's biggest Turkish wedding scene",
    taglineTr: "Avrupa'nın en büyük Türk düğün sahnesi",
    photo: {
      id: "photo-1587330979470-3595ac045ab0",
      page: "uFGi0_YciE0",
      by: "Florian Wehde",
      username: "florianwehde",
    },
  },
  {
    key: "amsterdam",
    country: "NL",
    en: "Amsterdam",
    tr: "Amsterdam",
    inTr: "Amsterdam'da",
    lat: 52.3676,
    lng: 4.9041,
    tz: "Europe/Amsterdam",
    featured: true,
    taglineEn: "Canal-side celebrations",
    taglineTr: "Kanal kenarında kutlamalar",
    photo: {
      id: "photo-1534351590666-13e3e96b5017",
      page: "QRtym77B6xk",
      by: "Adrien Olichon",
      username: "adrienolichon",
    },
  },
  {
    key: "paris",
    country: "FR",
    en: "Paris",
    tr: "Paris",
    inTr: "Paris'te",
    lat: 48.8566,
    lng: 2.3522,
    tz: "Europe/Paris",
    featured: true,
    taglineEn: "Celebrate in the city of light",
    taglineTr: "Işıklar şehrinde kutlayın",
    photo: {
      id: "photo-1502602898657-3e91760cbb34",
      page: "nnzkZNYWHaU",
      by: "Chris Karidis",
      username: "chriskaridis",
    },
  },
  {
    key: "new-york",
    country: "US",
    en: "New York",
    tr: "New York",
    inTr: "New York'ta",
    lat: 40.7128,
    lng: -74.006,
    tz: "America/New_York",
    featured: true,
    taglineEn: "Ballrooms and lofts",
    taglineTr: "Balo salonları ve loft mekanlar",
    photo: { id: "photo-1496588152823-86ff7695e68f", page: "_QdFx92MO2U", by: "Luca Bravo", username: "lucabravo" },
  },
  {
    key: "dubai",
    country: "AE",
    en: "Dubai",
    tr: "Dubai",
    inTr: "Dubai'de",
    lat: 25.2048,
    lng: 55.2708,
    tz: "Asia/Dubai",
    featured: true,
    taglineEn: "Grand hotels and desert nights",
    taglineTr: "Büyük oteller ve çöl geceleri",
    photo: { id: "photo-1546412414-8035e1776c9a", page: "q8D7WZc40eA", by: "Darcey Beau", username: "darceybeau" },
  },
  {
    key: "toronto",
    country: "CA",
    en: "Toronto",
    tr: "Toronto",
    inTr: "Toronto'da",
    lat: 43.6532,
    lng: -79.3832,
    tz: "America/Toronto",
    featured: true,
    taglineEn: "Lakeside banquet halls",
    taglineTr: "Göl kenarında davet salonları",
    // Wide panorama from the Toronto Islands; the CN Tower sits left of centre.
    photo: {
      id: "photo-1543962226-818f4301073f",
      page: "s0grRYEDaL4",
      by: "Jochem Raat",
      username: "jchmrt",
      focus: "40% 50%",
    },
  },
  {
    key: "sydney",
    country: "AU",
    en: "Sydney",
    tr: "Sidney",
    inTr: "Sidney'de",
    lat: -33.8688,
    lng: 151.2093,
    tz: "Australia/Sydney",
    featured: true,
    taglineEn: "Harbour views down under",
    taglineTr: "Liman manzaralı mekanlar",
    photo: { id: "photo-1546268060-2592ff93ee24", page: "Hao52Fu9-F8", by: "Jamie Davies", username: "jamie_davies" },
  },
];

/**
 * The cities to show a visitor: their own country's first (featured ones leading),
 * then featured cities elsewhere, then the rest, keeping the editorial order within each group.
 */
export function citiesForVisitor(visitorCountry: string | null | undefined, limit = 12): FeaturedCity[] {
  const country = visitorCountry?.toUpperCase();
  const rank = (c: FeaturedCity) => (c.country === country ? (c.featured ? 0 : 1) : c.featured ? 2 : 3);
  return FEATURED_CITIES.map((city, index) => ({ city, index }))
    .sort((a, b) => rank(a.city) - rank(b.city) || a.index - b.index)
    .slice(0, limit)
    .map(({ city }) => city);
}

/** Finds a featured city from a link (`country` + `city` key) or from free text ("Londra", "london"). */
export function findFeaturedCity(opts: { key?: string | null; country?: string | null; text?: string | null }) {
  const key = opts.key?.trim().toLowerCase();
  const country = opts.country?.trim().toUpperCase();
  if (key) {
    const match = FEATURED_CITIES.find((c) => c.key === key && (!country || c.country === country));
    if (match) return match;
  }
  const text = opts.text ? fold(opts.text) : "";
  if (!text) return undefined;
  return FEATURED_CITIES.find((c) => fold(c.en) === text || fold(c.tr) === text || c.key === text);
}

/** Lower-case, Turkish-aware, accent-free: "İstanbul" → "istanbul", "Londra " → "londra". */
function fold(s: string) {
  return s.trim().toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/\s+/g, "-");
}
