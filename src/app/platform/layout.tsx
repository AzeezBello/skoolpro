"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, ScrollText, School, ShieldAlert } from "lucide-react";
import { authFetch } from "@/lib/client/authFetch";
import { supabase } from "@/lib/supabaseClient";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground" role="status">
        <LogoMark size={44} className="animate-pulse" />
        <p className="text-sm">Checking access...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert size={26} />
          </span>
          <h1 className="mb-2 text-xl font-semibold">Access restricted</h1>
          <p className="text-sm text-muted-foreground">
            This area is for SkoolPro platform operators only. Your account doesn&apos;t have access.
          </p>
          <Link href="/dashboard" className="mt-5 inline-flex text-sm font-semibold">
            Go to the dashboard
          </Link>
        </div>
      </div>
    );
  }

  const navLink = (href: string, label: string, Icon: typeof School) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition",
          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon size={15} /> {label}
      </Link>
    );
  };

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/platform/schools" className="text-foreground hover:text-foreground">
              <Logo size={32} caption="Platform console" />
            </Link>
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Platform">
              {navLink("/platform/schools", "Schools", School)}
              {navLink("/platform/audit", "Audit log", ScrollText)}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 rounded-full border border-border bg-background/60 py-1 pl-1 pr-3 md:inline-flex">
              <Avatar name={email || "?"} size={26} />
              <span className="max-w-[200px] truncate text-muted-foreground">{email}</span>
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-shell-hover"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
        <nav className="flex gap-1 border-t border-border px-4 py-2 sm:hidden" aria-label="Platform mobile">
          {navLink("/platform/schools", "Schools", School)}
          {navLink("/platform/audit", "Audit log", ScrollText)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl animate-fade-up px-6 py-12 md:px-8 md:py-16">{children}</main>
    </div>
  );
}
