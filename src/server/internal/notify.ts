import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Queryable } from "@/db";
import { notifications, user } from "@/db/schema";

/** In-app notification row (the bell/inbox UI arrives in Phase 6; rows are kept from now). */
export async function notifyUser(db: Queryable, userId: string, kind: string, payload: Record<string, unknown>) {
  await db.insert(notifications).values({ userId, kind, payload });
}

export async function adminContacts(db: Queryable) {
  return db
    .select({ id: user.id, email: user.email, preferredLocale: user.preferredLocale })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deletedAt)));
}
