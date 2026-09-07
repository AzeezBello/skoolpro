"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { ManageClasses } from "@/components/dashboard/ManageClasses";

export default function ClassesPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (profile?.role !== "admin") return <RestrictedNotice message="Classes are managed by school admins." />;

  return <ManageClasses />;
}
