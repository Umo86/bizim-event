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
  ["parking", "Otopark", "On-site parking", "facilities", ["venue"]],
  // music & rules
  ["own_music", "Kendi müziğinizi getirebilirsiniz", "Bring your own music", "music", ["venue"]],
  ["no_age_restriction", "Yaş sınırı yok", "No age restriction", "rules", ["venue"]],
  ["children_welcome", "Çocuklar için uygun", "Child-friendly", "rules", ["venue", "caterer", "performer"]],
  // cultural
  ["prayer_room", "Mescit", "Prayer room", "cultural", ["venue"]],
  ["separate_womens_area", "Kadınlara ayrı alan", "Separate women's area", "cultural", ["venue"]],
  ["halal_menu", "Helal menü", "Halal menu", "cultural", ["venue", "caterer"]],
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

/** Seeded cities: Turkish names included; hero cities feed the homepage slideshow. */
export const SEED_CITIES = [
  { key: "london", country: "GB", en: "London", tr: "Londra", lat: 51.5072, lng: -0.1276, tz: "Europe/London", featured: true, taglineEn: "Halls, gardens and rooftops across the capital", taglineTr: "Başkentin dört bir yanında salonlar, bahçeler ve teraslar" },
  { key: "birmingham", country: "GB", en: "Birmingham", tr: "Birmingham", lat: 52.4862, lng: -1.8904, tz: "Europe/London", featured: false, taglineEn: "Big-capacity halls in the Midlands", taglineTr: "Midlands'te geniş kapasiteli salonlar" },
  { key: "manchester", country: "GB", en: "Manchester", tr: "Manchester", lat: 53.4808, lng: -2.2426, tz: "Europe/London", featured: false, taglineEn: "Warehouses, hotels and banquet suites", taglineTr: "Depo mekanlar, oteller ve davet salonları" },
  { key: "istanbul", country: "TR", en: "Istanbul", tr: "İstanbul", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul", featured: true, taglineEn: "Bosphorus views for unforgettable nights", taglineTr: "Unutulmaz geceler için Boğaz manzarası" },
  { key: "izmir", country: "TR", en: "Izmir", tr: "İzmir", lat: 38.4237, lng: 27.1428, tz: "Europe/Istanbul", featured: true, taglineEn: "Seaside gardens on the Aegean", taglineTr: "Ege kıyısında bahçe düğünleri" },
  { key: "berlin", country: "DE", en: "Berlin", tr: "Berlin", lat: 52.52, lng: 13.405, tz: "Europe/Berlin", featured: true, taglineEn: "Europe's biggest Turkish wedding scene", taglineTr: "Avrupa'nın en büyük Türk düğün sahnesi" },
  { key: "amsterdam", country: "NL", en: "Amsterdam", tr: "Amsterdam", lat: 52.3676, lng: 4.9041, tz: "Europe/Amsterdam", featured: true, taglineEn: "Canal-side celebrations", taglineTr: "Kanal kenarında kutlamalar" },
  { key: "paris", country: "FR", en: "Paris", tr: "Paris", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris", featured: true, taglineEn: "Celebrate in the city of light", taglineTr: "Işıklar şehrinde kutlayın" },
  { key: "new-york", country: "US", en: "New York", tr: "New York", lat: 40.7128, lng: -74.006, tz: "America/New_York", featured: true, taglineEn: "Ballrooms and lofts", taglineTr: "Balo salonları ve loft mekanlar" },
  { key: "dubai", country: "AE", en: "Dubai", tr: "Dubai", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai", featured: true, taglineEn: "Grand hotels and desert nights", taglineTr: "Büyük oteller ve çöl geceleri" },
  { key: "toronto", country: "CA", en: "Toronto", tr: "Toronto", lat: 43.6532, lng: -79.3832, tz: "America/Toronto", featured: true, taglineEn: "Lakeside banquet halls", taglineTr: "Göl kenarında davet salonları" },
  { key: "sydney", country: "AU", en: "Sydney", tr: "Sidney", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney", featured: true, taglineEn: "Harbour views down under", taglineTr: "Liman manzaralı mekanlar" },
] as const;

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
