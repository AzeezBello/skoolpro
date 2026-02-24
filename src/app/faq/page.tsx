import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const faqs = [
  {
    q: "How do we get started?",
    a: "Create an admin account, add your Supabase keys, and import students/classes. We can also onboard you—just message us on the contact page.",
  },
  {
    q: "Does SkoolPro support Paystack and Flutterwave?",
    a: "Yes. Both gateways are integrated with signed webhooks. Configure your secret keys and callback URLs in the environment variables and provider dashboards.",
  },
  {
    q: "Can we record partial payments?",
    a: "Absolutely. Record manual/partial payments from the invoices dashboard; receipts update immediately.",
  },
  {
    q: "How are roles handled?",
    a: "Supabase auth handles identities. Profiles determine role-based redirects and permissions for admins, teachers, and students.",
  },
  {
    q: "Can parents receive reminders and receipts?",
    a: "Yes. Reminders use Resend email templates, and receipts are generated as PDFs and can be shared or printed.",
  },
  {
    q: "Is there a way to export data?",
    a: "Attendance and grades export to PDF/Excel from the reports pages. Payments and invoices can be exported directly from Supabase if needed.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-10 shadow-soft ring-1 ring-white/10">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">FAQ</p>
          <h1 className="mt-2 text-4xl font-semibold">Answers to common questions</h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-300">
            Everything you need to know about setup, payments, roles, and reporting. Still stuck? Reach out and we’ll help.
          </p>
          <Link href="/contact" className="mt-4 inline-flex text-primary hover:text-primary/80">
            Contact support →
          </Link>
        </section>

        <div className="grid gap-4">
          {faqs.map((item) => (
            <Card key={item.q} className="border-white/10 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">{item.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
