import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local", override: false });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations use the UNPOOLED (direct) connection; the app uses the pooled one.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  // PostGIS owns these; never let drizzle-kit try to drop them.
  tablesFilter: ["!spatial_ref_sys", "!geography_columns", "!geometry_columns"],
  extensionsFilters: ["postgis"],
  strict: true,
  verbose: true,
});
