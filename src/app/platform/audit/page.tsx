"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authFetch } from "@/lib/client/authFetch";

interface AuditRow {
  id: string;
  startedAt: string;
  platformAdminEmail: string | null;
  targetUserEmail: string | null;
  targetSchoolName: string | null;
}

export default function PlatformAuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLog();
  }, []);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/platform/audit-log");
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to load audit log");
        return;
      }
      setRows(json.data || []);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Impersonation audit log</h1>
        <p className="text-sm text-gray-400">Every &quot;log in as&quot; action, most recent first.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No impersonation events yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Platform admin</th>
                <th className="p-3">Impersonated</th>
                <th className="p-3">School</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="p-3 text-gray-300">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="p-3 text-gray-300">{r.platformAdminEmail || "—"}</td>
                  <td className="p-3 text-gray-300">{r.targetUserEmail || "—"}</td>
                  <td className="p-3 text-gray-300">{r.targetSchoolName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
