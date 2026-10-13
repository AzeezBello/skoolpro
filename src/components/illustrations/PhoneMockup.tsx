import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/Logo";

/**
 * Parent-portal mockup inside a phone frame. Decorative markup, no live data.
 */
export function PhoneMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto w-[240px] rounded-[2.2rem] border border-white/15 bg-[#0b1220] p-2 shadow-soft ring-1 ring-white/5",
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[1.7rem] bg-[#0f172a] text-[10px] text-slate-200">
        <div className="flex items-center justify-between px-4 pb-2 pt-8">
          <div className="flex items-center gap-1.5">
            <LogoMark size={16} />
            <span className="font-semibold text-white">Parent portal</span>
          </div>
          <span className="h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 to-sky-400" />
        </div>

        <div className="space-y-2.5 px-3 pb-4">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/25 to-sky-500/10 p-3 ring-1 ring-emerald-400/30">
            <p className="text-[9px] uppercase tracking-widest text-emerald-200">Adaeze · JSS 2A</p>
            <p className="mt-1 text-sm font-semibold text-white">Attendance 97%</p>
            <p className="text-[9px] text-slate-300">Present 58 of 60 days this term</p>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-white">Term 2 invoice</span>
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">Due in 5 days</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] text-slate-400">Balance</p>
                <p className="text-sm font-semibold text-white">₦85,000</p>
              </div>
              <span className="rounded-full bg-emerald-400 px-3 py-1 text-[9px] font-semibold text-emerald-950">Pay now</span>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5">
            <p className="mb-1.5 font-medium text-white">Results published</p>
            {[
              ["Mathematics", "A", "92"],
              ["English", "B", "78"],
              ["Basic Science", "A", "88"],
            ].map(([s, g, m]) => (
              <div key={s} className="flex items-center justify-between py-1 text-[9px]">
                <span className="text-slate-300">{s}</span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-400">{m}</span>
                  <span className="rounded bg-emerald-400/20 px-1.5 font-semibold text-emerald-200">{g}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5">
            <p className="font-medium text-white">Announcement</p>
            <p className="text-[9px] text-slate-400">PTA meeting on Friday at 10am in the main hall.</p>
          </div>
        </div>

        <div className="flex items-center justify-around border-t border-white/5 py-2 text-[9px] text-slate-500">
          <span className="text-emerald-300">Home</span>
          <span>Fees</span>
          <span>Results</span>
          <span>Inbox</span>
        </div>
      </div>
    </div>
  );
}
