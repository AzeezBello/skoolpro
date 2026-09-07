import ProtectedRoute from "@/components/ProtectedRoute";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <OnboardingProvider>
        <DashboardShell>{children}</DashboardShell>
      </OnboardingProvider>
    </ProtectedRoute>
  );
}
