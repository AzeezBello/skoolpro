"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { AdminOverview } from "@/components/dashboard/AdminOverview";
import { Skeleton } from "@/components/ui/skeleton";

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
    return (
      <div className="space-y-6" role="status" aria-label="Loading">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return <AdminOverview />;
}
