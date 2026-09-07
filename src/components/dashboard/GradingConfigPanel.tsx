"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Award, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_GRADING, parseGradingConfig, type GradeBand, type GradingConfig } from "@/lib/grading";
import { invalidateSchoolSettings } from "@/lib/hooks/useSchoolSettings";

// Per-school CA/exam split and letter scale. Bands are sorted by minimum
// score descending; the lowest band should start at 0.
export function GradingConfigPanel() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [config, setConfig] = useState<GradingConfig>(DEFAULT_GRADING);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("schools")
      .select("id, grading_config")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSchoolId(data.id);
          setConfig(parseGradingConfig(data.grading_config));
        }
      });
  }, []);

  const total = config.ca_max + config.exam_max;

  const updateBand = (i: number, patch: Partial<GradeBand>) =>
    setConfig({ ...config, scale: config.scale.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });

  const save = async () => {
    if (!schoolId) return;
    if (config.ca_max <= 0 || config.exam_max < 0) return toast.error("Maximum scores must be positive");
    const scale = [...config.scale].filter((b) => b.grade.trim()).sort((a, b) => b.min - a.min);
    if (scale.length === 0) return toast.error("Add at least one grade band");
    if (scale[scale.length - 1].min !== 0) return toast.error("The lowest band must start at 0");
    if (scale.some((b) => b.min > total)) return toast.error(`Band minimums cannot exceed the total of ${total}`);
    setSaving(true);
    const { error } = await supabase.from("schools").update({ grading_config: { ...config, scale } }).eq("id", schoolId);
    setSaving(false);
    if (error) return toast.error(error.message);
    invalidateSchoolSettings();
    setConfig({ ...config, scale });
    toast.success("Grading settings saved");
  };

  return (
    <section className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Award size={18} /> Grading</h2>
      <p className="mb-4 text-sm text-muted-foreground">Score split and letter grades used on results entry and report cards.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">CA maximum</span>
          <input type="number" min={1} value={config.ca_max} onChange={(e) => setConfig({ ...config, ca_max: Number(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Exam maximum</span>
          <input type="number" min={0} value={config.exam_max} onChange={(e) => setConfig({ ...config, exam_max: Number(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <div className="text-sm">
          <span className="mb-1 block text-muted-foreground">Total</span>
          <p className="rounded-md border border-border bg-background/60 px-3 py-2">{total}</p>
        </div>
      </div>

      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-muted-foreground"><tr><th className="p-2">From score</th><th className="p-2">Grade</th><th className="p-2">Remark</th><th className="p-2"></th></tr></thead>
        <tbody>
          {config.scale.map((b, i) => (
            <tr key={i} className="border-t border-border/60">
              <td className="p-2"><input type="number" min={0} max={total} value={b.min} onChange={(e) => updateBand(i, { min: Number(e.target.value) })} className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" /></td>
              <td className="p-2"><input value={b.grade} onChange={(e) => updateBand(i, { grade: e.target.value.toUpperCase().slice(0, 3) })} className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm" /></td>
              <td className="p-2"><input value={b.remark || ""} onChange={(e) => updateBand(i, { remark: e.target.value })} className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm" /></td>
              <td className="p-2 text-right"><button onClick={() => setConfig({ ...config, scale: config.scale.filter((_, idx) => idx !== i) })} className="text-red-400" aria-label="Remove band"><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setConfig({ ...config, scale: [...config.scale, { min: 0, grade: "", remark: "" }] })} className="flex items-center gap-1 rounded-md border border-input px-3 py-2 text-xs hover:bg-white/5"><Plus size={12} /> Add band</button>
        <button type="button" onClick={() => setConfig(DEFAULT_GRADING)} className="rounded-md border border-input px-3 py-2 text-xs hover:bg-white/5">Reset to default</button>
        <button type="button" onClick={save} disabled={saving} className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "Saving..." : "Save grading"}</button>
      </div>
    </section>
  );
}
