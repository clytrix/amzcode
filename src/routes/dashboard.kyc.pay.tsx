import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { usePublicSettings } from "@/lib/platform-settings";
import { submitKycPaymentUtr } from "@/server/kyc.functions";
import { CheckCircle2, Copy, QrCode, ShieldCheck, AlertTriangle } from "lucide-react";
import { inr, usd } from "@/lib/currency";

export const Route = createFileRoute("/dashboard/kyc/pay")({ component: KycPayPage });

function KycPayPage() {
  const { user } = useAuth();
  const { settings, loading } = usePublicSettings();
  const upi = settings["payments.upi"] as any || {};
  const kycCfg = settings["kyc.config"];
  const feeUsd = Number(kycCfg.fee_usd) || 79;
  const rate = Number(upi.usd_to_inr_rate) || 94;
  const inrAmount = useMemo(() => Math.round(feeUsd * rate), [feeUsd, rate]);

  const [kyc, setKyc] = useState<any>(null);
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("kyc_submissions").select("*").eq("user_id", user.id).maybeSingle()
      .then((r) => setKyc(r.data));
  }, [user]);

  const copy = async (txt: string, label: string) => {
    try { await navigator.clipboard.writeText(txt); toast.success(`${label} copied`); }
    catch { toast.error("Copy failed"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utr.trim() || utr.trim().length < 6) return toast.error("Enter the UPI UTR / Transaction reference (min 6 chars)");
    setSubmitting(true);
    try {
      await submitKycPaymentUtr({ data: { utr: utr.trim(), inr_amount: inrAmount, screenshot_url: null } });
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not submit UTR");
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading payment details…</div>;

  if (done) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="rounded-xl border-2 border-success/40 bg-success/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-3 text-2xl font-bold">Payment recorded</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your UTR <span className="font-mono font-bold">{utr.toUpperCase()}</span> has been submitted.
            Your KYC is now under review by our team.
          </p>
          <p className="mt-4 text-sm">
            You can safely <b>close this tab</b> — your other tab will update automatically.
          </p>
        </div>
      </div>
    );
  }

  if (kyc?.status === "approved" || kyc?.status === "documents_submitted" || kyc?.status === "payment_submitted") {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="rounded-xl border bg-card p-6 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-3 text-xl font-bold">Already submitted</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your KYC payment has already been submitted. Please close this tab.</p>
        </div>
      </div>
    );
  }

  if (!upi.upi_id || !upi.qr_image_url) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h1 className="mt-2 text-xl font-bold">Payment not configured</h1>
          <p className="mt-2 text-sm">
            The administrator hasn't set up the UPI payment method yet. Please contact support and try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
          <QrCode className="h-6 w-6 text-primary" /> Pay KYC verification fee
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time refundable fee — returned with your first salary payout.
        </p>
      </div>

      <div className="rounded-xl border-2 border-primary/30 bg-card p-6 text-center shadow-[var(--shadow-elegant)]">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount to pay</div>
        <div className="mt-1 text-4xl font-bold tracking-tight">{inr(inrAmount)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          ({usd(feeUsd)} × ₹{rate} = {inr(inrAmount)})
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-sm font-bold">Scan QR code</div>
          <img src={upi.qr_image_url} alt="UPI QR code" className="mx-auto max-h-64 w-auto rounded border bg-white p-2" />
          <p className="mt-2 text-xs text-muted-foreground">Open any UPI app (GPay, PhonePe, Paytm…) and scan</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm font-bold">Or pay to UPI ID</div>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2 rounded border bg-secondary/30 p-2">
              <span className="font-mono text-xs">{upi.upi_id}</span>
              <button type="button" onClick={() => copy(upi.upi_id, "UPI ID")} className="text-primary hover:opacity-70">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            {upi.payee_name && (
              <div className="text-xs">Payee: <b>{upi.payee_name}</b></div>
            )}
            <div className="rounded border bg-warning/10 p-2 text-xs">
              <b>Pay exactly {inr(inrAmount)}</b> for instant verification.
            </div>
            {upi.instructions && <p className="text-xs text-muted-foreground">{upi.instructions}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-xl border-2 border-primary/40 bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Confirm payment</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          After paying, copy the <b>UTR / Transaction ID</b> from your UPI app receipt and paste below.
        </p>
        <input
          type="text"
          value={utr}
          onChange={(e) => setUtr(e.target.value.toUpperCase())}
          placeholder="e.g. 412345678901"
          className="mt-3 w-full rounded border border-input bg-white px-3 py-2 font-mono text-sm uppercase"
          required
        />
        <AzButton type="submit" variant="brand" size="lg" disabled={submitting} className="mt-3 w-full">
          {submitting ? "Submitting…" : "Submit UTR & complete payment"}
        </AzButton>
      </form>
    </div>
  );
}
