import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/db";
import type { DalContext, SessionUser } from "./dal/context";

/**
 * Reads the current Better Auth session from request headers (dynamic).
 * Memoised per request: layouts, pages and the header all ask for the user,
 * but the session is only resolved once.
 *
 * The role comes from Better Auth's 5-minute cookie cache, so it can lag a role
 * change by a few minutes. Fine for UI decisions; `requireAdmin` re-checks the
 * database before any admin data is read or written.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Read request headers first: this marks the caller as dynamic, so prerendering
  // stops here instead of trying to reach the database at build time.
  const requestHeaders = await headers();
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const u = result.user as typeof result.user & { role?: string; preferredLocale?: string };
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: (u.role as SessionUser["role"]) ?? "customer",
    preferredLocale: u.preferredLocale === "en" ? "en" : "tr",
  };
});

/** Builds the DAL context for server components, actions and route handlers. */
export async function getDalContext(): Promise<DalContext> {
  // Session first: it reads request headers, which stops prerendering before the
  // database is touched (builds have no DATABASE_URL).
  const user = await getSessionUser();
  return { db: getDb(), user };
}

/**
 * Re-reads the session from the database and re-issues the cached session cookie. Call it from
 * a server action after changing something the cookie holds (such as the role), so pages see
 * the change straight away instead of when the 5-minute cache expires.
 */
export async function refreshSessionCache() {
  await getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
}
