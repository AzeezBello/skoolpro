"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom";
  className?: string;
};

let tooltipIdCounter = 0;

// Lightweight, dependency-free tooltip: shows on hover *and* keyboard focus
// (not CSS-only :hover) so it's usable without a mouse, and is wired up via
// aria-describedby rather than a title attribute.
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const idRef = React.useRef<string>();
  if (!idRef.current) {
    tooltipIdCounter += 1;
    idRef.current = `tooltip-${tooltipIdCounter}`;
  }

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {React.cloneElement(children, { "aria-describedby": idRef.current })}
      <span
        role="tooltip"
        id={idRef.current}
        className={cn(
          "pointer-events-none absolute z-50 w-max max-w-[220px] rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 transition-opacity duration-150",
          side === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "top-full left-1/2 mt-2 -translate-x-1/2",
          open ? "opacity-100" : "opacity-0",
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}
