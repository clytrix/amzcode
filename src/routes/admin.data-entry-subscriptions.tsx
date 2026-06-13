import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { CheckCircle2, XCircle, Clock, Loader2, Search, Calendar, User, ImageIcon, ExternalLink, RefreshCw } from "lucide-react";
import {
  adminGetAllSubscriptions,
  adminApproveSubscription,
  adminCancelSubscription,
  adminExtendSubscription,
} from "@/server/data-entry-packages.functions";

export const Route = createFileRoute("/admin/data-entry-subscriptions")({
  component: AdminDataEntrySubscriptions,
});

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending Approval" },
  { value: "paid", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

function AdminDataEntrySubscriptions() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [extendModal, setExtendModal] = useState<any>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const fetchSubscriptions = useServerFn(adminGetAllSubscriptions);
  const approveSub = useServerFn(adminApproveSubscription);
  const cancelSub = useServerFn(adminCancelSubscription);
  const extendSub = useServerFn(adminExtendSubscription);

  useEffect(() => {
    loadSubscriptions();
  }, [filter]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const status = filter === "all" ? undefined : filter;
      const result = await fetchSubscriptions({ data: { status } });
      setSubscriptions(result.subscriptions);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await approveSub({ data: { subscription_id: id } });
      toast.success("Subscription approved");
      await loadSubscriptions();
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve");
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this subscription?")) return;
    setProcessing(id);
    try {
      await cancelSub({ data: { subscription_id: id } });
      toast.success("Subscription cancelled");
      await loadSubscriptions();
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel");
    } finally {
      setProcessing(null);
    }
  };

  const handleExtend = async () => {
    if (!extendModal) return;
    setProcessing(extendModal.id);
    try {
      await extendSub({
        data: { subscription_id: extendModal.id, days: extendDays },
      });
      toast.success(`Subscription extended by ${extendDays} days`);
      setExtendModal(null);
      await loadSubscriptions();
    } catch (e: any) {
      toast.error(e?.message || "Failed to extend");
    } finally {
      setProcessing(null);
    }
  };

  const filteredSubs = subscriptions.filter((sub) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      sub.user?.full_name?.toLowerCase().includes(searchLower) ||
      sub.user?.email?.toLowerCase().includes(searchLower) ||
      sub.package?.name?.toLowerCase().includes(searchLower) ||
      sub.payment_utr?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-warning/10 text-warning">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-success/10 text-success">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-muted text-muted-foreground">
            <Calendar className="h-3 w-3" /> Expired
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-destructive/10 text-destructive">
            <XCircle className="h-3 w-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Data Entry Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            Manage user subscriptions and approve pending payments
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSubscriptions} className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-bold hover:bg-secondary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <Link to="/admin/data-entry-packages">
            <AzButton variant="outline" size="sm">Manage Packages</AzButton>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded text-sm font-bold ${
              filter === opt.value
                ? "bg-primary text-primary-foreground"
                : "border bg-white hover:bg-secondary"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 rounded border bg-white px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, UTR..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {!loading && subscriptions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", count: subscriptions.length, color: "text-foreground" },
            { label: "Pending", count: subscriptions.filter(s => s.payment_status === "pending").length, color: "text-warning" },
            { label: "Active", count: subscriptions.filter(s => s.payment_status === "paid").length, color: "text-success" },
            { label: "Expired/Cancelled", count: subscriptions.filter(s => ["expired","cancelled"].includes(s.payment_status)).length, color: "text-muted-foreground" },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-lg border bg-card p-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Subscriptions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-bold">User</th>
                <th className="px-4 py-3 text-left font-bold">Package</th>
                <th className="px-4 py-3 text-left font-bold">Payment</th>
                <th className="px-4 py-3 text-left font-bold">Status</th>
                <th className="px-4 py-3 text-left font-bold">Purchased</th>
                <th className="px-4 py-3 text-left font-bold">Expires</th>
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.map((sub) => (
                <tr key={sub.id} className="border-t hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="font-medium">{sub.user?.full_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{sub.user?.email || sub.user_id}</div>
                        {sub.referral_code && (
                          <div className="text-xs text-primary mt-0.5">Ref: {sub.referral_code}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{sub.package?.name}</div>
                    <div className="text-xs text-muted-foreground">{sub.package?.daily_task_limit} tasks/day</div>
                    <div className="text-xs text-muted-foreground">{inr(sub.package?.price_inr)}</div>
                  </td>
                  <td className="px-4 py-3">
                    {sub.payment_utr ? (
                      <code className="text-xs bg-secondary px-1.5 py-0.5 rounded block">{sub.payment_utr}</code>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                    {sub.payment_screenshot_url && (
                      <button
                        onClick={() => setPreviewImg(sub.payment_screenshot_url)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ImageIcon className="h-3 w-3" /> View screenshot
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(sub.payment_status)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(sub.purchased_at || sub.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {sub.payment_status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(sub.id)}
                            disabled={processing === sub.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-success text-white hover:bg-success/90 disabled:opacity-50"
                          >
                            {processing === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleCancel(sub.id)}
                            disabled={processing === sub.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" /> Reject
                          </button>
                        </>
                      )}
                      {sub.payment_status === "paid" && (
                        <>
                          <button onClick={() => setExtendModal(sub)} className="px-2 py-1 rounded text-xs font-bold border hover:bg-secondary">
                            Extend
                          </button>
                          <button
                            onClick={() => handleCancel(sub.id)}
                            disabled={processing === sub.id}
                            className="px-2 py-1 rounded text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No subscriptions found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImg(null)} className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow z-10">
              <XCircle className="h-5 w-5 text-destructive" />
            </button>
            <img src={previewImg} alt="Payment screenshot" className="w-full rounded-lg shadow-xl" />
            <a href={previewImg} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 text-xs text-white hover:underline">
              <ExternalLink className="h-3 w-3" /> Open full size
            </a>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {extendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg">
            <h3 className="text-lg font-bold mb-2">Extend Subscription</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Extend {extendModal.user?.full_name}'s {extendModal.package?.name} plan
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-bold">Additional Days</span>
                <input
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                  min={1}
                  className="w-full mt-1 rounded border border-input bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setExtendModal(null)}
                className="flex-1 rounded border px-4 py-2 text-sm font-bold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleExtend}
                disabled={processing === extendModal.id}
                className="flex-1 rounded bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {processing === extendModal.id ? "Extending..." : "Extend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
