import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN_EMAIL,
  countEmails,
  logIn,
  openPage,
  SEEDED_PASSWORD,
  snap,
  ui,
  visible,
  waitForEmails,
  type Locale,
} from "./support/app";

/**
 * Subscriptions end to end, with the local billing simulator standing in for Stripe
 * (no Stripe keys in development): the pricing page, choosing a plan during the free
 * trial, cancelling and resuming, an expired business coming back, a failed payment and
 * its grace period, and the admin billing tools. Seeded accounts start in known states:
 * venue4 is on its free trial, venue8's trial has ended, venue2 pays, venue9 is on trial
 * and venue16 is hidden.
 */

// These tests change the seeded accounts' billing, so a retry (CI) starts again from fresh test data.
test.beforeEach(() => {
  if (test.info().retry > 0 && process.env.E2E_RESEED !== "0" && !process.env.E2E_BASE_URL) {
    execSync("pnpm db:seed --reset", { stdio: "ignore" });
  }
});

const prefix = (message: string) => message.split("{")[0].trim();

/** Logs in as a seeded owner and opens their (only) business; returns its id. */
async function openOwnBusiness(page: Page, locale: Locale, email: string) {
  await logIn(page, locale, email, SEEDED_PASSWORD, `/${locale}/business`);
  await page.getByRole("main").getByRole("listitem").getByRole("link").click();
  await page.waitForURL(/\/business\/[0-9a-f-]+$/);
  return page.url().split("/business/")[1];
}

/** Billing page → Manage billing → the simulated portal, then press one of its buttons. */
async function portal(page: Page, locale: Locale, action: string) {
  const t = ui[locale];
  await page.getByRole("button", { name: t.billing.manage }).click();
  await page.waitForURL(/\/dev\/billing-portal/);
  await page.getByRole("button", { name: t.devBilling.action[action as keyof typeof t.devBilling.action] }).click();
  await expect(visible(page.getByText(t.devBilling.done, { exact: true }))).toBeVisible();
  await page.getByRole("link", { name: t.devBilling.back }).click();
  await page.waitForURL(/\/billing$/);
}

test("the pricing page shows the offer in both languages", async ({ browser }) => {
  for (const locale of ["tr", "en"] as const) {
    const t = ui[locale];
    const { page, errors, close } = await openPage(browser, locale);
    await page.goto(`/${locale}/pricing`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: t.pricing.title })).toBeVisible();
    await expect(main.getByText("£6", { exact: true })).toBeVisible();
    await expect(main.getByText("£60", { exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: t.pricing.cta })).toHaveAttribute("href", `/${locale}/business/start`);
    await snap(page, `pricing-${locale}`);
    expect(errors).toEqual([]);
    await close();
  }
});

test("on the free trial: choose a plan that starts when the trial ends, cancel, then resume", async ({ browser }) => {
  const t = ui.tr;
  const email = "venue4@bizimevent.test";
  const { page, errors, close } = await openPage(browser, "tr");
  const main = page.getByRole("main");
  const id = await openOwnBusiness(page, "tr", email);

  await expect(visible(main.getByText(prefix(t.billing.bannerTrial)))).toBeVisible();
  await main.getByRole("link", { name: t.billing.choosePlan }).click();
  await page.waitForURL(`**/business/${id}/billing`);
  await expect(main.getByRole("heading", { name: t.billing.trialTitle })).toBeVisible();
  await snap(page, "billing-trial");

  const scheduledEmails = await countEmails(email, "planScheduled");
  await main.getByRole("button", { name: t.billing.chooseMonthly }).click();
  await page.waitForURL(/\/dev\/checkout\?token=/);
  await snap(page, "dev-checkout");
  await page.getByRole("button", { name: t.devBilling.pay }).click();
  await page.waitForURL(/\/billing\?checkout=success$/);
  await expect(visible(main.getByText(t.billing.checkoutSuccess))).toBeVisible();
  await expect(main.getByRole("heading", { name: /^Aylık planınız .+ tarihinde başlıyor$/ })).toBeVisible();
  await expect(main.getByRole("button", { name: t.billing.chooseMonthly })).toHaveCount(0);
  await waitForEmails(email, "planScheduled", scheduledEmails + 1);
  await snap(page, "billing-scheduled");

  const cancelEmails = await countEmails(email, "cancelScheduled");
  await portal(page, "tr", "cancel_at_period_end");
  await expect(visible(main.getByText(t.billing.endingBody))).toBeVisible();
  await waitForEmails(email, "cancelScheduled", cancelEmails + 1);

  await portal(page, "tr", "resume");
  await expect(main.getByRole("heading", { name: /^Aylık planınız .+ tarihinde başlıyor$/ })).toBeVisible();
  expect(errors).toEqual([]);
  await close();
});

test("an expired business subscribes and its listings go live again", async ({ browser }) => {
  const t = ui.en;
  const email = "venue8@bizimevent.test";
  const { page, errors, close } = await openPage(browser, "en");
  const main = page.getByRole("main");
  const id = await openOwnBusiness(page, "en", email);

  await expect(visible(main.getByText(t.billing.bannerExpired))).toBeVisible();
  await expect(main.getByRole("listitem").first()).toContainText(t.status.hidden);
  await page.goto(`/en/business/${id}/billing`);
  await expect(main.getByRole("heading", { name: t.billing.expiredTitle })).toBeVisible();
  await expect(visible(main.getByText(t.billing.expiredTrial))).toBeVisible();
  await expect(visible(main.getByText(t.billing.startsNow))).toBeVisible();
  await snap(page, "billing-expired");

  const started = await countEmails(email, "subscriptionStarted");
  await main.getByRole("button", { name: t.billing.chooseYearly }).click();
  await page.waitForURL(/\/dev\/checkout\?token=/);
  await page.getByRole("button", { name: t.devBilling.pay }).click();
  await page.waitForURL(/\/billing\?checkout=success$/);
  await expect(main.getByRole("heading", { name: "Yearly plan" })).toBeVisible();
  await waitForEmails(email, "subscriptionStarted", started + 1);

  await page.goto(`/en/business/${id}`);
  await expect(main.getByRole("listitem").first()).toContainText(t.status.live);
  await snap(page, "overview-live-again");
  expect(errors).toEqual([]);
  await close();
});

test("a failed payment keeps the business live for a 7-day grace period; paying again clears it", async ({
  browser,
}) => {
  const t = ui.tr;
  const email = "venue2@bizimevent.test";
  const { page, errors, close } = await openPage(browser, "tr");
  const main = page.getByRole("main");
  const id = await openOwnBusiness(page, "tr", email);
  await page.goto(`/tr/business/${id}/billing`);
  await expect(main.getByRole("heading", { name: /plan$/ })).toBeVisible();

  const failed = await countEmails(email, "paymentFailed");
  await portal(page, "tr", "payment_failed");
  await expect(main.getByRole("heading", { name: t.billing.pastDueTitle })).toBeVisible();
  await waitForEmails(email, "paymentFailed", failed + 1);
  await snap(page, "billing-past-due");
  await page.goto(`/tr/business/${id}`);
  await expect(visible(main.getByText(prefix(t.billing.bannerPastDue)))).toBeVisible();
  // Still live during the grace period.
  await expect(main.getByRole("listitem").first()).toContainText(t.status.live);

  const recovered = await countEmails(email, "paymentRecovered");
  await page.goto(`/tr/business/${id}/billing`);
  await portal(page, "tr", "payment_succeeded");
  await expect(main.getByRole("heading", { name: /plan$/ })).toBeVisible();
  await waitForEmails(email, "paymentRecovered", recovered + 1);
  expect(errors).toEqual([]);
  await close();
});

test("admin billing: setup, numbers, extending a trial and free access", async ({ browser }) => {
  const t = ui.tr.adminBilling;
  const { page, errors, close } = await openPage(browser, "tr");
  const main = page.getByRole("main");
  await logIn(page, "tr", ADMIN_EMAIL, SEEDED_PASSWORD, "/tr/admin/approvals");
  await page.getByRole("link", { name: ui.tr.admin.billing }).click();
  await page.waitForURL(/\/tr\/admin\/billing/);
  await expect(main.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
  await expect(visible(main.getByText(t.provider.dev))).toBeVisible();
  await expect(visible(main.getByText("/api/stripe/webhook"))).toBeVisible();
  await snap(page, "admin-billing");

  // Extend venue9's trial by 30 days.
  await main.getByRole("link", { name: t.filter.trial, exact: true }).click();
  await page.waitForURL(/filter=trial/);
  const trialRow = main.getByRole("listitem").filter({ hasText: "venue9@bizimevent.test" });
  const before = await trialRow.innerText();
  await trialRow.getByRole("button", { name: t.extend }).click();
  await expect(trialRow.getByText(t.done)).toBeVisible();
  await expect(trialRow).not.toHaveText(before);

  // Make venue16 (hidden, trial ended) free, then take it back.
  await main.getByRole("link", { name: t.filter.hidden, exact: true }).click();
  await page.waitForURL(/filter=hidden/);
  await main
    .getByRole("listitem")
    .filter({ hasText: "venue16@bizimevent.test" })
    .getByRole("button", { name: t.comp })
    .click();
  await expect(main.getByRole("listitem").filter({ hasText: "venue16@bizimevent.test" })).toHaveCount(0);
  await main.getByRole("link", { name: t.filter.comped, exact: true }).click();
  await page.waitForURL(/filter=comped/);
  const comped = main.getByRole("listitem").filter({ hasText: "venue16@bizimevent.test" });
  await expect(comped).toContainText(t.state.comped);
  await comped.getByRole("button", { name: t.uncomp }).click();
  await expect(comped).toHaveCount(0);
  expect(errors).toEqual([]);
  await close();
});
