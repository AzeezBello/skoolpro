"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "soft" | "link";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:translate-y-px",
  outline: "border border-border bg-transparent text-foreground hover:bg-secondary/60",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "text-foreground hover:bg-secondary/60",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  soft: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 hover:bg-primary/15",
  link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
