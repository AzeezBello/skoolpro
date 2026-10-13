import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/Logo";

/**
 * Product mockup of the admin dashboard, built from plain markup so it stays
 * crisp at any size, follows the brand palette, and never goes stale the way
 * a screenshot would. Purely decorative: no live data.
 */
export function DashboardMockup({ className }: { className?: string }) {
  const bars = [62, 78, 55, 90, 70, 84, 66, 95, 73, 88, 60, 81];
  const rows = [
    { name: "Adaeze Okafor", cls: "JSS 2A", status: "Paid", tone: "bg-emerald-400/20 text-emerald-300" },
    { name: "Tunde Balogun", cls: "SS 1B", status: "Partial", tone: "bg-sky-400/20 text-sky-300" },
    { name: "Fatima Bello", cls: "JSS 3C", status: "Overdue", tone: "bg-rose-400/20 text-rose-300" },
    { name: "Chidi Nwosu", cls: "SS 3A", status: "Paid", tone: "bg-emerald-400/20 text-emerald-300" },
  ];
  const nav = ["Overview", "Students", "Attendance", "Results", "Invoices", "Messages"];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] text-[11px] text-slate-200 shadow-soft ring-1 ring-white/5",
        className
      )}
      aria-hidden="true"
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <div className="ml-3 flex h-5 flex-1 items-center rounded-md bg-white/5 px-2 text-[10px] text-slate-400">
          app.skoolpro.app/dashboard
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[112px_1fr]">
        {/* sidebar */}
        <aside className="hidden flex-col gap-1 border-r border-white/5 bg-white/[0.02] p-3 sm:flex">
          <div className="mb-3 flex items-center gap-1.5">
            <LogoMark size={16} />
            <span className="font-semibold text-white">SkoolPro</span>
          </div>
          {nav.map((item, i) => (
            <div
              key={item}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5",
                i === 0 ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30" : "text-slate-400"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-sm", i === 0 ? "bg-emerald-300" : "bg-slate-600")} />
              {item}
            </div>
          ))}
        </aside>

        {/* content */}
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.25em] text-emerald-300">Analytics</p>
              <p className="text-sm font-semibold text-white">Admin Dashboard</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-white/10" />
              <span className="h-5 w-5 rounded-full bg-white/10" />
              <span className="h-5 w-12 rounded-full bg-emerald-400/90" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ["Active students", "1,248", "+3.2%"],
              ["Attendance (30d)", "96%", "+1.1%"],
              ["Collected", "₦8.4m", "+12%"],
              ["Outstanding", "₦1.9m", "14 overdue"],
            ].map(([label, value, delta]) => (
              <div key={label} className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                <p className="text-[9px] text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
                <p className="text-[9px] text-emerald-300">{delta}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 md:col-span-3">
              <p className="mb-2 text-[10px] font-medium text-slate-300">Average score by subject</p>
              <div className="flex h-20 items-end gap-1">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="animate-grow flex-1 rounded-sm bg-gradient-to-t from-emerald-500/60 to-emerald-300"
                    style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 md:col-span-2">
              <p className="mb-2 text-[10px] font-medium text-slate-300">Invoices by status</p>
              <div className="flex items-center gap-3">
                <div
                  className="h-16 w-16 shrink-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(#34d399 0 62%, #38bdf8 62% 80%, #fb7185 80% 92%, #475569 92% 100%)",
                    WebkitMask: "radial-gradient(circle, transparent 55%, #000 56%)",
                    mask: "radial-gradient(circle, transparent 55%, #000 56%)",
                  }}
                />
                <ul className="space-y-1 text-[9px] text-slate-400">
                  <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Paid 62%</li>
                  <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />Partial 18%</li>
                  <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />Overdue 12%</li>
                  <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />Pending 8%</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/5 bg-white/[0.03]">
            <div className="grid grid-cols-3 gap-2 border-b border-white/5 px-2.5 py-1.5 text-[9px] uppercase tracking-wider text-slate-500">
              <span>Student</span>
              <span>Class</span>
              <span className="text-right">Invoice</span>
            </div>
            {rows.map((r) => (
              <div key={r.name} className="grid grid-cols-3 items-center gap-2 border-b border-white/5 px-2.5 py-1.5 last:border-0">
                <span className="truncate text-slate-200">{r.name}</span>
                <span className="text-slate-400">{r.cls}</span>
                <span className="text-right">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", r.tone)}>{r.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
