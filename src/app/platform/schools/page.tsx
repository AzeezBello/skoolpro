"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { authFetch } from "@/lib/client/authFetch";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Schools</h1>
        <p className="text-sm text-gray-400">Every school on the platform.</p>
      </div>

      <form
        onSubmit={createSchool}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-gray-900 p-6"
      >
        <div>
          <label className="mb-1 block text-xs text-gray-400">School name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Slug (optional)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated if blank"
            className="rounded-md border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create school"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : schools.length === 0 ? (
        <p className="text-sm text-gray-400">No schools yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Status</th>
                <th className="p-3">Students</th>
                <th className="p-3">Teachers</th>
                <th className="p-3">Classes</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="p-3 font-medium">
                    <Link href={`/platform/schools/${s.id}`} className="text-amber-300 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        s.status === "active" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-300">{s.studentCount}</td>
                  <td className="p-3 text-gray-300">{s.teacherCount}</td>
                  <td className="p-3 text-gray-300">{s.classCount}</td>
                  <td className="p-3 text-gray-400">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => toggleStatus(s)}
                      className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      {s.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
