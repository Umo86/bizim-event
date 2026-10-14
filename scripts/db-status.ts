/**
 * Prints what's in a database, without changing anything: applied migrations,
 * reference data, businesses and listings by state, and how much is test data.
 *   pnpm db:status
 * Used by the Database workflow so a run's log shows the live database's state.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DATABASE_URL_UNPOOLED) first.");
  const pool = new Pool({ connectionString: url, max: 1 });
  const one = async <T extends Record<string, unknown>>(text: string) => (await pool.query<T>(text)).rows[0];
  const many = async <T extends Record<string, unknown>>(text: string) => (await pool.query<T>(text)).rows;
  try {
    const tables = await one<{ n: number }>(
      `select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'businesses'`,
    );
    if (!tables.n) {
      console.log("✗ No tables yet. Run the migrations (pnpm db:migrate, or the Database workflow).");
      return;
    }
    const migrations = await one<{ n: number }>(`select count(*)::int as n from drizzle.__drizzle_migrations`);
    const ref = await one<Record<string, number>>(`
      select (select count(*)::int from countries) as countries,
             (select count(*)::int from cities) as cities,
             (select count(*)::int from event_types) as event_types,
             (select count(*)::int from cancellation_policies where business_id is null) as policies,
             (select count(*)::int from subscription_plans) as plans`);
    const users = await one<Record<string, number>>(`
      select count(*)::int as total,
             count(*) filter (where email like '%@bizimevent.test')::int as test,
             count(*) filter (where role = 'admin')::int as admins,
             count(*) filter (where role = 'admin' and email not like '%@bizimevent.test')::int as real_admins
      from "user"`);
    const businesses = await many<{ status: string; total: number; test: number }>(`
      select b.status, count(*)::int as total, count(*) filter (where u.email like '%@bizimevent.test')::int as test
      from businesses b join "user" u on u.id = b.owner_id group by b.status order by b.status`);
    const listings = await one<Record<string, number>>(`
      select count(*)::int as total, count(*) filter (where is_public)::int as live from listings`);
    const size = await one<{ mb: string }>(
      `select round(pg_database_size(current_database()) / 1024.0 / 1024.0, 1)::text as mb`,
    );

    const inRepo = (JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] }).entries
      .length;
    console.log(`Migrations applied: ${migrations.n} of ${inRepo}`);
    if (migrations.n < inRepo) {
      console.log("  ✗ Some migrations haven't been applied: run pnpm db:migrate (the workflow's \"set up\").");
    }
    console.log(
      `Reference data: ${ref.countries} countries, ${ref.cities} cities, ${ref.event_types} event types, ${ref.policies} cancellation policies, ${ref.plans} plans`,
    );
    if (!ref.countries || !ref.event_types || !ref.policies || !ref.plans) {
      console.log("  ✗ Reference data is missing: the setup wizard needs it. Run pnpm db:seed --no-demo.");
    }
    console.log(
      `Accounts: ${users.total} (${users.test} test accounts on @bizimevent.test), admins: ${users.admins} (${users.real_admins} with a real email)`,
    );
    if (!users.real_admins) {
      console.log(
        '  ✗ No admin with a real email, so nobody can approve businesses: sign up on the site, then run pnpm db:make-admin <email> (the workflow\'s "make an account admin").',
      );
    }
    console.log(
      `Businesses: ${businesses.map((b) => `${b.status} ${b.total}${b.test ? ` (${b.test} test)` : ""}`).join(", ") || "none"}`,
    );
    console.log(`Listings: ${listings.total} (${listings.live} live)`);
    console.log(`Database size: ${size.mb} MB of the 1024 MB free plan`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
