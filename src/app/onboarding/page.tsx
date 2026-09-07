"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/client/authFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type Mode = "choose" | "create" | "invite";

function OnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteFromUrl = params.get("invite") || "";

  const [mode, setMode] = useState<Mode>(inviteFromUrl ? "invite" : "choose");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        const next = inviteFromUrl ? `/onboarding?invite=${encodeURIComponent(inviteFromUrl)}` : "/onboarding";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setEmail(data.user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id, full_name")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.school_id && !inviteFromUrl) {
        router.replace("/dashboard");
        return;
      }
      if (profile?.full_name) setFullName(profile.full_name);
      setChecking(false);
    })();
  }, [router, inviteFromUrl]);

  const createSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (schoolName.trim().length < 2) {
      toast.error("Enter your school's name");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch("/api/onboarding/create-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: schoolName, full_name: fullName, phone, address }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not create school");
        return;
      }
      toast.success(`Welcome to ${json.school.name}!`);
      router.replace("/dashboard");
    } catch {
      toast.error("Could not create school");
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      toast.error("Paste your invitation code or open the link from your email");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken.trim(), full_name: fullName }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not accept invitation");
        return;
      }
      toast.success("You're in!");
      router.replace("/dashboard");
    } catch {
      toast.error("Could not accept invitation");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <p className="text-center text-sm text-muted-foreground">Checking your account...</p>;
  }

  return (
    <div className="relative z-10 w-full max-w-3xl space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">Almost there</p>
        <h1 className="mt-2 text-3xl font-semibold">Set up your workspace</h1>
        <p className="mt-2 text-muted-foreground">
          Signed in as <span className="text-foreground">{email}</span>. Create a new school or join one you were invited to.
        </p>
      </div>

      {mode === "choose" && (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setMode("create")}
            className="rounded-2xl border border-border bg-card/80 p-6 text-left transition hover:border-primary/60 hover:bg-card"
          >
            <h2 className="text-lg font-semibold">Create a new school</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll become the school&apos;s first admin and can invite staff, students and parents.
            </p>
          </button>
          <button
            onClick={() => setMode("invite")}
            className="rounded-2xl border border-border bg-card/80 p-6 text-left transition hover:border-primary/60 hover:bg-card"
          >
            <h2 className="text-lg font-semibold">I have an invitation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join an existing school using the link or code your school admin sent you.
            </p>
          </button>
        </div>
      )}

      {mode === "create" && (
        <Card>
          <form onSubmit={createSchool}>
            <CardHeader>
              <CardTitle>Create your school</CardTitle>
              <CardDescription>You can update the profile, logo and motto later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schoolName">School name</Label>
                <Input id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Bright Future Academy" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Your full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Okafor" required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">School phone (optional)</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address (optional)</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Lagos" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setMode("choose")} disabled={busy}>
                  Back
                </Button>
                <Button type="submit" disabled={busy} className="flex-1">
                  {busy ? "Creating..." : "Create school"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {mode === "invite" && (
        <Card>
          <form onSubmit={acceptInvite}>
            <CardHeader>
              <CardTitle>Join with an invitation</CardTitle>
              <CardDescription>The invitation must have been sent to {email}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName2">Your full name</Label>
                <Input id="fullName2" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Okafor" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite">Invitation code</Label>
                <Input id="invite" value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} placeholder="Paste the code from your email" required />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setMode("choose")} disabled={busy}>
                  Back
                </Button>
                <Button type="submit" disabled={busy} className="flex-1">
                  {busy ? "Joining..." : "Join school"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div className="dark force-dark min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-10">
        <div className="absolute inset-0 bg-grid bg-[size:32px_32px] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background" />
        <Suspense fallback={<p className="relative z-10 text-sm text-muted-foreground">Loading...</p>}>
          <OnboardingInner />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}
