import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { formatRewardTimestamp } from "@/lib/date-utils";
import { CheckCircle2, Lock, FileImage, Calendar, IndianRupee, Receipt, Crown } from "lucide-react";
import { getMyDataEntryToday, upsertDataEntrySubmission } from "@/server/data-entry.functions";
import { getMyDataEntrySubscription } from "@/server/data-entry-packages.functions";

export const Route = createFileRoute("/dashboard/data-entry")({
  component: () => <Outlet />,
});

type Item = {
  id: string;
  position: number;
  reward_amount: number;
  invoice: any;
  submission: any | null;
};

type SubscriptionInfo = {
  subscription: any | null;
  todayCompleted: number;
  dailyLimit: number;
};

export function DataEntryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Check subscription first
      const sub = await getMyDataEntrySubscription();
      setSubscription(sub);
      
      // Only load tasks if user has active subscription
      if (sub?.subscription && sub.dailyLimit > 0) {
        const r = await getMyDataEntryToday();
        // Filter to only show up to daily limit
        const limitedPool = (r.pool as any[]).slice(0, sub.dailyLimit);
        setItems(limitedPool as any);
        const firstOpen = limitedPool.findIndex((p) => !p.submission?.is_done);
        setActiveIdx(firstOpen === -1 ? 0 : firstOpen);
      } else {
        setItems([]);
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const active = items[activeIdx];

  // Sync form with active submission
  useEffect(() => {
    if (!active) return;
    // Convert ISO date (YYYY-MM-DD) to DD-MM-YYYY for display
    let displayDate = "";
    if (active.submission?.invoice_date) {
      const iso = active.submission.invoice_date;
      const parts = iso.split("-");
      if (parts.length === 3) {
        displayDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        displayDate = iso;
      }
    }
    setForm({
      vendor_name: active.submission?.vendor_name || "",
      invoice_number: active.submission?.invoice_number || "",
      invoice_date: displayDate,
      amount: active.submission?.amount ?? "",
      tax_amount: active.submission?.tax_amount ?? "",
      gst_number: active.submission?.gst_number || "",
    });
  }, [active?.id]);

  const stats = useMemo(() => {
    const done = items.filter((i) => i.submission?.is_done).length;
    const earned = items.filter((i) => i.submission?.is_done).reduce((s, i) => s + Number(i?.reward_amount || 0), 0);
    const remaining = items.length - done;
    const potential = items.reduce((s, i) => s + Number(i?.reward_amount || 0), 0);
    return { done, total: items.length, earned, remaining, potential };
  }, [items]);

  const save = async (markDone: boolean) => {
    if (!active) return;
    if (markDone) {
      // Required fields for completion
      if (!form.vendor_name || !form.invoice_number || !form.amount) {
        return toast.error("Fill vendor, invoice number and amount before marking done.");
      }
    }
    setSaving(true);
    try {
      // Convert DD-MM-YYYY to YYYY-MM-DD for server
      let isoDate: string | null = null;
      if (form.invoice_date) {
        const parts = form.invoice_date.split("-");
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      await upsertDataEntrySubmission({
        data: {
          pool_id: active.id,
          vendor_name: form.vendor_name || null,
          invoice_number: form.invoice_number || null,
          invoice_date: isoDate,
          amount: form.amount === "" ? null : Number(form.amount),
          tax_amount: form.tax_amount === "" ? null : Number(form.tax_amount),
          gst_number: form.gst_number || null,
          mark_done: markDone,
        },
      });
      toast.success(markDone ? `+${inr(active?.reward_amount || 0)} credited!` : "Saved");
      await load();
      // Move to next not-done
      const next = items.findIndex((i, idx) => idx > activeIdx && !i.submission?.is_done);
      if (next !== -1) setActiveIdx(next);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading today's tasks…</div>;

  // Subscription gate - no active subscription (must come before empty-items check)
  if (!subscription?.subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Data Entry Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Purchase a data entry package to start completing tasks and earning rewards.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 text-center">
          <Crown className="mx-auto h-16 w-16 text-warning mb-4" />
          <h2 className="text-xl font-bold mb-2">Get a Data Entry Package</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Choose a plan that fits your goals. Complete daily tasks and earn money directly to your wallet.
          </p>
          <Link to="/dashboard/data-entry/packages">
            <AzButton variant="brand" size="md">
              <Crown className="mr-2 h-4 w-4" /> View Plans & Pricing
            </AzButton>
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Data Entry Tasks</h1>
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          No tasks available right now. The daily pool refreshes every morning at 12:05 AM IST.
          <br />
          Earnings are credited to your <Link to="/dashboard/earnings" className="font-bold text-primary hover:underline">Incentive Wallet</Link>.
        </div>
      </div>
    );
  }

  // Daily limit reached
  const hasReachedDailyLimit = subscription && subscription.todayCompleted >= subscription.dailyLimit;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Data Entry Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {subscription?.subscription?.package?.name} Plan: {subscription?.todayCompleted || 0} / {subscription?.dailyLimit || 0} tasks completed today
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/data-entry/my-plan" className="rounded border bg-card px-3 py-1.5 text-sm font-bold hover:bg-secondary">
            My Plan →
          </Link>
          <Link to="/dashboard/earnings" className="rounded border bg-card px-3 py-1.5 text-sm font-bold hover:bg-secondary">
            View wallet →
          </Link>
        </div>
      </div>

      {/* Daily limit reached banner */}
      {hasReachedDailyLimit && (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success mb-2" />
          <h3 className="font-bold text-success">Daily Limit Reached!</h3>
          <p className="text-sm text-muted-foreground">
            You've completed all {subscription?.dailyLimit} tasks for today. Come back tomorrow for more!
          </p>
        </div>
      )}

      {/* Progress strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Completed" value={`${stats.done} / ${stats.total}`} />
        <Stat label="Earned today" value={inr(stats.earned)} highlight />
        <Stat label="Remaining" value={`${stats.remaining}`} />
        <Stat label="Daily potential" value={inr(stats.potential)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Task list */}
        <div className="rounded-md border bg-card shadow-sm">
          <div className="border-b px-3 py-2 text-xs font-bold uppercase text-muted-foreground">
            Today's tasks
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {items.map((it, idx) => {
              const done = !!it.submission?.is_done;
              const isActive = idx === activeIdx;
              return (
                <button
                  key={it.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-0 ${
                    isActive ? "bg-primary/10 font-bold" : "hover:bg-secondary"
                  }`}
                >
                  <span className="w-6 text-xs text-muted-foreground">#{idx + 1}</span>
                  <span className="flex-1 truncate">{it.invoice?.vendor_name || "Invoice"}</span>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <span className="text-[10px] font-bold text-primary">{inr(it.reward_amount)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two-pane workspace */}
        {active && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Source pane */}
            <div className="rounded-md border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-bold uppercase text-muted-foreground">Source invoice</div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  Reward: {inr(active.reward_amount)}
                </span>
              </div>

              {/* Invoice Image */}
              {active.invoice?.image_url ? (
                <a href={active.invoice.image_url} target="_blank" rel="noreferrer" className="block mb-3">
                  <img
                    src={active.invoice.image_url}
                    alt="Invoice"
                    className="max-h-[280px] w-full rounded border object-contain"
                  />
                </a>
              ) : (
                <div className="flex h-32 items-center justify-center rounded border border-dashed text-xs text-muted-foreground mb-3">
                  <FileImage className="mr-2 h-4 w-4" /> No image available
                </div>
              )}

              {/* Invoice Details Info Box */}
              <div className="rounded border bg-secondary/30 p-3 space-y-2">
                <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Invoice Information</div>

                {active.invoice?.vendor_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendor:</span>
                    <span className="font-semibold">{active.invoice.vendor_name}</span>
                  </div>
                )}

                {active.invoice?.invoice_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invoice #:</span>
                    <span className="font-semibold">{active.invoice.invoice_number}</span>
                  </div>
                )}

                {active.invoice?.invoice_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-semibold">
                      {(() => {
                        const iso = active.invoice.invoice_date;
                        const parts = iso.split("-");
                        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                        return iso;
                      })()}
                    </span>
                  </div>
                )}

                {active.invoice?.amount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold">{inr(Number(active.invoice.amount))}</span>
                  </div>
                )}

                {active.invoice?.tax_amount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="font-semibold">{inr(Number(active.invoice.tax_amount))}</span>
                  </div>
                )}

                {active.invoice?.gst_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST:</span>
                    <span className="font-semibold">{active.invoice.gst_number}</span>
                  </div>
                )}

                {active.invoice?.notes && (
                  <div className="mt-2 pt-2 border-t text-sm">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1 text-xs">{active.invoice.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                <b>Task:</b> Enter the invoice details shown above into the form on the right.
              </div>
            </div>

            {/* Entry pane */}
            <div className="rounded-md border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-bold uppercase text-muted-foreground">Your entry</div>
                {active.submission?.is_done && (
                  <span className="flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                    <CheckCircle2 className="h-3 w-3" /> Completed · locked
                  </span>
                )}
              </div>

              <fieldset disabled={!!active.submission?.is_done} className="space-y-3 disabled:opacity-60">
                <Field label="Vendor / Company name" icon={<Receipt className="h-3 w-3" />}>
                  <input
                    value={form.vendor_name || ""}
                    onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                    className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Invoice number">
                  <input
                    value={form.invoice_number || ""}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Invoice date" icon={<Calendar className="h-3 w-3" />}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD-MM-YYYY"
                      pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                      value={form.invoice_date || ""}
                      onChange={(e) => {
                        // Auto-format as user types: DD-MM-YYYY
                        let val = e.target.value.replace(/[^0-9]/g, "");
                        if (val.length >= 2) val = val.slice(0, 2) + "-" + val.slice(2);
                        if (val.length >= 5) val = val.slice(0, 5) + "-" + val.slice(5, 9);
                        setForm({ ...form, invoice_date: val });
                      }}
                      className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="GST number">
                    <input
                      value={form.gst_number || ""}
                      onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                      className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total amount (₹)" icon={<IndianRupee className="h-3 w-3" />}>
                    <input
                      type="number"
                      step="0.01"
                      value={form.amount ?? ""}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Tax amount (₹)">
                    <input
                      type="number"
                      step="0.01"
                      value={form.tax_amount ?? ""}
                      onChange={(e) => setForm({ ...form, tax_amount: e.target.value })}
                      className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>
              </fieldset>

              {!active.submission?.is_done && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <AzButton variant="outline" size="sm" onClick={() => void save(false)} disabled={saving}>
                    {saving ? "Saving…" : "Save draft"}
                  </AzButton>
                  <AzButton variant="brand" size="sm" onClick={() => void save(true)} disabled={saving}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Mark done & claim {inr(active.reward_amount)}
                  </AzButton>
                </div>
              )}

              {active.submission?.is_done && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                  <Lock className="h-4 w-4 text-success" />
                  Reward of <b>{inr(active.reward_amount)}</b> credited on{" "}
                  {formatRewardTimestamp(active.submission.done_at || active.submission.reward_credited_at)}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? "bg-primary/10 border-primary/40" : "bg-card"}`}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground">
        {icon} {label}
      </div>
      {children}
    </label>
  );
}
