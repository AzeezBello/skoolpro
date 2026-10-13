import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";

/**
 * Shared frame for the public site and auth pages: always light, plain white
 * canvas, sticky header and footer. Pages supply their own <main>.
 */
export function MarketingLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("light flex min-h-screen flex-col overflow-x-hidden bg-white text-slate-900", className)}>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
