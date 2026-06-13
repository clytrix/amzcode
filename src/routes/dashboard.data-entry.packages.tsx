import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { Crown, Check, ArrowLeft, Loader2, Calendar, Copy, Upload, X, Users, Clock, AlertCircle, IndianRupee, Shield, Star, Zap } from "lucide-react";
import { getAvailablePackages, purchaseDataEntryPackage, getMyDataEntrySubscription, getPaymentSettings } from "@/server/data-entry-packages.functions";

export const Route = createFileRoute("/dashboard/data-entry/packages")({
  component: DataEntryPackagesPage,
});

const DURATION_OPTIONS = [
  { days: 30, label: "1 Month", multiplier: 1 },
  { days: 180, label: "6 Months", multiplier: 5.5 },
  { days: 365, label: "1 Year", multiplier: 10 },
  { days: 0, label: "Permanent", multiplier: 25 },
];

function DataEntryPackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [pendingSubscription, setPendingSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[0]);
  const [purchaseStep, setPurchaseStep] = useState<"select" | "pay">("select");
  const [utr, setUtr] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Fetch active packages via server function (uses admin client, bypasses RLS)
      const pkgRes = await getAvailablePackages();
      setPackages(pkgRes?.packages || []);
      
      // Try server functions for subscription + payment settings
      try {
        const subRes = await getMyDataEntrySubscription();
        setSubscription(subRes?.subscription);
        setPendingSubscription(subRes?.pendingSubscription || null);
      } catch (subErr: any) {
        console.warn("Subscription fetch failed:", subErr?.message);
      }
      
      try {
        const payRes = await getPaymentSettings();
        setPaymentSettings(payRes);
      } catch (payErr: any) {
        console.warn("Payment settings fetch failed:", payErr?.message);
      }
    } catch (e: any) {
      console.error("Load error:", e);
      setLoadError(e?.message || "Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotFile) return null;
    setUploadingScreenshot(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = screenshotFile.name.split(".").pop();
      const path = `${user.id}/payment-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("payment-screenshots").upload(path, screenshotFile);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("payment-screenshots").getPublicUrl(path);
      return publicUrl;
    } catch (e: any) {
      toast.error("Screenshot upload failed: " + e.message);
      return null;
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !utr) {
      toast.error("Please enter payment UTR");
      return;
    }
    if (utr.trim().length < 6) {
      toast.error("UTR must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (screenshotFile) {
        screenshotUrl = await uploadScreenshot();
      }

      const result = await purchaseDataEntryPackage({
        data: {
          package_id: selectedPackage.id,
          duration_days: selectedDuration.days,
          payment_utr: utr.trim(),
          payment_screenshot_url: screenshotUrl,
          referral_code: referralCode.trim() || null,
        },
      });
      toast.success(result.message || "Purchase submitted for approval");
      setPurchaseStep("select");
      setUtr("");
      setReferralCode("");
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setSelectedPackage(null);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  };

  const calculatePrice = (basePrice: number) => Math.round(basePrice * selectedDuration.multiplier);

  const copyUPI = () => {
    if (paymentSettings?.upi_id) {
      navigator.clipboard.writeText(paymentSettings.upi_id);
      toast.success("UPI ID copied!");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading packages…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center space-y-3">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="font-bold text-lg">Failed to load packages</h2>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <AzButton variant="brand" size="md" onClick={() => void loadData()}>Retry</AzButton>
        </div>
      </div>
    );
  }

  // Purchase flow - payment step
  if (purchaseStep === "pay" && selectedPackage) {
    const price = calculatePrice(selectedPackage.price_inr);
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => setPurchaseStep("select")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Plans
        </button>

        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-bold mb-1">Complete Purchase</h1>
          <p className="text-sm text-muted-foreground mb-6">Pay and submit your UTR to activate instantly after admin approval.</p>

          {/* Order summary */}
          <div className="rounded-lg border bg-secondary/30 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">{selectedPackage.name} Plan</span>
              <span className="text-sm text-muted-foreground">{selectedPackage.daily_task_limit} tasks/day</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
              <span>Duration: {selectedDuration.label}</span>
              <span>Reward: {inr(selectedPackage.reward_per_task)}/task</span>
            </div>
            <div className="pt-3 border-t flex items-center justify-between">
              <span className="font-bold text-lg">Total Amount</span>
              <span className="text-2xl font-bold text-success">{inr(price)}</span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: QR code + UPI */}
            <div className="space-y-4">
              <h3 className="font-bold">1. Scan & Pay</h3>
              {paymentSettings?.qr_image_url ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border p-4 bg-white">
                  <img
                    src={paymentSettings.qr_image_url}
                    alt="UPI QR Code"
                    className="w-48 h-48 object-contain"
                  />
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
                    Pay exactly <b className="text-foreground">{inr(price)}</b>
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
              {paymentSettings?.instructions && (
                <p className="text-xs text-muted-foreground">{paymentSettings.instructions}</p>
              )}
            </div>

            {/* Right: UTR + screenshot */}
            <div className="space-y-4">
              <h3 className="font-bold">2. Submit Payment Proof</h3>

              <div>
                <label className="block text-sm font-bold mb-1">UTR / Transaction Reference *</label>
                <input
                  type="text"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g., 423456789012"
                  className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Found in your UPI app payment history</p>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Payment Screenshot (optional)</label>
                {screenshotPreview ? (
                  <div className="relative rounded-lg border overflow-hidden">
                    <img src={screenshotPreview} alt="Screenshot" className="w-full max-h-40 object-contain bg-secondary/30" />
                    <button
                      onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-input py-6 flex flex-col items-center gap-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Upload className="h-6 w-6" />
                    Click to upload screenshot
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotSelect}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">
                  <Users className="inline h-3.5 w-3.5 mr-1" />
                  Referral Code (optional)
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="Enter referral code"
                  className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPurchaseStep("select")}
                  className="flex-1 rounded border px-4 py-2 text-sm font-bold hover:bg-secondary"
                >
                  Cancel
                </button>
                <AzButton
                  variant="brand"
                  size="md"
                  className="flex-1"
                  disabled={submitting || uploadingScreenshot || !utr}
                  onClick={handlePurchase}
                >
                  {submitting || uploadingScreenshot ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadingScreenshot ? "Uploading…" : "Submitting…"}</>
                  ) : "Submit Payment"}
                </AzButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active subscription display
  if (subscription) {
    const pkg = subscription.package;
    const expiresAt = subscription.expires_at;
    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
      : null;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/dashboard/data-entry" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Data Entry
        </Link>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-success/20 to-success/5 border-b border-success/20 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
                <Crown className="h-6 w-6 text-success" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{pkg.name} Plan</h1>
                <p className="text-sm text-muted-foreground">Active subscription</p>
              </div>
            </div>
            <span className="rounded-full bg-success text-white text-xs font-bold px-3 py-1">Active</span>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Daily Tasks", value: `${pkg.daily_task_limit} tasks/day` },
                { label: "Reward per Task", value: inr(pkg.reward_per_task) },
                { label: "Max Daily Earn", value: inr(pkg.daily_task_limit * pkg.reward_per_task) },
                { label: "Expires", value: expiresAt ? `${new Date(expiresAt).toLocaleDateString("en-IN")} (${daysLeft}d left)` : "Never (Permanent)" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <Link to="/dashboard/data-entry">
              <AzButton variant="brand" size="md" className="w-full">Start Data Entry Tasks</AzButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Pending subscription — awaiting admin approval
  if (pendingSubscription) {
    const pkg = pendingSubscription.package;
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Link to="/dashboard/data-entry" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Data Entry
        </Link>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-warning/20 to-warning/5 border-b border-warning/20 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
                <Clock className="h-6 w-6 text-warning-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Payment Under Review</h1>
                <p className="text-sm text-muted-foreground">Awaiting admin approval</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-lg bg-secondary/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-bold">{pkg?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Daily Tasks</span><span className="font-bold">{pkg?.daily_task_limit}/day</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">UTR</span><code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{pendingSubscription.payment_utr}</code></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Submitted</span><span>{new Date(pendingSubscription.created_at).toLocaleDateString("en-IN")}</span></div>
            </div>
            <p className="text-sm text-muted-foreground text-center">Approvals typically happen within 2–4 hours. You’ll get full access the moment it’s approved.</p>
            <Link to="/dashboard/tickets">
              <AzButton variant="outline" size="md" className="w-full">Contact Support</AzButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const PLAN_ICONS = [Zap, Star, Crown];
  const PLAN_TINTS = [
    "from-blue-500/10 to-blue-600/5 border-blue-300/40",
    "from-purple-500/10 to-purple-600/5 border-purple-300/40",
    "from-amber-500/10 to-amber-600/5 border-amber-300/40",
  ];

  // Package selection (default view)
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wide">
          <Crown className="h-3.5 w-3.5" /> Data Entry Plans
        </div>
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Purchase a package to unlock daily data entry tasks. Complete tasks and earn rewards directly to your incentive wallet.
        </p>
      </div>

      {/* Duration tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border bg-secondary/50 p-1 gap-1 flex-wrap justify-center">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setSelectedDuration(opt)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                selectedDuration.label === opt.label
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Packages grid */}
      {packages.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-2">
          <Crown className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="font-bold text-muted-foreground">No packages available</p>
          <p className="text-sm text-muted-foreground">Please check back later or contact support.</p>
          <button onClick={() => void loadData()} className="mt-2 text-sm text-primary hover:underline">Retry loading →</button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, idx) => {
            const price = calculatePrice(pkg.price_inr);
            const dailyEarning = pkg.daily_task_limit * pkg.reward_per_task;
            const PlanIcon = PLAN_ICONS[idx % PLAN_ICONS.length];
            const tint = PLAN_TINTS[idx % PLAN_TINTS.length];
            const isPopular = idx === 1;
            return (
              <div
                key={pkg.id}
                className={`relative rounded-xl border bg-gradient-to-b ${tint} p-5 flex flex-col transition-shadow hover:shadow-md ${
                  isPopular ? "ring-2 ring-primary" : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 shadow">Most Popular</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5 mb-4 mt-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/60 border">
                    <PlanIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{pkg.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedDuration.label} plan</p>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-3xl font-bold">{inr(price)}</div>
                  {selectedDuration.days > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{inr(Math.round(price / selectedDuration.days))}/day</p>
                  )}
                </div>
                <ul className="space-y-2.5 text-sm mb-6 flex-1">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success flex-shrink-0" /><span><b>{pkg.daily_task_limit}</b> tasks per day</span></li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success flex-shrink-0" /><span><b>{inr(pkg.reward_per_task)}</b> reward per task</span></li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success flex-shrink-0" /><span>Earn up to <b>{inr(dailyEarning)}</b>/day</span></li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success flex-shrink-0" /><span>Instant wallet credit</span></li>
                </ul>
                <AzButton
                  variant={isPopular ? "brand" : "outline"}
                  size="md"
                  className="w-full"
                  onClick={() => { setSelectedPackage(pkg); setPurchaseStep("pay"); }}
                >
                  Get {pkg.name} Plan
                </AzButton>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust strip */}
      <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground pt-2 border-t">
        <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-success" /> Secure UPI payment</span>
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" /> Approved within 2–4 hrs</span>
        <span className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5 text-warning-foreground" /> Instant wallet credit</span>
        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Earn via referrals</span>
      </div>
    </div>
  );
}
