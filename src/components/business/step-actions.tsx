"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { SaveIndicator, type SaveState } from "./autosave";

type Props = {
  state: SaveState;
  /** Saves pending changes; return false to stay on the page. */
  onBeforeLeave: () => Promise<boolean>;
  /** Validates + saves for Continue; return false to stay. */
  onContinue: () => Promise<boolean>;
  backHref?: string | null;
  nextHref?: string | null;
  nextLabel?: string;
  error?: string | null;
};

/** Sticky footer for every wizard / editor step. */
export function StepActions({ state, onBeforeLeave, onContinue, backHref, nextHref, nextLabel, error }: Props) {
  const t = useTranslations("wizard");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const go = (href: string) => startTransition(() => router.push(href));

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-10 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      {error ? (
        <p role="alert" className="mb-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {backHref ? (
          <button
            type="button"
            className={buttonVariants({ variant: "ghost" })}
            onClick={async () => {
              if (await onBeforeLeave()) go(backHref);
            }}
          >
            {t("back")}
          </button>
        ) : null}
        <SaveIndicator state={state} />
        <Button
          type="button"
          variant="cta"
          className="ml-auto"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const ok = await onContinue();
              if (ok && nextHref) go(nextHref);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {nextLabel ?? t("next")}
        </Button>
      </div>
    </div>
  );
}
