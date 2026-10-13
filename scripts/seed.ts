/**
 * Seed script.
 *   pnpm db:seed            reference data (idempotent upserts) + demo data if none exists
 *   pnpm db:seed --reset    wipe demo data (businesses, listings, users, bookings…) and re-create it
 *   pnpm db:seed --no-demo  reference data only (countries, cities, taxonomies, plans)
 *
 * Reference data: all ISO 3166-1 countries, seeded cities with Turkish names,
 * bilingual taxonomies, cancellation policies, subscription plans (£6/month, £60/year).
 * Demo data: 30 venues, 15 caterers, 20 performers across UK/TR/DE/NL with
 * GBP/TRY/EUR prices; businesses in every subscription state; customers,
 * enquiries, bookings and reviews; one admin. Well under 1 MB of rows.
 *
 * Images: if UNSPLASH_ACCESS_KEY is set, city tiles and demo listings get
 * hotlinked Unsplash photos with attribution (per the Unsplash API guidelines);
 * otherwise they stay empty and the UI shows a branded gradient.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { hashPassword } from "better-auth/crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DB } from "../src/db";
import * as s from "../src/db/schema";
import {
  ACT_TYPES,
  AMENITIES,
  CANCELLATION_POLICIES,
  CUISINES,
  DEMO_MARKETS,
  EVENT_TYPES,
  LANGUAGES,
  RETIRED_AMENITY_KEYS,
  SEED_CITIES,
  SERVICE_STYLES,
  VENUE_TYPES,
} from "../src/db/seed-data/taxonomy";
import { allCountries } from "../src/lib/countries-data";
import { slugify } from "../src/lib/slug";
import {
  refreshBusinessVisibility,
  refreshCityCounts,
  refreshCountryVisibility,
} from "../src/server/internal/visibility";

const args = new Set(process.argv.slice(2));
const RESET = args.has("--reset");
const NO_DEMO = args.has("--no-demo");
export const DEMO_PASSWORD = "BizimEvent!2026";

// Deterministic PRNG so every seed run produces the same demo data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261013);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const pickN = <T>(arr: readonly T[], n: number) => [...arr].sort(() => rand() - 0.5).slice(0, n);
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
const DAY = 864e5;

// Approximate placeholder rates for price_from_gbp; the daily job re-normalises with live ECB rates.
const TO_GBP: Record<string, number> = { GBP: 1, EUR: 0.86, TRY: 0.022 };

async function upsertLookup(
  db: DB,
  table: typeof s.venueTypes | typeof s.actTypes | typeof s.cuisines | typeof s.serviceStyles | typeof s.languages,
  rows: readonly (readonly [string, string, string])[],
) {
  for (const [i, [key, tr, en]] of rows.entries()) {
    await db
      .insert(table)
      .values({ key, labelTr: tr, labelEn: en, slugTr: slugify(tr), slugEn: slugify(en), sortOrder: i })
      .onConflictDoUpdate({ target: table.key, set: { labelTr: tr, labelEn: en, sortOrder: i } });
  }
}

async function seedReference(db: DB) {
  console.log("→ countries");
  const countries = allCountries();
  for (let i = 0; i < countries.length; i += 100) {
    const batch = countries.slice(i, i + 100).map((c) => ({ ...c }));
    await db
      .insert(s.countries)
      .values(batch)
      .onConflictDoUpdate({
        target: s.countries.iso2,
        set: {
          nameTr: sql`excluded.name_tr`,
          nameEn: sql`excluded.name_en`,
          defaultCurrency: sql`excluded.default_currency`,
          distanceUnit: sql`excluded.distance_unit`,
          defaultTimezone: sql`excluded.default_timezone`,
        },
      });
  }

  console.log("→ taxonomies");
  for (const [i, [key, tr, en, cultural, appliesTo]] of EVENT_TYPES.entries()) {
    await db
      .insert(s.eventTypes)
      .values({
        key,
        labelTr: tr,
        labelEn: en,
        slugTr: slugify(tr),
        slugEn: slugify(en),
        sortOrder: i,
        isTurkishCultural: cultural,
        appliesTo: appliesTo ?? ["venue", "caterer", "performer"],
      })
      .onConflictDoUpdate({
        target: s.eventTypes.key,
        set: { labelTr: tr, labelEn: en, sortOrder: i, isTurkishCultural: cultural },
      });
  }
  await upsertLookup(db, s.venueTypes, VENUE_TYPES);
  await upsertLookup(db, s.actTypes, ACT_TYPES);
  await upsertLookup(db, s.cuisines, CUISINES);
  await upsertLookup(db, s.serviceStyles, SERVICE_STYLES);
  await upsertLookup(db, s.languages, LANGUAGES);
  for (const [i, [key, tr, en, group, appliesTo]] of AMENITIES.entries()) {
    await db
      .insert(s.amenities)
      .values({
        key,
        labelTr: tr,
        labelEn: en,
        slugTr: slugify(tr),
        slugEn: slugify(en),
        sortOrder: i,
        group,
        appliesTo,
      })
      .onConflictDoUpdate({
        target: s.amenities.key,
        set: { labelTr: tr, labelEn: en, group, appliesTo, sortOrder: i },
      });
  }
  // Amenities replaced by structured venue fields (see RETIRED_AMENITY_KEYS).
  await db.delete(s.amenities).where(inArray(s.amenities.key, [...RETIRED_AMENITY_KEYS]));
  for (const p of CANCELLATION_POLICIES) {
    const [existing] = await db
      .select({ id: s.cancellationPolicies.id })
      .from(s.cancellationPolicies)
      .where(sql`${s.cancellationPolicies.key} = ${p.key} and ${s.cancellationPolicies.businessId} is null`)
      .limit(1);
    if (existing) await db.update(s.cancellationPolicies).set(p).where(eq(s.cancellationPolicies.id, existing.id));
    else await db.insert(s.cancellationPolicies).values(p);
  }

  console.log("→ subscription plans (£6/month, £60/year)");
  const plans = [
    { key: "monthly", nameTr: "Aylık", nameEn: "Monthly", interval: "month" as const, amountMinor: 600 },
    { key: "yearly", nameTr: "Yıllık", nameEn: "Yearly", interval: "year" as const, amountMinor: 6000 },
  ];
  for (const p of plans) {
    const [plan] = await db
      .insert(s.subscriptionPlans)
      .values({ key: p.key, nameTr: p.nameTr, nameEn: p.nameEn, interval: p.interval })
      .onConflictDoUpdate({ target: s.subscriptionPlans.key, set: { nameTr: p.nameTr, nameEn: p.nameEn } })
      .returning();
    await db
      .insert(s.planPrices)
      .values({ planId: plan.id, currency: "GBP", amountMinor: p.amountMinor })
      .onConflictDoNothing();
  }

  console.log("→ cities");
  const unsplash = process.env.UNSPLASH_ACCESS_KEY;
  for (const c of SEED_CITIES) {
    const photo = unsplash ? await unsplashPhoto(unsplash, `${c.en} city skyline`) : null;
    const values = {
      countryIso2: c.country,
      googlePlaceId: `seed:${c.key}`,
      nameEn: c.en,
      nameTr: c.tr,
      slugEn: slugify(c.en),
      slugTr: slugify(c.tr),
      centre: { lng: c.lng, lat: c.lat },
      timezone: c.tz,
      taglineEn: c.taglineEn,
      taglineTr: c.taglineTr,
      isFeaturedWorldwide: c.featured,
      ...(photo
        ? {
            heroImageUrl: photo.hero,
            tileImageUrl: photo.tile,
            imageSource: "unsplash" as const,
            imageCreditName: photo.credit,
            imageCreditUrl: photo.creditUrl,
          }
        : {}),
    };
    await db.insert(s.cities).values(values).onConflictDoUpdate({ target: s.cities.googlePlaceId, set: values });
  }
}

// ── Unsplash (optional) ─────────────────────────────────────────────────────

type Photo = { tile: string; hero: string; large: string; small: string; credit: string; creditUrl: string };
const UTM = "utm_source=bizim_event&utm_medium=referral";

async function unsplashSearch(key: string, query: string, perPage = 10): Promise<Photo[]> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results: {
        urls: { raw: string };
        user: { name: string; links: { html: string } };
        links: { download_location: string };
      }[];
    };
    return Promise.all(
      json.results.map(async (r) => {
        // Unsplash guideline: trigger the download endpoint when a photo is selected.
        await fetch(r.links.download_location, { headers: { Authorization: `Client-ID ${key}` } }).catch(
          () => undefined,
        );
        const raw = r.urls.raw;
        return {
          tile: `${raw}&w=800&h=1000&fit=crop&auto=format&q=70`,
          hero: `${raw}&w=2000&h=900&fit=crop&auto=format&q=70`,
          large: `${raw}&w=2000&auto=format&q=75`,
          small: `${raw}&w=400&auto=format&q=70`,
          credit: r.user.name,
          creditUrl: `${r.user.links.html}?${UTM}`,
        };
      }),
    );
  } catch {
    return [];
  }
}
async function unsplashPhoto(key: string, query: string) {
  return (await unsplashSearch(key, query, 1))[0] ?? null;
}

// ── Demo data ───────────────────────────────────────────────────────────────

const VENUE_NAMES = [
  ["Saray", "Palace"],
  ["Lale Bahçesi", "Tulip Garden"],
  ["Boğaziçi", "Bosphorus"],
  ["Yıldız", "Star"],
  ["Çınar", "Plane Tree"],
  ["Mavi Köşk", "Blue Mansion"],
  ["Gül Konağı", "Rose House"],
  ["Ay Işığı", "Moonlight"],
  ["Hilal", "Crescent"],
  ["Defne", "Laurel"],
  ["Ihlamur", "Linden"],
  ["Sedef", "Pearl"],
  ["Kristal", "Crystal"],
  ["Elmas", "Diamond"],
  ["Zümrüt", "Emerald"],
  ["Nergis", "Narcissus"],
  ["Papatya", "Daisy"],
  ["Selvi", "Cypress"],
  ["Şahane", "Splendid"],
  ["Lüks", "Luxe"],
  ["Anka", "Phoenix"],
  ["Sultan", "Sultan"],
] as const;
const VENUE_KINDS: { key: string; tr: string; en: string }[] = [
  { key: "wedding_hall", tr: "Düğün Salonu", en: "Wedding Hall" },
  { key: "banquet_hall", tr: "Davet Salonu", en: "Banquet Suite" },
  { key: "garden", tr: "Bahçe", en: "Gardens" },
  { key: "restaurant", tr: "Restoran", en: "Restaurant" },
  { key: "hotel", tr: "Otel Balo Salonu", en: "Hotel Ballroom" },
  { key: "community_centre", tr: "Kültür Merkezi", en: "Community Centre" },
];
const SPACES = [
  { tr: "Ana Salon", en: "Main Hall", cap: [250, 800] },
  { tr: "Bahçe", en: "Garden", cap: [80, 300] },
  { tr: "VIP Salon", en: "VIP Room", cap: [30, 90] },
] as const;
const CATERER_NAMES = [
  ["Anadolu Sofrası", "Anatolian Table"],
  ["Mangal Ustası", "Mangal Master"],
  ["Lokma Evi", "Lokma House"],
  ["Ege Mezeleri", "Aegean Meze"],
  ["Karadeniz Mutfağı", "Black Sea Kitchen"],
  ["Kıbrıs Lezzetleri", "Cypriot Flavours"],
  ["Osmanlı Ziyafeti", "Ottoman Feast"],
  ["Baklava Sarayı", "Baklava Palace"],
  ["Köfteci Dayı", "Uncle's Köfte"],
  ["Döner Durağı", "Döner Stop"],
  ["Hayır Lokması", "Charity Lokma"],
  ["Sofra Catering", "Sofra Catering"],
  ["Gurbet Mutfağı", "Homeland Kitchen"],
  ["Tandır Evi", "Tandır House"],
  ["Mevsim Catering", "Seasons Catering"],
] as const;
const PERFORMER_NAMES = [
  ["Grup Halay", "wedding_band"],
  ["Davulcu Mehmet", "davul_zurna"],
  ["Bağlama Sesi", "saz_baglama"],
  ["Halaycılar", "halay_band"],
  ["Ses Sanatçısı Ayşe", "singer"],
  ["DJ Tolga", "dj"],
  ["Raks Leyla", "oriental_dancer"],
  ["Anadolu Halk Dansları", "folk_dance"],
  ["Fasıl Meşk", "fasil"],
  ["Sema Ritüeli", "semazen"],
  ["Neşeli Animasyon", "kids_entertainer"],
  ["Sunucu Kerem", "mc_host"],
  ["Kına Gecem", "kina_organiser"],
  ["Orkestra Yıldız", "wedding_band"],
  ["Zurna Kardeşler", "davul_zurna"],
  ["DJ Elif", "dj"],
  ["Grup Karadeniz", "wedding_band"],
  ["Saz Ustası Ali", "saz_baglama"],
  ["Gece Mavisi", "singer"],
  ["Efe Folklor", "folk_dance"],
] as const;

function weightedMarket() {
  const total = DEMO_MARKETS.reduce((a, m) => a + m.weight, 0);
  let r = rand() * total;
  for (const m of DEMO_MARKETS) {
    if ((r -= m.weight) <= 0) return m;
  }
  return DEMO_MARKETS[0];
}

const SUB_STATES = ["trialing", "active", "active", "trialing", "comped", "past_due", "active", "expired"] as const;

async function wipeDemo(db: DB) {
  console.log("→ wiping demo data");
  await db.execute(sql`
    truncate table reviews, bookings, offers, viewings, messages, enquiries, event_plans, shortlists,
      availability_blocks, ical_feeds, listing_amenities, listing_event_types, listing_media, listing_prices,
      listing_capacities, venue_details, caterer_details, performer_details, listings, subscriptions,
      quick_replies, businesses, notifications, notification_preferences, reports, audit_log,
      listing_stats_daily, member, invitation, organization, session, account, verification, "user"
    restart identity cascade`);
}

async function createUser(
  db: DB,
  email: string,
  name: string,
  role: "customer" | "business" | "admin",
  locale: "tr" | "en",
  country: string,
) {
  const [u] = await db
    .insert(s.user)
    .values({ email, name, role, emailVerified: true, preferredLocale: locale, countryIso2: country })
    .returning();
  await db.insert(s.account).values({
    userId: u.id,
    accountId: u.id,
    providerId: "credential",
    password: await hashPassword(DEMO_PASSWORD),
  });
  return u;
}

async function seedDemo(db: DB) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.businesses);
  if (n > 0 && !RESET) {
    console.log(`→ demo data skipped (${n} businesses exist; use --reset to recreate)`);
    return;
  }
  if (RESET) await wipeDemo(db);

  const now = new Date();
  const cities = Object.fromEntries(
    (await db.select().from(s.cities)).map((c) => [c.googlePlaceId!.replace("seed:", ""), c]),
  );
  const eventTypes = await db.select().from(s.eventTypes);
  const venueTypes = Object.fromEntries((await db.select().from(s.venueTypes)).map((v) => [v.key, v]));
  const amenities = await db.select().from(s.amenities);
  const policies = await db.select().from(s.cancellationPolicies);
  const [monthly] = await db.select().from(s.subscriptionPlans).where(eq(s.subscriptionPlans.key, "monthly"));
  const [yearly] = await db.select().from(s.subscriptionPlans).where(eq(s.subscriptionPlans.key, "yearly"));

  const unsplash = process.env.UNSPLASH_ACCESS_KEY;
  const photoPools = unsplash
    ? {
        venue: await unsplashSearch(unsplash, "wedding reception hall", 30),
        caterer: await unsplashSearch(unsplash, "turkish food mezze", 30),
        performer: await unsplashSearch(unsplash, "live band wedding music", 30),
      }
    : { venue: [], caterer: [], performer: [] };

  console.log("→ users");
  await createUser(db, "admin@bizimevent.test", "Bizim Event Admin", "admin", "tr", "GB");
  const customers = [];
  for (let i = 1; i <= 8; i++) {
    const loc = i % 2 ? "tr" : "en";
    customers.push(
      await createUser(
        db,
        `customer${i}@bizimevent.test`,
        `${pick(["Ayşe", "Mehmet", "Zeynep", "Emre", "Elif", "Can", "Deniz", "Selin"])} ${pick(["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Arslan"])}`,
        "customer",
        loc,
        pick(["GB", "TR", "DE", "NL"]),
      ),
    );
  }

  type Spec = { type: "venue" | "caterer" | "performer"; name: readonly [string, string]; extra?: string };
  const specs: Spec[] = [];
  // 22 venue businesses → 30 venue listings (some have several spaces)
  for (let i = 0; i < 22; i++) specs.push({ type: "venue", name: VENUE_NAMES[i] });
  for (const nm of CATERER_NAMES) specs.push({ type: "caterer", name: nm });
  for (const [nm, act] of PERFORMER_NAMES) specs.push({ type: "performer", name: [nm, nm], extra: act });

  let ownerIndex = 0;
  const createdListings: { id: string; businessId: string; timezone: string; currency: string; public: boolean }[] = [];

  console.log("→ businesses & listings");
  for (const [bi, spec] of specs.entries()) {
    ownerIndex++;
    const market = weightedMarket();
    const city = cities[market.city];
    const owner = await createUser(
      db,
      `owner${ownerIndex}@bizimevent.test`,
      `${spec.name[0]} Owner`,
      "business",
      market.currency === "TRY" ? "tr" : pick(["tr", "en"]),
      city.countryIso2,
    );
    const kind = spec.type === "venue" ? pick(VENUE_KINDS) : null;
    const nameTr = spec.type === "venue" ? `${spec.name[0]} ${kind!.tr}` : spec.name[0];
    const nameEn = spec.type === "venue" ? `${spec.name[1]} ${kind!.en}` : spec.name[1];
    const subState = SUB_STATES[bi % SUB_STATES.length];
    // A few businesses are still waiting for approval (no subscription yet).
    const pending = bi % 13 === 12;
    const approvedAt = new Date(now.getTime() - between(5, 400) * DAY);
    const [org] = await db
      .insert(s.organization)
      .values({ name: nameEn, slug: `${slugify(nameEn)}-${bi}` })
      .returning();
    await db.insert(s.member).values({ organizationId: org.id, userId: owner.id, role: "owner" });

    const [biz] = await db
      .insert(s.businesses)
      .values({
        ownerId: owner.id,
        organizationId: org.id,
        type: spec.type,
        nameTr,
        nameEn,
        slug: `${slugify(nameEn)}-${slugify(city.nameEn)}`,
        descriptionTr: `${city.nameTr}'da ${spec.type === "venue" ? "mekan" : spec.type === "caterer" ? "ikram hizmeti" : "sahne sanatçısı"} olarak yıllardır topluluğumuzun mutlu günlerinde yanınızdayız.`,
        descriptionEn: `Serving the community in ${city.nameEn} for years — ${spec.type === "venue" ? "a venue" : spec.type === "caterer" ? "catering" : "live entertainment"} for your happiest days.`,
        phoneE164:
          market.currency === "GBP"
            ? `+4420${between(10000000, 99999999)}`
            : market.currency === "TRY"
              ? `+90212${between(1000000, 9999999)}`
              : `+4930${between(1000000, 9999999)}`,
        email: `hello@${slugify(nameEn)}.example`,
        instagram: slugify(nameEn).replace(/-/g, ""),
        addressLine: `${between(1, 250)} ${pick(["High Street", "Market Road", "Caddesi", "Straße", "Plein"])}, ${city.nameEn}`,
        location: { lng: city.centre!.lng + (rand() - 0.5) * 0.15, lat: city.centre!.lat + (rand() - 0.5) * 0.1 },
        countryIso2: city.countryIso2,
        cityId: city.id,
        timezone: city.timezone,
        currency: market.currency,
        status: pending ? "pending_review" : "approved",
        submittedAt: new Date(approvedAt.getTime() - 2 * DAY),
        approvedAt: pending ? null : approvedAt,
        verifiedAt: pending ? null : approvedAt,
        responseRate: between(70, 100),
        avgResponseMinutes: between(20, 900),
        onboardingStep: 9,
      })
      .returning();

    if (!pending) {
      const plan = rand() > 0.5 ? monthly : yearly;
      const trialStart = approvedAt;
      const sub: typeof s.subscriptions.$inferInsert = {
        businessId: biz.id,
        status: subState,
        trialStartedAt: trialStart,
        trialEndsAt: new Date(trialStart.getTime() + 90 * DAY),
      };
      if (subState === "trialing") {
        sub.trialStartedAt = new Date(now.getTime() - between(1, 80) * DAY);
        sub.trialEndsAt = new Date(sub.trialStartedAt.getTime() + 90 * DAY);
      }
      if (subState === "active" || subState === "past_due") {
        sub.planId = plan.id;
        sub.stripeCustomerId = `cus_demo_${bi}`;
        sub.stripeSubscriptionId = `sub_demo_${bi}`;
        sub.currentPeriodEnd = new Date(now.getTime() + between(3, 300) * DAY);
      }
      if (subState === "past_due") sub.graceUntil = new Date(now.getTime() + 4 * DAY);
      if (subState === "expired") sub.trialEndsAt = new Date(now.getTime() - between(2, 30) * DAY);
      await db.insert(s.subscriptions).values(sub);
    }

    // Listings
    // 22 venue businesses + 8 extra spaces = 30 venue listings (businesses 0, 3, 6 have 3 spaces; 9, 12 have 2).
    const spaces = spec.type !== "venue" ? 1 : [0, 3, 6].includes(bi) ? 3 : [9, 12].includes(bi) ? 2 : 1;
    for (let si = 0; si < spaces; si++) {
      const space = SPACES[si];
      const titleTr = spec.type === "venue" && spaces > 1 ? `${space.tr} — ${nameTr}` : nameTr;
      const titleEn = spec.type === "venue" && spaces > 1 ? `${space.en} — ${nameEn}` : nameEn;
      const maxGuests =
        spec.type === "venue"
          ? between(space.cap[0], space.cap[1])
          : spec.type === "caterer"
            ? between(150, 1500)
            : null;
      const priceFrom =
        spec.type === "venue"
          ? market.currency === "TRY"
            ? between(150_000, 900_000)
            : between(1_500, 15_000)
          : spec.type === "caterer"
            ? market.currency === "TRY"
              ? between(900, 3_500)
              : between(18, 75)
            : market.currency === "TRY"
              ? between(15_000, 120_000)
              : between(350, 3_000);
      const pricingModel =
        spec.type === "venue"
          ? pick(["hire_fee_session", "minimum_spend", "per_person"] as const)
          : spec.type === "caterer"
            ? ("per_person" as const)
            : pick(["per_set", "per_event"] as const);
      const policy = pick(policies);
      const [listing] = await db
        .insert(s.listings)
        .values({
          businessId: biz.id,
          type: spec.type,
          titleTr,
          titleEn,
          slug: `${slugify(titleEn)}-${slugify(city.nameEn)}-${bi}${si}`,
          descriptionTr: demoDescription(spec.type, "tr", city.nameTr),
          descriptionEn: demoDescription(spec.type, "en", city.nameEn),
          status: pending ? "pending_review" : "approved",
          minGuests: spec.type === "venue" ? Math.round((maxGuests ?? 100) * 0.3) : spec.type === "caterer" ? 50 : null,
          maxGuests,
          pricingModel,
          priceFrom,
          currency: market.currency,
          priceFromGbp: Math.round(priceFrom * TO_GBP[market.currency] * 100) / 100,
          depositPercent: pick([20, 25, 30, 50]),
          cancellationPolicyId: policy.id,
          bookingRequestsEnabled: rand() > 0.6,
          sortScore: Math.round(rand() * 1000) / 100,
          featuredUntil: rand() > 0.85 ? new Date(now.getTime() + 30 * DAY) : null,
        })
        .returning();

      // Event types
      const ets = pickN(eventTypes, between(3, 7));
      await db.insert(s.listingEventTypes).values(ets.map((e) => ({ listingId: listing.id, eventTypeId: e.id })));
      // Amenities
      const am = pickN(
        amenities.filter((a) => a.appliesTo.includes(spec.type)),
        between(3, 8),
      );
      if (am.length)
        await db.insert(s.listingAmenities).values(am.map((a) => ({ listingId: listing.id, amenityId: a.id })));

      if (spec.type === "venue") {
        const cap = maxGuests ?? 200;
        await db.insert(s.listingCapacities).values([
          { listingId: listing.id, layout: "standing", capacity: Math.round(cap * 1.3) },
          { listingId: listing.id, layout: "seated_dinner", capacity: cap },
          { listingId: listing.id, layout: "banquet", capacity: Math.round(cap * 0.9) },
          { listingId: listing.id, layout: "theatre", capacity: Math.round(cap * 1.2) },
        ]);
        await db.insert(s.venueDetails).values({
          listingId: listing.id,
          areaType: si === 1 ? "private_outdoor" : si === 2 ? "private_room" : "whole_venue",
          venueTypeId: venueTypes[kind!.key]?.id,
          inHouseCatering: rand() > 0.3,
          externalCateringAllowed: rand() > 0.5,
          alcohol: pick(["venue_provides", "byo", "none"] as const),
          halalKitchen: rand() > 0.3,
          alcoholFreeOption: rand() > 0.2,
          liveMusicAllowed: rand() > 0.1,
          davulZurnaAllowed: rand() > 0.4,
          ownDjAllowed: rand() > 0.3,
          lateLicenceUntil: pick(["00:00", "01:00", "02:00", null]),
          parkingSpaces: rand() > 0.3 ? between(10, 300) : null,
          prayerRoom: rand() > 0.6,
          separateWomensArea: rand() > 0.8,
          nearestTransport:
            market.currency === "GBP" ? pick(["Tube station 5 min walk", "Train station 10 min walk"]) : null,
        });
        // Weekend pricing grid
        await db.insert(s.listingPrices).values(
          [5, 6, 0].flatMap((dow) =>
            (["afternoon", "evening"] as const).map((session) => ({
              listingId: listing.id,
              dayOfWeek: dow,
              session,
              price: Math.round(priceFrom * (dow === 6 && session === "evening" ? 1.4 : 1)),
              pricingModel,
            })),
          ),
        );
      } else if (spec.type === "caterer") {
        await db.insert(s.catererDetails).values({
          listingId: listing.id,
          cuisines: pickN(
            CUISINES.map((c) => c[0]),
            between(1, 3),
          ),
          serviceStyles: pickN(
            SERVICE_STYLES.map((c) => c[0]),
            between(2, 4),
          ),
          halalCertified: rand() > 0.2,
          halalCertBody: rand() > 0.5 ? "HMC" : null,
          minGuests: 50,
          pricePerHeadFrom: priceFrom,
          staffIncluded: rand() > 0.4,
          equipmentIncluded: rand() > 0.5,
          travelRadiusKm: between(20, 200),
          hygieneRatingText: market.currency === "GBP" ? "5 (Very good)" : null,
        });
      } else {
        await db.insert(s.performerDetails).values({
          listingId: listing.id,
          actTypes: [spec.extra!],
          languages: pickN(["tr", "en", "ku", "de", "nl"], between(1, 3))
            .concat(["tr"])
            .filter((v, i, a) => a.indexOf(v) === i),
          setLengthMinutes: pick([45, 60, 90, 120]),
          setsPerEvent: pick([1, 2, 3]),
          ownPaIncluded: rand() > 0.4,
          travelFee: rand() > 0.5 ? between(50, 400) : null,
          countriesCovered: [city.countryIso2],
          travelsInternationally: rand() > 0.6,
          membersCount: between(1, 8),
        });
      }

      // Photos (only when Unsplash is configured)
      const pool = photoPools[spec.type];
      if (pool.length) {
        const photos = pickN(pool, spec.type === "venue" ? 5 : 3);
        await db.insert(s.listingMedia).values(
          photos.map((p, i) => ({
            listingId: listing.id,
            kind: "image" as const,
            urlSmall: p.small,
            urlMedium: p.tile,
            urlLarge: p.large,
            captionEn: `Photo by ${p.credit} on Unsplash`,
            captionTr: `Fotoğraf: ${p.credit} / Unsplash`,
            altEn: titleEn,
            altTr: titleTr,
            sortOrder: i,
          })),
        );
      }

      createdListings.push({
        id: listing.id,
        businessId: biz.id,
        timezone: city.timezone,
        currency: market.currency,
        public: false,
      });
    }
  }

  console.log("→ visibility");
  const bizIds = [...new Set(createdListings.map((l) => l.businessId))];
  for (const id of bizIds) await refreshBusinessVisibility(db, id, now);
  await refreshCityCounts(db);
  await refreshCountryVisibility(db);

  console.log("→ enquiries, bookings, reviews");
  const publicListings = await db
    .select({
      id: s.listings.id,
      businessId: s.listings.businessId,
      currency: s.listings.currency,
      priceFrom: s.listings.priceFrom,
    })
    .from(s.listings)
    .where(eq(s.listings.isPublic, true));
  const tzByBiz = Object.fromEntries(createdListings.map((l) => [l.businessId, l.timezone]));
  let reviewCount = 0;
  for (const [i, l] of publicListings.slice(0, 40).entries()) {
    const customer = customers[i % customers.length];
    const past = i % 2 === 0;
    const eventDate = new Date(now.getTime() + (past ? -between(10, 200) : between(20, 300)) * DAY)
      .toISOString()
      .slice(0, 10);
    const [enq] = await db
      .insert(s.enquiries)
      .values({
        customerId: customer.id,
        listingId: l.id,
        businessId: l.businessId,
        eventTypeId: pick(eventTypes).id,
        eventDate,
        guests: between(50, 400),
        message:
          customer.preferredLocale === "tr"
            ? "Merhaba, bu tarih için müsaitlik ve fiyat bilgisi alabilir miyim?"
            : "Hello, could you share availability and pricing for this date?",
        status: past ? "booked" : pick(["new", "replied", "offer_sent"] as const),
        firstResponseAt: new Date(now.getTime() - between(1, 30) * DAY),
        lastMessageAt: new Date(now.getTime() - between(0, 10) * DAY),
      })
      .returning();
    await db.insert(s.messages).values({ enquiryId: enq.id, senderId: customer.id, body: enq.message });

    if (past || i % 3 === 0) {
      const total = (l.priceFrom ?? 1000) * (past ? 1.2 : 1);
      const [booking] = await db
        .insert(s.bookings)
        .values({
          enquiryId: enq.id,
          listingId: l.id,
          businessId: l.businessId,
          customerId: customer.id,
          eventDate,
          timezone: tzByBiz[l.businessId] ?? "Europe/London",
          guests: enq.guests,
          totalAmount: Math.round(total),
          currency: l.currency,
          depositAmount: Math.round(total * 0.25),
          depositStatus: "received",
          balanceStatus: past ? "received" : "awaiting",
          status: past ? "completed" : "confirmed",
          completedAt: past ? new Date(eventDate) : null,
        })
        .returning();
      if (past) {
        const rating = pick([4, 5, 5, 5, 4, 3]);
        await db.insert(s.reviews).values({
          bookingId: booking.id,
          listingId: l.id,
          customerId: customer.id,
          rating,
          ratingValue: Math.min(5, rating + pick([0, 0, -1, 1])),
          ratingService: rating,
          ratingQuality: rating,
          locale: customer.preferredLocale,
          body:
            customer.preferredLocale === "tr"
              ? pick([
                  "Her şey mükemmeldi, misafirlerimiz çok memnun kaldı.",
                  "Ekip çok ilgiliydi, kesinlikle tavsiye ederim.",
                  "Güzel bir geceydi, küçük aksaklıklar oldu ama genel olarak memnunuz.",
                ])
              : pick([
                  "Everything was perfect — our guests loved it.",
                  "Very attentive team, highly recommended.",
                  "Lovely night; a few small hiccups but we were happy overall.",
                ]),
          businessReply:
            rand() > 0.5
              ? customer.preferredLocale === "tr"
                ? "Güzel yorumunuz için teşekkür ederiz!"
                : "Thank you for the kind words!"
              : null,
          status: "published",
        });
        reviewCount++;
      }
    }
  }
  // Denormalised rating on listings
  await db.execute(sql`
    update listings l set rating_avg = r.avg, review_count = r.n
    from (select listing_id, round(avg(rating)::numeric, 2) as avg, count(*)::int as n
          from reviews where status = 'published' group by listing_id) r
    where r.listing_id = l.id`);

  const [{ total, pub }] = await db
    .select({ total: sql<number>`count(*)::int`, pub: sql<number>`count(*) filter (where is_public)::int` })
    .from(s.listings);
  console.log(
    `✓ demo: ${specs.length} businesses, ${total} listings (${pub} public), ${customers.length} customers, ${reviewCount} reviews`,
  );
  console.log(`  logins: admin@bizimevent.test / owner1@… / customer1@… — password ${DEMO_PASSWORD}`);
}

function demoDescription(type: "venue" | "caterer" | "performer", locale: "tr" | "en", city: string) {
  const tr = {
    venue: `${city}'nın kalbinde, düğün, nişan ve kına geceleri için ferah ve şık bir mekan. Kendi ikram ekibimiz, geniş dans pisti ve misafirleriniz için rahat oturma düzeniyle hayalinizdeki geceyi birlikte planlayalım.`,
    caterer: `Geleneksel tariflerle hazırlanan helal menüler: mezeler, mangal, köfte ve döner standları, baklava ve lokma. ${city} ve çevresinde 50 kişiden binlerce kişiye kadar servis veriyoruz.`,
    performer: `Düğün, nişan ve kına geceleri için canlı performans. Halaydan oyun havalarına, ${city} ve çevresinde misafirlerinizi pistten kaldırmayacak bir program hazırlıyoruz.`,
  };
  const en = {
    venue: `A bright, elegant venue in the heart of ${city} for weddings, engagements and henna nights. In-house catering, a large dance floor and comfortable seating — let's plan your dream night together.`,
    caterer: `Halal menus made with traditional recipes: meze, mangal, köfte and döner stations, baklava and lokma. We serve ${city} and the surrounding area, from 50 guests to several thousand.`,
    performer: `Live performance for weddings, engagements and henna nights. From halay to folk favourites, we build a programme that keeps your guests on the dance floor across ${city}.`,
  };
  return (locale === "tr" ? tr : en)[type];
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DATABASE_URL_UNPOOLED) before seeding.");
  const pool = new Pool({ connectionString: url, max: 2 });
  const db: DB = drizzle({ client: pool, schema: s });
  const started = Date.now();
  await seedReference(db);
  if (!NO_DEMO) await seedDemo(db);
  const [{ bytes }] = await db
    .execute<{ bytes: string }>(sql`select pg_database_size(current_database())::text as bytes`)
    .then((r) => r.rows);
  console.log(
    `✓ seed finished in ${((Date.now() - started) / 1000).toFixed(1)}s — database size ${(Number(bytes) / 1024 / 1024).toFixed(1)} MB of 1024 MB free tier`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
