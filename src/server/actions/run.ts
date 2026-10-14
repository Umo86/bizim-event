import "server-only";
import { unstable_rethrow } from "next/navigation";
import Stripe from "stripe";
import { ZodError } from "zod";
import { BillingError } from "@/lib/adapters/billing";
import { StorageError } from "@/lib/adapters/storage";
import { captureException } from "@/lib/logger";
import { isDalError, type DalContext } from "@/server/dal";
import { getDalContext } from "@/server/session";

/** What every server action returns to the client: data, or an i18n error code. */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; fields?: string[] };

/**
 * Runs an action body with a fresh DAL context and maps failures to error
 * codes the UI can translate (`errors.action.<code>`). Redirects pass through.
 */
export async function runAction<T>(fn: (ctx: DalContext) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const ctx = await getDalContext();
    return { ok: true, data: await fn(ctx) };
  } catch (err) {
    unstable_rethrow(err);
    if (isDalError(err)) return { ok: false, error: err.message === err.code ? err.code : err.message };
    if (err instanceof ZodError) {
      return { ok: false, error: "INVALID", fields: [...new Set(err.issues.map((i) => i.path.join(".")))] };
    }
    if (err instanceof StorageError) return { ok: false, error: err.code };
    if (err instanceof BillingError) return { ok: false, error: err.code };
    if (err instanceof Stripe.errors.StripeError) {
      captureException(err, { where: "server-action.stripe", type: err.type, code: err.code });
      return { ok: false, error: "billing_failed" };
    }
    captureException(err, { where: "server-action" });
    return { ok: false, error: "UNKNOWN" };
  }
}
