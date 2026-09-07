"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { HelpCircle, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useT } from "@/components/i18n/LocaleProvider";

export default function Topbar({ onMenu }: { onMenu?: () => void }) {
  const router = useRouter();
  const { replayTour } = useOnboarding();
  const { profile } = useCurrentProfile();
  const { t } = useT();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-shell/80 px-4 py-3 backdrop-blur md:px-6 md:py-4">
      <div className="flex items-center gap-3">
        {onMenu && (
          <button onClick={onMenu} className="rounded-md p-2 text-shell-foreground hover:bg-shell-hover md:hidden" aria-label="Open menu">
            <Menu size={18} />
          </button>
        )}
        <div className="text-sm uppercase tracking-[0.25em] text-primary">SkoolPro</div>
      </div>
      <div className="flex items-center gap-2 text-sm text-shell-foreground md:gap-3">
        <span className="hidden items-center gap-2 rounded-full bg-shell-hover px-3 py-1 sm:flex">
          <User size={16} />
          {profile?.fullName || profile?.email || t("common.signedIn")}
        </span>
        <LanguageSwitcher compact />
        <NotificationBell />
        <ThemeToggle />
        <Tooltip content={t("topbar.tour")}>
          <button
            type="button"
            data-tour="topbar-replay-tour"
            onClick={replayTour}
            aria-label={t("topbar.tour")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-shell-hover text-shell-foreground transition hover:opacity-80"
          >
            <HelpCircle size={16} />
          </button>
        </Tooltip>
        <Button variant="destructive" onClick={handleLogout} className="h-9 px-3">
          <LogOut size={14} className="mr-1" />
          <span className="hidden sm:inline">{t("common.logout")}</span>
        </Button>
      </div>
    </header>
  );
}
