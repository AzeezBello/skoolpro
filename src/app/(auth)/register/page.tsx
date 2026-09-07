"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useT } from "@/components/i18n/LocaleProvider";

function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get("invite") || "";
  const { t } = useT();

  const onboardingUrl = invite ? `/onboarding?invite=${encodeURIComponent(invite)}` : "/onboarding";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(onboardingUrl)}`,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (user && data.session) {
      // Self-service signups always start as an unassigned "student"; the
      // database enforces this via the profiles_insert_own RLS policy. The
      // onboarding step then either creates a school (becoming admin) or
      // accepts an invitation, both through server routes.
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([{ id: user.id, full_name: fullName, role: "student" }]);

      if (profileError && !/duplicate|already exists/i.test(profileError.message)) {
        toast.error(profileError.message);
        setLoading(false);
        return;
      }

      toast.success("Account created!");
      router.push(onboardingUrl);
      return;
    }

    // Email confirmation is enabled: no session until the link is clicked.
    setNeedsConfirmation(true);
    setLoading(false);
  };

  if (needsConfirmation) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account
            {invite ? " and accept your invitation" : ""}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <form onSubmit={handleRegister}>
        <CardHeader>
          <CardTitle>{invite ? t("auth.register.inviteTitle") : t("auth.register.title")}</CardTitle>
          <CardDescription>
            {invite ? t("auth.register.inviteSubtitle") : t("auth.register.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("auth.register.fullName")}</Label>
            <Input id="fullName" placeholder="Ada Lovelace" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
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
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? t("auth.hide") : t("auth.show")}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t("auth.register.busy") : invite ? t("auth.register.inviteButton") : t("auth.register.button")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.register.have")}{" "}
            <a href={invite ? `/login?next=${encodeURIComponent(onboardingUrl)}` : "/login"} className="text-primary">
              {t("auth.register.login")}
            </a>
          </p>
        </CardContent>
      </form>
    </Card>
  );
}

export default function RegisterPage() {
  const { t } = useT();
  return (
    <div className="dark force-dark min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-10">
        <div className="absolute inset-0 bg-grid bg-[size:32px_32px] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background" />
        <div className="relative z-10 grid max-w-4xl grid-cols-1 items-center gap-10 rounded-3xl border border-white/5 bg-gray-950/60 p-10 shadow-soft backdrop-blur md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Create your space</p>
            <h1 className="text-3xl font-semibold leading-tight">{t("auth.register.heading")}</h1>
            <p className="text-muted-foreground">{t("auth.register.blurb")}</p>
          </div>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
