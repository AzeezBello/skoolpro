"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { EnterResults } from "@/components/dashboard/EnterResults";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";

export default function ResultsPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role !== "admin" && profile?.role !== "teacher") {
    return <RestrictedNotice message="Results are entered by teachers and admins. See your own report card from your dashboard." />;
  }

  return <EnterResults />;
}
