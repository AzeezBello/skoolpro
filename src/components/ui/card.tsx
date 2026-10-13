"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** `interactive` lifts on hover; `glass` is translucent for dark hero sections. */
  variant?: "default" | "interactive" | "glass" | "flat";
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  const variants = {
    default: "border border-border/70 bg-card text-card-foreground",
    interactive:
      "border border-border/70 bg-card text-card-foreground transition hover:border-foreground/40",
    glass: "border border-white/10 bg-white/5 text-white shadow-soft backdrop-blur-xl",
    flat: "border border-border bg-card/60 text-card-foreground",
  };
  return <div className={cn("rounded-xl", variants[variant], className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
