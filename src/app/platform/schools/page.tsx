"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Plus, Search } from "lucide-react";
import { authFetch } from "@/lib/client/authFetch";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";

interface SchoolRow {
  id: string;
  name: string;
  slug: string | null;
  status: "active" | "suspended";
  created_at: string;
  studentCount: number;
  teacherCount: number;
  classCount: number;
}

export default function PlatformSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/platform/schools");
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to load schools");
        return;
      }
      setSchools(json.data || []);
    } catch {
      toast.error("Failed to load schools");
    } finally {
      setLoading(false);
    }
  };

  const createSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("School name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await authFetch("/api/platform/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to create school");
        return;
      }
      toast.success("School created");
      setName("");
      setSlug("");
      fetchSchools();
    } catch {
      toast.error("Failed to create school");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (school: SchoolRow) => {
    const nextStatus = school.status === "active" ? "suspended" : "active";
    if (!confirm(`${nextStatus === "suspended" ? "Suspend" : "Reactivate"} ${school.name}?`)) return;

    try {
      const res = await authFetch(`/api/platform/schools/${school.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to update status");
        return;
      }
      toast.success(`School ${nextStatus === "suspended" ? "suspended" : "reactivated"}`);
      fetchSchools();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filtered = schools.filter((s) => {
    const q = query.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.slug || "").toLowerCase().includes(q);
  });
  const totals = schools.reduce(
    (acc, s) => ({
      active: acc.active + (s.status === "active" ? 1 : 0),
      suspended: acc.suspended + (s.status === "suspended" ? 1 : 0),
      students: acc.students + s.studentCount,
      teachers: acc.teachers + s.teacherCount,
    }),
    { active: 0, suspended: 0, students: 0, teachers: 0 }
  );

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Platform" title="Schools" description="Every school on the platform, with suspension, plan and admin controls." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active schools" value={totals.active} loading={loading} />
        <StatCard label="Suspended" value={totals.suspended} tone={totals.suspended ? "danger" : "neutral"} loading={loading} />
        <StatCard label="Students" value={totals.students.toLocaleString()} tone="info" loading={loading} />
        <StatCard label="Teachers" value={totals.teachers.toLocaleString()} tone="neutral" loading={loading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a school</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createSchool} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="school-name">School name</Label>
              <Input id="school-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bright Future Academy" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-slug">Slug (optional)</Label>
              <Input id="school-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated if blank" />
            </div>
            <Button type="submit" loading={creating}>
              <Plus size={15} /> {creating ? "Creating..." : "Create school"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All schools</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or slug" className="pl-9" aria-label="Search schools" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonRows rows={5} />
          ) : schools.length === 0 ? (
            <EmptyState illustration="folder" title="No schools yet" description="Create the first school above or wait for a sign-up." />
          ) : filtered.length === 0 ? (
            <EmptyState illustration="search" title="No matches" description="Try a different name or slug." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Students</th>
                    <th className="p-3 text-right">Teachers</th>
                    <th className="p-3 text-right">Classes</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="p-3">
                        <Link href={`/platform/schools/${s.id}`} className="font-semibold text-foreground hover:text-primary">
                          {s.name}
                        </Link>
                        {s.slug && <p className="text-xs text-muted-foreground">{s.slug}</p>}
                      </td>
                      <td className="p-3">
                        <Badge variant={s.status === "active" ? "success" : "danger"} dot>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums">{s.studentCount}</td>
                      <td className="p-3 text-right tabular-nums">{s.teacherCount}</td>
                      <td className="p-3 text-right tabular-nums">{s.classCount}</td>
                      <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant={s.status === "active" ? "outline" : "soft"} onClick={() => toggleStatus(s)}>
                          {s.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
