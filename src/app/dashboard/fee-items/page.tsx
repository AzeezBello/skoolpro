"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { ManageFeeItems } from "@/components/dashboard/ManageFeeItems";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";

export default function FeeItemsPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role !== "admin") {
    return <RestrictedNotice message="Fee items are managed by school admins." />;
  }

  return <ManageFeeItems />;
}
