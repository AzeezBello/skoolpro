"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/AuthLayout";

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
    <AuthLayout
      eyebrow="Account recovery"
      heading="Choose a new password"
      blurb="Pick something at least 8 characters long that you don't use anywhere else."
    >
      <Card variant="flat" className="w-full border-0 bg-transparent shadow-none">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-xl">Reset password</CardTitle>
            <CardDescription>
              {ready
                ? "Set a new password for your account."
                : "Make sure you opened this page from the reset link in your email."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
               
                required
              />
            </div>
            <Button type="submit" loading={loading} size="lg" className="w-full">
              {loading ? "Updating..." : "Update password"}
            </Button>
            <p className="text-center text-sm text-slate-500">
              Back to{" "}
              <a href="/login" className="font-medium text-primary">
                login
              </a>
            </p>
          </CardContent>
        </form>
      </Card>
    </AuthLayout>
  );
}
