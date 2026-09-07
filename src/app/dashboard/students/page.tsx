"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { StudentSelfView } from "@/components/dashboard/StudentSelfView";
import { ManageStudents } from "@/components/dashboard/ManageStudents";

export default function StudentsPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role === "student") {
    return <StudentSelfView />;
  }

  return <ManageStudents canEdit={profile?.role === "admin"} />;
}
