import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * The site's own address, for links handed to Stripe (return and cancel URLs).
 * NEXT_PUBLIC_APP_URL when it's set; in production with the localhost default still in
 * place, the address this request arrived on (on Vercel only real domains get here).
 */
export async function appBaseUrl() {
  const configured = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (env().NODE_ENV !== "production" || !/\/\/(localhost|127\.0\.0\.1)/.test(configured)) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : configured;
}
