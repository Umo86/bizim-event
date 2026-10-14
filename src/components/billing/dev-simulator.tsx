"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { devPayAction, devPortalAction } from "@/server/actions/billing";

/** Dev checkout: "pay" applies what Stripe + the webhook would, then returns to billing. */
export function DevPayButton({ token }: { token: string }) {
  const t = useTranslations("devBilling");
  const ta = useTranslations("actionErrors");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        variant="cta"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await devPayAction(token);
          // On success the action redirects; we only get here on failure.
          if (res && !res.ok) setError(ta.has(res.error) ? ta(res.error) : ta("UNKNOWN"));
          setBusy(false);
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("pay")}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/** Dev portal: one button per thing Stripe's portal (or Stripe itself) can do to a subscription. */
export function DevPortalActions({ token, actions }: { token: string; actions: readonly string[] }) {
  const t = useTranslations("devBilling");
  const ta = useTranslations("actionErrors");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(action);
              setMessage(null);
              const res = await devPortalAction(token, action);
              setBusy(null);
              setMessage(
                res.ok
                  ? { ok: true, text: t("done") }
                  : { ok: false, text: ta.has(res.error) ? ta(res.error) : ta("UNKNOWN") },
              );
              router.refresh();
            }}
          >
            {busy === action ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t(`action.${action}`)}
          </Button>
        ))}
      </div>
      {message ? (
        <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
