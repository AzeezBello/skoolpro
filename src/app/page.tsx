"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  Bus,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileQuestion,
  Globe2,
  MessageSquare,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useT } from "@/components/i18n/LocaleProvider";

const features = [
  { title: "Admissions to graduation", description: "Public application form, review and enrol in one click, class promotion and graduation at year end.", icon: ClipboardCheck },
  { title: "Results & report cards", description: "CA and exam entry, configurable grading scale, positions and class averages, publish when ready.", icon: BarChart3 },
  { title: "Fees that get paid", description: "Bulk invoicing, discounts, Paystack and Flutterwave, receipts, reminders and an arrears report.", icon: CreditCard },
  { title: "Parents in the loop", description: "A parent portal with attendance, results, invoices to pay online, announcements and messaging.", icon: Users2 },
  { title: "Timetable, homework & CBT", description: "Weekly timetable, assignments with submissions and grading, timed online multiple-choice exams.", icon: FileQuestion },
  { title: "Library, transport & hostel", description: "Book loans and fines, bus routes and stops, hostel rooms and bed allocation.", icon: Bus },
  { title: "Communication", description: "Announcements by class or role, direct messages, email and SMS reminders, in-app notifications.", icon: MessageSquare },
  { title: "Secure and multi-tenant", description: "Row-level security per school, audited actions, hashed API tokens, invite-only staff access.", icon: ShieldCheck },
];

export default function HomePage() {
  const { t } = useT();

  return (
    <div className="dark force-dark min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
        <header className="flex flex-col gap-6 rounded-3xl bg-slate-900/60 p-10 shadow-2xl ring-1 ring-white/10">
          <p className="text-sm uppercase tracking-[0.3em] text-green-400">SkoolPro</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{t("landing.tagline")}</h1>
              <p className="text-lg text-slate-300">{t("landing.sub")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-3 text-sm font-semibold text-gray-950 transition hover:bg-green-400">
                  {t("landing.cta.register")} <ArrowRight size={16} />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold transition hover:border-white/40">
                  {t("landing.cta.dashboard")}
                </Link>
                <Link href="/about" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white">
                  {t("landing.cta.about")}
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 px-6 py-5 text-sm text-slate-200 ring-1 ring-green-500/30 md:max-w-xs">
              <p className="font-semibold text-green-300">Free to start</p>
              <p className="text-slate-300">Up to 50 students and 5 teachers on the free plan. Upgrade in-app when you grow.</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {features.map(({ title, description, icon: Icon }) => (
            <div key={title} className="flex gap-4 rounded-2xl bg-slate-900/70 p-6 ring-1 ring-white/5 transition hover:-translate-y-1 hover:ring-green-400/50">
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
          <div className="col-span-2 space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">For parents</p>
            <h2 className="text-2xl font-semibold">{t("landing.applyBanner.title")}</h2>
            <p className="text-slate-300">{t("landing.applyBanner.body")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <CalendarDays className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">See every day</p>
                  <p className="text-sm text-slate-300">Attendance, timetable and homework for each child.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <BookMarked className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">Results when published</p>
                  <p className="text-sm text-slate-300">Report cards you can download the moment the school releases them.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <CreditCard className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">Pay fees online</p>
                  <p className="text-sm text-slate-300">Card, bank transfer or USSD through Paystack and Flutterwave, with instant receipts.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                <Globe2 className="mt-1 text-primary" />
                <div>
                  <p className="font-semibold">In your language</p>
                  <p className="text-sm text-slate-300">English, French, Hausa and Yorùbá, switchable from any page.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/0 p-6">
            <h3 className="text-lg font-semibold">Ready to onboard?</h3>
            <p className="text-slate-300">Create your school, import students from CSV, invite your staff, and start collecting fees the same day.</p>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
              {t("landing.cta.register")} <ArrowRight size={16} />
            </Link>
            <p className="text-xs text-muted-foreground">
              Need a hand migrating existing data? <Link href="/contact" className="underline">Talk to us</Link>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
