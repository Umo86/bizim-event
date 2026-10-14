/**
 * Makes an existing account an admin, so it can approve businesses (or, with --remove,
 * takes admin rights away again):
 *   pnpm db:make-admin you@example.com
 *   pnpm db:make-admin you@example.com --remove
 * The person signs up on the site and verifies their email first. The Database workflow
 * runs this as "make an account admin". Logged in the audit log.
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const remove = args.includes("--remove");
  const email = args
    .find((a) => !a.startsWith("--"))
    ?.trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Usage: pnpm db:make-admin you@example.com [--remove]");
  }
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DATABASE_URL_UNPOOLED) first.");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const { rows } = await pool.query<{ id: string; role: string; verified: boolean; businesses: number }>(
      `select u.id, u.role, u.email_verified as verified,
              (select count(*)::int from businesses b where b.owner_id = u.id) as businesses
       from "user" u where lower(u.email) = $1`,
      [email],
    );
    const user = rows[0];
    if (!user) throw new Error(`There's no account for ${email}. Sign up on the site first, then run this again.`);
    if (!remove && !user.verified) {
      throw new Error(
        `${email} hasn't verified its email address yet. Click the link in the email, then run this again.`,
      );
    }
    const role = remove ? (user.businesses > 0 ? "business" : "customer") : "admin";
    if (role === user.role) {
      console.log(`${email} is already ${role === "admin" ? "an admin" : `a ${role} account`}. Nothing changed.`);
      return;
    }
    await pool.query(`update "user" set role = $1, updated_at = now() where id = $2`, [role, user.id]);
    await pool.query(`insert into audit_log (action, entity, entity_id, diff) values ($1, 'user', $2, $3)`, [
      "user.role_changed",
      user.id,
      JSON.stringify({ from: user.role, to: role, by: "db:make-admin" }),
    ]);
    console.log(
      remove
        ? `✓ ${email} is no longer an admin.`
        : `✓ ${email} is now an admin. Log out and back in, then open /tr/admin/approvals.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
