import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { JobRequiredGate } from "@/components/job-required-gate";
import { ShieldCheck, Lock, Copy, Upload, X, ArrowLeft, Loader2, IndianRupee } from "lucide-react";
import { usePublicSettings } from "@/lib/platform-settings";
import { getMyWallet, requestWithdrawal, getMyWithdrawals } from "@/server/wallet.functions";

export const Route = createFileRoute("/dashboard/withdrawals")({
  component: () => (
    <JobRequiredGate feature="Withdrawals">
      <WithdrawalsPage />
    </JobRequiredGate>
  ),
});

function WithdrawalsPage() {
  const { user } = useAuth();
  const { settings } = usePublicSettings();
  const wd = settings["withdrawals.config"];
  const kycCfg = settings["kyc.config"];
  const MIN_WITHDRAWAL = Number(wd.min_amount) || 5000;
  const MAX_WITHDRAWAL = Number(wd.max_amount) || 500000;
  const withdrawalsEnabled = !!wd.enabled;
  const kycRequired = !!kycCfg.required_for_withdrawal;

  const [items, setItems] = useState<any[]>([]);
  const [kycStatus, setKycStatus] = useState<string>("not_started");
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank transfer (NEFT/IMPS)");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "pay_fee">("form");
  const [serviceFeeUtr, setServiceFeeUtr] = useState("");
  const [feeScreenshotFile, setFeeScreenshotFile] = useState<File | null>(null);
  const [feeScreenshotPreview, setFeeScreenshotPreview] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    try {
      const [wallet, wdHistory, k] = await Promise.all([
        getMyWallet().catch(() => null),
        getMyWithdrawals().catch(() => ({ withdrawals: [] })),
        supabase.from("kyc_submissions").select("status").eq("user_id", user.id).maybeSingle(),
      ]);
      setItems(wdHistory?.withdrawals || []);
      setKycStatus(k.data?.status || "not_started");
      console.log("KYC status loaded:", k.data?.status, "for user:", user.id);
      const salaryBalance = Number(wallet?.wallet?.salary_balance || 0);
      const incentiveBalance = Number(wallet?.wallet?.incentive_balance || 0);
      const totalWallet = salaryBalance + incentiveBalance;
      const pendingAmount = (wdHistory?.withdrawals || [])
        .filter((r: any) => r?.status === "pending" || r?.status === "pending_payment")
        .reduce((s: number, r: any) => s + Number(r?.amount || 0), 0);
      setBalance(Math.max(0, totalWallet - pendingAmount));
      try {
        const { data } = await supabase.from("platform_settings").select("value").eq("key", "payments.upi").maybeSingle();
        setPaymentSettings(data?.value || null);
      } catch {}
    } catch {}
  };
  useEffect(() => { void load(); }, [user]);

  const kycOk = kycRequired ? kycStatus === "approved" : true;
  const reachedThreshold = balance >= MIN_WITHDRAWAL;
  const remainingToThreshold = Math.max(0, MIN_WITHDRAWAL - balance);
  const serviceFee = amount ? Math.round(Number(amount) * 0.18) : 0;
  
  // Debug logging for KYC status
  console.log("Withdrawal page - kycRequired:", kycRequired, "kycStatus:", kycStatus, "kycOk:", kycOk, "user:", user?.id);

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setFeeScreenshotFile(file);
    setFeeScreenshotPreview(URL.createObjectURL(file));
  };

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!feeScreenshotFile) return null;
    setUploadingScreenshot(true);
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error("Not authenticated");
      const ext = feeScreenshotFile.name.split(".").pop();
      const path = `${u.id}/fee-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("payment-screenshots").upload(path, feeScreenshotFile);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("payment-screenshots").getPublicUrl(path);
      return publicUrl;
    } catch (e: any) {
      toast.error("Screenshot upload failed: " + e.message);
      return null;
    } finally { setUploadingScreenshot(false); }
  };

  const copyUPI = () => {
    if (paymentSettings?.upi_id) {
      navigator.clipboard.writeText(paymentSettings.upi_id);
      toast.success("UPI ID copied!");
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!withdrawalsEnabled) return toast.error("Withdrawals are temporarily disabled.");
    const amt = Number(amount);
    if (!amt || amt < MIN_WITHDRAWAL) return toast.error(`Minimum withdrawal is ${inr(MIN_WITHDRAWAL)}.`);
    if (amt > MAX_WITHDRAWAL) return toast.error(`Maximum withdrawal is ${inr(MAX_WITHDRAWAL)}.`);
    if (amt > balance) return toast.error("Insufficient balance.");
    if (step === "form") { setStep("pay_fee"); return; }
    if (!serviceFeeUtr || serviceFeeUtr.trim().length < 6) return toast.error("Please enter the service fee payment UTR");
    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (feeScreenshotFile) screenshotUrl = await uploadScreenshot();
      const result = await requestWithdrawal({
        data: {
          amount: amt, payout_method: method, payout_details: details,
          service_fee_utr: serviceFeeUtr.trim(), service_fee_screenshot_url: screenshotUrl,
        }
      });
      toast.success(result.message || "Withdrawal request submitted!");
      setAmount(""); setDetails(""); setServiceFeeUtr("");
      setFeeScreenshotFile(null); setFeeScreenshotPreview(null);
      setStep("form");
      void load();
    } catch (e: any) { toast.error(e?.message || "Submission failed"); }
    finally { setSubmitting(false); }
  };

  // KYC lock takes precedence — full lock screen until approved
  if (kycRequired && !kycOk) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <div className="rounded-xl border-2 border-warning/40 bg-warning/10 p-8 text-center">
          <Lock className="mx-auto h-12 w-12 text-warning-foreground" />
          <h2 className="mt-3 text-xl font-bold">Withdrawals locked</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Complete your KYC verification to unlock withdrawals. Your earnings will be safely held until verification is approved.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Current KYC status: <span className="font-semibold capitalize">{kycStatus.replace(/_/g, " ")}</span>
          </p>
          <div className="mt-4">
            <Link to="/dashboard/kyc">
              <AzButton variant="brand" size="lg">
                <ShieldCheck className="h-4 w-4" /> Complete KYC verification
              </AzButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Service fee payment step
  if (step === "pay_fee" && reachedThreshold && kycOk) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => setStep("form")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-bold mb-1">Pay Service Fee</h1>
          <p className="text-sm text-muted-foreground mb-6">An 18% service fee must be paid before your withdrawal can be processed.</p>
          <div className="rounded-lg border bg-secondary/30 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">Withdrawal Amount</span>
              <span className="text-xl font-bold">{inr(Number(amount))}</span>
            </div>
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-muted-foreground">Service Fee (18%)</span>
              <span className="font-bold text-destructive">{inr(serviceFee)}</span>
            </div>
            <div className="pt-3 border-t flex items-center justify-between">
              <span className="font-bold">You will receive</span>
              <span className="text-2xl font-bold text-success">{inr(Number(amount))}</span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-bold">1. Pay Service Fee</h3>
              {paymentSettings?.qr_image_url ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border p-4 bg-white">
                  <img src={paymentSettings.qr_image_url} alt="UPI QR" className="w-48 h-48 object-contain" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Pay to</p>
                    <p className="font-bold text-sm">{paymentSettings.payee_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-secondary px-2 py-1 rounded">{paymentSettings.upi_id}</code>
                      <button onClick={copyUPI} className="text-primary hover:text-primary/80">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground border-t w-full pt-2">
                    Pay exactly <b className="text-foreground">{inr(serviceFee)}</b>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  {paymentSettings?.upi_id ? (
                    <div className="flex items-center gap-2">
                      <span>UPI: <b>{paymentSettings.upi_id}</b></span>
                      <button onClick={copyUPI}><Copy className="h-3.5 w-3.5 text-primary" /></button>
                    </div>
                  ) : "Payment details not configured. Contact support."}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h3 className="font-bold">2. Submit Payment Proof</h3>
              <div>
                <label className="block text-sm font-bold mb-1">Service Fee UTR *</label>
                <input type="text" value={serviceFeeUtr} onChange={(e) => setServiceFeeUtr(e.target.value)}
                  placeholder="e.g., 423456789012"
                  className="w-full rounded border border-input bg-white px-3 py-2" />
                <p className="text-xs text-muted-foreground mt-1">Found in your UPI app payment history</p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Payment Screenshot (optional)</label>
                {feeScreenshotPreview ? (
                  <div className="relative rounded-lg border overflow-hidden">
                    <img src={feeScreenshotPreview} alt="Screenshot" className="w-full max-h-40 object-contain bg-secondary/30" />
                    <button onClick={() => { setFeeScreenshotFile(null); setFeeScreenshotPreview(null); }}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-input py-6 flex flex-col items-center gap-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <Upload className="h-6 w-6" />
                    Click to upload screenshot
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleScreenshotSelect} className="hidden" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep("form")} className="flex-1 rounded border px-4 py-2 text-sm font-bold hover:bg-secondary">Cancel</button>
                <AzButton variant="brand" size="md" className="flex-1" disabled={submitting || uploadingScreenshot} onClick={submit}>
                  {submitting || uploadingScreenshot ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadingScreenshot ? "Uploading…" : "Submitting…"}</>
                  ) : "Submit Withdrawal"}
                </AzButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Withdrawals</h1>

      <div className="rounded-md border bg-card p-5 shadow-sm">
        <div className="text-sm text-muted-foreground">Available balance</div>
        <div className="text-3xl font-bold text-success">{inr(balance, { decimals: true })}</div>
        <div className="mt-2 text-xs text-muted-foreground">
          Minimum withdrawal threshold: <span className="font-semibold">{inr(MIN_WITHDRAWAL)}</span>
        </div>
      </div>

      {!reachedThreshold && (
        <div className="rounded-md border bg-secondary/40 p-4 text-sm">
          <div className="flex items-center gap-2 font-bold">
            <Lock className="h-4 w-4" /> Withdrawal locked
          </div>
          <p className="mt-1 text-muted-foreground">
            Earn at least <strong>{inr(MIN_WITHDRAWAL)}</strong> before you can request a payout.
            You need <strong>{inr(remainingToThreshold)}</strong> more.
          </p>
        </div>
      )}

      {reachedThreshold && kycOk && (
        <div className="space-y-3 rounded-md border bg-card p-5 shadow-sm">
          <h2 className="font-bold">Request a withdrawal</h2>
          <p className="text-xs text-muted-foreground">An 18% service fee applies on the withdrawal amount.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Amount (₹ INR) — min {inr(MIN_WITHDRAWAL)} · max {inr(MAX_WITHDRAWAL)}</span>
            <input type="number" step="1" min={MIN_WITHDRAWAL} max={MAX_WITHDRAWAL} value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded border border-input bg-white px-3 py-2" required />
          </label>
          {amount && Number(amount) >= MIN_WITHDRAWAL && (
            <div className="rounded-md bg-secondary/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Service Fee (18%)</span><span className="font-bold text-warning">{inr(serviceFee)} (pay via UPI)</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-bold">You receive</span><span className="font-bold text-success">{inr(Number(amount))}</span></div>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded border border-input bg-white px-3 py-2">
              <option>UPI</option>
              <option>Bank transfer (NEFT/IMPS)</option>
              <option>Paytm</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Payout details (UPI ID or bank account + IFSC)</span>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2}
              className="w-full rounded border border-input bg-white px-3 py-2" />
          </label>
          <AzButton variant="brand" onClick={submit}>
            Continue to Pay Service Fee
          </AzButton>
        </div>
      )}

      <div className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-2 text-sm font-bold">History</div>
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No withdrawal requests yet.</div>}
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0 text-sm">
            <div>
              <div className="font-semibold">{inr(i?.amount || 0)} via {i?.payout_method || i?.method || "N/A"}</div>
              <div className="text-xs text-muted-foreground">
                {i?.created_at ? new Date(i.created_at).toLocaleString("en-IN") : "N/A"}
                {i?.service_fee_amount > 0 && <> · Fee: {inr(i.service_fee_amount)}</>}
              </div>
            </div>
            <span className={`rounded px-2 py-1 text-xs font-bold capitalize ${
              i?.status === "paid" || i?.status === "approved" ? "bg-success/15 text-success" :
              i?.status === "rejected" ? "bg-destructive/15 text-destructive" :
              "bg-warning/15 text-warning-foreground"
            }`}>{i?.status?.replace(/_/g, " ") || "Unknown"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
