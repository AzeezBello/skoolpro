import type { ReactNode } from "react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { SchoolIllustration } from "@/components/illustrations";

type AuthLayoutProps = {
  eyebrow: string;
  heading: string;
  blurb: string;
  /** Short lines shown under the blurb on large screens. */
  points?: string[];
  children: ReactNode;
};

/**
 * Split layout for login, register and password screens: calm copy and an
 * illustration on the left, the form on the right, plenty of air between.
 */
export function AuthLayout({ eyebrow, heading, blurb, points = [], children }: AuthLayoutProps) {
  return (
    <MarketingLayout>
      <main className="mx-auto grid max-w-5xl items-center gap-16 px-6 py-20 md:px-8 md:py-28 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-24">
        <section>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-slate-900 md:text-4xl">{heading}</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-500">{blurb}</p>
          {points.length > 0 && (
            <ul className="mt-8 space-y-2 text-sm text-slate-500">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <div className="mt-12 hidden max-w-sm lg:block">
            <SchoolIllustration />
          </div>
        </section>
        <section className="w-full">{children}</section>
      </main>
    </MarketingLayout>
  );
}
