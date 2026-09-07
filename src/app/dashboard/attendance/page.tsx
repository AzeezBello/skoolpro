"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { AttendanceSheet } from "@/components/dashboard/AttendanceSheet";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useT } from "@/components/i18n/LocaleProvider";

export default function AttendancePage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileLoading || !profile) return;
    if (profile.role !== "admin" && profile.role !== "teacher") {
      setLoading(false);
      return;
    }

    (async () => {
      // Teachers see the classes they're assigned to; admins see all.
      let query = supabase.from("classes").select("id, name").order("name");
      if (profile.role === "teacher") {
        query = query.eq("teacher_id", profile.relatedId || profile.userId);
      }
      const { data, error } = await query;
      if (error) toast.error(error.message);
      setClasses(data || []);
      setLoading(false);
    })();
  }, [profile, profileLoading]);

  if (profileLoading || loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile?.role !== "admin" && profile?.role !== "teacher") {
    return <RestrictedNotice message="Attendance is recorded by teachers and admins." />;
  }

  return <AttendanceSheet classes={classes} title={t("page.attendance.title")} />;
}
