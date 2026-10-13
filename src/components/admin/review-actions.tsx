"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import {
  approveBusinessAction,
  approveListingAction,
  rejectBusinessAction,
  rejectListingAction,
  requestBusinessChangesAction,
  requestListingChangesAction,
} from "@/server/actions/admin";

type Mode = null | "changes" | "reject";

/** Approve / request changes / reject, for a whole business or a single listing. */
export function ReviewActions({
  target,
  businessId,
  listingId,
}: {
  target: "business" | "listing";
  businessId: string;
  listingId?: string;
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("actionErrors");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string; fields?: string[] }>) {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      const text =
        res.error === "INVALID" ? tv("note_too_short") : ta.has(res.error ?? "") ? ta(res.error!) : ta("UNKNOWN");
      setMessage({ tone: "error", text });
      return;
    }
    setMessage({ tone: "ok", text: t("done") });
    setMode(null);
    setNote("");
    router.refresh();
  }

  const approve = () =>
    run(() =>
      target === "business" ? approveBusinessAction(businessId) : approveListingAction(listingId!, businessId),
    );
  const send = () =>
    run(() =>
      mode === "changes"
        ? target === "business"
          ? requestBusinessChangesAction(businessId, note)
          : requestListingChangesAction(listingId!, businessId, note)
        : target === "business"
          ? rejectBusinessAction(businessId, note)
          : rejectListingAction(listingId!, businessId, note),
    );

  return (
    <div className="space-y-3">
      {mode === null ? (
        <>
          <Button type="button" variant="primary" className="w-full" disabled={busy} onClick={approve}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {target === "business" ? t("approve") : t("approveListing")}
          </Button>
          {target === "business" ? <p className="text-xs text-muted">{t("approveHint")}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setMode("changes")}>
              {t("requestChanges")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-danger"
              disabled={busy}
              onClick={() => setMode("reject")}
            >
              {t("reject")}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`note-${target}-${listingId ?? businessId}`} className="block text-sm font-semibold text-ink">
            {mode === "changes" ? t("requestChanges") : t("reject")}
          </label>
          <Textarea
            id={`note-${target}-${listingId ?? businessId}`}
            rows={4}
            maxLength={2000}
            value={note}
            placeholder={mode === "changes" ? t("notePlaceholder") : t("reasonPlaceholder")}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "reject" ? "cta" : "primary"}
              disabled={busy || note.trim().length < 5}
              onClick={send}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("send")}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setMode(null)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {message ? (
        <p role="status" className={message.tone === "ok" ? "text-sm text-success" : "text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
