"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        Checking authentication...
      </div>
    );
  }

  return <>{children}</>;
}
