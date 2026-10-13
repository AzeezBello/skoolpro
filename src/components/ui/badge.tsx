"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "info" | "outline";

// Tinted pills that read correctly in both themes: colour comes from the
// semantic tokens rather than fixed Tailwind shades.
export function Badge({
  className,
  variant = "default",
  children,
  dot = false,
}: {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
  /** Leading status dot. */
  dot?: boolean;
}) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    success: "bg-success/10 text-success ring-1 ring-inset ring-success/30",
    warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/30",
    danger: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/30",
    info: "bg-info/10 text-info ring-1 ring-inset ring-info/30",
    outline: "border border-border text-foreground",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", variants[variant], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
