/**
 * Apply SQL migrations in /drizzle.
 * Uses a direct TCP connection (DATABASE_URL_UNPOOLED on Neon), which is what
 * Neon recommends for schema changes.
 *   pnpm db:migrate
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL) before migrating.");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("✓ Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
