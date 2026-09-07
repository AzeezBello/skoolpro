"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { ManageSubjects } from "@/components/dashboard/ManageSubjects";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";

export default function SubjectsPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role !== "admin") {
    return <RestrictedNotice message="Subjects are managed by school admins." />;
  }

  return <ManageSubjects />;
}
