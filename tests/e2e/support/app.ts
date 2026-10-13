import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Browser, type BrowserContextOptions, type Locator, type Page, devices } from "@playwright/test";
import en from "../../../messages/en.json";
import tr from "../../../messages/tr.json";

export type Locale = "tr" | "en";

/** UI copy straight from the message files, so the tests follow copy changes. */
export const ui = { tr, en } as const;

/** Seeded by `pnpm db:seed` on a local database. */
export const SEEDED_PASSWORD = "BizimEvent!2026";
export const ADMIN_EMAIL = "admin@bizimevent.test";

/** Test accounts live on the reserved .test domain; `pnpm db:seed --remove-demo` deletes them. */
export function testEmail(label: string) {
  return `e2e.${label}.${Date.now().toString(36)}@bizimevent.test`;
}

// ── Browsers ────────────────────────────────────────────────────────────────

/**
 * Next keeps recently visited pages mounted but hidden (so Back is instant), which leaves
 * hidden copies of their inputs in the DOM. CSS and text locators would match those too.
 */
export const visible = (locator: Locator) => locator.filter({ visible: true });

export const DESKTOP: BrowserContextOptions = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } };
export const PHONE: BrowserContextOptions = { ...devices["Pixel 7"] };

/**
 * Each browser gets its own client address (from TEST-NET-2, which is never routed) so
 * the login rate limits — 3 tries per address in quick succession — apply per person as
 * they do live, instead of every test sharing 127.0.0.1.
 */
let clients = Math.floor(Math.random() * 250);
const nextClientIp = () => `198.51.100.${(clients++ % 250) + 1}`;

export async function openPage(browser: Browser, locale: Locale, options: BrowserContextOptions = DESKTOP) {
  const context = await browser.newContext({ ...options, locale: locale === "tr" ? "tr-TR" : "en-GB" });
  const ip = nextClientIp();
  await context.route("**/api/auth/**", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }),
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, errors, close: () => context.close() };
}

/** Full-page screenshots for reviewing a run by eye: set E2E_SCREENSHOTS to a folder. */
let shot = 0;
export async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (!dir) return;
  shot += 1;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(dir, `${String(shot).padStart(3, "0")}-${name}.png`),
    fullPage: true,
    // Playwright's caret-hiding style makes React report a hydration mismatch.
    caret: "initial",
  });
}

// ── Email ───────────────────────────────────────────────────────────────────

/** Same file as DEV_EMAIL_OUTBOX in src/lib/adapters/email.ts (which can't be imported outside Next). */
const OUTBOX = path.join(process.cwd(), ".dev-emails", "outbox.jsonl");

type SentEmail = { at: string; to: string[]; subject: string; kind: string | null; text: string | null };

async function emailsTo(address: string) {
  const raw = await readFile(OUTBOX, "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SentEmail)
    .filter((m) => m.to.includes(address));
}

/** How many emails of this kind `address` has had so far (the outbox keeps every run's emails). */
export async function countEmails(address: string, kind: string) {
  return (await emailsTo(address)).filter((m) => m.kind === kind).length;
}

/** Waits until `address` has received at least `count` emails of this kind; returns them, oldest first. */
export async function waitForEmails(address: string, kind: string, count = 1) {
  let found: SentEmail[] = [];
  await expect
    .poll(
      async () => {
        found = (await emailsTo(address)).filter((m) => m.kind === kind);
        return found.length;
      },
      { message: `"${kind}" email to ${address}`, timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(count);
  return found;
}

export function linkIn(email: SentEmail, contains: string) {
  const link = email.text?.match(/https?:\/\/[^\s<>"'\])]+/g)?.find((u) => u.includes(contains));
  if (!link) throw new Error(`No link containing ${contains} in "${email.subject}"`);
  return link;
}

// ── Sign-in ─────────────────────────────────────────────────────────────────

/** Logs in through the form and waits to land on `next` (a path such as /tr/business). */
export async function logIn(page: Page, locale: Locale, email: string, password: string, next: string) {
  await page.goto(`/${locale}/sign-in?next=${encodeURIComponent(next)}`);
  await visible(page.locator("#email")).fill(email);
  await visible(page.locator("#password")).fill(password);
  await page.getByRole("main").getByRole("button", { name: ui[locale].auth.signInButton, exact: true }).click();
  await page.waitForURL((url) => url.pathname === next);
}

// ── Photos ──────────────────────────────────────────────────────────────────

/** Distinct JPEG photos drawn on a canvas in the page, so the repo needs no image fixtures. */
export async function samplePhotos(page: Page, count: number, label: string) {
  const dataUrls = await page.evaluate(
    async ({ count, label }) => {
      const urls: string[] = [];
      for (let i = 0; i < count; i++) {
        const canvas = new OffscreenCanvas(1600, 1067);
        const ctx = canvas.getContext("2d")!;
        const hue = (i * 53 + label.length * 29) % 360;
        const sky = ctx.createLinearGradient(0, 0, 0, 1067);
        sky.addColorStop(0, `hsl(${hue} 65% 70%)`);
        sky.addColorStop(1, `hsl(${(hue + 40) % 360} 55% 35%)`);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 1600, 1067);
        ctx.fillStyle = `hsl(${(hue + 180) % 360} 45% 30%)`;
        for (let x = 0; x < 1600; x += 140) ctx.fillRect(x, 1067 - 200 - ((x * 7 + i * 90) % 380), 110, 600);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 88px sans-serif";
        ctx.fillText(`${label} ${i + 1}`, 72, 140);
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
        urls.push(
          await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(blob);
          }),
        );
      }
      return urls;
    },
    { count, label },
  );
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return dataUrls.map((url, i) => ({
    name: `${slug}-${i + 1}.jpg`,
    mimeType: "image/jpeg",
    buffer: Buffer.from(url.slice(url.indexOf(",") + 1), "base64"),
  }));
}
