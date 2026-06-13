import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { AzButton } from "@/components/az-button";
import { Loader2, ArrowLeft, CheckCircle, Smartphone, Lock } from "lucide-react";
import { requestForgotPasswordOtp, verifyForgotPasswordOtp } from "@/server/sms-otp.functions";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function startCountdown(set: (v: (p: number) => number) => void) {
  const timer = setInterval(() => {
    set((prev) => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
  }, 1000);
}

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const requestOtpFn = useServerFn(requestForgotPasswordOtp);
  const verifyOtpFn = useServerFn(verifyForgotPasswordOtp);

  const [step, setStep] = useState<"identifier" | "otp" | "done">("identifier");
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [mobile, setMobile] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countdown, setCountdown] = useState(0);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return toast.error("Please enter your email or mobile number.");
    setLoading(true);
    try {
      const res = await requestOtpFn({ data: { identifier: identifier.trim() } });
      setMobile(res.mobile);
      setMaskedTarget(res.maskedTarget);
      setStep("otp");
      setCountdown(60);
      startCountdown(setCountdown);
      toast.success(`OTP sent to ${res.maskedTarget}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0 || loading) return;
    setLoading(true);
    try {
      const res = await requestOtpFn({ data: { identifier: identifier.trim() } });
      setMobile(res.mobile);
      setMaskedTarget(res.maskedTarget);
      setCountdown(60);
      startCountdown(setCountdown);
      toast.success("OTP resent.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend OTP.");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Enter the 6-digit OTP.");
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    setLoading(true);
    try {
      await verifyOtpFn({ data: { mobile, code: otp, newPassword } });
      setStep("done");
      toast.success("Password reset successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset password.");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <div className="rounded-md border bg-card p-6 shadow-sm">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>

          <h1 className="text-2xl font-bold">Reset your password</h1>

          {step === "identifier" && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your registered email or mobile number. We'll send an OTP via SMS.
              </p>
              <form onSubmit={handleRequestOtp} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Email or Mobile Number</span>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="email@example.com or 9876543210"
                      required
                      className="w-full rounded border border-input bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </label>
                <AzButton variant="brand" size="md" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : "Send OTP"}
                </AzButton>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                OTP sent to <strong>{maskedTarget}</strong>. Enter it below and choose a new password.
              </p>
              <form onSubmit={handleVerify} className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1.5">6-digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    autoFocus
                    className="w-full rounded border border-input bg-white px-3 py-2 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      className="w-full rounded border border-input bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="w-full rounded border border-input bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <AzButton variant="brand" size="md" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting…</> : "Reset Password"}
                </AzButton>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setStep("identifier"); setOtp(""); }}
                    className="text-muted-foreground hover:text-foreground">
                    ← Change
                  </button>
                  <button type="button" onClick={handleResend} disabled={countdown > 0 || loading}
                    className="text-primary hover:underline disabled:no-underline disabled:text-muted-foreground">
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="mt-6 rounded-lg border border-success/30 bg-success/10 p-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success mb-3" />
              <h3 className="font-bold text-success text-lg">Password reset!</h3>
              <p className="mt-1 text-sm text-muted-foreground">You can now sign in with your new password.</p>
              <AzButton variant="brand" size="md" className="mt-4 w-full" onClick={() => navigate({ to: "/login" })}>
                Sign In
              </AzButton>
            </div>
          )}

          <div className="mt-6 border-t pt-4 text-center text-sm">
            Remember your password?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
