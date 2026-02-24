"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Users, UserCheck, School, Book } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, ArcElement, Title, Tooltip, Legend);

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    attendanceRate: 0,
  });
  const [performanceData, setPerformanceData] = useState<any[]>([]);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    const [{ count: studentCount }, { count: teacherCount }, { count: classCount }] =
      await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("teachers").select("*", { count: "exact", head: true }),
        supabase.from("classes").select("*", { count: "exact", head: true }),
      ]);

    const { data: attendance } = await supabase.from("attendance").select("status");
    const total = attendance?.length || 0;
    const present = attendance?.filter((r) => r.status === "Present").length || 0;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    const { data: grades } = await supabase.from("grades").select("subject, score");
    const grouped = grades?.reduce<Record<string, number[]>>((acc, g: { subject: string; score: number }) => {
      acc[g.subject] = acc[g.subject] || [];
      acc[g.subject].push(g.score);
      return acc;
    }, {});

    const avgBySubject =
      grouped &&
      Object.keys(grouped).map((subject) => ({
        subject,
        avg: grouped[subject].reduce((a, b) => a + b, 0) / grouped[subject].length,
      }));

    setMetrics({
      students: studentCount || 0,
      teachers: teacherCount || 0,
      classes: classCount || 0,
      attendanceRate,
    });
    setPerformanceData(avgBySubject || []);
  };

  // Chart.js Data
  const attendanceData = {
    labels: ["Attendance Rate"],
    datasets: [
      {
        label: "Percentage",
        data: [metrics.attendanceRate],
        backgroundColor: ["#22c55e"],
      },
    ],
  };

  const performanceChart = {
    labels: performanceData.map((p) => p.subject),
    datasets: [
      {
        label: "Average Score",
        data: performanceData.map((p) => p.avg),
        backgroundColor: "#3b82f6",
      },
    ],
  };

  return (
    <main className="space-y-10 p-4 md:p-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Analytics</p>
          <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Live view of attendance, grades, and staffing.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Total Students" value={metrics.students} icon={<Users size={28} />} />
        <MetricCard title="Total Teachers" value={metrics.teachers} icon={<UserCheck size={28} />} />
        <MetricCard title="Total Classes" value={metrics.classes} icon={<School size={28} />} />
        <MetricCard title="Attendance Rate" value={`${metrics.attendanceRate}%`} icon={<Book size={28} />} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Grades by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <Bar data={performanceChart} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overall Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <Pie data={attendanceData} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: any; icon: any }) {
  return (
    <Card className="flex flex-col items-center justify-center bg-card/80 text-center">
      <CardContent className="flex w-full flex-col items-center gap-2 pt-6">
        <div className="rounded-full bg-primary/15 p-3 text-primary">{icon}</div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
