import { execSync } from "node:child_process";

/**
 * Fresh test data before every run, so the seeded accounts start in known states (venue4
 * on its trial, venue8 hidden, venue2 paying…) however earlier runs left them. Only
 * @bizimevent.test data is replaced. E2E_RESEED=0 skips it.
 */
export default function globalSetup() {
  if (process.env.E2E_RESEED === "0" || process.env.E2E_BASE_URL) return;
  execSync("pnpm db:seed --reset", { stdio: "inherit" });
}
