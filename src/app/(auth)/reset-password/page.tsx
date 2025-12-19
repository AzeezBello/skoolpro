"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // A valid recovery link should create a session; verify before allowing reset.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return toast.error("Open the reset link from your email.");
    if (!password || password !== confirm) return toast.error("Passwords must match.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) toast.error(error.message);
    else toast.success("Password updated. You can now log in.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <Card className="border-white/10 bg-card/80 shadow-soft">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
              <CardDescription>
                Set a new password. Make sure you opened this page from the reset link in your email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <div className="flex gap-2">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Updating..." : "Update password"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Back to <a href="/login" className="text-primary">login</a>
              </p>
            </CardContent>
          </form>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
