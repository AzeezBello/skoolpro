"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  Bus,
  CalendarDays,
  Check,
  ClipboardCheck,
  CreditCard,
  FileQuestion,
  Globe2,
  MessageSquare,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { DashboardMockup, PhoneMockup, SchoolIllustration } from "@/components/illustrations";
import { useT } from "@/components/i18n/LocaleProvider";

const features = [
  { title: "Admissions to graduation", description: "Public application form, one-click enrolment, promotion and graduation at year end.", icon: ClipboardCheck },
  { title: "Results & report cards", description: "CA and exam entry, configurable grading, positions and averages, published when ready.", icon: BarChart3 },
  { title: "Fees that get paid", description: "Bulk invoicing, discounts, Paystack and Flutterwave, receipts, reminders and arrears.", icon: CreditCard },
  { title: "Parents in the loop", description: "Attendance, results, invoices to pay online, announcements and messaging.", icon: Users2 },
  { title: "Timetable, homework & CBT", description: "Weekly timetable, graded assignments and timed online exams.", icon: FileQuestion },
  { title: "Library, transport & hostel", description: "Book loans and fines, bus routes and stops, rooms and bed allocation.", icon: Bus },
  { title: "Communication", description: "Announcements by class or role, direct messages, email and SMS reminders.", icon: MessageSquare },
  { title: "Secure and multi-tenant", description: "Row-level security per school, audited actions, invite-only staff access.", icon: ShieldCheck },
];

const steps = [
  { n: "1", title: "Create your school", body: "Sign up, name your school and you're the first admin. Set your logo, currency and grading scale." },
  { n: "2", title: "Import students, invite staff", body: "Upload a CSV of students and classes, then send invitation links to teachers and parents." },
  { n: "3", title: "Run the term", body: "Take attendance, enter results, issue invoices and collect fees online. Publish report cards when ready." },
];

const roles = [
  { title: "Admin", body: "Everything in their school: people, academics, fees, settings and the audit log." },
  { title: "Teacher", body: "Attendance and results for their classes, homework, exams and messaging." },
  { title: "Student", body: "Own attendance, timetable, homework, published results and invoices." },
  { title: "Parent", body: "Linked children's attendance, results and invoices, paid online in a tap." },
];

const plans = [
  { name: "Free", tag: "To get started", points: ["Up to 50 students", "Up to 5 teachers", "All core modules", "Parent portal"] },
  { name: "Basic", tag: "Growing schools", points: ["Higher student limit", "More teacher seats", "Email and SMS reminders", "Priority support"] },
  { name: "Pro", tag: "Multi-campus ready", points: ["Highest limits", "Public API tokens", "Audit log exports", "Onboarding assistance"] },
];

export default function HomePage() {
  const { t } = useT();

  return (
    <MarketingLayout>
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-24 text-center md:px-8 md:pt-32">
          <h1 className="mx-auto max-w-3xl animate-fade-up text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 md:text-6xl">
            {t("landing.tagline")}
          </h1>
          <p className="mx-auto mt-8 max-w-2xl animate-fade-up text-lg leading-relaxed text-slate-500 delay-100 md:text-xl">
            {t("landing.sub")}
          </p>
          <div className="mt-10 flex animate-fade-up flex-wrap justify-center gap-4 delay-200">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              {t("landing.cta.register")} <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium text-slate-700 transition hover:text-slate-900"
            >
              {t("landing.cta.dashboard")}
            </Link>
          </div>
          <p className="mt-6 animate-fade-up text-sm text-slate-400 delay-300">Free for up to 50 students. No card required.</p>

          <div className="mt-20 animate-fade-up delay-300">
            <DashboardMockup className="mx-auto max-w-4xl" />
          </div>
        </section>

        {/* Quiet stats */}
        <section className="mx-auto max-w-5xl px-6 pb-24 md:px-8">
          <dl className="grid grid-cols-2 gap-10 border-t border-slate-100 pt-10 text-center md:grid-cols-4">
            {[
              ["4", "languages"],
              ["2", "payment gateways"],
              ["25+", "dashboard screens"],
              ["1", "workspace per school"],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="text-sm text-slate-400">{label}</dt>
                <dd className="mt-1 font-display text-3xl font-semibold text-slate-900">{n}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section id="features" className="section scroll-mt-20">
          <div className="max-w-2xl">
            <p className="eyebrow">Everything a school runs on</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">One workspace, every department</h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-500">
              Replace spreadsheets, chat threads and paper receipts with modules that already talk to each other.
            </p>
          </div>
          <ul className="mt-20 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ title, description, icon: Icon }) => (
              <li key={title}>
                <Icon size={22} className="text-primary" strokeWidth={1.75} />
                <h3 className="mt-5 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-slate-100">
          <div className="section">
            <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Live before the next term starts</h2>
                <p className="mt-5 text-lg leading-relaxed text-slate-500">
                  Most schools go from sign-up to collecting fees online in an afternoon. Need help migrating existing
                  data?{" "}
                  <Link href="/contact" className="text-slate-900 underline underline-offset-4">
                    Talk to us
                  </Link>
                  .
                </p>
                <ol className="mt-14 space-y-10">
                  {steps.map((s) => (
                    <li key={s.n} className="flex gap-6">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 font-display text-sm font-semibold text-slate-900">
                        {s.n}
                      </span>
                      <div>
                        <h3 className="font-semibold text-slate-900">{s.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <SchoolIllustration className="mx-auto max-w-lg" />
            </div>
          </div>
        </section>

        {/* Parent portal */}
        <section id="parents" className="scroll-mt-20 border-t border-slate-100">
          <div className="section">
            <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
              <div className="order-2 flex justify-center lg:order-1">
                <PhoneMockup className="animate-float-slow" />
              </div>
              <div className="order-1 lg:order-2">
                <p className="eyebrow">For parents</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{t("landing.applyBanner.title")}</h2>
                <p className="mt-5 text-lg leading-relaxed text-slate-500">{t("landing.applyBanner.body")}</p>
                <ul className="mt-12 grid gap-8 sm:grid-cols-2">
                  {[
                    { icon: CalendarDays, title: "See every day", body: "Attendance, timetable and homework for each child." },
                    { icon: BookMarked, title: "Results when published", body: "Download report cards the moment the school releases them." },
                    { icon: CreditCard, title: "Pay fees online", body: "Card, bank transfer or USSD through Paystack and Flutterwave." },
                    { icon: Globe2, title: "In your language", body: "English, French, Hausa and Yorùbá, switchable from any page." },
                  ].map(({ icon: Icon, title, body }) => (
                    <li key={title}>
                      <Icon size={20} className="text-primary" strokeWidth={1.75} />
                      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="border-t border-slate-100">
          <div className="section">
            <p className="eyebrow">Role-aware consoles</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Everyone sees exactly what they need</h2>
            <ul className="mt-16 grid gap-10 border-t border-slate-100 pt-10 sm:grid-cols-2 lg:grid-cols-4">
              {roles.map((r) => (
                <li key={r.title}>
                  <h3 className="font-semibold text-slate-900">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{r.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="scroll-mt-20 border-t border-slate-100">
          <div className="section">
            <div className="max-w-2xl">
              <p className="eyebrow">Plans</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Start free, upgrade in-app</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-500">
                The free plan covers small schools. Larger plans unlock higher limits and are paid from inside the
                dashboard with Paystack or Flutterwave.
              </p>
            </div>
            <div className="mt-16 grid gap-12 md:grid-cols-3">
              {plans.map((p) => (
                <div key={p.name} className="border-t border-slate-200 pt-8">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{p.tag}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-slate-900">{p.name}</h3>
                  <ul className="mt-8 space-y-3 text-sm text-slate-600">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-3">
                        <Check size={15} className="text-primary" /> {pt}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:text-primary">
                    {t("landing.cta.register")} <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-100">
          <div className="section text-center">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Create your school, import students, invite staff, collect fees the same day.
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                {t("landing.cta.register")} <ArrowRight size={16} />
              </Link>
              <Link href="/about" className="inline-flex items-center px-7 py-3.5 text-sm font-medium text-slate-700 hover:text-slate-900">
                {t("landing.cta.about")}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
