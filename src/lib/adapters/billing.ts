import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

/**
 * Stripe Billing (Checkout in subscription mode + Customer Portal). No Connect:
 * booking money never passes through Bizim Event. Full flows land in Phase 3.
 */
let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client === undefined) {
    const key = env().STRIPE_SECRET_KEY;
    client = key ? new Stripe(key, { appInfo: { name: "Bizim Event" } }) : null;
  }
  return client;
}

export function requireStripe(): Stripe {
  const s = stripe();
  if (!s) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY (see .env.example).");
  return s;
}

export const TRIAL_DAYS = 90;
export const GRACE_DAYS = 7;
export const TRIAL_REMINDER_DAYS = [60, 83, 89] as const;
