"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Topbar() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-white/5 bg-gray-950/70 px-6 py-4 backdrop-blur">
      <div className="text-sm uppercase tracking-[0.25em] text-primary">SkoolPro</div>
      <div className="flex items-center gap-3 text-sm text-gray-200">
        <span className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
          <UserRound size={16} />
          {email || "Signed in"}
        </span>
        <Button variant="destructive" onClick={handleLogout} className="h-9 px-3">
          <LogOut size={14} className="mr-1" />
          Logout
        </Button>
      </div>
    </header>
  );
}
