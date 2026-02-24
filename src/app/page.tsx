import Link from "next/link";
import { ArrowRight, BarChart3, CreditCard, ShieldCheck, Users2, ClipboardList, Bell, Download } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const features = [
  {
    title: "Unified dashboard",
    description: "Track students, teachers, classes, attendance, and grades from one control room.",
    icon: BarChart3,
  },
  {
    title: "Invoices that collect",
    description: "Generate receipts, accept Paystack/Flutterwave, and send payment reminders automatically.",
    icon: CreditCard,
  },
  {
    title: "Secure by default",
    description: "Supabase auth, role-aware access, and webhook signatures keep data locked down.",
    icon: ShieldCheck,
  },
  {
    title: "Human-friendly",
    description: "Parent emails, receipts, and exports are all formatted for clarity and speed.",
    icon: Users2,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
        <header className="flex flex-col gap-6 rounded-3xl bg-slate-900/60 p-10 shadow-2xl ring-1 ring-white/10">
          <p className="text-sm uppercase tracking-[0.3em] text-green-400">SkoolPro SaaS</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                Run your school like a modern SaaS — without wrangling spreadsheets.
              </h1>
              <p className="text-lg text-slate-300">
                SkoolPro bundles admissions, attendance, billing, and communications so your team can
                focus on students, not tooling.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-3 text-sm font-semibold text-gray-950 transition hover:bg-green-400"
                >
                  Launch dashboard <ArrowRight size={16} />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold transition hover:border-white/40"
                >
                  Create an account
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition hover:text-white hover:border-white/30"
                >
                  Meet the product
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 px-6 py-5 text-sm text-slate-200 ring-1 ring-green-500/30 md:max-w-xs">
              <p className="font-semibold text-green-300">Live metrics</p>
              <p className="text-slate-300">Invoices, attendance, and grades stream into one analytics view.</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {features.map(({ title, description, icon: Icon }) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl bg-slate-900/70 p-6 ring-1 ring-white/5 transition hover:-translate-y-1 hover:ring-green-400/50"
            >
              <div className="mt-1 rounded-xl bg-green-500/15 p-3 text-green-300 ring-1 ring-green-500/30">
                <Icon />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-slate-300">{description}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 rounded-3xl bg-slate-950/70 p-8 ring-1 ring-white/10 md:grid-cols-3">
          <div className="col-span-2 space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Operations suite</p>
            <h2 className="text-2xl font-semibold">Workflows that replace spreadsheets</h2>
            <p className="text-slate-300">
              Generate invoices with receipts, export attendance to PDF/Excel, and send reminders without jumping between apps.
              SkoolPro ships with Nigerian-friendly payments and real-time Supabase data.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <ClipboardList className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">Bulk actions</p>
                  <p className="text-sm text-slate-300">Upload classes, fees, and students; auto-generate invoice references.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <Bell className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">Automated nudges</p>
                  <p className="text-sm text-slate-300">Reminder emails via Resend keep parents updated on balances.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <CreditCard className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">Local payments</p>
                  <p className="text-sm text-slate-300">Paystack and Flutterwave integrations with verified webhooks.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <Download className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">Exports & receipts</p>
                  <p className="text-sm text-slate-300">PDF receipts and Excel reports that are parent-ready.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/0 p-6">
            <h3 className="text-lg font-semibold">Ready to onboard?</h3>
            <p className="text-slate-300">We’ll help you import current term data and invite your team.</p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Talk to us <ArrowRight size={16} />
            </Link>
            <p className="text-xs text-muted-foreground">
              You can also start solo with a free admin account and add staff later.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
