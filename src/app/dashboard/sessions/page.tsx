"use client";

import { useState } from "react";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { ManageSessions, type SessionItem } from "@/components/dashboard/ManageSessions";
import { PromoteStudents } from "@/components/dashboard/PromoteStudents";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";

export default function SessionsPage() {
  const { profile, loading } = useCurrentProfile();
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role !== "admin") {
    return <RestrictedNotice message="Sessions are managed by school admins." />;
  }

  return (
    <div className="space-y-10">
      <ManageSessions onSessionsChange={setSessions} />
      {sessions.length > 0 && (
        <div className="border-t border-border/60 pt-8">
          <PromoteStudents sessions={sessions} />
        </div>
      )}
    </div>
  );
}
