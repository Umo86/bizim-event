import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN_EMAIL,
  countEmails,
  linkIn,
  logIn,
  openPage,
  PHONE,
  SEEDED_PASSWORD,
  snap,
  testEmail,
  ui,
  waitForEmails,
  visible,
  type Locale,
} from "./support/app";
import { completeListingSteps, saveAndContinue, type ListingInput } from "./support/listing";

/**
 * A new business, from nothing to live, for each listing type:
 * sign up → blocked until the email is verified → verify from the email → log out and
 * back in → set-up wizard with photo uploads → submit → an admin approves → add a
 * second listing → submit it → the admin approves that too.
 */

type Scenario = {
  type: "venue" | "caterer" | "performer";
  locale: Locale;
  phone?: boolean;
  business: {
    name: string;
    description: string;
    phone: string;
    email: string;
    country: string;
    address: string;
    city: string;
    postal?: string;
    currency: string;
    timezone: string;
  };
  first: ListingInput;
  second: ListingInput;
};

const run = Date.now().toString(36).slice(-4);

const SCENARIOS: Scenario[] = [
  {
    type: "venue",
    locale: "tr",
    business: {
      name: `Yıldız Düğün Salonu ${run}`,
      description:
        "Kuzey Londra'da 400 kişilik ferah düğün salonu. Kendi mutfağımız, geniş dans pisti ve ücretsiz otoparkımız var.",
      phone: "020 7946 0321",
      email: "info@yildizsalon.example",
      country: "GB",
      address: "221 Green Lanes",
      city: "London",
      postal: "N4 2HA",
      currency: "GBP",
      timezone: "Europe/London",
    },
    first: {
      title: "Ana Salon",
      description:
        "Yüksek tavanlı, kristal avizeli ana salonumuz 400 kişilik oturmalı yemek düzenine uygundur. Sahne ve ses sistemi dahildir.",
      areaType: "whole_venue",
      venueType: "wedding_hall",
      capacities: { seated_dinner: "400", standing: "550" },
      photos: 5,
      pricingModel: "hire_fee_session",
      priceFrom: "4500",
      deposit: "25",
      weekly: [[6, "evening", "6500"]],
      eventTypes: ["wedding", "engagement", "henna_night", "circumcision"],
      checks: ["inHouseCatering", "halalKitchen", "davulZurnaAllowed", "prayerRoom"],
      amenities: ["dance_floor", "wheelchair_access"],
      policy: "moderate",
    },
    second: {
      title: "Bahçe",
      description:
        "Salonun arkasındaki çiçekli bahçemiz yaz düğünleri ve kına geceleri için 180 kişilik oturma düzeni sunar.",
      areaType: "private_outdoor",
      capacities: { seated_dinner: "180", standing: "250" },
      photos: 5,
      pricingModel: "per_person",
      priceFrom: "45",
      deposit: "20",
      eventTypes: ["wedding", "henna_night", "birthday"],
      checks: ["alcoholFreeOption"],
      amenities: ["garden"],
      policy: "flexible",
    },
  },
  {
    type: "caterer",
    locale: "en",
    business: {
      name: `Anatolia Catering Berlin ${run}`,
      description:
        "Family-run Turkish caterer in Berlin. Mangal, meze and baklava for weddings and engagements across Germany.",
      phone: "+49 30 23125 456",
      email: "hello@anatolia-catering.example",
      country: "DE",
      address: "Oranienstraße 12",
      city: "Berlin",
      postal: "10999",
      currency: "EUR",
      timezone: "Europe/Berlin",
    },
    first: {
      title: "Wedding mangal menu",
      description:
        "Charcoal-grilled meats, six cold meze, fresh bread and baklava, served by our own staff for 80 to 600 guests.",
      chips: ["turkish", "kurdish", "mangal_bbq", "meze"],
      fields: { "#min-guests": "80", "#max-guests": "600" },
      photos: 3,
      pricingModel: "per_person",
      priceFrom: "38",
      deposit: "20",
      eventTypes: ["wedding", "engagement"],
      checks: ["staffIncluded", "halalCertified"],
      amenities: ["halal_menu", "vegetarian_options", "tasting_available"],
      policy: "flexible",
    },
    second: {
      title: "Baklava and lokma table",
      description:
        "A dessert table with three kinds of baklava, fresh lokma fried on site and Turkish tea, for 50 to 400 guests.",
      chips: ["turkish", "buffet"],
      fields: { "#min-guests": "50", "#max-guests": "400" },
      photos: 3,
      pricingModel: "per_person",
      priceFrom: "12",
      deposit: "20",
      eventTypes: ["mevlit", "hayir_yemegi"],
      checks: ["equipmentIncluded"],
      amenities: ["halal_menu"],
      policy: "moderate",
    },
  },
  {
    type: "performer",
    locale: "tr",
    phone: true,
    business: {
      name: `Karadeniz Davul Zurna ${run}`,
      description:
        "İstanbul merkezli davul-zurna ve halay ekibi. Düğün, kına ve sünnet törenlerinde 4 kişilik kadroyla sahne alıyoruz.",
      phone: "+90 532 000 12 34",
      email: "ekip@davulzurna.example",
      country: "TR",
      address: "Bağdat Caddesi 210",
      city: "İstanbul",
      currency: "TRY",
      timezone: "Europe/Istanbul",
    },
    first: {
      title: "Davul zurna ile gelin alma",
      description:
        "Gelin almadan halaya kadar davul-zurna, 2 set halinde. Kostümlü ekip, kendi ses sistemimizle geliyoruz.",
      chips: ["davul_zurna", "halay_band", "tr", "ku"],
      fields: { "#set-length": "45", "#sets": "2", "#members": "4" },
      photos: 3,
      pricingModel: "per_event",
      priceFrom: "12000",
      deposit: "30",
      travelFee: "1500",
      eventTypes: ["wedding", "henna_night", "circumcision"],
      checks: ["ownPaIncluded", "travelsInternationally"],
      countryCovered: "DE",
      amenities: ["costumes", "lighting_included"],
      policy: "custom",
      customTerms:
        "Kaporanın tamamı etkinlikten 45 gün öncesine kadar iade edilir. Sonrasında kapora iade edilmez, tarih bir kez değiştirilebilir.",
    },
    second: {
      title: "Saz ile kına gecesi",
      description:
        "Kına gecesi için bağlama ve vokal: yakılan kına türküleri, oyun havaları ve 2 set halinde canlı müzik.",
      chips: ["saz_baglama", "tr"],
      fields: { "#set-length": "60", "#sets": "2", "#members": "3" },
      photos: 3,
      pricingModel: "per_set",
      priceFrom: "8000",
      deposit: "25",
      eventTypes: ["henna_night", "engagement"],
      checks: ["ownPaIncluded"],
      amenities: ["lighting_included"],
      policy: "flexible",
    },
  },
];

for (const s of SCENARIOS) {
  test(`${s.type} (${s.locale}${s.phone ? ", phone" : ""}): sign up, verify, log in and add listings`, async ({
    browser,
  }) => {
    const t = ui[s.locale];
    const email = testEmail(s.type);
    const password = `E2e-${s.type}-Pass-2026`;
    const owner = await openPage(browser, s.locale, s.phone ? PHONE : undefined);
    const page = owner.page;
    const main = page.getByRole("main");

    await test.step("sign up from the business start page", async () => {
      await page.goto(`/${s.locale}/business/start`);
      await main.getByRole("link", { name: t.common.signUp, exact: true }).click();
      await page.waitForURL((url) => url.pathname === `/${s.locale}/sign-up`);
      await visible(page.locator("#name")).fill(`${s.business.name} Owner`);
      await visible(page.locator("#email")).fill(email);
      await visible(page.locator("#password")).fill(password);
      await main.getByRole("button", { name: t.auth.signUpButton, exact: true }).click();
      await expect(main.getByRole("status")).toHaveText(t.auth.verifyEmailSent);
      await snap(page, `${s.type}-signed-up`);
      await waitForEmails(email, "verify", 1);
    });

    await test.step("can't log in before verifying, and gets a fresh link", async () => {
      await main.getByRole("link", { name: t.auth.signInButton, exact: true }).click();
      await page.waitForURL((url) => url.pathname === `/${s.locale}/sign-in`);
      await visible(page.locator("#email")).fill(email);
      await visible(page.locator("#password")).fill(password);
      await main.getByRole("button", { name: t.auth.signInButton, exact: true }).click();
      await expect(main.getByRole("status")).toHaveText(t.auth.emailNotVerified);
      await snap(page, `${s.type}-not-verified`);
      await waitForEmails(email, "verify", 2);
    });

    await test.step("the link in the email verifies the account and logs in", async () => {
      const [, latest] = await waitForEmails(email, "verify", 2);
      await page.goto(linkIn(latest, "/verify-email"));
      await page.waitForURL((url) => url.pathname === `/${s.locale}/business/start`);
      await expect(
        main.getByRole("button", { name: new RegExp(t.businessStart[`${s.type}Title` as const]) }),
      ).toBeVisible();
    });

    await test.step("log out, then log back in with the password", async () => {
      await page.goto(`/${s.locale}/account`);
      await expect(visible(main.getByText(t.account.signedInAs.replace("{email}", email)))).toBeVisible();
      await main.getByRole("button", { name: t.common.logOut, exact: true }).click();
      await page.waitForURL((url) => url.pathname === `/${s.locale}`);
      await logIn(page, s.locale, email, password, `/${s.locale}/business/start`);
    });

    let businessId = "";
    await test.step("set up the business and its first listing", async () => {
      await main.getByRole("button", { name: new RegExp(t.businessStart[`${s.type}Title` as const]) }).click();
      await page.waitForURL(/\/setup\/info$/);
      businessId = page.url().split("/business/")[1].split("/")[0];

      await visible(page.locator(`#name-${s.locale}`)).fill(s.business.name);
      await visible(page.locator(`#description-${s.locale}`)).fill(s.business.description);
      await visible(page.locator("#phone")).fill(s.business.phone);
      await visible(page.locator("#email")).fill(s.business.email);
      await snap(page, `${s.type}-info`);
      await saveAndContinue(page, s.locale, "/location");

      // Typed in by hand: tests don't call the address-search providers.
      await page.getByRole("button", { name: t.fields.manualToggle }).click();
      await visible(page.locator("#country")).selectOption(s.business.country);
      await visible(page.locator("#address-line")).fill(s.business.address);
      await visible(page.locator("#city")).fill(s.business.city);
      if (s.business.postal) await visible(page.locator("#postal")).fill(s.business.postal);
      await snap(page, `${s.type}-location`);
      await saveAndContinue(page, s.locale, "/currency");

      // Prefilled from the address.
      await expect(visible(main.locator("select")).first()).toHaveValue(s.business.currency);
      await expect(visible(main.locator("select")).nth(1)).toHaveValue(s.business.timezone);
      await saveAndContinue(page, s.locale, "/listing");

      await completeListingSteps(page, s.locale, s.first, { name: `${s.type}-wizard`, editor: false });

      await snap(page, `${s.type}-review`);
      const adminEmails = await countEmails(ADMIN_EMAIL, "businessSubmitted");
      await page.getByRole("checkbox", { name: t.review.confirm }).check();
      await page.getByRole("button", { name: t.review.submit, exact: true }).click();
      await page.waitForURL(/submitted=1/);
      await expect(visible(main.getByText(t.businessOverview.submittedBanner))).toBeVisible();
      await snap(page, `${s.type}-submitted`);
      await waitForEmails(ADMIN_EMAIL, "businessSubmitted", adminEmails + 1);
    });

    await test.step("an admin approves the business", async () => {
      await approveAsAdmin(browser, s.locale, async (admin) => {
        await admin.goto(`/${s.locale}/admin/approvals`);
        await expect(visible(admin.getByRole("main").getByText(s.business.name)).first()).toBeVisible();
        await admin.goto(`/${s.locale}/admin/approvals/${businessId}`);
        await snap(admin, `${s.type}-admin-review`);
        await admin.getByRole("button", { name: t.admin.approve, exact: true }).click();
        await expect(visible(admin.getByText(t.admin.noActionNeeded))).toBeVisible();
      });
      await waitForEmails(email, "businessApproved", 1);
      await page.goto(`/${s.locale}/business/${businessId}`);
      // The owner sees the free trial and a way to choose a plan.
      await expect(visible(main.getByText(t.billing.bannerTrial.split("{")[0].trim()))).toBeVisible();
      await expect(main.getByRole("link", { name: t.billing.choosePlan })).toBeVisible();
      await snap(page, `${s.type}-approved`);
    });

    await test.step("add a second listing and send it for review", async () => {
      await main.getByRole("button", { name: t.businessOverview.addListing }).click();
      await page.waitForURL(/\/listings\/[0-9a-f-]+\/listing$/);
      await completeListingSteps(page, s.locale, s.second, { name: `${s.type}-second`, editor: true });
      const submit = main.getByRole("button", { name: t.listingEditor.submitListing });
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(visible(main.getByText(t.listingEditor.submitted, { exact: true }))).toBeVisible();
      // The page reloads its data: the listing is now in review, so there's nothing left to submit.
      await expect(submit).toBeHidden();
      await snap(page, `${s.type}-second-submitted`);
    });

    await test.step("the admin approves the new listing and it goes live", async () => {
      await approveAsAdmin(browser, s.locale, async (admin) => {
        await admin.goto(`/${s.locale}/admin/approvals`);
        const item = admin
          .getByRole("listitem")
          .filter({ hasText: s.second.title })
          .filter({ hasText: s.business.name });
        await snap(admin, `${s.type}-admin-queue`);
        await item.getByRole("button", { name: t.admin.approveListing }).click();
        // Approved listings leave the queue.
        await expect(item).toHaveCount(0);
      });
      await waitForEmails(email, "listingApproved", 1);
      await page.goto(`/${s.locale}/business/${businessId}`);
      for (const listing of [s.first, s.second]) {
        await expect(main.getByRole("listitem").filter({ hasText: listing.title })).toContainText(t.status.live);
      }
      await snap(page, `${s.type}-two-listings`);
    });

    expect(owner.errors, "uncaught errors in the page").toEqual([]);
    await owner.close();
  });
}

/** Runs `steps` in a separate browser session logged in as the seeded admin. */
async function approveAsAdmin(
  browser: Parameters<typeof openPage>[0],
  locale: Locale,
  steps: (page: Page) => Promise<void>,
) {
  const admin = await openPage(browser, locale);
  await logIn(admin.page, locale, ADMIN_EMAIL, SEEDED_PASSWORD, `/${locale}/admin/approvals`);
  await steps(admin.page);
  expect(admin.errors, "uncaught errors in the admin's page").toEqual([]);
  await admin.close();
}
