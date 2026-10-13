"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, HelpCircle, LogOut, Menu, UserCircle2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useT } from "@/components/i18n/LocaleProvider";
import { CONSOLE_LABEL, currentNavLink, type Role } from "@/lib/navigation";
import { LogoMark } from "@/components/brand/Logo";

export default function Topbar({ onMenu }: { onMenu?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { replayTour } = useOnboarding();
  const { profile } = useCurrentProfile();
  const { t } = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = currentNavLink(pathname);
  const role = profile?.role as Role | undefined;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-5 py-3 backdrop-blur-xl md:px-12">
      <div className="flex min-w-0 items-center gap-3">
        {onMenu && (
          <button onClick={onMenu} className="rounded-lg p-2 text-shell-foreground hover:bg-shell-hover md:hidden" aria-label="Open menu">
            <Menu size={18} />
          </button>
        )}
        <Link href="/dashboard" className="md:hidden" aria-label="SkoolPro">
          <LogoMark size={28} />
        </Link>
        <nav className="hidden min-w-0 items-center gap-1.5 text-sm md:flex" aria-label="Breadcrumb">
          <Link href="/dashboard" className="text-shell-muted hover:text-shell-foreground">
            {t("topbar.dashboard")}
          </Link>
          {current && (
            <>
              <span className="text-shell-muted/60">/</span>
              <span className="truncate font-semibold text-shell-foreground">{t(current.label)}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-1 text-sm text-shell-foreground md:gap-2">
        <div className="hidden sm:block">
          <LanguageSwitcher compact />
        </div>
        <NotificationBell />
        <ThemeToggle />
        <Tooltip content={t("topbar.tour")}>
          <button
            type="button"
            data-tour="topbar-replay-tour"
            onClick={replayTour}
            aria-label={t("topbar.tour")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-shell-foreground transition hover:bg-shell-hover"
          >
            <HelpCircle size={16} />
          </button>
        </Tooltip>

        <div ref={menuRef} className="relative ml-1">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("topbar.account")}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-shell-hover"
          >
            <Avatar name={profile?.fullName || profile?.email || "?"} size={28} />
            <span className="hidden max-w-[140px] truncate text-sm font-medium lg:inline">{profile?.fullName || profile?.email || t("common.signedIn")}</span>
            <ChevronDown size={14} className="text-shell-muted" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-soft">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Avatar name={profile?.fullName || profile?.email || "?"} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{profile?.fullName || t("common.signedIn")}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
                  {role && <p className="mt-0.5 text-[11px] font-medium text-primary">{t(CONSOLE_LABEL[role])}</p>}
                </div>
              </div>
              <div className="p-1.5">
                {role === "admin" && (
                  <Link
                    href="/dashboard/school"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary/60"
                  >
                    <UserCircle2 size={15} /> {t("nav.school")}
                  </Link>
                )}
                <div className="px-3 py-2 sm:hidden">
                  <LanguageSwitcher />
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut size={15} /> {t("common.logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
