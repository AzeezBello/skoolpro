 "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Users,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "Students", icon: GraduationCap },
  { href: "/dashboard/teachers", label: "Teachers", icon: Users },
  { href: "/dashboard/classes", label: "Classes", icon: BookOpen },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/reports/attendance", label: "Reports", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r border-white/5 bg-gray-950/80 px-4 py-6 backdrop-blur md:flex">
      <div className="mb-8 px-3">
        <p className="text-sm uppercase tracking-[0.3em] text-green-400">SkoolPro</p>
        <p className="text-xs text-gray-400">Admin Console</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                active ? "bg-green-500/20 text-white ring-1 ring-green-400/40" : "text-gray-300 hover:bg-white/5"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
