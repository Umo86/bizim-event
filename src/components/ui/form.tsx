"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-muted/80 focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Label + control + hint + error, wired together for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  optionalLabel,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {optional && optionalLabel ? <span className="ml-1.5 font-normal text-muted">({optionalLabel})</span> : null}
      </label>
      {React.cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled group (fieldset) for checkboxes, chips and radio cards. */
export function Group({
  legend,
  hint,
  error,
  children,
  className,
}: {
  legend: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {children}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}

/** Toggleable chips for multi-select lists (cuisines, act types, event types…). */
export function ChipGroup({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <label
            key={o.value}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-strong",
              checked
                ? "border-primary-strong bg-primary-soft text-primary-deeper"
                : "border-line bg-white text-ink hover:border-muted",
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={checked}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
              className="sr-only"
            />
            {checked ? <Check className="size-4" aria-hidden /> : null}
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/** Single-choice cards with an optional description line. */
export function RadioCards<T extends string>({
  name,
  options,
  value,
  onChange,
  columns = 2,
}: {
  name: string;
  options: { value: T; label: string; description?: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3 | 4;
}) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <div className={cn("grid gap-2", grid)}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-strong",
              checked ? "border-primary-strong bg-primary-soft" : "border-line bg-white hover:border-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="mt-1 size-4 shrink-0 accent-[var(--be-primary-strong)]"
            />
            <span>
              <span className="block font-semibold text-ink">{o.label}</span>
              {o.description ? <span className="mt-0.5 block text-sm text-muted">{o.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Checkbox row used for yes/no facts ("Halal kitchen", "Prayer room"). */
export function CheckRow({
  label,
  hint,
  checked,
  onChange,
  id,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-2 hover:bg-section"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--be-primary-strong)]"
      />
      <span>
        <span className="block text-ink">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-section text-ink",
    info: "bg-primary-soft text-primary-deeper",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-900",
    danger: "bg-red-50 text-red-800",
  } as const;
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div
        className="h-2 overflow-hidden rounded-full bg-section"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary-strong transition-[width] duration-500"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

/** Banner for status messages at the top of a page. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-primary/30 bg-primary-soft text-ink",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-950",
  } as const;
  return (
    <div role="status" className={cn("rounded-xl border p-4 text-sm leading-relaxed", tones[tone], className)}>
      {children}
    </div>
  );
}
