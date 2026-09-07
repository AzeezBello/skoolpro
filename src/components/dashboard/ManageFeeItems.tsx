"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

interface FeeItem {
  id: string;
  name: string;
  amount: number;
  description?: string | null;
}

const emptyForm = { name: "", amount: "", description: "" };

export function ManageFeeItems() {
  const { t } = useT();
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<FeeItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeeItems();
  }, []);

  const fetchFeeItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fee_items")
      .select("id, name, amount, description")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) toast.error(error.message);
    else setFeeItems(data || []);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const startEdit = (feeItem: FeeItem) => {
    setEditing(feeItem);
    setForm({
      name: feeItem.name,
      amount: String(feeItem.amount),
      description: feeItem.description || "",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    const amount = Number(form.amount);

    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const payload = {
      name,
      amount,
      description: form.description.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("fee_items").update(payload).eq("id", editing.id)
      : await supabase.from("fee_items").insert([payload]);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editing ? "Fee item updated" : "Fee item added");
    resetForm();
    fetchFeeItems();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this fee item? This is only possible if no invoices reference it.")) return;
    const { error } = await supabase.from("fee_items").delete().eq("id", id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "This fee item is used by existing invoices and cannot be deleted. Edit its name or amount instead."
          : error.message
      );
    }
    else {
      toast.success("Fee item deleted");
      fetchFeeItems();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("page.feeItems.title")}</h1>

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-3"
      >
        <input
          placeholder="Name (e.g. Tuition Fee)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount (NGN)"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <input
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <div className="flex gap-2 md:col-span-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            {editing ? "Update fee item" : "Add fee item"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : feeItems.length === 0 ? (
        <EmptyState
          icon={<Wallet size={20} />}
          title="No fee items yet"
          description="Add your first fee item above — it'll be available when creating invoices."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="p-3">{t("common.name")}</th>
                <th className="p-3">{t("common.amount")}</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {feeItems.map((f) => (
                <tr key={f.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">{f.name}</td>
                  <td className="p-3 text-muted-foreground">NGN {Number(f.amount).toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground">{f.description || "—"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(f)}
                        className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(f.id)}
                        className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/80"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
