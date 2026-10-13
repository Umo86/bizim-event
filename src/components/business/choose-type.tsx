"use client";

import { Loader2, Music2, PartyPopper, UtensilsCrossed } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ListingType } from "@/lib/listing-config";
import { createBusinessAction } from "@/server/actions/business";

const TYPES: { type: ListingType; Icon: typeof PartyPopper }[] = [
  { type: "venue", Icon: PartyPopper },
  { type: "caterer", Icon: UtensilsCrossed },
  { type: "performer", Icon: Music2 },
];

/** Step 0: pick what to list. Creates the draft and moves into the wizard. */
export function ChooseType() {
  const t = useTranslations("businessStart");
  const ta = useTranslations("actionErrors");
  const locale = useLocale();
  const [busy, setBusy] = useState<ListingType | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {TYPES.map(({ type, Icon }) => (
          <button
            key={type}
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(type);
              setError(null);
              const res = await createBusinessAction(type, locale);
              // On success the action redirects; we only get here on failure.
              if (res && !res.ok) {
                setError(ta.has(res.error) ? ta(res.error) : ta("UNKNOWN"));
                setBusy(null);
              }
            }}
            className={cn(
              "flex flex-col items-start gap-3 rounded-2xl border border-line bg-white p-6 text-left shadow-card transition-colors hover:border-primary-strong focus-visible:border-primary-strong disabled:opacity-70",
              busy === type && "border-primary-strong",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-deeper">
              {busy === type ? (
                <Loader2 className="size-6 animate-spin" aria-hidden />
              ) : (
                <Icon className="size-6" aria-hidden />
              )}
            </span>
            <span className="font-heading text-xl font-bold text-ink">{t(`${type}Title`)}</span>
            <span className="text-sm text-muted">{t(`${type}Body`)}</span>
            <span className="mt-auto pt-2 text-sm font-semibold text-primary-strong">
              {busy === type ? t("creating") : t("choose")}
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
