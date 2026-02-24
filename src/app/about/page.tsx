import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users2, CreditCard, BarChart3, ShieldCheck, Mail } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const pillars = [
  {
    title: "Student success",
    description: "Attendance, grades, and messaging stay in one profile so you always know how a learner is doing.",
    icon: Users2,
  },
  {
    title: "Financial clarity",
    description: "Invoices, receipts, and Paystack/Flutterwave payments sync instantly—no more chasing reference IDs.",
    icon: CreditCard,
  },
  {
    title: "Operational visibility",
    description: "Exports, charts, and role-aware dashboards give leadership a real-time pulse.",
    icon: BarChart3,
  },
  {
    title: "Secure by default",
    description: "Supabase auth, signed webhooks, and audit-friendly payment history keep data and funds safe.",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-10 shadow-soft ring-1 ring-white/10">
          <Badge variant="outline" className="mb-3">About SkoolPro</Badge>
          <h1 className="text-4xl font-semibold">Built for schools that need clarity, not chaos.</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-300">
            SkoolPro replaces brittle spreadsheets and scattered apps with a single pane of glass for attendance,
            payments, grades, and communications. It ships with the rails you need to run a Nigerian school smoothly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="rounded-full bg-white/5 px-3 py-1">Next.js + Supabase</span>
            <span className="rounded-full bg-white/5 px-3 py-1">Paystack & Flutterwave</span>
            <span className="rounded-full bg-white/5 px-3 py-1">PDF receipts</span>
            <span className="rounded-full bg-white/5 px-3 py-1">Export to Excel</span>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {pillars.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border-white/10 bg-card/80">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-3 text-primary ring-1 ring-primary/30">
                  <Icon />
                </div>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">{description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-8 text-slate-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-primary">We’d love to help</p>
              <h2 className="text-2xl font-semibold">Want to see SkoolPro with your data?</h2>
              <p className="max-w-xl text-slate-300">
                We’ll onboard your current term, set up payments, and train your staff in under a week.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Contact us <Mail size={16} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
