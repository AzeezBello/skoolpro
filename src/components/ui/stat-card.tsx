import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Tone = "primary" | "info" | "warning" | "danger" | "neutral";

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Small line under the value, e.g. "14 overdue". */
  hint?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  className?: string;
};

const tones: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-secondary text-secondary-foreground",
};

/** Compact metric tile for dashboards. */
export function StatCard({ label, value, icon, hint, tone = "primary", loading = false, className }: StatCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border/70 bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <div className={cn("rounded-lg p-2", tones[tone])}>{icon}</div>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      )}
      {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
