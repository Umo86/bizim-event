import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, logIn, openPage, SEEDED_PASSWORD, snap, ui, visible } from "./support/app";

/**
 * The dummy accounts from `pnpm db:seed` work: each test business owner logs in and
 * finds their business and listings; the admin finds businesses waiting for review.
 */

for (const type of ["venue", "caterer", "performer"] as const) {
  test(`${type}1@bizimevent.test logs in and sees their ${type} business`, async ({ browser }) => {
    const t = ui.tr;
    const { page, errors, close } = await openPage(browser, "tr");
    await logIn(page, "tr", `${type}1@bizimevent.test`, SEEDED_PASSWORD, "/tr/business");

    const business = page.getByRole("main").getByRole("listitem");
    await expect(business).toHaveCount(1);
    await expect(business).toContainText(t.listingTypes[type]);
    await business.getByRole("link").click();
    await page.waitForURL(/\/tr\/business\/[0-9a-f-]+$/);

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: t.businessOverview.listingsTitle })).toBeVisible();
    await expect(main.getByRole("link", { name: t.businessOverview.edit }).first()).toBeVisible();
    await snap(page, `seeded-${type}1`);
    expect(errors).toEqual([]);
    await close();
  });
}

test("newbusiness@bizimevent.test can start a listing straight away", async ({ browser }) => {
  const t = ui.en;
  const { page, errors, close } = await openPage(browser, "en");
  await logIn(page, "en", "newbusiness@bizimevent.test", SEEDED_PASSWORD, "/en/business/start");
  for (const type of ["venue", "caterer", "performer"] as const) {
    await expect(
      page.getByRole("main").getByRole("button", { name: new RegExp(t.businessStart[`${type}Title` as const]) }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
  await close();
});

test("the admin sees test businesses waiting for approval", async ({ browser }) => {
  const t = ui.tr;
  const { page, errors, close } = await openPage(browser, "tr");
  await logIn(page, "tr", ADMIN_EMAIL, SEEDED_PASSWORD, "/tr/admin/approvals");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: t.admin.queueTitle })).toBeVisible();
  await expect(main.getByRole("link", { name: t.admin.review }).first()).toBeVisible();
  await snap(page, "seeded-admin-queue");
  expect(errors).toEqual([]);
  await close();
});

test("customer1@bizimevent.test logs in to their account", async ({ browser }) => {
  const t = ui.tr;
  const { page, errors, close } = await openPage(browser, "tr");
  await logIn(page, "tr", "customer1@bizimevent.test", SEEDED_PASSWORD, "/tr/account");
  await expect(
    visible(page.getByRole("main").getByText(t.account.signedInAs.replace("{email}", "customer1@bizimevent.test"))),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await close();
});
