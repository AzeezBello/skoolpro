"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/client/authFetch";
import { supabase } from "@/lib/supabaseClient";

// Deliberately separate from the /dashboard layout: no OnboardingProvider,
// no tour, no school-scoped Sidebar. This checks platform_admins via
// /api/platform/me rather than any profiles.role value — a school's own
// admin has no path into this section at all.
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "denied" | "ok">("checking");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = async () => {
    try {
      const res = await authFetch("/api/platform/me");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setStatus("denied");
        return;
      }
      const json = await res.json();
      setEmail(json.email || null);
      setStatus("ok");
    } catch {
      router.replace("/login");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-sm text-gray-400">Checking access...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="max-w-md rounded-xl border border-white/10 bg-gray-900 p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold">Access restricted</h1>
          <p className="text-sm text-gray-400">
            This area is for SkoolPro platform operators only. Your account doesn&apos;t have access.
          </p>
        </div>
      </div>
    );
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        pathname === href || pathname.startsWith(`${href}/`)
          ? "bg-white/10 text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-gray-900/70 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">SkoolPro Platform</span>
          <nav className="flex gap-1">
            {navLink("/platform/schools", "Schools")}
            {navLink("/platform/audit", "Audit Log")}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <span>{email}</span>
          <button
            onClick={handleLogout}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
