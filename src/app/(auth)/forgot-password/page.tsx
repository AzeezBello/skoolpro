"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("Check your email for a reset link.");
    }
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      heading="Forgot your password?"
      blurb="Enter the email you signed up with and we'll send you a link to choose a new password."
    >
      <Card variant="flat" className="w-full border-0 bg-transparent shadow-none">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <CardDescription>
              {sent ? `We sent a reset link to ${email}. It expires shortly, so open it soon.` : "Enter your email to receive a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
            <Button type="submit" loading={loading} size="lg" className="w-full">
              {loading ? "Sending..." : sent ? "Send again" : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-slate-500">
              Remembered it?{" "}
              <a href="/login" className="font-medium text-primary">
                Back to login
              </a>
            </p>
          </CardContent>
        </form>
      </Card>
    </AuthLayout>
  );
}
