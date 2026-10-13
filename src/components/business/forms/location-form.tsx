"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/form";
import { manualLocationInput } from "@/lib/validation/business";
import { saveLocationAction } from "@/server/actions/business";
import type { SaveState } from "../autosave";
import { StepActions } from "../step-actions";
import { useStepValidation } from "../use-step-validation";

type Suggestion = { placeId: string; primary: string; secondary: string };

export function LocationForm({
  businessId,
  savedAddress,
  countryOptions,
  defaultCountry,
  backHref,
  nextHref,
}: {
  businessId: string;
  savedAddress: string | null;
  countryOptions: { iso2: string; name: string }[];
  defaultCountry: string;
  backHref: string;
  nextHref: string;
}) {
  const t = useTranslations("fields");
  const tv = useTranslations("validation");
  const ta = useTranslations("actionErrors");
  const locale = useLocale();
  const listId = useId();

  const [mode, setMode] = useState<"search" | "manual">("search");
  const [editing, setEditing] = useState(!savedAddress);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [provider, setProvider] = useState<"google" | "photon" | null>(null);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [extra, setExtra] = useState("");
  const [manual, setManual] = useState({ countryIso2: defaultCountry, city: "", addressLine: "", postalCode: "" });
  const [state, setState] = useState<SaveState>(savedAddress ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const { errors, validate } = useStepValidation(manualLocationInput);
  // One session token per search, so autocomplete + details bill as one Places session.
  const session = useMemo(() => crypto.randomUUID(), []);
  const aborter = useRef<AbortController | null>(null);

  const searching = mode === "search" && !picked && query.trim().length >= 3;
  const visible = searching ? suggestions : [];

  useEffect(() => {
    if (!searching) return;
    const handle = setTimeout(async () => {
      aborter.current?.abort();
      const ctrl = new AbortController();
      aborter.current = ctrl;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ q: query, lang: locale, session });
        const res = await fetch(`/api/places/autocomplete?${qs}`, { signal: ctrl.signal });
        const json = (await res.json()) as { suggestions?: Suggestion[]; provider?: "google" | "photon" };
        setSuggestions(json.suggestions ?? []);
        setProvider(json.provider ?? null);
        setActive(-1);
        setSearched(true);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, searching, locale, session]);

  async function save(): Promise<boolean> {
    setError(null);
    if (!editing && savedAddress) return true;
    let payload: unknown;
    if (mode === "search") {
      if (!picked) {
        setError(tv("pick_address"));
        return false;
      }
      payload = { mode: "place", placeId: picked.placeId, sessionToken: session, addressExtra: extra };
    } else {
      const m = { mode: "manual" as const, ...manual, postalCode: manual.postalCode || undefined };
      if (!validate(m)) return false;
      payload = m;
    }
    setState("saving");
    const res = await saveLocationAction(businessId, payload);
    if (!res.ok) {
      setState("error");
      setError(ta.has(res.error) ? ta(res.error) : ta("UNKNOWN"));
      return false;
    }
    setState("saved");
    return true;
  }

  function choose(s: Suggestion) {
    setPicked(s);
    setQuery(`${s.primary}${s.secondary ? `, ${s.secondary}` : ""}`);
    setSuggestions([]);
    setState("dirty");
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
      {savedAddress && !editing ? (
        <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line p-5">
          <MapPin className="mt-0.5 size-5 text-primary-strong" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted">{t("savedAddress")}</p>
            <p className="mt-1 text-ink">{savedAddress}</p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-primary-strong hover:underline"
            onClick={() => setEditing(true)}
          >
            {t("changeAddress")}
          </button>
        </div>
      ) : mode === "search" ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="address-search" className="block text-sm font-semibold text-ink">
              {t("searchAddress")}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                id="address-search"
                role="combobox"
                aria-expanded={visible.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="off"
                value={query}
                placeholder={t("searchPlaceholder")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPicked(null);
                }}
                onKeyDown={(e) => {
                  if (!visible.length) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => (a + 1) % visible.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => (a <= 0 ? visible.length - 1 : a - 1));
                  } else if (e.key === "Enter" && active >= 0) {
                    e.preventDefault();
                    choose(visible[active]);
                  } else if (e.key === "Escape") {
                    setSuggestions([]);
                  }
                }}
                className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-10 text-base text-ink focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {loading ? (
                <Loader2
                  className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted"
                  aria-hidden
                />
              ) : null}
              {visible.length > 0 ? (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-card">
                  <ul id={listId} role="listbox" className="max-h-72 overflow-auto py-1">
                    {visible.map((s, i) => (
                      <li
                        key={s.placeId}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          choose(s);
                        }}
                        className={`cursor-pointer px-4 py-2.5 ${i === active ? "bg-primary-soft" : "hover:bg-section"}`}
                      >
                        <span className="block font-medium text-ink">{s.primary}</span>
                        {s.secondary ? <span className="block text-sm text-muted">{s.secondary}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {/* Required attribution for the address data (ODbL / Google Places policy). */}
                  {provider === "photon" ? (
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noreferrer"
                      className="block border-t border-line px-4 py-1.5 text-xs text-muted hover:underline"
                    >
                      {t("osmAttribution")}
                    </a>
                  ) : provider === "google" ? (
                    <p className="border-t border-line px-4 py-1.5 text-xs text-muted">{t("googleAttribution")}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {searched && !loading && !visible.length && searching ? (
              <p className="text-sm text-muted">{t("noResults")}</p>
            ) : null}
          </div>
          {picked ? (
            <Field id="address-extra" label={t("addressExtra")} optional optionalLabel={t("optional")}>
              <Input value={extra} maxLength={120} onChange={(e) => setExtra(e.target.value)} />
            </Field>
          ) : null}
          <button
            type="button"
            className="text-sm font-semibold text-primary-strong hover:underline"
            onClick={() => setMode("manual")}
          >
            {t("manualToggle")}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <Field id="country" label={t("country")} error={errors.countryIso2}>
            <Select
              value={manual.countryIso2}
              onChange={(e) => setManual((m) => ({ ...m, countryIso2: e.target.value }))}
            >
              {countryOptions.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="address-line" label={t("addressLine")} error={errors.addressLine}>
            <Input
              autoComplete="street-address"
              value={manual.addressLine}
              onChange={(e) => setManual((m) => ({ ...m, addressLine: e.target.value }))}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="city" label={t("city")} error={errors.city}>
              <Input
                autoComplete="address-level2"
                value={manual.city}
                onChange={(e) => setManual((m) => ({ ...m, city: e.target.value }))}
              />
            </Field>
            <Field id="postal" label={t("postalCode")} optional optionalLabel={t("optional")} error={errors.postalCode}>
              <Input
                autoComplete="postal-code"
                value={manual.postalCode}
                onChange={(e) => setManual((m) => ({ ...m, postalCode: e.target.value }))}
              />
            </Field>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-primary-strong hover:underline"
            onClick={() => setMode("search")}
          >
            {t("searchToggle")}
          </button>
        </div>
      )}
      <StepActions
        state={state}
        error={error}
        backHref={backHref}
        nextHref={nextHref}
        onBeforeLeave={async () => true}
        onContinue={save}
      />
    </form>
  );
}
