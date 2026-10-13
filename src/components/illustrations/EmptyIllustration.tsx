import { cn } from "@/lib/utils";

type Variant = "folder" | "inbox" | "chart" | "search";

/**
 * Small spot illustrations for empty states. Each is ~120px, uses the
 * current theme's muted tones and a brand accent, and carries no text.
 */
export function EmptyIllustration({ variant = "folder", className }: { variant?: Variant; className?: string }) {
  const common = cn("h-28 w-28", className);
  switch (variant) {
    case "inbox":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / 0.08)" />
          <path d="M26 54 L40 32 H80 L94 54 V82 a6 6 0 0 1 -6 6 H32 a6 6 0 0 1 -6 -6 Z" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
          <path d="M26 54 H46 l6 10 h16 l6 -10 H94" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
          <circle cx="86" cy="34" r="9" fill="hsl(var(--primary))" />
          <path d="M82 34 l3 3 l5 -6" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / 0.08)" />
          <rect x="28" y="30" width="64" height="60" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
          <rect x="38" y="62" width="10" height="18" rx="2" fill="hsl(var(--muted-foreground) / 0.35)" />
          <rect x="55" y="50" width="10" height="30" rx="2" fill="hsl(var(--primary) / 0.6)" />
          <rect x="72" y="42" width="10" height="38" rx="2" fill="hsl(var(--primary))" />
          <path d="M36 44 l14 -8 l12 6 l16 -12" stroke="hsl(var(--info))" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / 0.08)" />
          <circle cx="54" cy="54" r="22" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="3" />
          <path d="M70 70 l18 18" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round" />
          <path d="M44 54 h20 M54 44 v20" stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / 0.08)" />
          <path d="M26 42 a6 6 0 0 1 6 -6 h18 l8 8 h30 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 H32 a6 6 0 0 1 -6 -6 Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
          <path d="M26 56 h68 v28 a6 6 0 0 1 -6 6 H32 a6 6 0 0 1 -6 -6 Z" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
          <rect x="52" y="20" width="36" height="24" rx="4" fill="hsl(var(--primary))" opacity="0.9" />
          <path d="M60 32 h20 M60 26 h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
