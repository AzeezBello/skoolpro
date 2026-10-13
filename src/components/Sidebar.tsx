"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useT } from "@/components/i18n/LocaleProvider";
import { CONSOLE_LABEL, DASHBOARD_LINKS, NAV_SECTIONS, isNavActive, type Role } from "@/lib/navigation";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { profile, loading } = useCurrentProfile();
  const { t } = useT();
  const role = profile?.role as Role | undefined;

  // While the role is loading show nothing role-specific; once known, only
  // that role's links. (Previously the full admin set was shown to unknown
  // roles, which confused orphaned accounts.)
  const visibleLinks = loading || !role ? [] : DASHBOARD_LINKS.filter((link) => link.roles.includes(role));
  const sections = NAV_SECTIONS.map((s) => ({ ...s, links: visibleLinks.filter((l) => l.section === s.id) })).filter(
    (s) => s.links.length > 0
  );

  const nav = (
    <div className="flex h-full flex-col">
      <div className="mb-10 flex items-start justify-between px-2">
        <Link href="/dashboard" className="text-shell-foreground hover:text-shell-foreground">
          <Logo size={34} caption={role ? t(CONSOLE_LABEL[role]) : t("console.generic")} />
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1.5 text-shell-muted hover:bg-shell-hover md:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-7 overflow-y-auto pr-1 text-sm" aria-label="Dashboard">
        {loading && (
          <div className="space-y-2 px-2" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-shell-hover" />
            ))}
          </div>
        )}
        {sections.map((section) => (
          <div key={section.id}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-muted">{t(section.label)}</p>
            <ul className="space-y-0.5">
              {section.links.map(({ href, label, icon: Icon, tour }) => {
                const active = isNavActive(href, pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      data-tour={tour}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-shell-foreground/75 hover:bg-shell-hover hover:text-shell-foreground"
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
                      <Icon size={17} className={cn("shrink-0", active ? "text-primary" : "text-shell-muted group-hover:text-shell-foreground")} />
                      <span className="truncate">{t(label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {profile && (
        <div className="mt-6 flex items-center gap-3 px-2 pt-4 border-t border-border/70">
          <Avatar name={profile.fullName || profile.email || "?"} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-shell-foreground">{profile.fullName || t("common.signedIn")}</p>
            <p className="truncate text-xs text-shell-muted">{profile.email}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col border-r border-border/70 bg-shell px-4 py-6 md:flex">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 flex w-[288px] flex-col bg-shell px-3 py-5 shadow-2xl animate-in slide-in-from-left duration-200">{nav}</aside>
        </div>
      )}
    </>
  );
}
