import { execSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  ADMIN_EMAIL,
  countEmails,
  linkIn,
  logIn,
  openPage,
  samplePhotos,
  SEEDED_PASSWORD,
  snap,
  ui,
  visible,
  waitForEmails,
  type Locale,
} from "./support/app";

/**
 * What else happens to a business on its way in: the admin asks for changes and the owner
 * fixes and resubmits; the admin rejects one; a customer account lists a business; an owner
 * adds a second business; the set-up wizard explains what's missing and keeps what's typed;
 * a file that isn't a photo is refused; and logging in with an email link. Seeded accounts:
 * venue13 and caterer4 are waiting for approval, venue11 pays, customer2 and customer5 are
 * customers. Other specs rely on venue1's single business and newbusiness@ being empty, so
 * this one leaves those alone.
 */

// These tests change seeded accounts, so a retry (CI) starts again from fresh test data.
test.beforeEach(() => {
  if (test.info().retry > 0 && process.env.E2E_RESEED !== "0" && !process.env.E2E_BASE_URL) {
    execSync("pnpm db:seed --reset", { stdio: "ignore" });
  }
});

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** The ids of the businesses on the owner's "My businesses" page, in order. */
async function businessIds(page: Page, locale: Locale) {
  await page.goto(`/${locale}/business`);
  const hrefs = await page
    .getByRole("main")
    .locator('a[href*="/business/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return [...new Set(hrefs.map((h) => h.match(UUID)?.[0]).filter((id): id is string => !!id))];
}

async function asAdmin(browser: Browser, locale: Locale, steps: (page: Page) => Promise<void>) {
  const admin = await openPage(browser, locale);
  await logIn(admin.page, locale, ADMIN_EMAIL, SEEDED_PASSWORD, `/${locale}/admin/approvals`);
  await steps(admin.page);
  expect(admin.errors, "uncaught errors in the admin's page").toEqual([]);
  await admin.close();
}

test("changes requested: the owner sees the note, fixes the listing, resubmits and is approved", async ({
  browser,
}) => {
  const t = ui.tr;
  const email = "venue13@bizimevent.test";
  const { page, errors, close } = await openPage(browser, "tr");
  const main = page.getByRole("main");
  await logIn(page, "tr", email, SEEDED_PASSWORD, "/tr/business");
  const [id] = await businessIds(page, "tr");
  await page.goto(`/tr/business/${id}`);
  await expect(visible(main.getByText(t.businessOverview.pendingBanner))).toBeVisible();

  const note = "Lütfen salonun en az 5 fotoğrafını ekleyin ve açıklamaya otopark bilgisini yazın.";
  const asked = await countEmails(email, "businessChangesRequested");
  await asAdmin(browser, "tr", async (admin) => {
    await admin.goto(`/tr/admin/approvals/${id}`);
    await admin.getByRole("button", { name: t.admin.requestChanges, exact: true }).click();
    await visible(admin.locator(`#note-business-${id}`)).fill(note);
    await admin.getByRole("button", { name: t.admin.send, exact: true }).click();
    await expect(visible(admin.getByText(t.admin.done))).toBeVisible();
  });
  await waitForEmails(email, "businessChangesRequested", asked + 1);

  await page.goto(`/tr/business/${id}`);
  await expect(visible(main.getByText(t.businessOverview.changesBanner))).toBeVisible();
  await expect(visible(main.getByText(note))).toBeVisible();
  await snap(page, "changes-requested");

  // Fix both: the description, and the photos (the seeded listings have none).
  await page.goto(`/tr/business/${id}/setup/info`);
  const description = visible(page.locator("#description-tr"));
  await description.fill(`${await description.inputValue()} Ücretsiz otoparkımız 120 araçlıktır.`);
  await expect(visible(page.getByText(t.wizard.saved))).toBeVisible();
  // Wait for the page to hydrate: a file chosen before React is listening would be ignored.
  await page.goto(`/tr/business/${id}/setup/photos`, { waitUntil: "networkidle" });
  await visible(page.locator("input[type=file][multiple]")).setInputFiles(await samplePhotos(page, 5, "Kristal"));
  await expect(visible(page.locator("ul li img"))).toHaveCount(5, { timeout: 120_000 });
  await page.goto(`/tr/business/${id}`);
  await main.getByRole("link", { name: t.businessOverview.makeChanges }).click();
  await page.waitForURL(/\/setup\/review$/);
  const submitted = await countEmails(ADMIN_EMAIL, "businessSubmitted");
  await page.getByRole("checkbox", { name: t.review.confirm }).check();
  await page.getByRole("button", { name: t.review.submit, exact: true }).click();
  await page.waitForURL(/submitted=1/);
  await expect(visible(main.getByText(t.businessOverview.submittedBanner))).toBeVisible();
  await waitForEmails(ADMIN_EMAIL, "businessSubmitted", submitted + 1);

  await asAdmin(browser, "tr", async (admin) => {
    await admin.goto(`/tr/admin/approvals/${id}`);
    await expect(visible(admin.getByText("120 araçlık", { exact: false })).first()).toBeVisible();
    await admin.getByRole("button", { name: t.admin.approve, exact: true }).click();
    await expect(visible(admin.getByText(t.admin.noActionNeeded))).toBeVisible();
  });
  await waitForEmails(email, "businessApproved", 1);
  await page.goto(`/tr/business/${id}`);
  await expect(main.getByRole("link", { name: t.billing.choosePlan })).toBeVisible();
  await expect(main.getByRole("listitem").first()).toContainText(t.status.live);
  expect(errors).toEqual([]);
  await close();
});

test("a rejected business sees why", async ({ browser }) => {
  const t = ui.en;
  const email = "caterer4@bizimevent.test";
  const { page, errors, close } = await openPage(browser, "en");
  await logIn(page, "en", email, SEEDED_PASSWORD, "/en/business");
  const [id] = await businessIds(page, "en");

  const reason = "We couldn't confirm this business exists. Please contact us with your registration details.";
  await asAdmin(browser, "en", async (admin) => {
    await admin.goto(`/en/admin/approvals/${id}`);
    await admin.getByRole("button", { name: ui.en.admin.reject, exact: true }).click();
    await visible(admin.locator(`#note-business-${id}`)).fill(reason);
    await admin.getByRole("button", { name: ui.en.admin.send, exact: true }).click();
    await expect(visible(admin.getByText(ui.en.admin.done))).toBeVisible();
  });
  await waitForEmails(email, "businessRejected", 1);
  await page.goto(`/en/business/${id}`);
  const main = page.getByRole("main");
  await expect(visible(main.getByText(t.businessOverview.rejectedBanner))).toBeVisible();
  await expect(visible(main.getByText(reason))).toBeVisible();
  // Rejected businesses stay hidden.
  await expect(main.getByRole("listitem").first()).not.toContainText(t.status.live);
  expect(errors).toEqual([]);
  await close();
});

test("a customer lists a business, and an owner adds a second one", async ({ browser }) => {
  for (const { email, locale, type } of [
    { email: "customer2@bizimevent.test", locale: "tr", type: "performer" },
    { email: "venue11@bizimevent.test", locale: "en", type: "caterer" },
  ] as const) {
    const t = ui[locale];
    const { page, errors, close } = await openPage(browser, locale);
    const main = page.getByRole("main");
    await logIn(page, locale, email, SEEDED_PASSWORD, `/${locale}/account`);
    const before = await businessIds(page, locale);

    if (before.length === 0) {
      // A customer starts from their account page.
      await page.goto(`/${locale}/account`);
      await main.getByRole("link", { name: t.account.listBusiness }).click();
      await page.waitForURL(`**/${locale}/list-your-business`);
      await main.getByRole("link", { name: t.businessLanding.heroCta }).first().click();
    } else {
      await main.getByRole("link", { name: t.businessList.add }).click();
    }
    await page.waitForURL(`**/${locale}/business/start`);
    await main.getByRole("button", { name: new RegExp(t.businessStart[`${type}Title`]) }).click();
    await page.waitForURL(/\/setup\/info$/);
    const name = `${type === "performer" ? "Mehter Takımı" : "Second Kitchen"} ${Date.now().toString(36).slice(-4)}`;
    await visible(page.locator(`#name-${locale}`)).fill(name);
    await expect(visible(page.getByText(t.wizard.saved))).toBeVisible();
    await snap(page, `${type}-new-business-info`);

    const after = await businessIds(page, locale);
    expect(after).toHaveLength(before.length + 1);
    await expect(visible(main.getByText(name))).toBeVisible();
    // The account page now offers "My businesses".
    await page.goto(`/${locale}/account`);
    await expect(main.getByRole("link", { name: t.account.myBusinesses })).toBeVisible();
    expect(errors).toEqual([]);
    await close();
  }
});

test("the set-up wizard says what's missing, keeps what's typed, and refuses files that aren't photos", async ({
  browser,
}) => {
  const t = ui.en;
  const { page, errors, close } = await openPage(browser, "en");
  const main = page.getByRole("main");
  await logIn(page, "en", "customer5@bizimevent.test", SEEDED_PASSWORD, "/en/account");
  await page.goto("/en/business/start");
  await main.getByRole("button", { name: new RegExp(t.businessStart.venueTitle) }).click();
  await page.waitForURL(/\/setup\/info$/);
  const base = page.url().replace(/\/setup\/info$/, "");

  // Nothing filled in: the step won't move on and says what's wrong.
  await page.getByRole("button", { name: t.wizard.next, exact: true }).click();
  await expect(visible(page.getByRole("alert")).first()).toBeVisible();
  await expect(page).toHaveURL(/\/setup\/info$/);
  await snap(page, "wizard-missing");

  // A bad email is flagged; a good one is kept after a reload.
  await visible(page.locator("#name-en")).fill("Garden Hall Test");
  await visible(page.locator("#email")).fill("not-an-email");
  await page.getByRole("button", { name: t.wizard.next, exact: true }).click();
  await expect(visible(page.getByRole("alert")).first()).toBeVisible();
  await expect(page).toHaveURL(/\/setup\/info$/);
  await visible(page.locator("#email")).fill("events@gardenhall.example");
  await expect(visible(page.getByText(t.wizard.saved))).toBeVisible();
  await page.reload();
  await expect(visible(page.locator("#name-en"))).toHaveValue("Garden Hall Test");
  await expect(visible(page.locator("#email"))).toHaveValue("events@gardenhall.example");

  // A text file dressed up as a photo is refused with a message; a real photo goes in.
  await page.goto(`${base}/setup/photos`, { waitUntil: "networkidle" });
  const input = visible(page.locator("input[type=file][multiple]"));
  await input.setInputFiles({ name: "menu.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not really a photo") });
  await expect(visible(page.getByText(/menu\.jpg/)).first()).toBeVisible();
  await expect(visible(page.locator("ul li img"))).toHaveCount(0);
  await input.setInputFiles(await samplePhotos(page, 1, "Garden"));
  await expect(visible(page.locator("ul li img"))).toHaveCount(1, { timeout: 120_000 });
  await snap(page, "wizard-photo-refused");
  expect(errors).toEqual([]);
  await close();
});

test("log in with an emailed link, sent in the language of the page", async ({ browser }) => {
  const t = ui.en;
  const email = "customer3@bizimevent.test";
  const { page, errors, close } = await openPage(browser, "en");
  const main = page.getByRole("main");
  await page.goto("/en/sign-in?next=%2Fen%2Faccount");
  // A typo gets a proper message rather than a request.
  await visible(page.locator("#email")).fill("customer3@");
  await main.getByRole("button", { name: t.auth.magicLinkButton }).click();
  await expect(main.getByRole("status")).toHaveText(t.validation.invalid_email);
  const sent = await countEmails(email, "magic");
  await visible(page.locator("#email")).fill(email);
  await main.getByRole("button", { name: t.auth.magicLinkButton }).click();
  await expect(main.getByRole("status")).toHaveText(t.auth.magicLinkSent);
  const links = await waitForEmails(email, "magic", sent + 1);
  const latest = links[links.length - 1];
  expect(latest.subject).toBe(t.email.magicSubject);
  await page.goto(linkIn(latest, "/magic-link"));
  await page.waitForURL((url) => url.pathname === "/en/account");
  await expect(visible(main.getByText(t.account.signedInAs.replace("{email}", email)))).toBeVisible();
  expect(errors).toEqual([]);
  await close();
});
