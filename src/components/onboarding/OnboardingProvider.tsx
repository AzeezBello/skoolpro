"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { startProductTour } from "@/lib/onboarding/productTour";
import type { Role } from "@/lib/onboarding/content";

type OnboardingContextValue = {
  replayTour: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "teacher" || value === "student";
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [showFlow, setShowFlow] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, onboarding_completed_at")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted || !profile || !isRole(profile.role)) return;

      setRole(profile.role);
      if (!profile.onboarding_completed_at) {
        setShowFlow(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function finishOnboarding(startTour: boolean) {
    setShowFlow(false);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userId) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", userId);
    }

    if (startTour && role) {
      // Give the modal time to unmount and the underlying page to settle
      // before highlighting anything on it.
      window.setTimeout(() => startProductTour(role), 300);
    }
  }

  function replayTour() {
    if (role) startProductTour(role);
  }

  return (
    <OnboardingContext.Provider value={{ replayTour }}>
      {children}
      {showFlow && role && <OnboardingFlow role={role} onFinish={finishOnboarding} />}
    </OnboardingContext.Provider>
  );
}
