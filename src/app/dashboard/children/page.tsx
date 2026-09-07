"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { ParentSelfView } from "@/components/dashboard/ParentSelfView";

export default function ChildrenPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (profile?.role !== "parent") return <RestrictedNotice message="This page is for parent and guardian accounts." />;

  return <ParentSelfView />;
}
