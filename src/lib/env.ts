import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Every provider is optional so the app boots with
 * stubs locally; adapters check `isConfigured` and fall back gracefully.
 * Never import this file from a Client Component.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Neon (set automatically by the Vercel Marketplace integration)
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Bizim Event <hello@bizimevent.co.uk>"),
  // Shown on the contact page (read at build time; see src/server/contact.ts)
  CONTACT_EMAIL: z.string().email().optional(),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Pusher
  PUSHER_APP_ID: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().default("eu"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Stripe Billing
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_TAX_ENABLED: z.enum(["true", "false"]).default("false"),

  // Google Places
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_PLACES_KEY: z.string().optional(),

  // Unsplash
  UNSPLASH_ACCESS_KEY: z.string().optional(),

  // Cloudflare Turnstile
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // SMS (paid — off by default)
  SMS_ENABLED: z.enum(["true", "false"]).default("false"),
  INFOBIP_BASE_URL: z.string().optional(),
  INFOBIP_API_KEY: z.string().optional(),
  INFOBIP_SENDER: z.string().optional(),

  // AI translation (optional)
  TRANSLATE_PROVIDER: z.enum(["none", "anthropic"]).default("none"),
  ANTHROPIC_API_KEY: z.string().optional(),
  TRANSLATE_MODEL: z.string().default("claude-haiku-5-5"),

  // Vercel Cron
  CRON_SECRET: z.string().optional(),

  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${String(key)}. See .env.example.`);
  }
  return value as NonNullable<Env[K]>;
}
