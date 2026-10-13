/**
 * Bilingual taxonomies. `key` is stable (used in code, URLs map via slugs).
 * Admins can edit labels later in the taxonomy manager (Phase 7).
 */
type L = readonly [key: string, tr: string, en: string];
type ListingType = "venue" | "caterer" | "performer";

export const EVENT_TYPES: readonly (readonly [string, string, string, boolean, ListingType[]?])[] = [
  ["wedding", "Düğün", "Wedding", true],
  ["engagement", "Nişan", "Engagement party", true],
  ["henna_night", "Kına gecesi", "Henna night", true],
  ["kiz_isteme", "Kız isteme / Söz", "Kız isteme / promise ceremony", true],
  ["circumcision", "Sünnet düğünü", "Circumcision celebration (sünnet)", true],
  ["mevlit", "Mevlit", "Mevlit", true],
  ["baby_mevlit", "Bebek mevlidi / Diş buğdayı", "Baby mevlit / first-tooth party", true],
  ["baby_shower", "Baby shower", "Baby shower", false],
  ["birthday", "Doğum günü", "Birthday party", false],
  ["graduation", "Mezuniyet", "Graduation party", false],
  ["iftar", "İftar", "Iftar dinner", true],
  ["bayram", "Bayram kutlaması", "Bayram celebration", true],
  ["hayir_yemegi", "Hayır yemeği / Lokma", "Charity meal / lokma", true],
  ["corporate", "Kurumsal etkinlik", "Corporate event", false],
  ["concert_gala", "Konser / gala", "Concert / gala", false],
  ["association", "Dernek etkinliği", "Community association event", true],
];

export const VENUE_TYPES: readonly L[] = [
  ["wedding_hall", "Düğün salonu", "Wedding hall"],
  ["banquet_hall", "Balo / davet salonu", "Banquet hall"],
  ["hotel", "Otel", "Hotel"],
  ["restaurant", "Restoran", "Restaurant"],
  ["garden", "Bahçe / kır düğünü alanı", "Garden venue"],
  ["rooftop", "Teras / çatı katı", "Rooftop"],
  ["community_centre", "Kültür merkezi / dernek salonu", "Community centre"],
  ["conference_centre", "Kongre merkezi", "Conference centre"],
  ["waterfront", "Sahil / boğaz mekanı", "Waterfront venue"],
  ["historic", "Tarihi mekan", "Historic venue"],
  ["boat", "Tekne", "Boat"],
  ["private_dining", "Özel yemek salonu", "Private dining room"],
];

export const ACT_TYPES: readonly L[] = [
  ["wedding_band", "Düğün orkestrası", "Wedding band"],
  ["davul_zurna", "Davul-zurna", "Davul-zurna"],
  ["saz_baglama", "Saz / bağlama", "Saz / bağlama"],
  ["halay_band", "Halay grubu", "Halay band"],
  ["singer", "Şarkıcı", "Singer"],
  ["dj", "DJ", "DJ"],
  ["oriental_dancer", "Oryantal dansçı", "Oriental (belly) dancer"],
  ["folk_dance", "Halk dansları ekibi", "Folk dance troupe"],
  ["fasil", "Fasıl heyeti", "Fasıl ensemble"],
  ["semazen", "Semazen", "Whirling dervish (semazen)"],
  ["kids_entertainer", "Çocuk animatörü", "Children's entertainer"],
  ["mc_host", "Sunucu / MC", "MC / host"],
  ["kina_organiser", "Kına organizatörü", "Henna-night organiser"],
];

export const CUISINES: readonly L[] = [
  ["turkish", "Türk mutfağı", "Turkish"],
  ["kurdish", "Kürt mutfağı", "Kurdish"],
  ["cypriot", "Kıbrıs mutfağı", "Cypriot"],
  ["black_sea", "Karadeniz mutfağı", "Black Sea"],
  ["ottoman", "Osmanlı mutfağı", "Ottoman"],
  ["mixed", "Karma mutfak", "Mixed"],
];

export const SERVICE_STYLES: readonly L[] = [
  ["buffet", "Açık büfe", "Buffet"],
  ["plated", "Servisli (tabak)", "Plated"],
  ["mangal_bbq", "Mangal / BBQ", "Mangal / BBQ"],
  ["kofte_station", "Köfte standı", "Köfte station"],
  ["doner_station", "Döner standı", "Döner station"],
  ["meze", "Meze", "Meze"],
  ["sweets_baklava", "Tatlı ve baklava", "Sweets & baklava"],
  ["lokma_truck", "Lokma arabası", "Lokma truck"],
];

export const LANGUAGES: readonly L[] = [
  ["tr", "Türkçe", "Turkish"],
  ["en", "İngilizce", "English"],
  ["ku", "Kürtçe", "Kurdish"],
  ["de", "Almanca", "German"],
  ["nl", "Felemenkçe", "Dutch"],
  ["fr", "Fransızca", "French"],
  ["ar", "Arapça", "Arabic"],
  ["az", "Azerbaycan Türkçesi", "Azerbaijani"],
];

/**
 * [key, tr, en, group, appliesTo]
 * Facts that already have their own field on venue_details (prayer room, women's area,
 * parking spaces, halal kitchen, live music / own DJ) are NOT amenities — ask once.
 */
export const RETIRED_AMENITY_KEYS = ["parking", "own_music", "prayer_room", "separate_womens_area"] as const;

/** [key, tr, en, group, appliesTo] */
export const AMENITIES: readonly (readonly [string, string, string, string, ListingType[]])[] = [
  // accessibility
  ["wheelchair_access", "Tekerlekli sandalye erişimi", "Wheelchair access", "accessibility", ["venue"]],
  ["accessible_toilet", "Engelli tuvaleti", "Accessible toilet", "accessibility", ["venue"]],
  ["step_free", "Basamaksız giriş", "Step-free access", "accessibility", ["venue"]],
  ["accessible_parking", "Engelli otoparkı", "Accessible parking", "accessibility", ["venue"]],
  ["lift", "Asansör", "Lift", "accessibility", ["venue"]],
  // outdoor & space
  ["garden", "Bahçe", "Garden", "outdoor", ["venue"]],
  ["rooftop", "Teras", "Rooftop", "outdoor", ["venue"]],
  ["waterfront", "Deniz / nehir kenarı", "Waterfront", "outdoor", ["venue"]],
  ["dance_floor", "Dans pisti", "Dance floor", "facilities", ["venue"]],
  ["stage", "Sahne", "Stage", "facilities", ["venue"]],
  ["av_equipment", "Ses ve görüntü sistemi", "AV equipment", "facilities", ["venue"]],
  ["wifi", "Wi-Fi", "Wi-Fi", "facilities", ["venue"]],
  ["air_conditioning", "Klima", "Air conditioning", "facilities", ["venue"]],
  ["bridal_room", "Gelin odası", "Bridal room", "facilities", ["venue"]],
  ["cloakroom", "Vestiyer", "Cloakroom", "facilities", ["venue"]],
  // music & rules
  ["no_age_restriction", "Yaş sınırı yok", "No age restriction", "rules", ["venue"]],
  ["children_welcome", "Çocuklar için uygun", "Child-friendly", "rules", ["venue", "caterer", "performer"]],
  // cultural
  ["halal_menu", "Helal menü", "Halal menu", "cultural", ["caterer"]],
  // caterer extras
  ["tasting_available", "Tadım imkanı", "Tasting available", "service", ["caterer"]],
  ["vegetarian_options", "Vejetaryen seçenekler", "Vegetarian options", "service", ["caterer"]],
  ["cake_service", "Pasta servisi", "Cake service", "service", ["caterer", "venue"]],
  // performer extras
  ["lighting_included", "Işık sistemi dahil", "Lighting included", "service", ["performer"]],
  ["costumes", "Geleneksel kostüm", "Traditional costumes", "service", ["performer"]],
];

export const CANCELLATION_POLICIES = [
  {
    key: "flexible",
    nameTr: "Esnek",
    nameEn: "Flexible",
    termsTr: "Etkinlikten 14 gün öncesine kadar ücretsiz iptal; kapora tamamen iade edilir.",
    termsEn: "Free cancellation up to 14 days before the event; the deposit is refunded in full.",
  },
  {
    key: "moderate",
    nameTr: "Orta",
    nameEn: "Moderate",
    termsTr: "Etkinlikten 30 gün öncesine kadar kaporanın %50'si iade edilir; sonrasında iade yapılmaz.",
    termsEn: "50% of the deposit is refunded up to 30 days before the event; no refund after that.",
  },
  {
    key: "strict",
    nameTr: "Katı",
    nameEn: "Strict",
    termsTr: "Kapora iade edilmez. Etkinlikten 60 gün öncesine kadar tarih bir kez ücretsiz değiştirilebilir.",
    termsEn: "The deposit is non-refundable. The date can be moved once, free of charge, up to 60 days before.",
  },
] as const;

/** Seeded cities = the featured cities (names, taglines and photos live in src/content/cities.ts). */
export { FEATURED_CITIES as SEED_CITIES } from "../../content/cities";

/** Cities that receive demo listings, with their pricing currency. */
export const DEMO_MARKETS = [
  { city: "london", currency: "GBP", weight: 5 },
  { city: "birmingham", currency: "GBP", weight: 2 },
  { city: "manchester", currency: "GBP", weight: 2 },
  { city: "istanbul", currency: "TRY", weight: 4 },
  { city: "izmir", currency: "TRY", weight: 2 },
  { city: "berlin", currency: "EUR", weight: 3 },
  { city: "amsterdam", currency: "EUR", weight: 2 },
] as const;
