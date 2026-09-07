"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookMarked,
  BookText,
  Bus,
  BedDouble,
  FileQuestion,
  CalendarDays,
  Baby,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageSquare,
  Receipt,
  School,
  ScrollText,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useT } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

type Role = "admin" | "teacher" | "student" | "parent";

const links: Array<{
  href: string;
  label: MessageKey;
  icon: typeof LayoutDashboard;
  tour: string;
  roles: Role[];
}> = [
  { href: "/dashboard", label: "nav.overview", icon: LayoutDashboard, tour: "sidebar-overview", roles: ["admin"] },
  { href: "/dashboard/children", label: "nav.children", icon: Baby, tour: "sidebar-children", roles: ["parent"] },
  { href: "/dashboard/school", label: "nav.school", icon: School, tour: "sidebar-school", roles: ["admin"] },
  { href: "/dashboard/admissions", label: "nav.admissions", icon: ClipboardCheck, tour: "sidebar-admissions", roles: ["admin"] },
  { href: "/dashboard/team", label: "nav.team", icon: ShieldCheck, tour: "sidebar-team", roles: ["admin"] },
  {
    href: "/dashboard/students",
    label: "nav.students",
    icon: GraduationCap,
    tour: "sidebar-students",
    roles: ["admin", "teacher", "student"],
  },
  {
    href: "/dashboard/teachers",
    label: "nav.teachers",
    icon: Users,
    tour: "sidebar-teachers",
    roles: ["admin", "teacher", "student"],
  },
  { href: "/dashboard/classes", label: "nav.classes", icon: BookOpen, tour: "sidebar-classes", roles: ["admin"] },
  { href: "/dashboard/subjects", label: "nav.subjects", icon: Library, tour: "sidebar-subjects", roles: ["admin"] },
  { href: "/dashboard/sessions", label: "nav.sessions", icon: CalendarRange, tour: "sidebar-sessions", roles: ["admin"] },
  { href: "/dashboard/attendance", label: "nav.attendance", icon: CalendarCheck, tour: "sidebar-attendance", roles: ["admin", "teacher"] },
  { href: "/dashboard/results", label: "nav.results", icon: ClipboardList, tour: "sidebar-results", roles: ["admin", "teacher"] },
  { href: "/dashboard/timetable", label: "nav.timetable", icon: CalendarDays, tour: "sidebar-timetable", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/dashboard/homework", label: "nav.homework", icon: BookMarked, tour: "sidebar-homework", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/dashboard/exams", label: "nav.exams", icon: FileQuestion, tour: "sidebar-exams", roles: ["admin", "teacher", "student"] },
  { href: "/dashboard/library", label: "nav.library", icon: BookText, tour: "sidebar-library", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/dashboard/transport", label: "nav.transport", icon: Bus, tour: "sidebar-transport", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/dashboard/hostel", label: "nav.hostel", icon: BedDouble, tour: "sidebar-hostel", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/dashboard/fee-items", label: "nav.feeItems", icon: Wallet, tour: "sidebar-fee-items", roles: ["admin"] },
  { href: "/dashboard/invoices", label: "nav.invoices", icon: Receipt, tour: "sidebar-invoices", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/dashboard/announcements", label: "nav.announcements", icon: Megaphone, tour: "sidebar-announcements", roles: ["admin", "teacher"] },
  { href: "/dashboard/messages", label: "nav.messages", icon: MessageSquare, tour: "sidebar-messages", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/dashboard/reports/attendance", label: "nav.reports", icon: BarChart3, tour: "sidebar-reports", roles: ["admin", "teacher"] },
  { href: "/dashboard/audit", label: "nav.audit", icon: ScrollText, tour: "sidebar-audit", roles: ["admin"] },
];

const consoleLabel: Record<Role, MessageKey> = {
  admin: "console.admin",
  teacher: "console.teacher",
  student: "console.student",
  parent: "console.parent",
};

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { profile, loading } = useCurrentProfile();
  const { t } = useT();
  const role = profile?.role as Role | undefined;

  // While the role is loading show nothing role-specific; once known, only
  // that role's links. (Previously the full admin set was shown to unknown
  // roles, which confused orphaned accounts.)
  const visibleLinks = loading || !role ? [] : links.filter((link) => link.roles.includes(role));

  const nav = (
    <>
      <div className="mb-8 flex items-start justify-between px-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-primary">SkoolPro</p>
          <p className="text-xs text-shell-muted">{role ? t(consoleLabel[role]) : t("console.generic")}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-shell-muted hover:bg-shell-hover md:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        {loading && <p className="px-3 text-xs text-shell-muted">{t("common.loading")}</p>}
        {visibleLinks.map(({ href, label, icon: Icon, tour }) => {
          const base = href.startsWith("/dashboard/reports/") ? "/dashboard/reports" : href;
          const active = pathname === href || (base !== "/dashboard" && pathname.startsWith(`${base}/`));
          return (
            <Link
              key={href}
              href={href}
              data-tour={tour}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                active ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : "text-shell-foreground/80 hover:bg-shell-hover"
              }`}
            >
              <Icon size={16} />
              {t(label)}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-border bg-shell px-4 py-6 backdrop-blur md:flex">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-shell px-4 py-6 shadow-2xl">{nav}</aside>
        </div>
      )}
    </>
  );
}
