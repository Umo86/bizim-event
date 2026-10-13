import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import type { DB } from "@/db";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Fresh schema + all migrations on the test database. */
export async function freshTestDb(): Promise<{ db: DB; close: () => Promise<void> }> {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL not set");
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
  const db = drizzle({ client: pool, schema });
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, close: () => pool.end() };
}
