import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const metadata = { title: "Contact" };

const support = [
  { title: "Data import", body: "Students, classes, fee items and open invoices from CSV or Excel." },
  { title: "Payment gateway setup", body: "Paystack and Flutterwave keys, live webhooks and test transactions." },
  { title: "Staff onboarding", body: "Hands-on training for admins and teachers, plus a guided in-app tour." },
];

export default function ContactPage() {
  return (
    <MarketingLayout>
      <main className="section">
        <div className="grid gap-20 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Get in touch</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">We reply within one business day.</h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-500">
              Tell us about your school’s size, billing setup and timelines, and we’ll come back with next steps.
            </p>

            <dl className="mt-14 space-y-6 text-sm">
              <div>
                <dt className="text-slate-400">Email</dt>
                <dd className="mt-1">
                  <a href="mailto:support@skoolpro.app" className="text-slate-900 hover:text-primary">
                    support@skoolpro.app
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Phone</dt>
                <dd className="mt-1 text-slate-900">+234 (0) 800 000 0000</dd>
              </div>
              <div>
                <dt className="text-slate-400">Hours</dt>
                <dd className="mt-1 text-slate-900">Mon to Fri, 9:00 to 17:00 WAT</dd>
              </div>
              <div>
                <dt className="text-slate-400">Office</dt>
                <dd className="mt-1 text-slate-900">Remote-first across Nigeria; Lagos HQ by appointment.</dd>
              </div>
            </dl>

            <div className="mt-14 border-t border-slate-100 pt-10">
              <p className="text-sm font-semibold text-slate-900">Implementation support</p>
              <ul className="mt-6 space-y-5">
                {support.map((s) => (
                  <li key={s.title}>
                    <p className="text-sm font-medium text-slate-900">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <form action="mailto:support@skoolpro.app" method="get" encType="text/plain" className="space-y-7 lg:pt-16">
            <div className="grid gap-7 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" name="name" placeholder="Ada Lovelace" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school">School / organisation</Label>
                <Input id="school" name="school" placeholder="Bright Future Academy" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" placeholder="Onboarding 500 students for next term" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">What do you need?</Label>
              <textarea
                id="body"
                name="body"
                rows={6}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="We’d like to import 500 students and start collecting term fees..."
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Send message <Send size={15} />
            </button>
            <p className="text-xs text-slate-400">Opens in your email app, addressed to our support inbox.</p>
          </form>
        </div>
      </main>
    </MarketingLayout>
  );
}
