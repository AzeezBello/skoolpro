"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    if (user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([{ id: user.id, full_name: fullName, role }]);

      if (profileError) {
        toast.error(profileError.message);
      } else {
        toast.success("Registration successful!");
        router.push("/dashboard");
      }
    }

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
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Create your space</p>
            <h1 className="text-3xl font-semibold leading-tight">Join SkoolPro</h1>
            <p className="text-muted-foreground">
              Set up your account, pick a role, and unlock dashboards for billing, attendance, and reporting.
            </p>
          </div>

          <Card className="w-full">
            <form onSubmit={handleRegister}>
              <CardHeader>
                <CardTitle>Sign up</CardTitle>
                <CardDescription>Provision an account for your team role.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    placeholder="Ada Lovelace"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Registering..." : "Sign Up"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account? <a href="/login" className="text-primary">Login</a>
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
