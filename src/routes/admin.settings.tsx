import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, Save, Mail, Send, ShieldCheck, Banknote,
  MessageCircle, Code2, Globe, AlertTriangle, RefreshCw, QrCode, Upload,
  Ban, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAllSettings, updateSetting, sendTestEmail } from "@/server/settings.functions";
import { adminUploadPaymentQr } from "@/server/admin.functions";
import { invalidatePublicSettingsCache } from "@/lib/platform-settings";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

const SUSPENSION_REASONS = [
  { label: "Malicious activity", value: "This hosting account has been suspended due to malicious activity." },
  { label: "Spam / Terms of Service violation", value: "This website has been suspended for spamming and abusing Clytrix Terms of Service." },
  { label: "Non-payment of hosting fees", value: "This website has been suspended for non-payment of hosting fees." },
  { label: "DMCA copyright complaint", value: "This website has been suspended due to a DMCA copyright complaint." },
  { label: "Acceptable Use Policy violation", value: "This account has been suspended for violating our Acceptable Use Policy." },
];

type SettingRow = { key: string; value: any; is_public: boolean; description: string | null; updated_at: string };

function AdminSettings() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testEmail, setTestEmailAddr] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAllSettings();
      setRows(res.settings as any);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const get = (key: string): any => rows.find((r) => r.key === key)?.value ?? {};
  const setLocal = (key: string, patch: Record<string, any>) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.key === key);
      if (exists) {
        return prev.map((r) => (r.key === key ? { ...r, value: { ...r.value, ...patch } } : r));
      }
      return [...prev, { key, value: patch, is_public: true, description: null, updated_at: new Date().toISOString() }];
    });
  };

  const save = async (key: string) => {
    setSaving(key);
    try {
      const value = get(key);
      await updateSetting({ data: { key, value } });
      invalidatePublicSettingsCache();
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const sendTest = async () => {
    if (!testEmail) return toast.error("Enter a recipient email");
    setSendingTest(true);
    try {
      await sendTestEmail({ data: { to: testEmail } });
      toast.success(`Test email sent to ${testEmail}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>;

  const branding = get("site.branding");
  const kyc = get("kyc.config");
  const wd = get("withdrawals.config");
  const email = get("email.zeptomail");
  const tg = get("telegram.widget");
  const code = get("custom.code");
  const suspended = get("site.suspended");
  const maint = get("site.maintenance");
  const signup = get("site.signup");
  const upi = get("payments.upi");

  
  const onQrUpload = async (file: File) => {
    setUploadingQr(true);
    try {
      const fileData = await fileToBase64(file);
      const { url } = await adminUploadPaymentQr({
        data: { fileName: file.name, contentType: file.type, fileData },
      });
      setLocal("payments.upi", { qr_image_url: url });
      toast.success("QR uploaded — click Save to apply");
    } catch (e: any) { toast.error(e?.message || "Upload failed"); }
    finally { setUploadingQr(false); }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // Remove data URL prefix
      };
      reader.onerror = reject;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><SettingsIcon className="h-6 w-6" /> Platform Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your site, KYC, payments, email, and integrations.</p>
        </div>
        <AzButton variant="ghost" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Reload</AzButton>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto whitespace-nowrap pb-1">
          <TabsTrigger value="general"><Globe className="mr-1 h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="kyc"><ShieldCheck className="mr-1 h-4 w-4" />KYC</TabsTrigger>
          <TabsTrigger value="payments"><QrCode className="mr-1 h-4 w-4" />Payments (UPI)</TabsTrigger>
          <TabsTrigger value="withdrawals"><Banknote className="mr-1 h-4 w-4" />Withdrawals</TabsTrigger>
          <TabsTrigger value="email"><Mail className="mr-1 h-4 w-4" />Email</TabsTrigger>
          <TabsTrigger value="telegram"><MessageCircle className="mr-1 h-4 w-4" />Telegram</TabsTrigger>
          <TabsTrigger value="code"><Code2 className="mr-1 h-4 w-4" />Custom Code</TabsTrigger>
          <TabsTrigger value="suspension"><Ban className="mr-1 h-4 w-4" />Suspension</TabsTrigger>
          <TabsTrigger value="maintenance"><AlertTriangle className="mr-1 h-4 w-4" />Maintenance</TabsTrigger>

        </TabsList>

        {/* PAYMENTS — placed via React fragment below; keep first TabsList intact */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual UPI Payment (KYC fee)</CardTitle>
              <CardDescription>Configure the UPI QR code, UPI ID, and USD→INR rate shown to employees on the KYC payment page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="UPI ID (e.g. yourname@okicici)">
                <Input value={upi.upi_id || ""} onChange={(e) => setLocal("payments.upi", { upi_id: e.target.value })} />
              </Field>
              <Field label="Payee name (shown to user)">
                <Input value={upi.payee_name || ""} onChange={(e) => setLocal("payments.upi", { payee_name: e.target.value })} />
              </Field>
              <Field label="USD → INR conversion rate">
                <Input type="number" min={1} step="0.01" value={upi.usd_to_inr_rate ?? 94} onChange={(e) => setLocal("payments.upi", { usd_to_inr_rate: Number(e.target.value) })} />
              </Field>
              <Field label="Instructions (optional)">
                <Textarea rows={3} value={upi.instructions || ""} onChange={(e) => setLocal("payments.upi", { instructions: e.target.value })} />
              </Field>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">QR code image</Label>
                {upi.qr_image_url && (
                  <div className="flex items-start gap-3">
                    <img src={upi.qr_image_url} alt="UPI QR" className="h-40 w-40 rounded border bg-white p-2" />
                    <AzButton
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!confirm("Remove the current QR image? Users won't see a QR until you upload a new one.")) return;
                        setLocal("payments.upi", { qr_image_url: "" });
                        toast.success("QR removed locally — click Save to apply");
                      }}
                    >
                      Delete QR
                    </AzButton>
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded border bg-secondary/40 px-3 py-2 text-sm font-semibold hover:bg-secondary">
                  <Upload className="h-4 w-4" />
                  {uploadingQr ? "Uploading…" : (upi.qr_image_url ? "Replace QR" : "Upload QR image")}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onQrUpload(f); e.currentTarget.value = ""; }} />
                </label>
              </div>
              <SaveBar onSave={() => save("payments.upi")} saving={saving === "payments.upi"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsList className="hidden">
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Site Branding</CardTitle>
              <CardDescription>How your platform appears across the site and emails.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Site name">
                <Input value={branding.site_name || ""} onChange={(e) => setLocal("site.branding", { site_name: e.target.value })} />
              </Field>
              <Field label="Tagline">
                <Input value={branding.tagline || ""} onChange={(e) => setLocal("site.branding", { tagline: e.target.value })} />
              </Field>
              <Field label="Support email">
                <Input type="email" value={branding.support_email || ""} onChange={(e) => setLocal("site.branding", { support_email: e.target.value })} />
              </Field>
              <SaveBar onSave={() => save("site.branding")} saving={saving === "site.branding"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signup</CardTitle>
              <CardDescription>Control account creation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="Allow new signups" desc="Disable to stop new account registrations." checked={!!signup.enabled} onChange={(v) => setLocal("site.signup", { enabled: v })} />
              <ToggleRow label="Require email verification" desc="Users must verify email before signing in." checked={!!signup.require_email_verification} onChange={(v) => setLocal("site.signup", { require_email_verification: v })} />
              <SaveBar onSave={() => save("site.signup")} saving={saving === "site.signup"} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC */}
        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>KYC Configuration</CardTitle>
              <CardDescription>Identity verification settings for employees.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="KYC enabled" desc="Turn the KYC flow on or off site-wide." checked={!!kyc.enabled} onChange={(v) => setLocal("kyc.config", { enabled: v })} />
              <ToggleRow label="Required for withdrawals" desc="Block withdrawal requests until KYC is approved." checked={!!kyc.required_for_withdrawal} onChange={(v) => setLocal("kyc.config", { required_for_withdrawal: v })} />
              <Field label="KYC processing fee (USD)">
                <Input type="number" min={0} step="0.01" value={kyc.fee_usd ?? 0} onChange={(e) => setLocal("kyc.config", { fee_usd: Number(e.target.value) })} />
              </Field>
              <SaveBar onSave={() => save("kyc.config")} saving={saving === "kyc.config"} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* WITHDRAWALS */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Withdrawal Limits</CardTitle>
              <CardDescription>Set thresholds enforced for all employees.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="Withdrawals enabled" desc="Disable to pause all new withdrawal requests." checked={!!wd.enabled} onChange={(v) => setLocal("withdrawals.config", { enabled: v })} />
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Min amount (₹)">
                  <Input type="number" min={0} value={wd.min_amount ?? 0} onChange={(e) => setLocal("withdrawals.config", { min_amount: Number(e.target.value) })} />
                </Field>
                <Field label="Max amount (₹)">
                  <Input type="number" min={0} value={wd.max_amount ?? 0} onChange={(e) => setLocal("withdrawals.config", { max_amount: Number(e.target.value) })} />
                </Field>
                <Field label="Daily limit (₹)">
                  <Input type="number" min={0} value={wd.daily_limit ?? 0} onChange={(e) => setLocal("withdrawals.config", { daily_limit: Number(e.target.value) })} />
                </Field>
              </div>
              <SaveBar onSave={() => save("withdrawals.config")} saving={saving === "withdrawals.config"} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resend Configuration</CardTitle>
              <CardDescription>
                The API token is stored as a server secret (<code className="text-xs">RESEND_API_KEY</code>). Manage it via project secrets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="Email sending enabled" desc="Master switch for outbound email." checked={!!email.enabled} onChange={(v) => setLocal("email.zeptomail", { enabled: v })} />
              <Field label="From email"><Input type="email" value={email.from_email || ""} onChange={(e) => setLocal("email.zeptomail", { from_email: e.target.value })} /></Field>
              <Field label="From name"><Input value={email.from_name || ""} onChange={(e) => setLocal("email.zeptomail", { from_name: e.target.value })} /></Field>
              <SaveBar onSave={() => save("email.zeptomail")} saving={saving === "email.zeptomail"} />

              <div className="mt-4 rounded-md border bg-muted/40 p-3">
                <div className="mb-2 text-sm font-semibold">Send test email</div>
                <div className="flex gap-2">
                  <Input type="email" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmailAddr(e.target.value)} />
                  <AzButton onClick={sendTest} disabled={sendingTest}>
                    <Send className="mr-1 h-4 w-4" />{sendingTest ? "Sending…" : "Send test"}
                  </AzButton>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TELEGRAM */}
        <TabsContent value="telegram" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Telegram Support Widget</CardTitle>
              <CardDescription>Show a floating chat button that opens a Telegram conversation with your bot or support account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="Show widget on site" desc="Display the floating Telegram button on all public pages." checked={!!tg.enabled} onChange={(v) => setLocal("telegram.widget", { enabled: v })} />
              <Field label="Bot or account username (without @)">
                <Input value={tg.bot_username || ""} placeholder="awzjobs_support" onChange={(e) => setLocal("telegram.widget", { bot_username: e.target.value.replace(/^@/, "") })} />
              </Field>
              <Field label="Welcome tooltip">
                <Input value={tg.welcome_message || ""} onChange={(e) => setLocal("telegram.widget", { welcome_message: e.target.value })} />
              </Field>
              <Field label="Position">
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={tg.position || "bottom-right"} onChange={(e) => setLocal("telegram.widget", { position: e.target.value })}>
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                </select>
              </Field>
              <SaveBar onSave={() => save("telegram.widget")} saving={saving === "telegram.widget"} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOM CODE */}
        <TabsContent value="code" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Code Snippets</CardTitle>
              <CardDescription>
                Inject HTML/JS into <code className="text-xs">&lt;head&gt;</code> or before <code className="text-xs">&lt;/body&gt;</code>. Use for analytics, chat scripts, verification meta, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Analytics ID (e.g. Google Analytics G-XXXX)">
                <Input value={code.analytics_id || ""} onChange={(e) => setLocal("custom.code", { analytics_id: e.target.value })} />
              </Field>
              <Field label="Head HTML">
                <Textarea rows={6} placeholder='<meta name="..." content="..."/>' value={code.head_html || ""} onChange={(e) => setLocal("custom.code", { head_html: e.target.value })} />
              </Field>
              <Field label="Body end HTML (before </body>)">
                <Textarea rows={6} placeholder="<!-- chat widget script -->" value={code.body_end_html || ""} onChange={(e) => setLocal("custom.code", { body_end_html: e.target.value })} />
              </Field>
              <p className="text-xs text-muted-foreground">⚠️ Code runs on every page. Only paste snippets you trust.</p>
              <SaveBar onSave={() => save("custom.code")} saving={saving === "custom.code"} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUSPENSION */}
        <TabsContent value="suspension" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Site Suspension</CardTitle>
              <CardDescription>When enabled, the entire website will be replaced with a Clytrix-hosted suspension page. No pages are accessible while suspended.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="Suspend entire website"
                desc="Replace the entire website with a Clytrix suspension page. No one can access the site while suspended. Admin must disable via Supabase directly or redeploy."
                checked={!!suspended.enabled}
                onChange={(v) => setLocal("site.suspended", { enabled: v })}
              />
              <Field label="Suspension reason">
                <Select
                  value={(() => {
                    const predefined = SUSPENSION_REASONS.map(r => r.value);
                    return predefined.includes(suspended.reason) ? suspended.reason : "custom";
                  })()}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      setLocal("site.suspended", { reason: suspended.reason && !SUSPENSION_REASONS.some(r => r.value === suspended.reason) ? suspended.reason : "" });
                    } else {
                      setLocal("site.suspended", { reason: v });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUSPENSION_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom reason…</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {(() => {
                const predefined = SUSPENSION_REASONS.map(r => r.value);
                const isCustom = !predefined.includes(suspended.reason);
                return isCustom ? (
                  <Field label="Custom suspension message">
                    <Textarea
                      rows={2}
                      value={suspended.reason || ""}
                      onChange={(e) => setLocal("site.suspended", { reason: e.target.value })}
                      placeholder="Enter custom suspension reason"
                    />
                  </Field>
                ) : null;
              })()}
              <SaveBar onSave={() => save("site.suspended")} saving={saving === "site.suspended"} />
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="mb-2 text-sm font-semibold">Preview suspended page</div>
                <a
                  href="/suspended"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  <ExternalLink className="h-3 w-3" /> Open /suspended
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MAINTENANCE */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>Show a banner notice site-wide. Admins can still access the panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="Maintenance mode enabled" desc="Show a sitewide maintenance banner." checked={!!maint.enabled} onChange={(v) => setLocal("site.maintenance", { enabled: v })} />
              <Field label="Banner message">
                <Textarea rows={3} value={maint.message || ""} onChange={(e) => setLocal("site.maintenance", { message: e.target.value })} />
              </Field>
              <SaveBar onSave={() => save("site.maintenance")} saving={saving === "site.maintenance"} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">
        Public settings are visible to anyone visiting your site. Private settings (like email config) require admin access.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card/40 p-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SaveBar({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end pt-2">
      <AzButton onClick={onSave} disabled={saving}>
        <Save className="mr-1 h-4 w-4" />{saving ? "Saving…" : "Save changes"}
      </AzButton>
    </div>
  );
}

// Quiet unused import warning if any
void Badge;
