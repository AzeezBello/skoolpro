import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Baby,
  BedDouble,
  BookMarked,
  BookOpen,
  BookText,
  Bus,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
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
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export type Role = "admin" | "teacher" | "student" | "parent";

export type NavSection = "home" | "school" | "people" | "academics" | "campus" | "finance" | "communication" | "insights";

export type NavLink = {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Stable hook for the product tour; do not rename. */
  tour: string;
  roles: Role[];
  section: NavSection;
};

export const NAV_SECTIONS: Array<{ id: NavSection; label: MessageKey }> = [
  { id: "home", label: "nav.section.home" },
  { id: "school", label: "nav.section.school" },
  { id: "people", label: "nav.section.people" },
  { id: "academics", label: "nav.section.academics" },
  { id: "campus", label: "nav.section.campus" },
  { id: "finance", label: "nav.section.finance" },
  { id: "communication", label: "nav.section.communication" },
  { id: "insights", label: "nav.section.insights" },
];

// Single source of truth for the dashboard sidebar and the topbar title.
export const DASHBOARD_LINKS: NavLink[] = [
  { href: "/dashboard", label: "nav.overview", icon: LayoutDashboard, tour: "sidebar-overview", roles: ["admin"], section: "home" },
  { href: "/dashboard/children", label: "nav.children", icon: Baby, tour: "sidebar-children", roles: ["parent"], section: "home" },
  { href: "/dashboard/school", label: "nav.school", icon: School, tour: "sidebar-school", roles: ["admin"], section: "school" },
  { href: "/dashboard/admissions", label: "nav.admissions", icon: ClipboardCheck, tour: "sidebar-admissions", roles: ["admin"], section: "school" },
  { href: "/dashboard/team", label: "nav.team", icon: ShieldCheck, tour: "sidebar-team", roles: ["admin"], section: "school" },
  { href: "/dashboard/students", label: "nav.students", icon: GraduationCap, tour: "sidebar-students", roles: ["admin", "teacher", "student"], section: "people" },
  { href: "/dashboard/teachers", label: "nav.teachers", icon: Users, tour: "sidebar-teachers", roles: ["admin", "teacher", "student"], section: "people" },
  { href: "/dashboard/classes", label: "nav.classes", icon: BookOpen, tour: "sidebar-classes", roles: ["admin"], section: "academics" },
  { href: "/dashboard/subjects", label: "nav.subjects", icon: Library, tour: "sidebar-subjects", roles: ["admin"], section: "academics" },
  { href: "/dashboard/sessions", label: "nav.sessions", icon: CalendarRange, tour: "sidebar-sessions", roles: ["admin"], section: "academics" },
  { href: "/dashboard/attendance", label: "nav.attendance", icon: CalendarCheck, tour: "sidebar-attendance", roles: ["admin", "teacher"], section: "academics" },
  { href: "/dashboard/results", label: "nav.results", icon: ClipboardList, tour: "sidebar-results", roles: ["admin", "teacher"], section: "academics" },
  { href: "/dashboard/timetable", label: "nav.timetable", icon: CalendarDays, tour: "sidebar-timetable", roles: ["admin", "teacher", "student", "parent"], section: "academics" },
  { href: "/dashboard/homework", label: "nav.homework", icon: BookMarked, tour: "sidebar-homework", roles: ["admin", "teacher", "student", "parent"], section: "academics" },
  { href: "/dashboard/exams", label: "nav.exams", icon: FileQuestion, tour: "sidebar-exams", roles: ["admin", "teacher", "student"], section: "academics" },
  { href: "/dashboard/library", label: "nav.library", icon: BookText, tour: "sidebar-library", roles: ["admin", "teacher", "student", "parent"], section: "campus" },
  { href: "/dashboard/transport", label: "nav.transport", icon: Bus, tour: "sidebar-transport", roles: ["admin", "teacher", "student", "parent"], section: "campus" },
  { href: "/dashboard/hostel", label: "nav.hostel", icon: BedDouble, tour: "sidebar-hostel", roles: ["admin", "teacher", "student", "parent"], section: "campus" },
  { href: "/dashboard/fee-items", label: "nav.feeItems", icon: Wallet, tour: "sidebar-fee-items", roles: ["admin"], section: "finance" },
  { href: "/dashboard/invoices", label: "nav.invoices", icon: Receipt, tour: "sidebar-invoices", roles: ["admin", "teacher", "student", "parent"], section: "finance" },
  { href: "/dashboard/announcements", label: "nav.announcements", icon: Megaphone, tour: "sidebar-announcements", roles: ["admin", "teacher"], section: "communication" },
  { href: "/dashboard/messages", label: "nav.messages", icon: MessageSquare, tour: "sidebar-messages", roles: ["admin", "teacher", "student", "parent"], section: "communication" },
  { href: "/dashboard/reports/attendance", label: "nav.reports", icon: BarChart3, tour: "sidebar-reports", roles: ["admin", "teacher"], section: "insights" },
  { href: "/dashboard/audit", label: "nav.audit", icon: ScrollText, tour: "sidebar-audit", roles: ["admin"], section: "insights" },
];

export const CONSOLE_LABEL: Record<Role, MessageKey> = {
  admin: "console.admin",
  teacher: "console.teacher",
  student: "console.student",
  parent: "console.parent",
};

/** Base path used for active-state matching (reports share one entry). */
export function navBase(href: string) {
  return href.startsWith("/dashboard/reports/") ? "/dashboard/reports" : href;
}

export function isNavActive(href: string, pathname: string) {
  const base = navBase(href);
  return pathname === href || (base !== "/dashboard" && pathname.startsWith(`${base}/`)) || (base !== href && pathname === base);
}

/** The link that best describes the current pathname, for titles and breadcrumbs. */
export function currentNavLink(pathname: string): NavLink | undefined {
  return DASHBOARD_LINKS.filter((l) => isNavActive(l.href, pathname)).sort((a, b) => b.href.length - a.href.length)[0];
}
