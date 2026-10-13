import type { DB } from "@/db";

export type Role = "customer" | "business" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  preferredLocale: "tr" | "en";
};

/**
 * Every DAL function receives this context. The app builds it from the request
 * (src/server/session.ts); tests build it directly with a test database and a
 * fake user, which is what lets us prove the authorisation rules.
 */
export type DalContext = {
  db: DB;
  user: SessionUser | null;
  now?: Date;
};

export const nowOf = (ctx: DalContext) => ctx.now ?? new Date();
