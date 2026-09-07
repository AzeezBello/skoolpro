"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type CurrentProfile = {
  userId: string;
  email: string | null;
  role: string | null;
  fullName: string | null;
  schoolId: string | null;
  relatedId: string | null;
};

// Shared by every page that needs to branch its UI on the caller's role
// (e.g. admin gets a management CRUD screen, the "home" role for that page
// gets its own self-service view, everyone else gets a read-only list).
export function useCurrentProfile() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name, school_id, related_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted) return;

      if (profileError) setError(profileError.message);
      setProfile({
        userId: user.id,
        email: user.email ?? null,
        role: typeof data?.role === "string" ? data.role : null,
        fullName: data?.full_name ?? null,
        schoolId: data?.school_id ?? null,
        relatedId: data?.related_id ?? null,
      });
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { profile, loading, error };
}
