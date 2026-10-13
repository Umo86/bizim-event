import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "@/lib/env";

/** Upstash Redis (free tier): small caches, rate limits and view counters. */
let client: Redis | null | undefined;

export function redis(): Redis | null {
  if (client === undefined) {
    const e = env();
    client =
      e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN })
        : null;
  }
  return client;
}

type LimiterName = "auth" | "enquiry" | "message" | "upload";
const LIMITS: Record<LimiterName, { tokens: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  auth: { tokens: 10, window: "1 m" },
  enquiry: { tokens: 10, window: "1 h" },
  message: { tokens: 60, window: "1 m" },
  upload: { tokens: 60, window: "10 m" },
};

const limiters = new Map<LimiterName, Ratelimit>();

/** Returns { success: true } when Redis is not configured (local dev). */
export async function rateLimit(name: LimiterName, identifier: string) {
  const r = redis();
  if (!r) return { success: true, remaining: Infinity, reset: 0 };
  let limiter = limiters.get(name);
  if (!limiter) {
    const { tokens, window } = LIMITS[name];
    limiter = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(tokens, window), prefix: `rl:${name}` });
    limiters.set(name, limiter);
  }
  const { success, remaining, reset } = await limiter.limit(identifier);
  return { success, remaining, reset };
}

/** Cache-aside helper for small JSON values. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const r = redis();
  if (!r) return load();
  const hit = await r.get<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await load();
  await r.set(key, value, { ex: ttlSeconds });
  return value;
}

/** Profile-view counter, flushed to listing_stats_daily by the daily job. */
export async function incrementListingView(listingId: string, day = new Date().toISOString().slice(0, 10)) {
  const r = redis();
  if (!r) return;
  await r.hincrby(`views:${day}`, listingId, 1);
  await r.expire(`views:${day}`, 60 * 60 * 24 * 7);
}
