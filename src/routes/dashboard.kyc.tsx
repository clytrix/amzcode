import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { ShieldCheck, AlertCircle, CheckCircle2, Lock, Wallet, FileText, Upload, ExternalLink, Copy, QrCode, AlertTriangle } from "lucide-react";
import { inr, usd } from "@/lib/currency";
import { saveKycDetails, submitKycPaymentUtr } from "@/server/kyc.functions";
import { KycDocumentUploader, isKycDocsComplete } from "@/components/kyc-document-uploader";
import { usePublicSettings } from "@/lib/platform-settings";

export const Route = createFileRoute("/dashboard/kyc")({ component: KycPage });

function KycPage() {
  const { user } = useAuth();
  const { settings } = usePublicSettings();
  const upi = settings["payments.upi"] as any || {};
  const kycCfg = settings["kyc.config"];
  const feeUsd = Number(kycCfg.fee_usd) || 79;
  const rate = Number(upi.usd_to_inr_rate) || 94;
  const kycInr = Math.round(feeUsd * rate);

  const [kyc, setKyc] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [step, setStep] = useState<"docs" | "upload" | "pay" | "review" | "approved">("docs");
  const [saving, setSaving] = useState(false);
  const [utr, setUtr] = useState("");
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const formInitializedRef = useRef(false);

  const load = async (updateForm = false) => {
    if (!user) return;
    const { data } = await supabase.from("kyc_submissions").select("*").eq("user_id", user.id).maybeSingle();
    setKyc(data);
    // Only update form from DB on initial load or when explicitly requested
    // This prevents the polling interval from overwriting user input
    if (updateForm || !formInitializedRef.current) {
      setForm(data || {});
      formInitializedRef.current = true;
    }
    if (data?.status === "approved") setStep("approved");
    else if (data?.status === "documents_submitted" || data?.status === "payment_submitted" || data?.status === "fee_paid") setStep("review");
    else if (data && data.full_name && data.bank_account_number && !isKycDocsComplete(data)) setStep("upload");
    else if (data && isKycDocsComplete(data)) setStep("pay");
    else setStep("docs");
  };

  // Initial load - only runs once when user is available
  useEffect(() => {
    if (!user) return;
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Live update: poll every 5s to detect changes from other tabs
  // Only updates kyc state, NOT form state (to avoid clearing user input)
  useEffect(() => {
    if (!user) return;
    // Only poll when on certain steps where we need live updates
    if (step !== "pay" && step !== "upload" && step !== "docs") return;
    const id = setInterval(() => {
      // Load without updating form to prevent clearing user input
      supabase.from("kyc_submissions").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        setKyc(data);
        // Check for status changes that should update step
        if (data?.status === "approved") setStep("approved");
        else if (data?.status === "documents_submitted" || data?.status === "payment_submitted" || data?.status === "fee_paid") setStep("review");
      });
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, step]);

  const docsValid = (f: any) => !!(f.full_name && f.date_of_birth && f.address && f.address.length >= 5 && f.document_number
    && f.bank_account_holder && f.bank_account_number && f.bank_ifsc_swift);

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docsValid(form)) {
      if (!form.address || form.address.length < 5) {
        return toast.error("Please enter a complete address (at least 5 characters) with house/street, area, city, state and PIN code.");
      }
      return toast.error("Please fill in all required fields.");
    }
    setSaving(true);
    try {
      await saveKycDetails({
        data: {
          full_name: form.full_name,
          date_of_birth: form.date_of_birth,
          address: form.address,
          document_type: form.document_type || "Aadhaar Card",
          document_number: form.document_number,
          pan_number: form.pan_number || null,
          aadhaar_number: form.aadhaar_number || form.document_number || null,
          bank_account_holder: form.bank_account_holder,
          bank_account_number: form.bank_account_number,
          bank_name: form.bank_name || "—",
          bank_ifsc_swift: form.bank_ifsc_swift,
          upi_id: form.upi_id || null,
        },
      });
      toast.success("Details saved.");
      await load();
      setStep("upload");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast.error(err?.message || "Could not save details");
    } finally { setSaving(false); }
  };

  const goToPayStep = () => {
    if (!isKycDocsComplete(kyc)) return toast.error("Please upload Aadhaar, bank passbook page and selfie.");
    setStep("pay");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyToClipboard = async (txt: string, label: string) => {
    try { await navigator.clipboard.writeText(txt); toast.success(`${label} copied`); }
    catch { toast.error("Copy failed"); }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utr.trim() || utr.trim().length < 6) return toast.error("Enter the UPI UTR / Transaction reference (min 6 chars)");
    setSubmittingUtr(true);
    try {
      await submitKycPaymentUtr({ data: { utr: utr.trim(), inr_amount: kycInr, screenshot_url: null } });
      toast.success("Payment recorded! Your KYC is under review.");
      setStep("review");
      await load(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not submit UTR");
    } finally { setSubmittingUtr(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">KYC Verification</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Two-step KYC: enter your details, upload your documents, then pay the verification fee via UPI.
        </p>
      </div>

      <Stepper step={step} />

      {step === "approved" && (
        <div className="rounded-xl border-2 border-success/40 bg-success/10 p-6">
          <div className="flex items-center gap-2 text-lg font-bold text-success"><CheckCircle2 className="h-5 w-5" /> KYC Approved</div>
          <p className="mt-1 text-sm text-muted-foreground">You're verified. Withdrawals are now unlocked.</p>
        </div>
      )}

      {step === "review" && (
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-lg font-bold"><Lock className="h-5 w-5 text-primary" /> KYC under process</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Thanks — we received your payment of <b>{inr(Number(kyc?.payment_inr_amount || kycInr))}</b>.
            Our team is verifying your KYC and will update you within 24 hours.
          </p>
          {kyc?.payment_utr && (
            <div className="mt-3 rounded border bg-secondary/40 p-3 text-xs">
              UTR / Transaction ref: <span className="font-mono font-bold">{kyc.payment_utr}</span>
            </div>
          )}
        </div>
      )}

      {step === "docs" && (
        <form onSubmit={saveDetails} className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Step 1 — Personal & bank details</h2>
          </div>
          {kyc?.status === "rejected" && (
            <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
              <b>Previous submission rejected:</b> {kyc.admin_notes || "Please re-submit corrected information."}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Full name (as per Aadhaar)" value={form.full_name || ""} onChange={(v) => setForm({ ...form, full_name: v })} required />
            <Input label="Phone number" value={form.phone || ""} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="Email" type="email" value={form.email || user?.email || ""} onChange={(v) => setForm({ ...form, email: v })} />
            <Input label="Date of birth" type="date" value={form.date_of_birth || ""} onChange={(v) => setForm({ ...form, date_of_birth: v })} required />
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold">Full address with PIN code (min 5 characters)</span>
                <textarea
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2} required
                  minLength={5}
                  className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                  placeholder="House / street, area, city, state, PIN code"
                />
                {form.address && form.address.length < 5 && (
                  <span className="mt-1 block text-xs text-destructive">Address must be at least 5 characters</span>
                )}
              </label>
            </div>
            <Input label="Aadhaar number" value={form.document_number || ""} onChange={(v) => setForm({ ...form, document_number: v, document_type: "Aadhaar Card" })} required />
            <Input label="PAN number (optional)" value={form.pan_number || ""} onChange={(v) => setForm({ ...form, pan_number: v })} />
            <Input label="Bank account holder name" value={form.bank_account_holder || ""} onChange={(v) => setForm({ ...form, bank_account_holder: v })} required />
            <Input label="Bank name" value={form.bank_name || ""} onChange={(v) => setForm({ ...form, bank_name: v })} />
            <Input label="Bank account number" value={form.bank_account_number || ""} onChange={(v) => setForm({ ...form, bank_account_number: v })} required />
            <Input label="IFSC code" value={form.bank_ifsc_swift || ""} onChange={(v) => setForm({ ...form, bank_ifsc_swift: v.toUpperCase() })} required />
            <Input label="UPI ID (optional)" value={form.upi_id || ""} onChange={(v) => setForm({ ...form, upi_id: v })} />
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">Next: upload Aadhaar, bank passbook & selfie.</div>
            <AzButton variant="brand" size="lg" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save & continue →"}
            </AzButton>
          </div>
        </form>
      )}

      {step === "upload" && (
        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Step 2 — Upload documents</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload clear photos of your Aadhaar card, bank passbook front page, and a selfie.
          </p>
          <KycDocumentUploader kyc={kyc} onChange={(patch) => setKyc({ ...(kyc || {}), ...patch })} />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button type="button" onClick={() => setStep("docs")} className="text-sm font-semibold text-muted-foreground hover:underline">
              ← Edit details
            </button>
            <AzButton variant="brand" size="lg" type="button" onClick={goToPayStep} disabled={!isKycDocsComplete(kyc)}>
              Continue to payment →
            </AzButton>
          </div>
        </div>
      )}

      {step === "pay" && (
        <div className="space-y-5">
          {/* Payment Info Header */}
          <div className="rounded-xl border-2 border-primary/30 bg-card p-6 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Step 3 — Pay verification fee</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Pay the one-time KYC verification fee. <b>This amount is fully refundable</b> and will be returned to you with your first salary payout.
            </p>

            <div className="mt-5 rounded-lg border bg-secondary/40 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verification fee (refundable)</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-4xl font-bold tracking-tight">{inr(kycInr)}</span>
                <span className="text-base text-muted-foreground">≈ {usd(feeUsd)}</span>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Conversion rate: 1 USD = ₹{rate}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Identity & document verification</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Bank account validation</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> <b>Refunded with first salary</b></li>
              </ul>
            </div>
          </div>

          {/* Payment QR and UPI ID */}
          {upi.upi_id && upi.qr_image_url ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
                <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold">
                  <QrCode className="h-4 w-4" /> Scan QR code
                </div>
                <img src={upi.qr_image_url} alt="UPI QR code" className="mx-auto max-h-64 w-auto rounded border bg-white p-2" />
                <p className="mt-2 text-xs text-muted-foreground">Open any UPI app (GPay, PhonePe, Paytm…) and scan</p>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="text-sm font-bold">Or pay to UPI ID</div>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2 rounded border bg-secondary/30 p-2">
                    <span className="font-mono text-xs">{upi.upi_id}</span>
                    <button type="button" onClick={() => copyToClipboard(upi.upi_id, "UPI ID")} className="text-primary hover:opacity-70">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {upi.payee_name && (
                    <div className="text-xs">Payee: <b>{upi.payee_name}</b></div>
                  )}
                  <div className="rounded border bg-warning/10 p-2 text-xs">
                    <b>Pay exactly {inr(kycInr)}</b> for instant verification.
                  </div>
                  {upi.instructions && <p className="text-xs text-muted-foreground">{upi.instructions}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <h3 className="mt-2 font-bold text-destructive">Payment not configured</h3>
              <p className="mt-1 text-sm">The administrator hasn't set up the UPI payment method yet. Please contact support.</p>
            </div>
          )}

          {/* UTR Submission Form */}
          <form onSubmit={submitPayment} className="rounded-xl border-2 border-primary/40 bg-card p-5 shadow-sm">
            <h3 className="text-lg font-bold">Confirm payment</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              After paying via UPI, copy the <b>UTR / Transaction ID</b> from your UPI app receipt and paste below.
            </p>
            <input
              type="text"
              value={utr}
              onChange={(e) => setUtr(e.target.value.toUpperCase())}
              placeholder="e.g. 412345678901"
              className="mt-3 w-full rounded border border-input bg-white px-3 py-2 font-mono text-sm uppercase"
              required
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep("upload")} className="text-sm font-semibold text-muted-foreground hover:underline">
                ← Edit documents
              </button>
              <AzButton type="submit" variant="brand" size="lg" disabled={submittingUtr || !upi.upi_id}>
                {submittingUtr ? "Submitting…" : "Submit UTR & complete payment"}
              </AzButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: "docs" | "upload" | "pay" | "review" | "approved" }) {
  const idx = step === "docs" ? 0 : step === "upload" ? 1 : step === "pay" ? 2 : step === "review" ? 3 : 4;
  const labels = ["Details", "Documents", "Payment", "Review", "Approved"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-bold">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i <= idx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {i < idx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={i <= idx ? "text-foreground" : "text-muted-foreground"}>{l}</span>
          {i < labels.length - 1 && <span className="mx-1 hidden h-px w-8 bg-border sm:block" />}
        </li>
      ))}
    </ol>
  );
}

function Input({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
