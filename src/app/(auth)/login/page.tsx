"use client";

import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthLayout } from "@/components/auth/AuthLayout";
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
      // Platform operators live outside the tenant role system, so check the
      // allowlist first; otherwise they'd be bounced to school onboarding.
      const accessToken = data.session?.access_token;
      if (accessToken) {
        try {
          const res = await fetch("/api/platform/me", { headers: { Authorization: `Bearer ${accessToken}` } });
          if (res.ok) destination = "/platform";
        } catch {
          // Not a platform admin or the check failed; fall through to the school routing.
        }
      }

      if (destination === "/dashboard") {
        const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", userId).maybeSingle();
        if (!profile?.school_id) destination = "/onboarding";
        else if (profile.role === "teacher") destination = "/dashboard/teachers";
        else if (profile.role === "student") destination = "/dashboard/students";
        else if (profile.role === "parent") destination = "/dashboard/children";
      }
    }

    toast.success("Welcome back!");
    router.push(destination);
    router.refresh();
  };

  return (
    <Card variant="flat" className="w-full border-0 bg-transparent shadow-none">
      <form onSubmit={handleLogin}>
        <CardHeader>
          <CardTitle className="text-xl">{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
             
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <a href="/forgot-password" className="text-xs text-primary hover:text-primary/80">
                {t("auth.forgot")}
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? t("auth.hide") : t("auth.show")}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <Button type="submit" loading={loading} size="lg" className="w-full">
            {loading ? t("auth.login.busy") : t("auth.login.button")}
          </Button>
          <p className="text-center text-sm text-slate-500">
            {t("auth.login.noAccount")}{" "}
            <a href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-primary">
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
    <AuthLayout
      eyebrow={t("auth.login.welcome")}
      heading={t("auth.login.heading")}
      blurb={t("auth.login.blurb")}
      points={["Role-aware consoles for admins, teachers, students and parents", "Fees, results and attendance in one place", "Secure per-school workspace"]}
    >
      <Suspense fallback={<p className="text-sm text-slate-500">Loading...</p>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
