import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

export { schema };

/**
 * Database client.
 * - Neon (production/preview): @neondatabase/serverless Pool on the POOLED
 *   connection string — supports transactions over WebSockets.
 * - Anything else (local Postgres, CI): node-postgres.
 * One Pool per server instance, created lazily so builds never connect.
 */
// Both drivers expose the same pg-compatible query API, so we type against node-postgres.
export type DB = NodePgDatabase<typeof schema>;
/** A transaction handle — same query API as DB. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything internal helpers can query through: the pool or an open transaction. */
export type Queryable = DB | Tx;

function createDb(url: string): DB {
  if (/neon\.tech/.test(url)) {
    const pool = new NeonPool({ connectionString: url, max: 5 });
    return drizzleNeon({ client: pool, schema }) as unknown as DB;
  }
  const pool = new PgPool({ connectionString: url, max: 5 });
  return drizzlePg({ client: pool, schema });
}

const globalForDb = globalThis as unknown as { __bizimDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__bizimDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Add Neon via the Vercel Marketplace or set it in .env.local.");
    }
    globalForDb.__bizimDb = createDb(url);
  }
  return globalForDb.__bizimDb;
}

/** For scripts and tests that need their own connection. */
export function createDbForUrl(url: string): DB {
  return createDb(url);
}
