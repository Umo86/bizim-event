import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 min-h-11",
  {
    variants: {
      variant: {
        cta: "bg-cta-strong text-white hover:bg-cta-deeper",
        primary: "bg-primary-strong text-white hover:bg-primary-deeper",
        outline: "border border-line bg-white text-ink hover:bg-section",
        ghost: "text-ink hover:bg-section",
        link: "text-primary-strong underline-offset-4 hover:underline min-h-0",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/**
 * Button classes, merged with tailwind-merge so extra classes win cleanly:
 * `buttonVariants({ variant: "cta", className: "hidden sm:inline-flex" })` really hides
 * the button on phones (plain string concatenation left the base `inline-flex` fighting
 * `hidden`, and whichever came later in the stylesheet won).
 */
export function buttonVariants({ className, ...props }: VariantProps<typeof variants> & { className?: string } = {}) {
  return cn(variants(props), className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
