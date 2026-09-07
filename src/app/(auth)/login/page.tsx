"use client";

import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useT } from "@/components/i18n/LocaleProvider";

// Only ever redirect to a same-origin path so `next` can't be used as an
// open redirect.
function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { t } = useT();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    let destination = next || "/dashboard";
    const userId = data.user?.id;
    if (!next && userId) {
      const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", userId).maybeSingle();
      if (!profile?.school_id) destination = "/onboarding";
      else if (profile.role === "teacher") destination = "/dashboard/teachers";
      else if (profile.role === "student") destination = "/dashboard/students";
      else if (profile.role === "parent") destination = "/dashboard/children";
    }

    toast.success("Welcome back!");
    router.push(destination);
    router.refresh();
  };

  return (
    <Card className="w-full">
      <form onSubmit={handleLogin}>
        <CardHeader>
          <CardTitle>{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" placeholder="you@school.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? t("auth.hide") : t("auth.show")}
              </Button>
            </div>
            <div className="text-right text-xs">
              <a href="/forgot-password" className="text-primary hover:text-primary/80">
                {t("auth.forgot")}
              </a>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t("auth.login.busy") : t("auth.login.button")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.login.noAccount")}{" "}
            <a href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-primary">
              {t("auth.login.create")}
            </a>
          </p>
        </CardContent>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useT();
  return (
    <div className="dark force-dark min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-10">
        <div className="absolute inset-0 bg-grid bg-[size:32px_32px] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background" />
        <div className="relative z-10 grid max-w-4xl grid-cols-1 items-center gap-10 rounded-3xl border border-white/5 bg-gray-950/60 p-10 shadow-soft backdrop-blur md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">{t("auth.login.welcome")}</p>
            <h1 className="text-3xl font-semibold leading-tight">{t("auth.login.heading")}</h1>
            <p className="text-muted-foreground">{t("auth.login.blurb")}</p>
          </div>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
