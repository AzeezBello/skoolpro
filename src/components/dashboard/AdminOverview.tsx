"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
import { Users, UserCheck, School, CalendarCheck, Wallet, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AnnouncementsPanel } from "@/components/dashboard/AnnouncementsPanel";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
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

export function AdminOverview() {
  const { t } = useT();
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

  const performanceChart = {
    labels: performanceData.map((p) => p.subject),
    datasets: [{ label: "Average score", data: performanceData.map((p) => p.avg), backgroundColor: "#3b82f6" }],
  };

  const statusLabels = ["pending", "partial", "paid", "overdue", "cancelled"].filter((s) => statusBreakdown[s]);
  const statusColors: Record<string, string> = { pending: "#f59e0b", partial: "#3b82f6", paid: "#22c55e", overdue: "#ef4444", cancelled: "#6b7280" };
  const invoiceChart = {
    labels: statusLabels,
    datasets: [{ data: statusLabels.map((s) => statusBreakdown[s]), backgroundColor: statusLabels.map((s) => statusColors[s]) }],
  };

  return (
    <main className="space-y-8 p-2 md:p-4">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-primary">Analytics</p>
        <h1 className="text-3xl font-semibold">{t("page.overview.title")}</h1>
        <p className="text-muted-foreground">{t("page.overview.subtitle")}</p>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <AnnouncementsPanel />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Active Students" value={metrics.students} icon={<Users size={24} />} />
        <MetricCard title="Teachers" value={metrics.teachers} icon={<UserCheck size={24} />} />
        <MetricCard title="Classes" value={metrics.classes} icon={<School size={24} />} />
        <MetricCard title="Attendance (30d)" value={metrics.attendanceRate === null ? "—" : `${metrics.attendanceRate}%`} icon={<CalendarCheck size={24} />} />
        <MetricCard title="Collected this month" value={formatMoney(metrics.collectedThisMonth, settings.currency)} icon={<Wallet size={24} />} />
        <MetricCard
          title="Outstanding fees"
          value={formatMoney(metrics.outstanding, settings.currency)}
          hint={metrics.overdueCount ? `${metrics.overdueCount} overdue` : undefined}
          icon={<AlertTriangle size={24} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average score by subject</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : performanceData.length === 0 ? (
              <EmptyState title="No results yet" description="Averages appear once teachers enter CA and exam scores." />
            ) : (
              <Bar data={performanceChart} options={{ scales: { y: { min: 0, max: 100 } } }} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices by status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : statusLabels.length === 0 ? (
              <EmptyState title="No invoices yet" description="Create invoices from the Invoices page." />
            ) : (
              <div className="mx-auto max-w-xs">
                <Doughnut data={invoiceChart} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetricCard({ title, value, icon, hint }: { title: string; value: string | number; icon: React.ReactNode; hint?: string }) {
  return (
    <Card className="bg-card/80">
      <CardContent className="flex flex-col gap-2 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          <div className="rounded-full bg-primary/15 p-2 text-primary">{icon}</div>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-amber-400">{hint}</p>}
      </CardContent>
    </Card>
  );
}
