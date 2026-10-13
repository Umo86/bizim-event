"use client";

import { Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  createListingAction,
  deleteListingAction,
  setListingPausedAction,
  submitListingAction,
} from "@/server/actions/listing";

export function AddListingButton({ businessId }: { businessId: string }) {
  const t = useTranslations("businessOverview");
  const ta = useTranslations("actionErrors");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await createListingAction(businessId, locale);
          if (res && !res.ok) {
            setError(ta.has(res.error) ? ta(res.error) : ta("UNKNOWN"));
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {t("addListing")}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/** Submit / pause / resume / delete controls on the listing editor. */
export function ListingEditorActions({
  listingId,
  businessId,
  status,
  businessStatus,
  canSubmit,
  canDelete,
}: {
  listingId: string;
  businessId: string;
  status: string;
  businessStatus: string;
  canSubmit: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("listingEditor");
  const ta = useTranslations("actionErrors");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setBusy(key);
    setMessage(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) setMessage({ tone: "error", text: ta.has(res.error ?? "") ? ta(res.error!) : ta("UNKNOWN") });
    else {
      if (success) setMessage({ tone: "ok", text: success });
      router.refresh();
    }
  }

  const submittable = businessStatus === "approved" && ["draft", "changes_requested", "rejected"].includes(status);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {submittable ? (
          <Button
            type="button"
            variant="cta"
            size="sm"
            disabled={!canSubmit || busy !== null}
            onClick={() => run("submit", () => submitListingAction(listingId), t("submitted"))}
          >
            {busy === "submit" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("submitListing")}
          </Button>
        ) : null}
        {status === "approved" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("pause", () => setListingPausedAction(listingId, true))}
          >
            {t("pause")}
          </Button>
        ) : null}
        {status === "paused" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("resume", () => setListingPausedAction(listingId, false))}
          >
            {t("resume")}
          </Button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "text-danger" })}
            disabled={busy !== null}
            onClick={async () => {
              if (!window.confirm(t("deleteConfirm"))) return;
              setBusy("delete");
              const res = await deleteListingAction(listingId);
              setBusy(null);
              if (res.ok) router.push(`/business/${businessId}`);
              else setMessage({ tone: "error", text: ta.has(res.error) ? ta(res.error) : ta("UNKNOWN") });
            }}
          >
            {t("delete")}
          </button>
        ) : null}
      </div>
      {submittable && !canSubmit ? <p className="text-sm text-muted">{t("submitHint")}</p> : null}
      {status === "approved" || status === "paused" ? <p className="text-sm text-muted">{t("pauseHint")}</p> : null}
      {message ? (
        <p role="status" className={message.tone === "ok" ? "text-sm text-success" : "text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
