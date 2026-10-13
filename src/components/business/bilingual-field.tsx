"use client";

import { Languages, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/form";
import { translateAction } from "@/server/actions/listing";

type Lang = "tr" | "en";

type Props = {
  id: string;
  label: string;
  hint?: string;
  valueTr: string;
  valueEn: string;
  onChange: (lang: Lang, value: string) => void;
  multiline?: boolean;
  maxLength?: number;
  error?: string | null;
  translateEnabled: boolean;
  placeholder?: string;
};

/**
 * Turkish + English versions of one field, side by side. At least one is
 * enough; "Translate" drafts the empty side for the owner to check.
 */
export function BilingualField({
  id,
  label,
  hint,
  valueTr,
  valueEn,
  onChange,
  multiline,
  maxLength,
  error,
  translateEnabled,
  placeholder,
}: Props) {
  const t = useTranslations("fields");
  const [busy, setBusy] = useState<Lang | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const values = { tr: valueTr, en: valueEn };
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  async function translate(to: Lang) {
    const from: Lang = to === "tr" ? "en" : "tr";
    setBusy(to);
    const res = await translateAction(values[from], from, to);
    setBusy(null);
    if (res.ok && res.data.text) {
      onChange(to, res.data.text);
      setNote(t("translateReview"));
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">{label}</legend>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(["tr", "en"] as const).map((lang) => {
          const other = lang === "tr" ? "en" : "tr";
          const fieldId = `${id}-${lang}`;
          const common = {
            id: fieldId,
            value: values[lang],
            lang,
            maxLength,
            placeholder,
            "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
            "aria-invalid": error ? true : undefined,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(lang, e.target.value),
          };
          return (
            <div key={lang} className="space-y-1.5">
              <label htmlFor={fieldId} className="text-xs font-semibold text-muted">
                {lang === "tr" ? t("turkish") : t("english")}
              </label>
              {multiline ? <Textarea rows={6} {...common} /> : <Input {...common} />}
              {translateEnabled && !values[lang].trim() && values[other].trim() ? (
                <button
                  type="button"
                  onClick={() => translate(lang)}
                  disabled={busy !== null}
                  className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary-strong hover:underline disabled:opacity-60"
                >
                  {busy === lang ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Languages className="size-4" aria-hidden />
                  )}
                  {busy === lang
                    ? t("translating")
                    : t("translate", { lang: lang === "tr" ? t("turkish") : t("english") })}
                </button>
              ) : null}
              {maxLength && multiline ? (
                <p className="text-right text-xs text-muted">
                  {values[lang].length} / {maxLength}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
