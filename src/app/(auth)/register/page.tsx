"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthLayout } from "@/components/auth/AuthLayout";
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
      <Card variant="flat" className="w-full border-0 bg-transparent shadow-none">
        <CardHeader className="items-center text-center">
          <span className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MailCheck size={26} />
          </span>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your
            account{invite ? " and accept your invitation" : ""}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card variant="flat" className="w-full border-0 bg-transparent shadow-none">
      <form onSubmit={handleRegister}>
        <CardHeader>
          <CardTitle className="text-xl">{invite ? t("auth.register.inviteTitle") : t("auth.register.title")}</CardTitle>
          <CardDescription>
            {invite ? t("auth.register.inviteSubtitle") : t("auth.register.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("auth.register.fullName")}</Label>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
             
              required
            />
          </div>
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
            <Label htmlFor="password">{t("auth.password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
                minLength={8}
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
            {loading ? t("auth.register.busy") : invite ? t("auth.register.inviteButton") : t("auth.register.button")}
          </Button>
          <p className="text-center text-sm text-slate-500">
            {t("auth.register.have")}{" "}
            <a href={invite ? `/login?next=${encodeURIComponent(onboardingUrl)}` : "/login"} className="font-medium text-primary">
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
    <AuthLayout
      eyebrow="Create your space"
      heading={t("auth.register.heading")}
      blurb={t("auth.register.blurb")}
      points={["Free for up to 50 students and 5 teachers", "Import students from CSV in minutes", "Invite staff and parents with a link"]}
    >
      <Suspense fallback={<p className="text-sm text-slate-500">Loading...</p>}>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}
