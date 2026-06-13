import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { inr, kycFeeDisplay, KYC_FEE_USD, USD_TO_INR_RATE } from "@/lib/currency";
import { FileImage, Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { notifyKycStatus } from "@/server/notifications.functions";
import { adminDecideKyc, adminResetKyc } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/kyc")({ component: AdminKyc });

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending review (Documents submitted + Fee paid)" },
  { value: "documents_submitted", label: "Documents submitted" },
  { value: "fee_paid", label: "Fee paid" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "not_started", label: "Not started" },
];

const PAGE_SIZE = 10;

function AdminKyc() {
  const { user } = useAuth();
  const [allRows, setAllRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewNotified, setReviewNotified] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("kyc_submissions").select("*").order("updated_at", { ascending: false });

    if (statusFilter === "pending") q = q.in("status", ["documents_submitted", "fee_paid"]);
    else if (statusFilter !== "all") q = q.eq("status", statusFilter as any);

    if (dateFrom) q = q.gte("updated_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      q = q.lte("updated_at", end.toISOString());
    }

    const { data: kycRows, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const userIds = Array.from(new Set((kycRows || []).map((r: any) => r.user_id)));
    const profilesRes = userIds.length
      ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds)
      : { data: [] as any[] };
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
    setAllRows(((kycRows as any[]) || []).map((r) => ({ ...r, profiles: profileMap.get(r.user_id) || null })));
    setPage(0);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFrom, dateTo]);

  // Client-side search across name/email/phone
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allRows;
    return allRows.filter((r) => {
      const blob = [
        r.profiles?.full_name,
        r.full_name,
        r.profiles?.email,
        r.profiles?.phone,
        r.document_number,
        r.bank_account_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [allRows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const decide = async (row: any, status: "approved" | "rejected") => {
    if (!user) return;
    setBusyId(row.id);
    const noteText = notes[row.id] || null;
    try {
      await adminDecideKyc({
        data: { submission_id: row.id, status, admin_notes: noteText },
      });
      toast.success(`KYC ${status}`);
      try {
        await notifyKycStatus({ data: { user_id: row.user_id, status, admin_notes: noteText } });
      } catch (e: any) {
        toast.error(`KYC saved but email failed: ${e?.message || e}`);
      }
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save KYC decision");
    } finally {
      setBusyId(null);
    }
  };

  // Mark KYC as "in review" (triggers notification once per session per row).
  const markInReview = async (row: any) => {
    if (reviewNotified[row.id]) return;
    setReviewNotified((m) => ({ ...m, [row.id]: true }));
    try {
      await notifyKycStatus({ data: { user_id: row.user_id, status: "in_review", admin_notes: null } });
      toast.success("Employee notified review has started.");
    } catch (e: any) {
      toast.error(e?.message || "Could not send review notification");
      setReviewNotified((m) => ({ ...m, [row.id]: false }));
    }
  };

  const viewDoc = async (path: string) => {
    if (!path) return toast.error("No document path provided");
    
    // First try to get a signed URL (works with RLS protected buckets)
    try {
      const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
        return;
      }
    } catch (e) {
      console.error("Signed URL error:", e);
    }
    
    // Fallback: try public URL (for public buckets)
    try {
      const { data } = supabase.storage.from("kyc-documents").getPublicUrl(path);
      if (data?.publicUrl) {
        window.open(data.publicUrl, "_blank");
        return;
      }
    } catch (e) {
      console.error("Public URL error:", e);
    }
    
    toast.error("Could not generate document link. Check storage bucket 'kyc-documents' exists and is accessible.");
  };

  const clearFilters = () => {
    setStatusFilter("pending");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">KYC Reviews</h1>
        <div className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {/* Filter bar */}
      <div className="grid gap-2 rounded-md border bg-card p-3 shadow-sm md:grid-cols-[1fr_1fr_1fr_2fr_auto]">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-input bg-white px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded border border-input bg-white px-2 text-sm">
          <span className="shrink-0 text-xs text-muted-foreground">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-transparent py-2 outline-none"
          />
        </label>
        <label className="flex items-center gap-2 rounded border border-input bg-white px-2 text-sm">
          <span className="shrink-0 text-xs text-muted-foreground">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-transparent py-2 outline-none"
          />
        </label>
        <label className="flex items-center gap-2 rounded border border-input bg-white px-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search name, email, phone, doc/account number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full bg-transparent py-2 outline-none"
          />
        </label>
        <AzButton variant="outline" size="sm" onClick={clearFilters}>
          Reset
        </AzButton>
      </div>

      <div className="space-y-3">
        {!loading && pageRows.length === 0 && (
          <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
            No KYC submissions match the current filters.
          </div>
        )}
        {pageRows.map((r) => (
          <div key={r.id} className="rounded-md border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold">{r.profiles?.full_name || r.full_name || "(no name)"}</div>
                <div className="text-sm text-muted-foreground">
                  {r.profiles?.email} · {r.profiles?.phone || "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Updated {new Date(r.updated_at).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`rounded px-2 py-1 text-xs font-bold capitalize ${
                    r.status === "approved"
                      ? "bg-success/15 text-success"
                      : r.status === "rejected"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-warning/15 text-warning-foreground"
                  }`}
                >
                  {String(r.status).replace(/_/g, " ")}
                </span>
                <div className="mt-1 text-xs text-muted-foreground">
                  Fee: {kycFeeDisplay()}{" "}
                  {r.fee_paid_at ? "✓ Paid" : "Pending"}
                  {Number(r.fee_amount || 0) !== KYC_FEE_USD && (
                    <span className="ml-1 text-warning">(was ${Number(r.fee_amount || 0)})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Detail label="Legal name">{r.full_name}</Detail>
              <Detail label="DOB">{r.date_of_birth}</Detail>
              <Detail label="Document">
                {r.document_type} · {r.document_number}
              </Detail>
              <Detail label="Bank">
                {r.bank_name} · A/C {r.bank_account_number}
              </Detail>
              <Detail label="IFSC">{r.bank_ifsc_swift}</Detail>
              <Detail label="UPI">{r.upi_id || "—"}</Detail>
              <Detail label="Account holder">{r.bank_account_holder}</Detail>
              <Detail label="Payment ref">{r.fee_payment_reference || "—"}</Detail>
              <Detail label="UTR (UPI)">{r.payment_utr || "—"}</Detail>
              <Detail label="Paid (INR)">{r.payment_inr_amount ? `₹${Number(r.payment_inr_amount).toLocaleString("en-IN")}` : "—"}</Detail>
              <Detail label="Payment submitted">{r.payment_submitted_at ? new Date(r.payment_submitted_at).toLocaleString("en-IN") : "—"}</Detail>
              {r.payment_screenshot_url && (
                <div className="sm:col-span-2">
                  <button
                    onClick={() => viewDoc(r.payment_screenshot_url)}
                    className="flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-secondary"
                  >
                    <FileImage className="h-3 w-3" /> View payment screenshot
                  </button>
                </div>
              )}
            </div>

            {(r.document_front_url || r.document_back_url || r.selfie_url) && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Uploaded documents</div>
                <div className="flex flex-wrap gap-2">
                  {r.document_front_url && (
                    <button
                      onClick={() => viewDoc(r.document_front_url)}
                      className="flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-secondary"
                    >
                      <FileImage className="h-3 w-3" /> ID front
                    </button>
                  )}
                  {r.document_back_url && (
                    <button
                      onClick={() => viewDoc(r.document_back_url)}
                      className="flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-secondary"
                    >
                      <FileImage className="h-3 w-3" /> ID back
                    </button>
                  )}
                  {r.selfie_url && (
                    <button
                      onClick={() => viewDoc(r.selfie_url)}
                      className="flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-secondary"
                    >
                      <FileImage className="h-3 w-3" /> Selfie
                    </button>
                  )}
                </div>
              </div>
            )}

            {r.admin_notes && (
              <div className="mt-2 text-xs text-muted-foreground">
                <b>Previous notes:</b> {r.admin_notes}
              </div>
            )}

            {(r.status === "documents_submitted" || r.status === "fee_paid") && (
              <div className="mt-3 space-y-2">
                <textarea
                  placeholder="Optional review note (visible to user, esp. on rejection)"
                  value={notes[r.id] || ""}
                  onFocus={() => void markInReview(r)}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <AzButton
                    size="sm"
                    variant="brand"
                    onClick={() => decide(r, "approved")}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id ? "Saving…" : "Approve KYC"}
                  </AzButton>
                  <AzButton
                    size="sm"
                    variant="outline"
                    onClick={() => decide(r, "rejected")}
                    disabled={busyId === r.id}
                  >
                    Reject
                  </AzButton>
                  {!reviewNotified[r.id] && (
                    <AzButton size="sm" variant="outline" onClick={() => void markInReview(r)}>
                      <Eye className="mr-1 h-3 w-3" /> Mark "in review"
                    </AzButton>
                  )}
                  {reviewNotified[r.id] && (
                    <span className="self-center text-xs text-muted-foreground">
                      ✓ Employee notified review started
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Re-KYC: always available so admin can request a fresh submission */}
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">Need the user to re-submit?</span>
              <AzButton
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!confirm("Reset this user's KYC and ask them to re-submit? Existing documents will be detached.")) return;
                  try {
                    await adminResetKyc({ data: { user_id: r.user_id, reason: notes[r.id] || null } });
                    toast.success("Re-KYC requested. User can now re-submit.");
                    void load();
                  } catch (e: any) { toast.error(e?.message || "Could not reset KYC"); }
                }}
              >
                Request re-KYC
              </AzButton>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-md border bg-card p-3 text-sm">
          <div className="text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded border border-input bg-white px-3 py-1 hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 rounded border border-input bg-white px-3 py-1 hover:bg-secondary disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase text-muted-foreground">{label}: </span>
      <span>{children || "—"}</span>
    </div>
  );
}
