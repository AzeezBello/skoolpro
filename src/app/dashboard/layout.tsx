import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen text-foreground">
        <Sidebar />
        <div className="flex-1">
          <Topbar />
          <div className="bg-gradient-to-b from-background via-background/80 to-background px-6 pb-10 pt-4">
            {children}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
