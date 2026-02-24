import { Mail, Phone, MapPin, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-10 shadow-soft ring-1 ring-white/10">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Get in touch</p>
          <h1 className="mt-2 text-4xl font-semibold">We’re here to help you ship a calmer school day.</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-300">
            Tell us about your school’s size, billing setup, and timelines. We’ll get back within one business day with next steps.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-white/10 bg-card/80">
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" placeholder="Ada Lovelace" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" placeholder="you@school.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school">School / Organization</Label>
                <Input id="school" placeholder="SkoolPro Academy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">What do you need?</Label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="We’d like to import 500 students and start collecting term fees..."
                />
              </div>
              <Button className="w-full">
                Send message
                <Send size={16} className="ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground">Prefer email? Reach us at support@skoolpro.app.</p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-white/10 bg-card/80">
              <CardHeader>
                <CardTitle>Contact details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Mail className="text-primary" size={18} />
                  support@skoolpro.app
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="text-primary" size={18} />
                  +234 (0) 800 000 0000
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="text-primary" size={18} />
                  Remote-first across Nigeria; Lagos HQ by appointment.
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-gradient-to-br from-white/5 to-white/0">
              <CardHeader>
                <CardTitle>Implementation support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-300">
                <p>• Data import for students, classes, and invoices</p>
                <p>• Payment gateway setup with live webhooks</p>
                <p>• Staff onboarding and best practices</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
