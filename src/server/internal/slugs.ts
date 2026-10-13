import "server-only";
import { and, eq, like, ne, or } from "drizzle-orm";
import type { Queryable } from "@/db";
import { businesses, listings } from "@/db/schema";
import { slugify } from "@/lib/slug";

/** First free slug among base, base-2, base-3 … for businesses or listings. */
export async function uniqueSlug(db: Queryable, table: "businesses" | "listings", base: string, excludeId?: string) {
  const t = table === "businesses" ? businesses : listings;
  const clean = slugify(base, 70) || "listing";
  const rows = await db
    .select({ slug: t.slug })
    .from(t)
    .where(and(or(eq(t.slug, clean), like(t.slug, `${clean}-%`)), excludeId ? ne(t.id, excludeId) : undefined));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(clean)) return clean;
  for (let i = 2; i < 1000; i++) {
    if (!taken.has(`${clean}-${i}`)) return `${clean}-${i}`;
  }
  return `${clean}-${crypto.randomUUID().slice(0, 8)}`;
}

export function draftSlug() {
  return `draft-${crypto.randomUUID()}`;
}

export const isDraftSlug = (s: string) => s.startsWith("draft-");
