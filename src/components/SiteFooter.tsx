import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#parents", label: "Parent portal" },
      { href: "/#plans", label: "Plans" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Register a school" },
    ],
  },
  {
    title: "Contact",
    links: [
      { href: "mailto:support@skoolpro.app", label: "support@skoolpro.app" },
      { href: "tel:+2348000000000", label: "+234 (0) 800 000 0000" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-20 md:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-5">
            <Logo size={28} />
            <p className="max-w-xs text-sm leading-relaxed text-slate-500">
              School management for Nigerian and African schools. Admissions, attendance, results, fees and parent
              communication in one calm workspace.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-slate-900">{col.title}</p>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-slate-500 hover:text-slate-900">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-slate-100 pt-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SkoolPro. All rights reserved.</p>
          <p>English · Français · Hausa · Yorùbá</p>
        </div>
      </div>
    </footer>
  );
}
