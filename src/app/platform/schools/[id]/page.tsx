"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { authFetch } from "@/lib/client/authFetch";

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
    return <p className="text-sm text-gray-400">Loading...</p>;
  }

  if (!detail) {
    return <p className="text-sm text-gray-400">School not found.</p>;
  }

  const { school, counts, staff } = detail;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{school.name}</h1>
        <p className="text-sm text-gray-400">
          {school.slug ? `${school.slug} · ` : ""}
          <span className={school.status === "active" ? "text-green-400" : "text-red-400"}>{school.status}</span>
        </p>
      </div>

      <form onSubmit={savePlan} className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-gray-900 p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Plan</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="rounded-md border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white">
            <option value="free">Free</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Duration (months)</label>
          <input type="number" min={1} value={planMonths} onChange={(e) => setPlanMonths(e.target.value)} className="w-24 rounded-md border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white" />
        </div>
        <button type="submit" disabled={savingPlan} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50">
          {savingPlan ? "Saving..." : "Set plan"}
        </button>
        <span className="text-xs text-gray-400">
          Current: {school.plan_id || "free"}{school.plan_expires_at ? ` until ${new Date(school.plan_expires_at).toLocaleDateString()}` : ""}
        </span>
      </form>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-gray-900 p-4 text-center">
          <p className="text-2xl font-semibold">{counts.students}</p>
          <p className="text-xs text-gray-400">Students</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-gray-900 p-4 text-center">
          <p className="text-2xl font-semibold">{counts.teachers}</p>
          <p className="text-xs text-gray-400">Teachers</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-gray-900 p-4 text-center">
          <p className="text-2xl font-semibold">{counts.classes}</p>
          <p className="text-xs text-gray-400">Classes</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Staff</h2>
        {staff.length === 0 ? (
          <p className="text-sm text-gray-400">No admin or teacher accounts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-gray-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Email</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="p-3 font-medium">{s.fullName}</td>
                    <td className="p-3 capitalize text-gray-300">{s.role}</td>
                    <td className="p-3 text-gray-300">{s.email || "—"}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => impersonate(s)}
                        disabled={impersonatingId === s.id}
                        className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-950 transition hover:bg-amber-400 disabled:opacity-50"
                      >
                        {impersonatingId === s.id ? "Starting..." : "Impersonate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form
          onSubmit={assignAdmin}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-gray-900 p-6"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">Assign an existing account as admin</label>
            <input
              type="email"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="parent@example.com"
              className="w-full rounded-md border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={assigning}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {assigning ? "Assigning..." : "Assign admin"}
          </button>
        </form>
        <p className="text-xs text-gray-500">
          The account must already exist (they need to have signed up at least once) — this only reassigns their
          role and school.
        </p>
      </div>
    </div>
  );
}
