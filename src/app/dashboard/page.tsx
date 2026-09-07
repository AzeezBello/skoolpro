"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { AdminOverview } from "@/components/dashboard/AdminOverview";

const HOME_BY_ROLE: Record<string, string> = {
  teacher: "/dashboard/teachers",
  student: "/dashboard/students",
  parent: "/dashboard/children",
};

// School-wide aggregate metrics only make sense for admins; every other role
// is sent to its own home page.
export default function DashboardOverviewPage() {
  const { profile, loading } = useCurrentProfile();
  const router = useRouter();
  const home = profile?.role ? HOME_BY_ROLE[profile.role] : undefined;

  useEffect(() => {
    if (loading) return;
    if (home) router.replace(home);
  }, [loading, home, router]);

  if (loading || home) {
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }

  return <AdminOverview />;
}
