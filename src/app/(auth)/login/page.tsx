"use client"

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    let destination = "/dashboard";
    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (profile?.role === "teacher") destination = "/dashboard/teachers";
      if (profile?.role === "student") destination = "/dashboard/students";
    }

    toast.success("Welcome back!");
    router.push(destination);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-gray-900 text-white">
      <SiteHeader />
      <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-10">
        <div className="absolute inset-0 bg-grid bg-[size:32px_32px] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background" />
        <div className="relative z-10 grid max-w-4xl grid-cols-1 items-center gap-10 rounded-3xl border border-white/5 bg-gray-950/60 p-10 shadow-soft backdrop-blur md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Welcome back</p>
            <h1 className="text-3xl font-semibold leading-tight">Sign in to SkoolPro</h1>
            <p className="text-muted-foreground">
              Access the dashboard to manage students, teachers, invoices, and reports in one place.
            </p>
          </div>

          <Card className="w-full">
            <form onSubmit={handleLogin}>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>Use your email and password to access your workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  <div className="text-right text-xs">
                    <a href="/forgot-password" className="text-primary hover:text-primary/80">Forgot password?</a>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Signing in..." : "Login"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  No account yet? <a href="/register" className="text-primary">Create one</a>
                </p>
              </CardContent>
            </form>
          </Card>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
