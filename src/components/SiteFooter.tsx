import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950/70">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <p className="text-lg font-semibold text-white">SkoolPro</p>
            <p className="text-sm text-slate-300">
              A calmer way to run your school: analytics, attendance, invoices, payments, and messaging in one place.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Explore</p>
            <div className="flex flex-col gap-2 text-sm text-slate-300">
              <Link href="/">Home</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Contact</p>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Mail size={16} className="text-primary" />
              support@skoolpro.app
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Phone size={16} className="text-primary" />
              +234 (0) 800 000 0000
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <MapPin size={16} className="text-primary" />
              Lagos HQ (by appointment), remote-first.
            </div>
          </div>
        </div>
        <div className="mt-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} SkoolPro. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
