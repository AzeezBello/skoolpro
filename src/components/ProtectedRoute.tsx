"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Client-side gate for the dashboard shell. The middleware already refuses
// unauthenticated requests; this additionally routes accounts that have no
// school yet to onboarding, and suspended schools to a notice.
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"checking" | "ok" | "suspended">("checking");

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id, schools:school_id(status)")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!profile?.school_id) {
        router.replace("/onboarding");
        return;
      }

      const status = (profile as any)?.schools?.status;
      if (status && status !== "active") {
        setState("suspended");
        return;
      }

      setState("ok");
    })();

    return () => {
      mounted = false;
    };
  }, [router, pathname]);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Checking authentication...
      </div>
    );
  }

  if (state === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold">School suspended</h1>
          <p className="text-sm text-muted-foreground">
            Access to this school is currently suspended. Please contact SkoolPro support.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
