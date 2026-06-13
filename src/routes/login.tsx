import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { AzButton } from "@/components/az-button";
import { Smartphone, Lock, ArrowRight, Loader2, Shield } from "lucide-react";
import { requestLoginOtp, verifyLoginOtp } from "@/server/sms-otp.functions";

export const Route = createFileRoute("/login")({ component: LoginPage });

function startCountdown(set: (v: (p: number) => number) => void) {
  const timer = setInterval(() => {
    set((prev) => {
      if (prev <= 1) { clearInterval(timer); return 0; }
      return prev - 1;
    });
  }, 1000);
}

function LoginPage() {
  const requestOtpFn = useServerFn(requestLoginOtp);
  const verifyOtpFn = useServerFn(verifyLoginOtp);

  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [mobile, setMobile] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { toast.error("Please enter your email or mobile number"); return; }
    setLoading(true);
    try {
      const result = await requestOtpFn({ data: { identifier: identifier.trim() } });
      setMobile(result.mobile);
      setMaskedTarget(result.maskedTarget);
      setStep("otp");
      setCountdown(60);
      startCountdown(setCountdown);
      toast.success(`OTP sent to ${result.maskedTarget}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      const result = await verifyOtpFn({ data: { mobile, code: otp } });
      // Use the hashed token to verify OTP type and sign in
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: result.hashedToken,
        type: "magiclink",
      });
      if (error || !data.session) throw new Error("Session creation failed. Please try again.");
      toast.success("Login successful!");
      await new Promise((r) => setTimeout(r, 100));
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || loading) return;
    setLoading(true);
    try {
      const result = await requestOtpFn({ data: { identifier: identifier.trim() } });
      setMobile(result.mobile);
      setMaskedTarget(result.maskedTarget);
      setCountdown(60);
      startCountdown(setCountdown);
      toast.success("OTP resent successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-secondary via-white to-secondary">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <div className="rounded-xl border bg-white p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Secure Login</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "identifier"
                ? "Enter your email or mobile number"
                : `OTP sent to ${maskedTarget}`}
            </p>
          </div>

          {step === "identifier" ? (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5">Email or Mobile Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="email@example.com or 9876543210"
                    autoComplete="tel"
                    required
                    className="w-full rounded-lg border border-input bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  OTP will be sent via SMS to your registered mobile number.
                </p>
              </div>
              <AzButton variant="brand" size="md" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : <><ArrowRight className="mr-2 h-4 w-4" />Send OTP</>}
              </AzButton>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5">Enter OTP</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    autoFocus
                    required
                    className="w-full rounded-lg border border-input bg-secondary/50 pl-10 pr-4 py-2.5 text-sm text-center tracking-[0.5em] font-mono text-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  6-digit OTP sent to <strong>{maskedTarget}</strong>
                </p>
              </div>
              <AzButton variant="brand" size="md" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Verify & Login"}
              </AzButton>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setStep("identifier"); setOtp(""); }}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  ← Change
                </button>
                <button type="button" onClick={handleResend} disabled={countdown > 0 || loading}
                  className="text-primary hover:underline disabled:no-underline disabled:text-muted-foreground transition-colors">
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-4 border-t text-center text-sm">
            <p className="text-muted-foreground">
              New here?{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline">Create account</Link>
            </p>
            <p className="mt-2 text-muted-foreground">
              <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
