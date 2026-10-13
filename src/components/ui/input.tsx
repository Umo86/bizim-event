import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink placeholder:text-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
        className,
      )}
      {...props}
    />
  );
}

/** Input with a fixed prefix (currency symbol) and/or suffix (unit). Props go to the <input>. */
export function AffixInput({
  prefix,
  suffix,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: React.ReactNode; suffix?: React.ReactNode }) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>
      ) : null}
      <Input className={cn(prefix ? "pl-10" : "", suffix ? "pr-32" : "", className)} {...props} />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 max-w-28 -translate-y-1/2 truncate text-right text-sm text-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-white p-6 shadow-card", className)} {...props} />;
}
