"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type LogoMarkProps = { size?: number; className?: string };

// Graduation-cap monogram on a brand gradient. Gradient ids are generated
// per instance so several logos on one page never collide.
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  const id = useId();
  const gradientId = `skoolpro-logo-${id.replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="SkoolPro"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.55" stopColor="#10b981" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <path d="M32 17 L52 26.5 L32 36 L12 26.5 Z" fill="#fff" />
      <path d="M21 31.5 V40 c0 3.4 5 6 11 6 s11-2.6 11-6 V31.5 L32 36.7 Z" fill="#fff" fillOpacity="0.82" />
      <path d="M52 26.5 V38" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="52" cy="40.5" r="2.4" fill="#fff" />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  className?: string;
  /** Hide the word mark and show only the icon. */
  iconOnly?: boolean;
  /** Small caption under the word mark, e.g. "Admin Console". */
  caption?: string;
};

export function Logo({ size = 32, className, iconOnly = false, caption }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {!iconOnly && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-tight">
            Skool<span className="text-primary">Pro</span>
          </span>
          {caption && <span className="mt-1 text-[11px] font-medium text-muted-foreground">{caption}</span>}
        </span>
      )}
    </span>
  );
}
