"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, KeyRound, UserPlus } from "lucide-react";
import { authFetch } from "@/lib/client/authFetch";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

interface StaffMember {
  id: string;
  fullName: string;
  role: string;
  email: string | null;
}

interface SchoolDetail {
  school: { id: string; name: string; slug: string | null; status: "active" | "suspended"; created_at: string; plan_id?: string; plan_expires_at?: string | null };
  counts: { students: number; teachers: number; classes: number };
  staff: StaffMember[];
}

export default function PlatformSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const schoolId = params.id;
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [planId, setPlanId] = useState("free");
  const [planMonths, setPlanMonths] = useState("12");
  const [savingPlan, setSavingPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignEmail, setAssignEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  useEffect(() => {
    if (schoolId) fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/platform/schools/${schoolId}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to load school");
        return;
      }
      setDetail(json.data);
      setPlanId(json.data?.school?.plan_id || "free");
    } catch {
      toast.error("Failed to load school");
    } finally {
      setLoading(false);
    }
  };

  const assignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmail.trim()) {
      toast.error("Enter an email");
      return;
    }
    setAssigning(true);
    try {
      const res = await authFetch(`/api/platform/schools/${schoolId}/assign-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: assignEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to assign admin");
        return;
      }
      toast.success("Admin assigned");
      setAssignEmail("");
      fetchDetail();
    } catch {
      toast.error("Failed to assign admin");
    } finally {
      setAssigning(false);
    }
  };

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const res = await authFetch(`/api/platform/schools/${schoolId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, months: Number(planMonths) }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not update plan");
        return;
      }
      toast.success("Plan updated");
      fetchDetail();
    } finally {
      setSavingPlan(false);
    }
  };

  const impersonate = async (staff: StaffMember) => {
    if (
      !confirm(
        `This logs YOUR browser tab into ${staff.email}'s account (a real session, not a preview). ` +
          `Your own platform-admin session in this tab will be replaced — use a separate browser/incognito ` +
          `window first if you need both at once. This action is logged. Continue?`
      )
    ) {
      return;
    }

    const reason = prompt("Reason for impersonation (recorded in the audit log):")?.trim() || "";
    if (reason.length < 5) {
      toast.error("A reason of at least 5 characters is required");
      return;
    }

    setImpersonatingId(staff.id);
    try {
      const res = await authFetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: staff.id, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to start impersonation");
        return;
      }
      if (json.actionLink) {
        window.location.href = json.actionLink;
      } else {
        toast.error("No impersonation link returned");
      }
    } catch {
      toast.error("Failed to start impersonation");
    } finally {
      setImpersonatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <SkeletonRows rows={4} />
      </div>
    );
  }

  if (!detail) {
    return <EmptyState illustration="search" title="School not found" action={<Link href="/platform/schools" className="text-sm font-semibold">Back to schools</Link>} />;
  }

  const { school, counts, staff } = detail;

  return (
    <div className="space-y-8">
      <Link href="/platform/schools" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> All schools
      </Link>

      <PageHeader
        eyebrow="School"
        title={school.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {school.slug && <span className="font-mono text-xs">{school.slug}</span>}
            <Badge variant={school.status === "active" ? "success" : "danger"} dot>
              {school.status}
            </Badge>
            <Badge variant="info">{(school.plan_id || "free").toUpperCase()} plan</Badge>
            {school.plan_expires_at && <span className="text-xs">until {new Date(school.plan_expires_at).toLocaleDateString()}</span>}
          </span>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Students" value={counts.students} />
        <StatCard label="Teachers" value={counts.teachers} tone="info" />
        <StatCard label="Classes" value={counts.classes} tone="neutral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription plan</CardTitle>
            <CardDescription>Assign a plan and its duration. Limits are enforced by the database.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePlan} className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <select
                  id="plan"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="months">Months</Label>
                <Input id="months" type="number" min={1} value={planMonths} onChange={(e) => setPlanMonths(e.target.value)} />
              </div>
              <Button type="submit" loading={savingPlan}>
                {savingPlan ? "Saving..." : "Set plan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign an admin</CardTitle>
            <CardDescription>
              The account must already exist (they need to have signed up at least once). This only reassigns their role and school.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={assignAdmin} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="assign-email">Email</Label>
                <Input id="assign-email" type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              <Button type="submit" loading={assigning}>
                <UserPlus size={15} /> {assigning ? "Assigning..." : "Assign admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
          <CardDescription>Admin and teacher accounts. Impersonation is audited and requires a reason.</CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <EmptyState illustration="inbox" title="No admin or teacher accounts yet" description="Assign an admin above to get the school started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Email</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td className="p-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={s.fullName || s.email || "?"} size={30} />
                          <span className="font-medium">{s.fullName}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge variant={s.role === "admin" ? "info" : "secondary"}>{s.role}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{s.email || "—"}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" loading={impersonatingId === s.id} onClick={() => impersonate(s)}>
                          <KeyRound size={13} /> {impersonatingId === s.id ? "Starting..." : "Impersonate"}
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
