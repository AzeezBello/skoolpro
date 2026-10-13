"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell flex min-h-screen bg-background text-foreground">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <div className="flex-1 px-5 pb-24 pt-8 md:px-12 md:pt-12">
          <div className="mx-auto w-full max-w-[1320px] animate-fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}
