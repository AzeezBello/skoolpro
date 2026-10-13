"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

const links = [
  { href: "/#features", label: "Product" },
  { href: "/#parents", label: "Parents" },
  { href: "/#plans", label: "Plans" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href.includes("#") ? false : pathname === href);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 md:px-8">
        <Link href="/" className="text-slate-900 hover:text-slate-900" aria-label="SkoolPro home">
          <Logo size={28} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm text-slate-500 transition hover:text-slate-900",
                isActive(link.href) && "text-slate-900"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden text-slate-500 sm:block">
            <LanguageSwitcher compact />
          </div>
          <Link href="/login" className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 md:inline-flex">
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white px-6 py-6 md:hidden">
          <nav className="flex flex-col gap-4" aria-label="Mobile">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-base text-slate-700 hover:text-slate-900">
                {link.label}
              </Link>
            ))}
            <Link href="/login" className="text-base text-slate-700 hover:text-slate-900">
              Log in
            </Link>
          </nav>
          <div className="mt-6 border-t border-slate-100 pt-4 text-slate-600">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </header>
  );
}
