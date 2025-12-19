"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "outline";

export function Badge({ className, variant = "default", children }: { className?: string; variant?: BadgeVariant; children: React.ReactNode }) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    success: "bg-green-500/20 text-green-200 ring-1 ring-green-400/40",
    warning: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40",
    outline: "border border-border text-foreground",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}
