"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { ManageTeam } from "@/components/dashboard/ManageTeam";

export default function TeamPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role !== "admin") {
    return <RestrictedNotice message="Only school admins can manage team access." />;
  }

  return <ManageTeam />;
}
