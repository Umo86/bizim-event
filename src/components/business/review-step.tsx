"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import type { Check } from "@/lib/completeness";
import { submitBusinessAction } from "@/server/actions/business";
import { cn } from "@/lib/utils";

export function ReviewStep({
  businessId,
  checks,
  canSubmit,
  status,
  preview,
  backHref,
}: {
  businessId: string;
  checks: Check[];
  canSubmit: boolean;
  status: string;
  preview: React.ReactNode;
  backHref: string;
}) {
  const t = useTranslations("review");
  const tc = useTranslations("checks");
  const tw = useTranslations("wizard");
  const ta = useTranslations("actionErrors");
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const required = checks.filter((c) => c.required);
  const recommended = checks.filter((c) => !c.required);
  const submittable = ["draft", "changes_requested", "rejected"].includes(status);

  const row = (c: Check) => (
    <li key={c.key} className="flex min-h-11 items-center gap-3 border-b border-line py-2 last:border-0">
      {c.done ? (
        <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
      ) : (
        <Circle className="size-5 shrink-0 text-muted" aria-hidden />
      )}
      <span className={cn("flex-1", c.done ? "text-ink" : "text-ink")}>
        {tc(c.key)}
        <span className="sr-only"> — {c.done ? tc("done") : tc(c.required ? "required" : "recommended")}</span>
      </span>
      {!c.done ? (
        <Link
          href={`/business/${businessId}/setup/${c.step}`}
          className="text-sm font-semibold text-primary-strong hover:underline"
        >
          {tc("fix")}
        </Link>
      ) : null}
    </li>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <section>
          <h2 className="font-heading text-xl font-bold text-ink">
            {canSubmit ? t("readyTitle") : t("notReadyTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{tc("required")}</p>
          <ul className="mt-3 rounded-2xl border border-line px-4">{required.map(row)}</ul>
        </section>
        <section>
          <p className="text-sm text-muted">{tc("recommended")}</p>
          <ul className="mt-3 rounded-2xl border border-line px-4">{recommended.map(row)}</ul>
        </section>

        {status === "pending_review" ? <Notice>{t("inReview")}</Notice> : null}

        {submittable ? (
          <section className="space-y-4 rounded-2xl bg-section p-5">
            <p className="text-sm text-ink">{t("afterSubmit")}</p>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--be-primary-strong)]"
              />
              <span className="text-sm text-ink">
                {t("confirm")}{" "}
                <Link href="/legal/business-terms" className="font-semibold text-primary-strong underline">
                  {t("businessTerms")}
                </Link>
              </span>
            </label>
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
                {tw("back")}
              </Link>
              <Button
                type="button"
                variant="cta"
                className="ml-auto"
                disabled={!canSubmit || !confirmed || busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const res = await submitBusinessAction(businessId);
                  setBusy(false);
                  if (!res.ok) {
                    setError(ta.has(res.error) ? ta(res.error) : ta("UNKNOWN"));
                    return;
                  }
                  router.push(`/business/${businessId}?submitted=1`);
                }}
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy ? t("submitting") : t("submit")}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
      <aside className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">{t("previewTitle")}</h2>
        {preview}
      </aside>
    </div>
  );
}
