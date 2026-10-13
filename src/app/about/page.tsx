import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { SchoolIllustration } from "@/components/illustrations";

export const metadata = { title: "About" };

const pillars = [
  { title: "Student success", description: "Attendance, grades, homework and messaging stay in one profile so you always know how a learner is doing." },
  { title: "Financial clarity", description: "Invoices, receipts and Paystack/Flutterwave payments reconcile instantly. No more chasing reference IDs." },
  { title: "Operational visibility", description: "Exports, charts and role-aware dashboards give leadership a real-time pulse on the whole school." },
  { title: "Secure by default", description: "Row-level security per school, signed webhooks, hashed API tokens and an audit trail for sensitive actions." },
];

const principles = [
  { title: "Local first", body: "Naira by default, Paystack and Flutterwave, Termii SMS, and interfaces in English, French, Hausa and Yorùbá." },
  { title: "Works on any phone", body: "Installable as a PWA so parents and teachers get an app-like experience without an app store." },
  { title: "Your data stays yours", body: "Every query is scoped to your school. Platform operators can only act through audited, explicit tooling." },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="section">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="eyebrow">About SkoolPro</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
                Built for schools that need clarity, not chaos.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-500">
                SkoolPro replaces brittle spreadsheets and scattered apps with a single workspace for admissions,
                attendance, results, fees and communication. It ships with the rails a Nigerian or African school needs
                on day one.
              </p>
            </div>
            <SchoolIllustration className="mx-auto max-w-md" />
          </div>
        </section>

        <section className="border-t border-slate-100">
          <div className="section">
            <ul className="grid gap-x-16 gap-y-14 md:grid-cols-2">
              {pillars.map((p) => (
                <li key={p.title}>
                  <h2 className="text-lg font-semibold text-slate-900">{p.title}</h2>
                  <p className="mt-3 leading-relaxed text-slate-500">{p.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-slate-100">
          <div className="section">
            <p className="eyebrow">Principles</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">What we optimise for</h2>
            <ul className="mt-14 grid gap-12 md:grid-cols-3">
              {principles.map((p) => (
                <li key={p.title}>
                  <h3 className="font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-slate-100">
          <div className="section text-center">
            <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight text-slate-900">Want to see SkoolPro with your data?</h2>
            <p className="mx-auto mt-5 max-w-lg text-slate-500">We’ll onboard your current term, set up payments and train your staff in under a week.</p>
            <Link
              href="/contact"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Contact us <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
