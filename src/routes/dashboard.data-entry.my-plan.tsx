import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { Crown, ArrowLeft, Loader2, Calendar, Copy, Upload, X, Users, Clock, AlertCircle, IndianRupee, Shield, Star, Zap, TrendingUp, CheckCircle2 } from "lucide-react";
import { getMyDataEntrySubscription, getAvailablePackages, upgradeDataEntryPackage, getMyDataEntryEarnings, getPaymentSettings } from "@/server/data-entry-packages.functions";

export const Route = createFileRoute("/dashboard/data-entry/my-plan")({
  component: MyPlanPage,
});

function MyPlanPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeStep, setUpgradeStep] = useState<"view" | "select" | "pay">("view");
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [utr, setUtr] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, pkgRes, earningsRes, payRes] = await Promise.all([
        getMyDataEntrySubscription(),
        getAvailablePackages(),
        getMyDataEntryEarnings(),
        getPaymentSettings(),
      ]);
      setSubscription(subRes?.subscription);
      setPendingUpgrade(subRes?.pendingSubscription || null);
      setPackages(pkgRes?.packages || []);
      setEarnings(earningsRes);
      setPaymentSettings(payRes);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load plan details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
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
      const path = `${user.id}/upgrade-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("payment-screenshots").upload(path, screenshotFile);
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

  const submitUpgrade = async () => {
    if (!selectedPackage) return;
    if (!utr || utr.trim().length < 6) return toast.error("Please enter the payment UTR");
    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (screenshotFile) screenshotUrl = await uploadScreenshot();
      const result = await upgradeDataEntryPackage({
        data: {
          new_package_id: selectedPackage.id,
          payment_utr: utr.trim(),
          payment_screenshot_url: screenshotUrl,
        },
      });
      toast.success(result.message || "Upgrade request submitted!");
      setUtr("");
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setUpgradeStep("view");
      void loadData();
    } catch (e: any) {
      toast.error(e?.message || "Upgrade failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard/data-entry/packages" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to packages
        </Link>
        <div className="rounded-lg border bg-card p-8 text-center">
          <Crown className="mx-auto h-16 w-16 text-warning mb-4" />
          <h2 className="text-xl font-bold mb-2">No Active Plan</h2>
          <p className="text-muted-foreground mb-6">Purchase a data entry package to start earning.</p>
          <Link to="/dashboard/data-entry/packages">
            <AzButton variant="brand">View Packages</AzButton>
          </Link>
        </div>
      </div>
    );
  }

  const currentPkg = subscription.package;
  const upgradePrice = selectedPackage ? Math.max(0, selectedPackage.price_inr - currentPkg.price_inr) : 0;
  const higherTierPackages = packages.filter((p: any) => p.price_inr > currentPkg.price_inr && p.is_active);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/dashboard/data-entry" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      {/* Current Plan Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{currentPkg.name} Plan</h1>
            <p className="text-sm text-muted-foreground">Your current data entry subscription</p>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
            Active
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-lg border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" /> Validity
            </div>
            <div className="text-lg font-bold">
              {subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString("en-IN") : "Permanent"}
            </div>
          </div>
          <div className="rounded-lg border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" /> Daily Tasks
            </div>
            <div className="text-lg font-bold">{currentPkg.daily_task_limit} / day</div>
          </div>
          <div className="rounded-lg border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <IndianRupee className="h-4 w-4" /> Task Reward
            </div>
            <div className="text-lg font-bold">{inr(currentPkg.reward_per_task)} / task</div>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <h3 className="font-bold text-sm">Plan Benefits</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {currentPkg.daily_task_limit} data entry tasks daily</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {inr(currentPkg.reward_per_task)} per completed task</li>
            {currentPkg.referral_commission_percent > 0 && (
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {currentPkg.referral_commission_percent}% referral commission</li>
            )}
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Earnings credited to incentive wallet</li>
          </ul>
        </div>

        {pendingUpgrade && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 mb-4">
            <div className="flex items-center gap-2 font-bold text-warning-foreground mb-1">
              <AlertCircle className="h-4 w-4" /> Upgrade Pending
            </div>
            <p className="text-sm text-muted-foreground">
              Your upgrade to {pendingUpgrade.package?.name} is being reviewed. Admin will verify your payment shortly.
            </p>
          </div>
        )}

        {higherTierPackages.length > 0 && !pendingUpgrade && (
          <AzButton variant="brand" onClick={() => setUpgradeStep("select")} className="w-full md:w-auto">
            <Zap className="mr-2 h-4 w-4" /> Upgrade Plan
          </AzButton>
        )}
      </div>

      {/* Earnings Summary */}
      {earnings && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Earnings Summary
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-secondary/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Earnings</div>
              <div className="text-2xl font-bold text-success">{inr(earnings.total_earnings || 0)}</div>
            </div>
            <div className="rounded-lg border bg-secondary/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">Tasks Completed</div>
              <div className="text-2xl font-bold">{earnings.total_tasks || 0}</div>
            </div>
            <div className="rounded-lg border bg-secondary/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">Referral Earnings</div>
              <div className="text-2xl font-bold text-primary">{inr(earnings.referral_earnings || 0)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Selection */}
      {upgradeStep === "select" && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">Select Higher-Tier Plan</h2>
          <p className="text-sm text-muted-foreground mb-6">Upgrade to unlock more daily tasks and higher rewards per task.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {higherTierPackages.map((pkg: any) => (
              <div
                key={pkg.id}
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedPackage?.id === pkg.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedPackage(pkg)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold">{pkg.name}</h3>
                  <Star className="h-4 w-4 text-warning" />
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>{pkg.daily_task_limit} tasks/day · {inr(pkg.reward_per_task)}/task</div>
                  {pkg.referral_commission_percent > 0 && <div>{pkg.referral_commission_percent}% referral commission</div>}
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="text-sm text-muted-foreground">Upgrade price</div>
                  <div className="text-lg font-bold">{inr(Math.max(0, pkg.price_inr - currentPkg.price_inr))}</div>
                </div>
              </div>
            ))}
          </div>
          {higherTierPackages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No higher-tier plans available. You're on the highest tier!
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={() => { setUpgradeStep("view"); setSelectedPackage(null); }} className="rounded border px-4 py-2 font-bold hover:bg-secondary">
              Cancel
            </button>
            {selectedPackage && (
              <AzButton variant="brand" onClick={() => setUpgradeStep("pay")}>
                Continue to Payment
              </AzButton>
            )}
          </div>
        </div>
      )}

      {/* Upgrade Payment */}
      {upgradeStep === "pay" && selectedPackage && (
        <div className="rounded-lg border bg-card p-6">
          <button onClick={() => setUpgradeStep("select")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h2 className="text-2xl font-bold mb-1">Pay for Upgrade</h2>
          <p className="text-sm text-muted-foreground mb-6">Complete payment to upgrade from {currentPkg.name} to {selectedPackage.name}.</p>

          <div className="rounded-lg border bg-secondary/30 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">Current Plan</span>
              <span className="text-xl font-bold">{currentPkg.name} ({inr(currentPkg.price_inr)})</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">New Plan</span>
              <span className="text-xl font-bold">{selectedPackage.name} ({inr(selectedPackage.price_inr)})</span>
            </div>
            <div className="pt-3 border-t flex items-center justify-between">
              <span className="font-bold">Upgrade Price</span>
              <span className="text-2xl font-bold text-primary">{inr(upgradePrice)}</span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-bold">1. Pay Upgrade Fee</h3>
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
                    Pay exactly <b className="text-foreground">{inr(upgradePrice)}</b>
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
                <label className="block text-sm font-bold mb-1">Payment UTR *</label>
                <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g., 423456789012"
                  className="w-full rounded border border-input bg-white px-3 py-2" />
                <p className="text-xs text-muted-foreground mt-1">Found in your UPI app payment history</p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Payment Screenshot (optional)</label>
                {screenshotPreview ? (
                  <div className="relative rounded-lg border overflow-hidden">
                    <img src={screenshotPreview} alt="Screenshot" className="w-full max-h-40 object-contain bg-secondary/30" />
                    <button onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
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
                <button onClick={() => setUpgradeStep("select")} className="flex-1 rounded border px-4 py-2 text-sm font-bold hover:bg-secondary">Cancel</button>
                <AzButton variant="brand" size="md" className="flex-1" disabled={submitting || uploadingScreenshot} onClick={submitUpgrade}>
                  {submitting || uploadingScreenshot ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadingScreenshot ? "Uploading…" : "Submitting…"}</>
                  ) : "Submit Upgrade"}
                </AzButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
