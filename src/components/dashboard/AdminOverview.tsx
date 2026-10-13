"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
import {
  Users,
  UserCheck,
  School,
  CalendarCheck,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  Receipt,
  ClipboardList,
  Megaphone,
  GraduationCap,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AnnouncementsPanel } from "@/components/dashboard/AnnouncementsPanel";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useTheme } from "@/lib/hooks/useTheme";
import { formatMoney } from "@/lib/money";
import { useT } from "@/components/i18n/LocaleProvider";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

type Metrics = {
  students: number;
  teachers: number;
  classes: number;
  attendanceRate: number | null;
  outstanding: number;
  overdueCount: number;
  collectedThisMonth: number;
};

const quickActions = [
  { href: "/dashboard/invoices", label: "Issue invoices", icon: Receipt },
  { href: "/dashboard/attendance", label: "Take attendance", icon: CalendarDays },
  { href: "/dashboard/results", label: "Enter results", icon: ClipboardList },
  { href: "/dashboard/students", label: "Add students", icon: GraduationCap },
  { href: "/dashboard/announcements", label: "Post announcement", icon: Megaphone },
];

function greetingKey(hour: number): "topbar.greeting.morning" | "topbar.greeting.afternoon" | "topbar.greeting.evening" {
  if (hour < 12) return "topbar.greeting.morning";
  if (hour < 17) return "topbar.greeting.afternoon";
  return "topbar.greeting.evening";
}

export function AdminOverview() {
  const { t } = useT();
  const { dark } = useTheme();
  const { profile } = useCurrentProfile();
  const [metrics, setMetrics] = useState<Metrics>({
    students: 0,
    teachers: 0,
    classes: 0,
    attendanceRate: null,
    outstanding: 0,
    overdueCount: 0,
    collectedThisMonth: 0,
  });
  const [performanceData, setPerformanceData] = useState<Array<{ subject: string; avg: number }>>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSchoolSettings();

  useEffect(() => {
    void fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [
        { count: studentCount },
        { count: teacherCount },
        { count: classCount },
        { data: attendance },
        { data: results },
        { data: invoices },
        { data: payments },
      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("teachers").select("*", { count: "exact", head: true }),
        supabase.from("classes").select("*", { count: "exact", head: true }),
        supabase.from("attendance").select("status").gte("date", since.toISOString().slice(0, 10)),
        supabase.from("results").select("total_score, subjects(name)").limit(5000),
        supabase.from("invoices").select("total_amount, amount, amount_paid, status"),
        supabase.from("payments").select("amount, status, created_at").eq("status", "success").gte("created_at", monthStart.toISOString()),
      ]);

      const total = attendance?.length || 0;
      const present = attendance?.filter((r) => ["present", "late"].includes(String(r.status).toLowerCase())).length || 0;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

      const grouped: Record<string, number[]> = {};
      for (const r of (results as any[]) || []) {
        const name = r.subjects?.name || "Unknown";
        (grouped[name] ||= []).push(Number(r.total_score || 0));
      }
      const avgBySubject = Object.keys(grouped)
        .map((subject) => ({ subject, avg: Math.round((grouped[subject].reduce((a, b) => a + b, 0) / grouped[subject].length) * 10) / 10 }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 12);

      let outstanding = 0;
      let overdueCount = 0;
      const breakdown: Record<string, number> = {};
      for (const inv of (invoices as any[]) || []) {
        const t = Number(inv.total_amount ?? inv.amount ?? 0);
        const p = Number(inv.amount_paid ?? 0);
        if (inv.status !== "cancelled") outstanding += Math.max(t - p, 0);
        if (inv.status === "overdue") overdueCount += 1;
        breakdown[inv.status] = (breakdown[inv.status] || 0) + 1;
      }

      const collectedThisMonth = ((payments as any[]) || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      setMetrics({
        students: studentCount || 0,
        teachers: teacherCount || 0,
        classes: classCount || 0,
        attendanceRate,
        outstanding,
        overdueCount,
        collectedThisMonth,
      });
      setPerformanceData(avgBySubject);
      setStatusBreakdown(breakdown);
    } catch (err: any) {
      setError(err?.message || "Could not load metrics");
    } finally {
      setLoading(false);
    }
  };

  // Chart.js paints to a canvas, so CSS variables can't be used directly;
  // pick palette values that match the active theme instead.
  const palette = useMemo(
    () => ({
      text: dark ? "#94a3b8" : "#64748b",
      grid: dark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.14)",
      bar: dark ? "#34d399" : "#10b981",
      barHover: dark ? "#6ee7b7" : "#059669",
      status: {
        pending: dark ? "#fbbf24" : "#f59e0b",
        partial: dark ? "#60a5fa" : "#3b82f6",
        paid: dark ? "#34d399" : "#10b981",
        overdue: dark ? "#fb7185" : "#ef4444",
        cancelled: dark ? "#64748b" : "#94a3b8",
      } as Record<string, string>,
    }),
    [dark]
  );

  const performanceChart = {
    labels: performanceData.map((p) => p.subject),
    datasets: [
      {
        label: "Average score",
        data: performanceData.map((p) => p.avg),
        backgroundColor: palette.bar,
        hoverBackgroundColor: palette.barHover,
        borderRadius: 6,
        maxBarThickness: 36,
      },
    ],
  };

  const performanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 100, grid: { color: palette.grid }, ticks: { color: palette.text }, border: { display: false } },
      x: { grid: { display: false }, ticks: { color: palette.text }, border: { display: false } },
    },
  };

  const statusLabels = ["pending", "partial", "paid", "overdue", "cancelled"].filter((s) => statusBreakdown[s]);
  const invoiceChart = {
    labels: statusLabels,
    datasets: [
      {
        data: statusLabels.map((s) => statusBreakdown[s]),
        backgroundColor: statusLabels.map((s) => palette.status[s]),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const invoiceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: { legend: { position: "bottom" as const, labels: { color: palette.text, usePointStyle: true, boxWidth: 8 } } },
  };

  const firstName = (profile?.fullName || "").split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="space-y-12">
      <PageHeader eyebrow="Analytics" title={t("page.overview.title")} description={t("page.overview.subtitle")} />

      {/* Welcome banner */}
      <section className="border-y border-border/70 py-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{today}</p>
            <h2 className="text-2xl font-semibold md:text-3xl">
              {t(greetingKey(new Date().getHours()))}
              {firstName ? `, ${firstName}` : ""}
            </h2>
            <p className="text-muted-foreground">{t("overview.welcome", { school: settings.name })}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("overview.quickActions")}</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-foreground"
                >
                  <Icon size={13} /> {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <AnnouncementsPanel />

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active students" value={metrics.students.toLocaleString()} icon={<Users size={18} />} loading={loading} />
        <StatCard label="Teachers" value={metrics.teachers.toLocaleString()} icon={<UserCheck size={18} />} tone="info" loading={loading} />
        <StatCard label="Classes" value={metrics.classes.toLocaleString()} icon={<School size={18} />} tone="neutral" loading={loading} />
        <StatCard
          label="Attendance (30d)"
          value={metrics.attendanceRate === null ? "—" : `${metrics.attendanceRate}%`}
          icon={<CalendarCheck size={18} />}
          loading={loading}
        />
        <StatCard label="Collected this month" value={formatMoney(metrics.collectedThisMonth, settings.currency)} icon={<Wallet size={18} />} loading={loading} />
        <StatCard
          label="Outstanding fees"
          value={formatMoney(metrics.outstanding, settings.currency)}
          hint={metrics.overdueCount ? <span className="font-medium text-warning">{metrics.overdueCount} overdue</span> : undefined}
          icon={<AlertTriangle size={18} />}
          tone={metrics.overdueCount ? "warning" : "neutral"}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Average score by subject</CardTitle>
              <CardDescription className="mt-1">Top 12 subjects across all entered results.</CardDescription>
            </div>
            <Link href="/dashboard/reports/grades" className="inline-flex items-center gap-1 text-xs font-semibold">
              Report <ArrowUpRight size={14} />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : performanceData.length === 0 ? (
              <EmptyState illustration="chart" title="No results yet" description="Averages appear once teachers enter CA and exam scores." />
            ) : (
              <div className="h-72">
                <Bar data={performanceChart} options={performanceOptions} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Invoices by status</CardTitle>
              <CardDescription className="mt-1">All invoices issued to date.</CardDescription>
            </div>
            <Link href="/dashboard/reports/fees" className="inline-flex items-center gap-1 text-xs font-semibold">
              Arrears <ArrowUpRight size={14} />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : statusLabels.length === 0 ? (
              <EmptyState illustration="inbox" title="No invoices yet" description="Create invoices from the Invoices page." />
            ) : (
              <div className="h-72">
                <Doughnut data={invoiceChart} options={invoiceOptions} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
