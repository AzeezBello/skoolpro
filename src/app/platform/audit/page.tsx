"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authFetch } from "@/lib/client/authFetch";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";

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
    <div className="space-y-8">
      <PageHeader eyebrow="Platform" title="Impersonation audit log" description='Every "log in as" action, most recent first.' />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState illustration="inbox" title="No impersonation events yet" description="Entries appear here whenever an operator logs in as a school user." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-3">When</th>
                    <th className="p-3">Platform admin</th>
                    <th className="p-3">Impersonated</th>
                    <th className="p-3">School</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-2">
                          <Avatar name={r.platformAdminEmail || "?"} size={26} />
                          {r.platformAdminEmail || "—"}
                        </span>
                      </td>
                      <td className="p-3">{r.targetUserEmail || "—"}</td>
                      <td className="p-3 text-muted-foreground">{r.targetSchoolName || "—"}</td>
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
