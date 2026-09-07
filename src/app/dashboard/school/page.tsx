"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { ManageSchoolProfile } from "@/components/dashboard/ManageSchoolProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { ApiTokensPanel } from "@/components/dashboard/ApiTokensPanel";
import { PlanPanel } from "@/components/dashboard/PlanPanel";
import { GradingConfigPanel } from "@/components/dashboard/GradingConfigPanel";

export default function SchoolProfilePage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role !== "admin") {
    return <RestrictedNotice message="The school profile is managed by school admins." />;
  }

  return (
    <div className="space-y-8">
      <ManageSchoolProfile />
      <GradingConfigPanel />
      <PlanPanel />
      <ApiTokensPanel />
    </div>
  );
}
