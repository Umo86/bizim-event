import { revalidateTag } from "next/cache";
import { after, connection } from "next/server";
import { getDb } from "@/db";
import { billing, verifyStripeEvent } from "@/lib/adapters/billing";
import { env } from "@/lib/env";
import { captureException, logger } from "@/lib/logger";
import { deliverBillingNotice, handleStripeEvent } from "@/server/internal/billing";

export const maxDuration = 30;

/**
 * Stripe → Bizim Event. Register this URL in Stripe (Developers → Webhooks) with the events
 * in STRIPE_WEBHOOK_EVENTS and put the endpoint's signing secret in STRIPE_WEBHOOK_SECRET.
 * Unsigned or mis-signed requests are refused; each event is applied once.
 */
export async function POST(req: Request) {
  await connection();
  const provider = billing();
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (provider.name !== "stripe" || !secret) {
    return Response.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const payload = await req.text();
  let event;
  try {
    event = await verifyStripeEvent(payload, req.headers.get("stripe-signature"), secret);
  } catch {
    logger.warn("stripe.webhook_bad_signature");
    return Response.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    const db = getDb();
    const outcome = await handleStripeEvent(db, event, (id) => provider.retrieveSubscription(id));
    logger.info("stripe.webhook", { id: event.id, type: event.type, status: outcome.status });
    if (outcome.status === "processed" && outcome.result) {
      revalidateTag("listings", "max");
      const result = outcome.result;
      after(() => deliverBillingNotice(db, result));
    }
    return Response.json({ received: true, status: outcome.status });
  } catch (err) {
    // 500 → Stripe retries with backoff; nothing was recorded, so the retry starts clean.
    captureException(err, { where: "stripe.webhook", event: event.id, type: event.type });
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
}
