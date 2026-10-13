import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const metadata = { title: "FAQ" };

const groups: Array<{ title: string; items: Array<{ q: string; a: string }> }> = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do we get started?",
        a: "Register, name your school and you become its first admin. Import students and classes from CSV, then invite teachers and parents from Team & Access. We can also onboard you; just message us on the contact page.",
      },
      {
        q: "Is there a free plan?",
        a: "Yes. The free plan covers up to 50 students and 5 teachers with every core module. You can upgrade from inside the dashboard when you grow.",
      },
      {
        q: "Can parents apply online?",
        a: "Yes. Turn on admissions and share your public link, which looks like skoolpro.app/apply/your-school. Applications land in the Admissions page where you review and accept them into a class.",
      },
    ],
  },
  {
    title: "Fees and payments",
    items: [
      {
        q: "Does SkoolPro support Paystack and Flutterwave?",
        a: "Both gateways are integrated with signed webhooks. Add your secret keys and callback URLs in the environment variables and provider dashboards, and payments credit invoices automatically.",
      },
      {
        q: "Can we record partial or manual payments?",
        a: "Absolutely. Record manual or partial payments from the Invoices page; balances, receipts and the arrears report update immediately.",
      },
      {
        q: "Can parents receive reminders and receipts?",
        a: "Yes. Reminders go out by email (and SMS when configured), and receipts are generated as PDFs that can be downloaded, shared or printed.",
      },
    ],
  },
  {
    title: "Academics",
    items: [
      {
        q: "How are results and report cards produced?",
        a: "Teachers enter CA and exam scores per subject. The grading scale is configurable per school. Positions and class averages are computed automatically, and report cards are published as PDFs when the admin releases them.",
      },
      {
        q: "Do you support online exams?",
        a: "Yes. Create timed multiple-choice and short-answer exams that are auto-marked, plus essay questions marked by the teacher. Students never see the answer key.",
      },
    ],
  },
  {
    title: "Security and data",
    items: [
      {
        q: "How are roles handled?",
        a: "Supabase Auth handles identities. Each profile belongs to one school with a role of admin, teacher, student or parent, and row-level security enforces that scope on every query.",
      },
      {
        q: "Is there a way to export data?",
        a: "Attendance, grades and fee reports export to PDF and Excel. Students export to CSV. Per-school API tokens let you pull students, invoices and fee items programmatically.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto flex max-w-3xl flex-col gap-20 px-6 py-24 md:px-8 md:py-32">
        <section className="space-y-6">
          <p className="eyebrow">FAQ</p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">Answers to common questions</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-500">
            Everything you need to know about setup, payments, roles and reporting. Still stuck?{" "}
            <Link href="/contact" className="text-slate-900 underline underline-offset-4">
              Contact support
            </Link>
            .
          </p>
        </section>

        {groups.map((group) => (
          <section key={group.title} className="space-y-4">
            <h2 className="eyebrow">{group.title}</h2>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {group.items.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown size={18} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-500">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </main>
    </MarketingLayout>
  );
}
