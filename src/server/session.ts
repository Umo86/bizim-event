import "server-only";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/db";
import type { DalContext, SessionUser } from "./dal/context";

/** Reads the current Better Auth session from request headers (dynamic). */
export async function getSessionUser(): Promise<SessionUser | null> {
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
}

/** Builds the DAL context for server components, actions and route handlers. */
export async function getDalContext(): Promise<DalContext> {
  return { db: getDb(), user: await getSessionUser() };
}
