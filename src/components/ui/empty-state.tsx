import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyIllustration } from "@/components/illustrations/EmptyIllustration";

type EmptyStateProps = {
  icon?: ReactNode;
  /** Spot illustration shown when no icon is given. Defaults to "folder". */
  illustration?: "folder" | "inbox" | "chart" | "search" | "none";
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

// Replaces plain "No X yet" text with an illustration + tip + optional
// call-to-action, so a blank screen tells a new user what to do next instead
// of just confirming there's nothing there.
export function EmptyState({ icon, illustration = "folder", title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      ) : illustration !== "none" ? (
        <EmptyIllustration variant={illustration} className="h-24 w-24" />
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
