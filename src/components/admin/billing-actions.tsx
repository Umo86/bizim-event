"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { checkStripeAction, extendTrialAction, setCompedAction } from "@/server/actions/billing";

const EXTEND_OPTIONS = [7, 14, 30, 90] as const;

/** Per-business admin levers: extend the free trial, make free, end free access. */
export function SubscriptionActions({
  businessId,
  canExtendTrial,
  canComp,
  canUncomp,
}: {
  businessId: string;
  canExtendTrial: boolean;
  canComp: boolean;
  canUncomp: boolean;
}) {
  const t = useTranslations("adminBilling");
  const ta = useTranslations("actionErrors");
  const router = useRouter();
  const [days, setDays] = useState<number>(30);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setMessage(null);
    const res = await fn();
    setBusy(null);
    setMessage(
      res.ok
        ? { ok: true, text: t("done") }
        : { ok: false, text: ta.has(res.error ?? "") ? ta(res.error!) : ta("UNKNOWN") },
    );
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canExtendTrial ? (
        <div className="flex items-center gap-1">
          <label htmlFor={`extend-${businessId}`} className="sr-only">
            {t("extend")}
          </label>
          <select
            id={`extend-${businessId}`}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
          >
            {EXTEND_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {t("extendDays", { days: d })}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("extend", () => extendTrialAction(businessId, days))}
          >
            {busy === "extend" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("extend")}
          </Button>
        </div>
      ) : null}
      {canComp ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => run("comp", () => setCompedAction(businessId, true))}
        >
          {busy === "comp" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("comp")}
        </Button>
      ) : null}
      {canUncomp ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => run("uncomp", () => setCompedAction(businessId, false))}
        >
          {busy === "uncomp" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("uncomp")}
        </Button>
      ) : null}
      {message ? (
        <p role="status" className={message.ok ? "w-full text-sm text-success" : "w-full text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

/** Proves the Stripe keys work: finds (or creates) the two prices. */
export function CheckStripeButton() {
  const t = useTranslations("adminBilling");
  const ta = useTranslations("actionErrors");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const res = await checkStripeAction();
          setBusy(false);
          setMessage(
            res.ok
              ? { ok: true, text: t("checkOk") }
              : { ok: false, text: ta.has(res.error) ? ta(res.error) : ta("UNKNOWN") },
          );
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("checkStripe")}
      </Button>
      {message ? (
        <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
