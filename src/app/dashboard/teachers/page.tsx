"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { TeacherSelfView } from "@/components/dashboard/TeacherSelfView";
import { ManageTeachers } from "@/components/dashboard/ManageTeachers";

export default function TeachersPage() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role === "teacher") {
    return <TeacherSelfView />;
  }

  return <ManageTeachers canEdit={profile?.role === "admin"} />;
}
