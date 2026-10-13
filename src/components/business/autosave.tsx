"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/server/actions/run";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type SaveResult = ActionResult<{ invalid?: string[] } | unknown>;

/**
 * Debounced autosave. Every change is saved ~1s after the owner stops typing;
 * `flush()` saves immediately (used by Continue/Back). Server actions run one at
 * a time per client, so saves never overlap.
 */
export function useAutosave<T>(values: T, save: (v: T) => Promise<SaveResult>, { delay = 1000, enabled = true } = {}) {
  const [state, setState] = useState<SaveState>("idle");
  const [invalid, setInvalid] = useState<string[]>([]);
  const lastInvalid = useRef<string[]>([]);
  const lastSaved = useRef<string>(JSON.stringify(values));
  const latest = useRef(values);
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = values;
    saveRef.current = save;
  });

  /** Saves if anything changed. Resolves with whether it worked and which fields the server skipped. */
  const run = useCallback(async (): Promise<{ ok: boolean; invalid: string[]; error?: string }> => {
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    if (json === lastSaved.current) {
      setState((s) => (s === "dirty" ? "saved" : s));
      return { ok: true, invalid: lastInvalid.current };
    }
    setState("saving");
    const res = await saveRef.current(snapshot);
    if (!res.ok) {
      setState("error");
      return { ok: false, invalid: [], error: res.error };
    }
    const bad = (res.data as { invalid?: string[] } | null)?.invalid ?? [];
    setInvalid(bad);
    lastInvalid.current = bad;
    lastSaved.current = json;
    setState(bad.length ? "error" : JSON.stringify(latest.current) === json ? "saved" : "dirty");
    return { ok: true, invalid: bad };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const json = JSON.stringify(values);
    if (json === lastSaved.current) return;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [values, delay, enabled, run]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== lastSaved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return run();
  }, [run]);

  return { state, invalid, flush };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("wizard");
  if (state === "idle") return <span className="text-sm text-muted" aria-live="polite" />;
  const content = {
    dirty: <span className="text-muted">{t("unsaved")}</span>,
    saving: (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("saving")}
      </span>
    ),
    saved: (
      <span className="inline-flex items-center gap-1.5 text-success">
        <Check className="size-4" aria-hidden />
        {t("saved")}
      </span>
    ),
    error: (
      <span className="inline-flex items-center gap-1.5 text-danger">
        <AlertCircle className="size-4" aria-hidden />
        {t("saveError")}
      </span>
    ),
  }[state];
  return (
    <span className="text-sm" aria-live="polite">
      {content}
    </span>
  );
}
