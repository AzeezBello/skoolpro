"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/reports/attendance", label: "Attendance" },
  { href: "/dashboard/reports/grades", label: "Grades" },
  { href: "/dashboard/reports/fees", label: "Fees & arrears" },
];

export function ReportsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-lg border border-border bg-card/60 p-1 text-sm">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`rounded-md px-3 py-1.5 transition ${pathname === t.href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
