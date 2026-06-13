import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { AzButton } from "@/components/az-button";
import { Loader2, Smartphone } from "lucide-react";
import { requestSignupSmsOtp, verifySignupSmsOtp } from "@/server/sms-otp.functions";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function startCountdown(set: (v: (p: number) => number) => void) {
  const timer = setInterval(() => {
    set((prev) => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
  }, 1000);
}

function SignupPage() {
  const navigate = useNavigate();
  const requestOtp = useServerFn(requestSignupSmsOtp);
  const verifyOtp = useServerFn(verifySignupSmsOtp);

  const [step, setStep] = useState<"form" | "otp">("form");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [confirmedMobile, setConfirmedMobile] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (!form.phone.trim()) return toast.error("Mobile number is required.");
    setLoading(true);
    try {
      const res = await requestOtp({ data: { mobile: form.phone.trim() } });
      setConfirmedMobile(res.mobile);
      setStep("otp");
      setCountdown(60);
      startCountdown(setCountdown);
      toast.success(`OTP sent to +91 xxxxxx${res.mobile.slice(-4)}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally { setLoading(false); }
  };

  const handleChangePhone = async () => {
    const phone = newPhone.trim();
    if (!phone) return toast.error("Enter a mobile number.");
    setLoading(true);
    try {
      const res = await requestOtp({ data: { mobile: phone } });
      setForm((f) => ({ ...f, phone }));
      setConfirmedMobile(res.mobile);
      setCode("");
      setEditingPhone(false);
      setCountdown(60);
      startCountdown(setCountdown);
      toast.success(`OTP sent to +91 xxxxxx${res.mobile.slice(-4)}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0 || loading) return;
    setLoading(true);
    try {
      const res = await requestOtp({ data: { mobile: confirmedMobile } });
      setConfirmedMobile(res.mobile);
      setCountdown(60);
      startCountdown(setCountdown);
      toast.success("OTP resent successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend OTP.");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return toast.error("Enter the 6-digit OTP.");
    setLoading(true);
    try {
      const res = await verifyOtp({
        data: {
          mobile: confirmedMobile,
          code,
          fullName: form.fullName,
          email: form.email,
          password: form.password,
        },
      });
      if (!res.ok) { toast.error("Verification failed."); return; }
      toast.success("Account created! Please sign in.");
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <div className="rounded-md border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Create account</h1>

          {step === "form" ? (
            <form onSubmit={handleStart} className="mt-5 space-y-4">
              <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required maxLength={120} />
              <Field label="Email address" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required maxLength={255} />
              <div>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Mobile number <span className="text-destructive">*</span></span>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="9876543210"
                      required
                      maxLength={15}
                      className="w-full rounded border border-input bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </label>
                <p className="text-xs text-muted-foreground mt-1">10-digit Indian mobile. OTP will be sent here.</p>
              </div>
              <Field label="Password (min 8 chars)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required maxLength={128} />
              <AzButton variant="brand" size="md" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP…</> : "Continue"}
              </AzButton>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                OTP sent to <strong>+91 xxxxxx{confirmedMobile.slice(-4)}</strong>
              </div>

              {editingPhone ? (
                <div className="space-y-2">
                  <label className="block text-sm font-bold">Enter correct mobile number</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={15}
                      autoFocus
                      className="w-full rounded border border-input bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex gap-2">
                    <AzButton variant="brand" size="sm" onClick={handleChangePhone} disabled={loading} className="flex-1">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                    </AzButton>
                    <button type="button" onClick={() => setEditingPhone(false)} className="text-sm text-muted-foreground hover:text-foreground px-2">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setNewPhone(""); setEditingPhone(true); }}
                  className="text-xs text-primary hover:underline">
                  Wrong number? Change it
                </button>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded border border-input bg-white px-3 py-2 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-ring"
                  inputMode="numeric"
                  autoFocus={!editingPhone}
                />
                <AzButton variant="brand" size="md" className="w-full" disabled={loading || code.length !== 6}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : "Verify & Create Account"}
                </AzButton>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setStep("form"); setCode(""); }}
                    className="text-muted-foreground hover:text-foreground">
                    ← Back
                  </button>
                  <button type="button" onClick={handleResend} disabled={countdown > 0 || loading}
                    className="text-primary hover:underline disabled:no-underline disabled:text-muted-foreground">
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-6 border-t pt-4 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        className="w-full rounded border border-input bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
