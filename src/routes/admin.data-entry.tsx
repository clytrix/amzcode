import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { Plus, Trash2, RefreshCw, Wallet, IndianRupee, Settings } from "lucide-react";
import { adminUpsertInvoice, adminDeleteInvoice, adminRolloverPoolNow, adminAccrueSalaryNow, adminUpdatePoolReward, adminUpdateAllPoolRewards } from "@/server/data-entry.functions";
import { inr } from "@/lib/currency";

export const Route = createFileRoute("/admin/data-entry")({ component: AdminDataEntry });

const blank = {
  id: undefined as string | undefined,
  vendor_name: "",
  invoice_number: "",
  invoice_date: "",
  amount: "",
  tax_amount: "0",
  gst_number: "",
  image_url: "",
  notes: "",
  is_active: true,
  reward_amount: "150",
};

function AdminDataEntry() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [pool, setPool] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [globalReward, setGlobalReward] = useState<number>(150);

  // Calculate average reward from current pool
  const getAverageReward = () => {
    if (pool.length === 0) return 150;
    const total = pool.reduce((sum, p) => sum + Number(p.reward_amount || 150), 0);
    return Math.round(total / pool.length);
  };

  const load = async () => {
    const [inv, pl] = await Promise.all([
      supabase.from("data_entry_invoices" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("data_entry_daily_pool" as any).select("*, data_entry_invoices(vendor_name, invoice_number)").order("position"),
    ]);
    setInvoices((inv.data as any[]) || []);
    setPool((pl.data as any[]) || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!form.vendor_name || !form.invoice_number || !form.amount) {
      return toast.error("Vendor, invoice number, and amount are required.");
    }
    setSaving(true);
    try {
      await adminUpsertInvoice({
        data: {
          id: form.id,
          vendor_name: form.vendor_name,
          invoice_number: form.invoice_number,
          invoice_date: form.invoice_date || null,
          amount: Number(form.amount),
          tax_amount: Number(form.tax_amount || 0),
          gst_number: form.gst_number || null,
          image_url: form.image_url || null,
          notes: form.notes || null,
          is_active: form.is_active,
        },
      });
      toast.success("Saved");
      setForm(blank);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete invoice?")) return;
    try {
      await adminDeleteInvoice({ data: { id } });
      toast.success("Deleted");
      void load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const rollover = async () => {
    setBusy(true);
    try {
      const r = await adminRolloverPoolNow();
      toast.success(`Pool refreshed: ${JSON.stringify(r.result)}`);
      void load();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(false);
    }
  };

  const accrue = async () => {
    setBusy(true);
    try {
      const r = await adminAccrueSalaryNow();
      toast.success(`Salary accrual: ${JSON.stringify(r.result)}`);
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(false);
    }
  };

  const updatePoolReward = async (poolId: string, amount: number) => {
    try {
      await adminUpdatePoolReward({ data: { pool_id: poolId, reward_amount: amount } });
      toast.success(`Reward updated to ${inr(amount)}`);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };

  const updateAllRewards = async () => {
    if (!confirm(`Update ALL pool items to ${inr(globalReward)}?`)) return;
    setBusy(true);
    try {
      await adminUpdateAllPoolRewards({ data: { reward_amount: globalReward } });
      toast.success(`All rewards updated to ${inr(globalReward)}`);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Data Entry · Invoice Pool</h1>
          <p className="text-sm text-muted-foreground">
            Manage the invoice pool. Each day, 60 random active invoices are picked at 12:05 AM IST.
            Click "Generate fresh daily pool" to create NEW random tasks (removes old, creates fresh).
            Current reward: <b>{inr(getAverageReward())}</b> per task.
          </p>
        </div>
        <div className="flex gap-2">
          <AzButton variant="outline" size="sm" onClick={rollover} disabled={busy}>
            <RefreshCw className="mr-1 h-4 w-4" /> Generate fresh daily pool
          </AzButton>
          <AzButton variant="outline" size="sm" onClick={accrue} disabled={busy}>
            <Wallet className="mr-1 h-4 w-4" /> Accrue daily salary now
          </AzButton>
        </div>
      </div>

      {/* Add / edit form */}
      <div className="rounded-md border bg-card p-4 shadow-sm">
        <div className="mb-3 text-sm font-bold">{form.id ? "Edit invoice" : "Add invoice"}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Inp label="Vendor name *" value={form.vendor_name} onChange={(v) => setForm({ ...form, vendor_name: v })} />
          <Inp label="Invoice number *" value={form.invoice_number} onChange={(v) => setForm({ ...form, invoice_number: v })} />
          <Inp label="Invoice date" type="date" value={form.invoice_date} onChange={(v) => setForm({ ...form, invoice_date: v })} />
          <Inp label="Amount (₹) *" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
          <Inp label="Tax amount (₹)" type="number" value={form.tax_amount} onChange={(v) => setForm({ ...form, tax_amount: v })} />
          <Inp label="GST number" value={form.gst_number} onChange={(v) => setForm({ ...form, gst_number: v })} />
          <Inp label="Image URL" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} className="md:col-span-2" />
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active (eligible for pool)
          </label>
          <Inp label="Notes (visible to employees)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} className="md:col-span-3" />
        </div>
        <div className="mt-3 flex gap-2">
          <AzButton variant="brand" size="sm" onClick={save} disabled={saving}>
            <Plus className="mr-1 h-4 w-4" /> {form.id ? "Update" : "Add invoice"}
          </AzButton>
          {form.id && (
            <AzButton variant="outline" size="sm" onClick={() => setForm(blank)}>Cancel</AzButton>
          )}
        </div>
      </div>

      {/* Reward Configuration */}
      <div className="rounded-md border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Settings className="h-4 w-4" /> Reward Configuration
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted-foreground">Reward per task (₹)</span>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  value={globalReward}
                  onChange={(e) => setGlobalReward(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-24 rounded border border-input bg-white px-3 py-2 text-sm"
                />
              </div>
            </label>
          </div>
          <AzButton variant="brand" size="sm" onClick={updateAllRewards} disabled={busy || pool.length === 0}>
            Update all tasks to {inr(globalReward)}
          </AzButton>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Changes apply immediately to today's pool. The daily auto-rollover at 12:05 AM will use this amount for new pools.
        </p>
      </div>

      {/* Today's pool preview */}
      <div className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-2 text-sm font-bold">Today's pool ({pool.length} / 60) — Reward per task: {inr(getAverageReward())}</div>
        {pool.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            No pool yet for today. Add at least 60 active invoices and click "Generate fresh daily pool".
          </div>
        )}
        {pool.length > 0 && (
          <div className="grid grid-cols-2 gap-2 p-3 text-xs sm:grid-cols-3 md:grid-cols-5">
            {pool.map((p, i) => (
              <div key={p.id} className="rounded border bg-background p-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">#{i + 1}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {inr(Number(p.reward_amount || 150))}
                  </span>
                </div>
                <div className="mt-1 truncate">{p.data_entry_invoices?.vendor_name}</div>
                <div className="text-muted-foreground">{p.data_entry_invoices?.invoice_number}</div>
                <div className="mt-2 flex items-center gap-1">
                  <input
                    type="number"
                    defaultValue={Number(p.reward_amount || 150)}
                    onBlur={(e) => {
                      const newVal = Number(e.target.value);
                      if (newVal !== Number(p.reward_amount)) {
                        void updatePoolReward(p.id, newVal);
                      }
                    }}
                    className="w-16 rounded border border-input px-1 py-0.5 text-xs"
                    min={1}
                    max={10000}
                  />
                  <span className="text-[10px] text-muted-foreground">₹</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All invoices */}
      <div className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-2 text-sm font-bold">All invoices ({invoices.length})</div>
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-left">Invoice #</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((iv) => (
                <tr key={iv.id} className="border-t hover:bg-secondary/40">
                  <td className="px-3 py-2 font-bold">{iv.vendor_name}</td>
                  <td className="px-3 py-2">{iv.invoice_number}</td>
                  <td className="px-3 py-2 text-right">₹{Number(iv.amount).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2">{iv.invoice_date || "—"}</td>
                  <td className="px-3 py-2 text-center">{iv.is_active ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setForm({ ...iv, amount: String(iv.amount), tax_amount: String(iv.tax_amount) })}
                      className="mr-2 text-xs text-primary hover:underline">Edit</button>
                    <button onClick={() => remove(iv.id)} className="text-xs text-destructive hover:underline">
                      <Trash2 className="inline h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Inp({ label, value, onChange, type = "text", className = "" }: { label: string; value: any; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}
