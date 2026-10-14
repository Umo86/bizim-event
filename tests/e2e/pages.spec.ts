import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN_EMAIL, DESKTOP, logIn, openPage, PHONE, SEEDED_PASSWORD, snap, ui, type Locale } from "./support/app";

/**
 * Every page, as everyone who can see it: a visitor, a customer, business owners in each
 * state, and the admin. Each page opens in English on a desktop and in Turkish (the longer
 * language) on a phone. A page passes when it renders its own heading (or the expected
 * log-in redirect or "not found"), without errors in the browser, failed requests, or
 * sideways scrolling on the phone. Links found on the way are followed too, so a link to a
 * page that doesn't exist fails the run. All problems are listed together at the end.
 *
 * On CI pushes the crawl is shorter (Turkish on a phone only; the message files are checked
 * for matching keys by a unit test). Locally, and on CI with E2E_FULL_CRAWL=1 (the weekly and
 * manual E2E runs), every page also opens in English on a desktop.
 */

type Expect = "ok" | "sign-in" | "not-found";
type Check = { path: string; expect?: Expect };
type Viewer = { locale: Locale; device: "desktop" | "phone"; page: Page; close: () => Promise<void> };

const FULL = !process.env.CI || process.env.E2E_FULL_CRAWL === "1";

const VIEWS: { locale: Locale; device: "desktop" | "phone" }[] = FULL
  ? [
      { locale: "en", device: "desktop" },
      { locale: "tr", device: "phone" },
    ]
  : [{ locale: "tr", device: "phone" }];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

test.describe.configure({ timeout: 20 * 60_000 });

/** A 1×1 PNG standing in for the city photos, so pages don't wait on Unsplash. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Opens the two viewers for one person, logged in when `email` is given. */
async function viewers(browser: Browser, email?: string): Promise<Viewer[]> {
  const out: Viewer[] = [];
  for (const v of VIEWS) {
    const { page, close } = await openPage(browser, v.locale, v.device === "phone" ? PHONE : DESKTOP);
    await page
      .context()
      .route("https://images.unsplash.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
      );
    if (email) await logIn(page, v.locale, email, SEEDED_PASSWORD, `/${v.locale}/account`);
    out.push({ ...v, page, close });
  }
  return out;
}

/** The ids behind an owner's first business and its listings, read from their dashboard. */
async function ownerIds(page: Page, locale: Locale) {
  await page.goto(`/${locale}/business`);
  const businessHref = await page
    .getByRole("main")
    .locator('a[href*="/business/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  const businessId = businessHref.map((h) => h.match(UUID)?.[0]).find(Boolean);
  if (!businessId) throw new Error(`no business on ${page.url()}`);
  await page.goto(`/${locale}/business/${businessId}`);
  const listingHrefs = await page
    .getByRole("main")
    .locator('a[href*="/listings/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  const listingIds = [...new Set(listingHrefs.map((h) => h.split("/listings/")[1]?.match(UUID)?.[0]).filter(Boolean))];
  return { businessId, listingIds: listingIds as string[] };
}

/**
 * Pages already opened in this run, shared by the tests (they run one after another in one
 * worker), so a link that every page carries — the header and footer — is followed once.
 */
const checked = new Set<string>();

class Crawl {
  readonly problems: string[] = [];
  private links = new Set<string>();

  constructor(private who: string) {}

  /** Visits one page in every viewer and records what's wrong with it, and the links on it. */
  async visit(vs: Viewer[], check: Check) {
    checked.add(stripLocale(check.path));
    for (const v of vs) await this.visitOne(v, check, true);
  }

  private async visitOne(v: Viewer, { path, expect: want = "ok" }: Check, collectLinks = false) {
    const { page, locale } = v;
    const url = `/${locale}${path === "/" ? "" : path}`;
    const label = `${this.who} · ${locale} ${v.device} · ${url}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const badResponses: string[] = [];
    const onConsole = (m: { type(): string; text(): string }) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    };
    const onPageError = (e: Error) => pageErrors.push(e.message);
    const onResponse = (r: { status(): number; url(): string; request(): { resourceType(): string } }) => {
      const document = r.request().resourceType() === "document";
      if (r.status() >= 500 || (r.status() >= 400 && !document)) badResponses.push(`${r.status()} ${r.url()}`);
    };
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("response", onResponse);
    try {
      const res = await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(250);
      const finalPath = new URL(page.url()).pathname;
      const h1 = (await page.locator("h1").allInnerTexts()).map((s) => s.trim()).filter(Boolean);
      const notFound = h1.includes(ui[locale].errors.notFoundTitle);

      if (want === "sign-in") {
        if (finalPath !== `/${locale}/sign-in`)
          this.problems.push(`${label}: expected the log-in page, got ${finalPath}`);
      } else if (want === "not-found") {
        if (!notFound) this.problems.push(`${label}: expected "not found", got ${JSON.stringify(h1)}`);
      } else {
        if (notFound) this.problems.push(`${label}: page not found`);
        else if (h1.length === 0) this.problems.push(`${label}: no heading`);
        if (res && res.status() >= 400) this.problems.push(`${label}: HTTP ${res.status()}`);
        if (finalPath.endsWith("/sign-in") && !path.startsWith("/sign-in"))
          this.problems.push(`${label}: sent to the log-in page`);
      }
      const expected404 = want === "not-found" ? /status of 404/ : null;
      for (const e of consoleErrors) {
        if (expected404?.test(e)) continue;
        this.problems.push(`${label}: console error: ${e.slice(0, 300)}`);
      }
      for (const e of pageErrors) this.problems.push(`${label}: uncaught error: ${e.slice(0, 300)}`);
      for (const r of badResponses) this.problems.push(`${label}: request failed: ${r}`);

      if (v.device === "phone") {
        const wide = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          if (document.documentElement.scrollWidth <= width + 1) return null;
          const culprit = [...document.querySelectorAll("body *")].find((el) => {
            const r = el.getBoundingClientRect();
            return r.right > width + 1 && getComputedStyle(el).position !== "fixed";
          });
          const desc = culprit
            ? `${culprit.tagName.toLowerCase()}.${String(culprit.className).split(" ").slice(0, 4).join(".")}`
            : "?";
          return `${document.documentElement.scrollWidth}px wide (${desc})`;
        });
        if (wide) this.problems.push(`${label}: scrolls sideways: ${wide}`);
      }

      if (collectLinks && want === "ok" && !notFound) {
        const hrefs = await page
          .locator('a[href^="/"]')
          .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
        for (const h of hrefs) {
          if (h.startsWith("/api/") || h.includes("#")) continue;
          this.links.add(stripLocale(h));
        }
      }
      await snap(page, `${this.who}-${locale}-${v.device}-${path.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}`);
    } catch (err) {
      this.problems.push(`${label}: ${(err as Error).message.split("\n")[0]}`);
    } finally {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("response", onResponse);
    }
  }

  /**
   * Opens every link found on the pages visited since the last call that no check covered,
   * in the first viewer. One level deep, and only as the person whose pages they were on.
   */
  async followLinks(vs: Viewer[]) {
    const links = [...this.links].sort();
    this.links.clear();
    for (const link of links) {
      if (checked.has(link)) continue;
      checked.add(link);
      await this.visitOne(vs[0], { path: link });
    }
  }
}

/** "/tr/pricing?x=1" → "/pricing?x=1"; paths without a locale are returned as they are. */
function stripLocale(href: string) {
  const m = href.match(/^\/(tr|en)(\/.*|\?.*)?$/);
  if (!m) return href;
  const rest = m[2] ?? "/";
  return rest.startsWith("?") ? `/${rest}` : rest;
}

function report(crawl: Crawl) {
  expect(crawl.problems, crawl.problems.join("\n")).toEqual([]);
}

const PUBLIC: Check[] = [
  { path: "/" },
  { path: "/search" },
  { path: "/search?type=venue" },
  { path: "/search?type=caterer&country=GB&city=london" },
  { path: "/search?type=performer&place=Berlin" },
  { path: "/list-your-business" },
  { path: "/pricing" },
  { path: "/sign-in" },
  { path: "/sign-up" },
  { path: "/about" },
  { path: "/how-it-works" },
  { path: "/help" },
  { path: "/contact" },
  { path: "/legal/terms" },
  { path: "/legal/business-terms" },
  { path: "/legal/privacy" },
  { path: "/legal/cookies" },
  { path: "/legal/nonsense", expect: "not-found" },
  { path: "/no-such-page", expect: "not-found" },
  // Starting a business explains that you need an account first; an unknown step is simply not found.
  { path: "/business/start" },
  { path: "/business/00000000-0000-4000-8000-000000000000/setup/nonsense", expect: "not-found" },
];

test("a visitor: public pages, links, and the log-in wall", async ({ browser }) => {
  const crawl = new Crawl("visitor");
  const vs = await viewers(browser);
  for (const c of PUBLIC) await crawl.visit(vs, c);
  for (const path of ["/account", "/business", "/business/00000000-0000-4000-8000-000000000000/setup/info"]) {
    await crawl.visit(vs, { path, expect: "sign-in" });
  }
  for (const path of ["/admin/approvals", "/admin/billing"]) await crawl.visit(vs, { path, expect: "not-found" });
  await crawl.followLinks(vs);
  for (const v of vs) await v.close();
  report(crawl);
});

test("a customer: account, starting a business, and nothing that isn't theirs", async ({ browser }) => {
  const crawl = new Crawl("customer");
  const owner = await openPage(browser, "en");
  await logIn(owner.page, "en", "venue1@bizimevent.test", SEEDED_PASSWORD, "/en/account");
  const { businessId } = await ownerIds(owner.page, "en");
  await owner.close();

  const vs = await viewers(browser, "customer1@bizimevent.test");
  for (const path of ["/account", "/business", "/business/start", "/list-your-business", "/pricing"]) {
    await crawl.visit(vs, { path });
  }
  await crawl.visit(vs, { path: `/business/${businessId}`, expect: "not-found" });
  await crawl.visit(vs, { path: `/business/${businessId}/billing`, expect: "not-found" });
  await crawl.visit(vs, { path: "/admin/approvals", expect: "not-found" });
  await crawl.followLinks(vs);
  for (const v of vs) await v.close();
  report(crawl);
});

const STEPS = [
  "info",
  "location",
  "currency",
  "listing",
  "photos",
  "pricing",
  "event-types",
  "details",
  "cancellation",
  "review",
];
const SECTIONS = ["listing", "photos", "pricing", "event-types", "details", "cancellation"];

test("business owners: dashboard, set-up wizard and listing editor for a venue, a caterer and a performer", async ({
  browser,
}) => {
  const crawl = new Crawl("owner");
  for (const [email, full] of [
    ["venue1@bizimevent.test", true],
    ["caterer3@bizimevent.test", false],
    ["performer4@bizimevent.test", false],
  ] as const) {
    const vs = await viewers(browser, email);
    const { businessId, listingIds } = await ownerIds(vs[0].page, "en");
    const base = `/business/${businessId}`;
    await crawl.visit(vs, { path: "/business" });
    await crawl.visit(vs, { path: base });
    await crawl.visit(vs, { path: `${base}/billing` });
    for (const step of full ? STEPS : ["info", "review"]) await crawl.visit(vs, { path: `${base}/setup/${step}` });
    for (const section of SECTIONS) await crawl.visit(vs, { path: `${base}/listings/${listingIds[0]}/${section}` });
    if (full) {
      await crawl.visit(vs, { path: `${base}/setup/nonsense`, expect: "not-found" });
      await crawl.visit(vs, { path: `${base}/listings/${listingIds[0]}/nonsense`, expect: "not-found" });
      await crawl.followLinks(vs);
    }
    for (const v of vs) await v.close();
  }
  report(crawl);
});

test("business owners in every billing state, and a brand-new business account", async ({ browser }) => {
  const crawl = new Crawl("states");
  // venue13 waits for approval, venue8's trial has ended, venue2 pays, venue6's payment
  // is overdue and venue5 is free (see the seed's summary).
  let someoneElses = "";
  for (const email of ["venue13", "venue8", "venue2", "venue6", "venue5"]) {
    const vs = await viewers(browser, `${email}@bizimevent.test`);
    const { businessId } = await ownerIds(vs[0].page, "en");
    await crawl.visit(vs, { path: `/business/${businessId}` });
    await crawl.visit(vs, { path: `/business/${businessId}/billing` });
    if (someoneElses) await crawl.visit(vs, { path: `/business/${someoneElses}`, expect: "not-found" });
    someoneElses = businessId;
    await crawl.followLinks(vs);
    for (const v of vs) await v.close();
  }
  const fresh = await viewers(browser, "newbusiness@bizimevent.test");
  for (const path of ["/account", "/business", "/business/start"]) await crawl.visit(fresh, { path });
  for (const v of fresh) await v.close();
  report(crawl);
});

test("the admin: approvals, a business under review, billing and its filters", async ({ browser }) => {
  const crawl = new Crawl("admin");
  const vs = await viewers(browser, ADMIN_EMAIL);
  const page = vs[0].page;
  await page.goto("/en/admin/approvals");
  const reviewIds = await page
    .getByRole("main")
    .locator('a[href*="/admin/approvals/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")?.match(/[0-9a-f-]{36}/)?.[0]).filter(Boolean));
  await crawl.visit(vs, { path: "/admin/approvals" });
  if (reviewIds[0]) await crawl.visit(vs, { path: `/admin/approvals/${reviewIds[0]}` });
  await crawl.visit(vs, { path: "/admin/billing" });
  for (const filter of ["trial", "paying", "scheduled", "past_due", "hidden", "comped"]) {
    await crawl.visit(vs, { path: `/admin/billing?filter=${filter}` });
  }
  await crawl.visit(vs, { path: "/admin/billing?page=2" });
  await crawl.followLinks(vs);
  for (const v of vs) await v.close();
  report(crawl);
});

test("server endpoints answer sensibly without credentials", async ({ request }) => {
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  // No Stripe keys in development and CI: the webhook says billing isn't set up.
  expect((await request.post("/api/stripe/webhook", { data: "{}" })).status()).toBe(503);
  const ret = await request.get("/api/billing/return?business=../../x&locale=en", { maxRedirects: 0 });
  expect(ret.status()).toBeGreaterThanOrEqual(300);
  expect(ret.headers().location).toBe("/en/business");
});
