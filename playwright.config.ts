import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: real browser, real dev server, real local database.
 *
 *   pnpm db:migrate && pnpm db:seed   # the tests log in as the seeded admin and test businesses
 *   pnpm test:e2e                     # starts `pnpm dev` unless one is already running on :3000
 *
 * The flows share one dev server and one database, so they run one at a time.
 * E2E_BASE_URL points the tests at a server you started yourself (local only:
 * the tests create accounts). PLAYWRIGHT_CHROMIUM_EXECUTABLE uses a Chromium
 * that's already installed instead of Playwright's download.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `next dev` compiles each route on its first visit, so the first pass through the wizard is
  // slow — slower still on CI runners.
  timeout: (process.env.CI ? 10 : 6) * 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: `${baseURL}/tr`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
