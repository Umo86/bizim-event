"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** TR | EN toggle that keeps the same page and query string. */
export function LanguageSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (next: "tr" | "en") => {
    if (next === locale) return;
    const qs = search.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next }));
  };

  return (
    <div role="group" aria-label={label} className={cn("flex rounded-lg border border-line p-0.5 text-sm", pending && "opacity-60")}>
      {(["tr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => go(l)}
          aria-pressed={locale === l}
          lang={l}
          className={cn(
            "min-h-8 rounded-md px-2.5 font-semibold uppercase",
            locale === l ? "bg-primary-strong text-white" : "text-muted hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
