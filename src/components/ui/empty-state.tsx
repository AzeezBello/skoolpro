import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

// Replaces plain "No X yet" text with a consistent icon + tip + optional
// call-to-action, so a blank screen tells a new user what to do next instead
// of just confirming there's nothing there.
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-10 text-center",
        className
      )}
    >
      {icon && <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
