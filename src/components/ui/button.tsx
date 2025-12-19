"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-transparent hover:bg-secondary/40",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-secondary/50",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
