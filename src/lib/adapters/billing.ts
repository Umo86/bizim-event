import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { PLAN_KEYS, PLANS, planForPrice, type PlanKey } from "@/lib/plans";

/**
 * Stripe Billing: Checkout in subscription mode + the Customer Portal. No Connect —
 * booking money never passes through Bizim Event, only the £6/£60 subscription does.
 *
 * Providers:
 *  - stripe    STRIPE_SECRET_KEY set (test or live keys)
 *  - dev       local development and tests without Stripe keys: checkout and the portal
 *              are simulated by /[locale]/dev/checkout and /[locale]/dev/billing-portal,
 *              which apply the same subscription updates a webhook would. Never in production.
 *  - disabled  production without Stripe keys: the free trial runs, plans can't be bought yet
 *
 * Prices are found by lookup key (and created on first use), and the Customer Portal
 * configuration is created on first use too, so the only setup is two env vars and a
 * webhook endpoint (see README → Billing).
 */

export type Locale = "tr" | "en";

/** Stripe's subscription, reduced to what Bizim Event stores. */
export type SubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  /** From the subscription's metadata (or the checkout session that created it). */
  businessId: string | null;
  stripeStatus: string;
  cancellationReason: string | null;
  plan: PlanKey | null;
  /** End of the current period: the trial end while Stripe is "trialing". */
  currentPeriodEnd: Date | null;
  /** Set to end at the period end (or a set date) rather than renew. */
  cancelAtPeriodEnd: boolean;
};

export type CheckoutInput = {
  businessId: string;
  customerId: string;
  plan: PlanKey;
  /** The free trial's end, carried into Stripe so the first charge waits for it. */
  trialEnd: Date | null;
  locale: Locale;
  /** Where Stripe sends the owner after paying; may contain {CHECKOUT_SESSION_ID}. */
  returnUrl: string;
  /** The billing page, for providers that confirm without a round trip. */
  billingUrl: string;
  cancelUrl: string;
};

export type PortalInput = { businessId: string; customerId: string; returnUrl: string; locale: Locale };

export class BillingError extends Error {
  constructor(readonly code: "billing_disabled" | "billing_failed") {
    super(code);
  }
}

export interface BillingProvider {
  readonly name: "stripe" | "dev" | "disabled";
  readonly enabled: boolean;
  /** test / live for Stripe keys, dev for the simulator. */
  readonly mode: "test" | "live" | "dev" | null;
  createCustomer(input: { businessId: string; email: string; name: string; locale: Locale }): Promise<string>;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  createPortal(input: PortalInput): Promise<{ url: string }>;
  /** The subscription a finished checkout created, or null while it's still processing. */
  checkoutSubscription(sessionId: string): Promise<SubscriptionSnapshot | null>;
  retrieveSubscription(subscriptionId: string): Promise<SubscriptionSnapshot>;
}

/** Pure mapping, unit-tested: what we keep from a Stripe subscription. */
export function snapshotFromStripe(sub: Stripe.Subscription, fallbackBusinessId?: string | null): SubscriptionSnapshot {
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? sub.trial_end ?? null;
  return {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    businessId: sub.metadata?.businessId || fallbackBusinessId || null,
    stripeStatus: sub.status,
    cancellationReason: sub.cancellation_details?.reason ?? null,
    plan: item ? planForPrice(item.price) : null,
    currentPeriodEnd: sub.cancel_at
      ? new Date(Math.min(sub.cancel_at, periodEnd ?? sub.cancel_at) * 1000)
      : periodEnd
        ? new Date(periodEnd * 1000)
        : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at != null,
  };
}

const stripeLocale = (l: Locale) => (l === "tr" ? "tr" : "en-GB");

// ── Stripe ──────────────────────────────────────────────────────────────────

let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client === undefined) {
    const key = env().STRIPE_SECRET_KEY;
    client = key ? new Stripe(key, { appInfo: { name: "Bizim Event" }, maxNetworkRetries: 2 }) : null;
  }
  return client;
}

const PORTAL_METADATA = { app: "bizim-event", version: "1" };

class StripeProvider implements BillingProvider {
  readonly name = "stripe" as const;
  readonly enabled = true;
  readonly mode: "test" | "live";
  private prices: Promise<{ productId: string; priceIds: Record<PlanKey, string> }> | null = null;
  private portalConfig: Promise<string> | null = null;

  constructor(
    private s: Stripe,
    key: string,
  ) {
    this.mode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "test";
  }

  /** The two prices, found by lookup key and created (with their product) the first time. */
  ensurePrices() {
    this.prices ??= this.loadPrices().catch((err) => {
      this.prices = null;
      throw err;
    });
    return this.prices;
  }

  private async loadPrices() {
    const keys = PLAN_KEYS.map((k) => PLANS[k].lookupKey);
    const found = await this.s.prices.list({ lookup_keys: keys, active: true, limit: 10 });
    const byKey = new Map(found.data.map((p) => [p.lookup_key, p]));
    let productId = found.data[0]
      ? typeof found.data[0].product === "string"
        ? found.data[0].product
        : found.data[0].product.id
      : null;
    if (!productId) {
      const product = await this.s.products.create(
        {
          name: "Bizim Event business page",
          description: "Listing subscription for one business page on Bizim Event",
          metadata: { app: "bizim-event" },
        },
        { idempotencyKey: "bizim-event-product-v1" },
      );
      productId = product.id;
    }
    const priceIds = {} as Record<PlanKey, string>;
    for (const plan of PLAN_KEYS) {
      const existing = byKey.get(PLANS[plan].lookupKey);
      if (existing) {
        priceIds[plan] = existing.id;
        continue;
      }
      const created = await this.s.prices.create(
        {
          product: productId,
          currency: "gbp",
          unit_amount: PLANS[plan].amountMinor,
          recurring: { interval: PLANS[plan].interval },
          lookup_key: PLANS[plan].lookupKey,
          nickname: PLANS[plan].nameEn,
          tax_behavior: "inclusive",
          metadata: { app: "bizim-event", plan },
        },
        { idempotencyKey: `bizim-event-price-${plan}-v1` },
      );
      logger.info("billing.price_created", { plan, price: created.id });
      priceIds[plan] = created.id;
    }
    return { productId, priceIds };
  }

  /** Customer Portal settings: update card, invoices, switch monthly ↔ yearly, cancel at period end. */
  ensurePortalConfiguration() {
    this.portalConfig ??= (async () => {
      const list = await this.s.billingPortal.configurations.list({ active: true, limit: 100 });
      const existing = list.data.find(
        (c) => c.metadata?.app === PORTAL_METADATA.app && c.metadata?.version === PORTAL_METADATA.version,
      );
      if (existing) return existing.id;
      const { productId, priceIds } = await this.ensurePrices();
      const created = await this.s.billingPortal.configurations.create(
        {
          features: {
            customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: {
              enabled: true,
              mode: "at_period_end",
              cancellation_reason: {
                enabled: true,
                options: ["too_expensive", "unused", "missing_features", "switched_service", "other"],
              },
            },
            subscription_update: {
              enabled: true,
              default_allowed_updates: ["price"],
              products: [{ product: productId, prices: PLAN_KEYS.map((k) => priceIds[k]) }],
              proration_behavior: "create_prorations",
              trial_update_behavior: "continue_trial",
            },
          },
          metadata: PORTAL_METADATA,
        },
        { idempotencyKey: "bizim-event-portal-v1" },
      );
      return created.id;
    })().catch((err) => {
      this.portalConfig = null;
      throw err;
    });
    return this.portalConfig;
  }

  async createCustomer(input: { businessId: string; email: string; name: string; locale: Locale }) {
    const params = {
      email: input.email,
      name: input.name,
      preferred_locales: [stripeLocale(input.locale)],
      metadata: { businessId: input.businessId },
    };
    // Same request twice (a double click) → the same customer.
    const fingerprint = createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 16);
    const customer = await this.s.customers.create(params, {
      idempotencyKey: `bizim-event-customer-${input.businessId}-${fingerprint}`,
    });
    return customer.id;
  }

  async createCheckout(input: CheckoutInput) {
    const { priceIds } = await this.ensurePrices();
    const tax = env().STRIPE_TAX_ENABLED === "true";
    const session = await this.s.checkout.sessions.create({
      mode: "subscription",
      customer: input.customerId,
      client_reference_id: input.businessId,
      line_items: [{ price: priceIds[input.plan], quantity: 1 }],
      subscription_data: {
        metadata: { businessId: input.businessId },
        ...(input.trialEnd ? { trial_end: Math.floor(input.trialEnd.getTime() / 1000) } : {}),
      },
      metadata: { businessId: input.businessId, plan: input.plan },
      locale: stripeLocale(input.locale),
      allow_promotion_codes: true,
      automatic_tax: { enabled: tax },
      ...(tax
        ? { customer_update: { address: "auto" as const }, billing_address_collection: "required" as const }
        : {}),
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new BillingError("billing_failed");
    return { url: session.url };
  }

  async createPortal(input: PortalInput) {
    const session = await this.s.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
      locale: stripeLocale(input.locale),
      configuration: await this.ensurePortalConfiguration(),
    });
    return { url: session.url };
  }

  async checkoutSubscription(sessionId: string) {
    const session = await this.s.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.mode !== "subscription" || session.status !== "complete" || !session.subscription) return null;
    const sub =
      typeof session.subscription === "string"
        ? await this.s.subscriptions.retrieve(session.subscription)
        : session.subscription;
    return snapshotFromStripe(sub, session.client_reference_id ?? session.metadata?.businessId);
  }

  async retrieveSubscription(subscriptionId: string) {
    return snapshotFromStripe(await this.s.subscriptions.retrieve(subscriptionId));
  }
}

/** Checks the `stripe-signature` header and parses the event; throws if it doesn't match. */
export async function verifyStripeEvent(payload: string, signature: string | null, secret: string) {
  return Stripe.webhooks.constructEventAsync(payload, signature ?? "", secret);
}

// ── Dev simulator ───────────────────────────────────────────────────────────

/** Signed, short-lived tokens for the dev checkout and portal pages (local development only). */
const devSecret = () => env().BETTER_AUTH_SECRET ?? "dev-only-secret";

export function signDevToken(data: Record<string, unknown>, ttlSeconds = 60 * 60) {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString(
    "base64url",
  );
  return `${body}.${createHmac("sha256", devSecret()).update(body).digest("base64url")}`;
}

export function readDevToken<T>(token: string | null | undefined): T | null {
  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(createHmac("sha256", devSecret()).update(body).digest("base64url"));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
  return data.exp > Date.now() / 1000 ? data : null;
}

export type DevCheckoutToken = {
  businessId: string;
  customerId: string;
  plan: PlanKey;
  trialEnd: string | null;
  billingUrl: string;
  cancelUrl: string;
};
export type DevPortalToken = { businessId: string; customerId: string; returnUrl: string };

class DevProvider implements BillingProvider {
  readonly name = "dev" as const;
  readonly enabled = true;
  readonly mode = "dev" as const;
  async createCustomer(input: { businessId: string }) {
    return `dev_cus_${input.businessId}`;
  }
  async createCheckout(input: CheckoutInput) {
    const token = signDevToken({
      businessId: input.businessId,
      customerId: input.customerId,
      plan: input.plan,
      trialEnd: input.trialEnd?.toISOString() ?? null,
      billingUrl: input.billingUrl,
      cancelUrl: input.cancelUrl,
    } satisfies DevCheckoutToken);
    return { url: `/${input.locale}/dev/checkout?token=${token}` };
  }
  async createPortal(input: PortalInput) {
    const token = signDevToken({
      businessId: input.businessId,
      customerId: input.customerId,
      returnUrl: input.returnUrl,
    } satisfies DevPortalToken);
    return { url: `/${input.locale}/dev/billing-portal?token=${token}` };
  }
  async checkoutSubscription() {
    return null; // the simulator applies its result before redirecting
  }
  async retrieveSubscription(): Promise<SubscriptionSnapshot> {
    throw new BillingError("billing_disabled");
  }
}

class DisabledProvider implements BillingProvider {
  readonly name = "disabled" as const;
  readonly enabled = false;
  readonly mode = null;
  private fail(): never {
    throw new BillingError("billing_disabled");
  }
  createCustomer = async () => this.fail();
  createCheckout = async () => this.fail();
  createPortal = async () => this.fail();
  checkoutSubscription = async () => this.fail();
  retrieveSubscription = async () => this.fail();
}

let provider: BillingProvider | undefined;

export function billing(): BillingProvider {
  if (!provider) {
    const e = env();
    const s = stripe();
    if (s && e.STRIPE_SECRET_KEY) provider = new StripeProvider(s, e.STRIPE_SECRET_KEY);
    else if (e.NODE_ENV !== "production") provider = new DevProvider();
    else provider = new DisabledProvider();
  }
  return provider;
}

export function isDevBilling() {
  return billing().name === "dev";
}

/** For the admin setup check: prices exist (creating them if needed) and the portal is configured. */
export async function checkStripeSetup() {
  const p = billing();
  if (!(p instanceof StripeProvider)) return null;
  const { priceIds } = await p.ensurePrices();
  const portalConfigurationId = await p.ensurePortalConfiguration();
  return { priceIds, portalConfigurationId };
}
