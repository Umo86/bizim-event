import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
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

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
