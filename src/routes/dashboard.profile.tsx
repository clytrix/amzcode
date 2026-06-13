import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { Trash2, Star, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard/profile")({ component: ProfilePage });

interface BankAccount {
  id: string;
  label: string | null;
  account_holder: string | null;
  account_number: string | null;
  bank_name: string | null;
  ifsc_swift: string | null;
  upi_id: string | null;
  is_primary: boolean;
  source: string;
}

function ProfilePage() {
  const { user } = useAuth();
  const [p, setP] = useState<any>({});
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [newAcc, setNewAcc] = useState<Partial<BankAccount>>({
    label: "", account_holder: "", account_number: "", bank_name: "", ifsc_swift: "", upi_id: "", is_primary: false,
  });
  const [savingAcc, setSavingAcc] = useState(false);
  const [emailForm, setEmailForm] = useState({ new_email: "" });
  const [pwForm, setPwForm] = useState({ new_password: "", confirm: "" });
  const [busyAuth, setBusyAuth] = useState(false);

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase.from("bank_accounts").select("*").eq("user_id", user.id).order("is_primary", { ascending: false }).order("created_at", { ascending: true });
    setAccounts((data as BankAccount[]) || []);
  };

  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setP(data || {}));
    void loadAccounts();
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name, phone: p.phone, address: p.address, city: p.city, country: p.country,
    }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated!");
  };

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newAcc.account_number && !newAcc.upi_id) return toast.error("Provide an account number or a UPI ID.");
    setSavingAcc(true);
    const { error } = await supabase.from("bank_accounts").insert({
      user_id: user.id,
      label: newAcc.label || null,
      account_holder: newAcc.account_holder || null,
      account_number: newAcc.account_number || null,
      bank_name: newAcc.bank_name || null,
      ifsc_swift: newAcc.ifsc_swift || null,
      upi_id: newAcc.upi_id || null,
      is_primary: !!newAcc.is_primary,
      source: "manual",
    });
    setSavingAcc(false);
    if (error) return toast.error(error.message);
    toast.success("Bank account added");
    setShowAddAcc(false);
    setNewAcc({ label: "", account_holder: "", account_number: "", bank_name: "", ifsc_swift: "", upi_id: "", is_primary: false });
    void loadAccounts();
  };

  const removeAccount = async (id: string) => {
    if (!confirm("Delete this bank account? Withdrawals will use your remaining primary account.")) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    void loadAccounts();
  };

  const setPrimary = async (id: string) => {
    const { error } = await supabase.from("bank_accounts").update({ is_primary: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Primary account updated");
    void loadAccounts();
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = emailForm.new_email.trim().toLowerCase();
    if (!v || !v.includes("@")) return toast.error("Enter a valid email.");
    setBusyAuth(true);
    const { error } = await supabase.auth.updateUser({ email: v });
    setBusyAuth(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmation email sent. Check both old and new inboxes to confirm the change.");
    setEmailForm({ new_email: "" });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (pwForm.new_password !== pwForm.confirm) return toast.error("Passwords do not match.");
    setBusyAuth(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.new_password });
    setBusyAuth(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPwForm({ new_password: "", confirm: "" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile &amp; Settings</h1>

      {/* Personal info */}
      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Personal information</h2>
        <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
          <In label="Full name" v={p.full_name} on={(v) => setP({ ...p, full_name: v })} />
          <In label="Phone" v={p.phone} on={(v) => setP({ ...p, phone: v })} />
          <In label="Address" v={p.address} on={(v) => setP({ ...p, address: v })} full />
          <In label="City" v={p.city} on={(v) => setP({ ...p, city: v })} />
          <In label="Country" v={p.country} on={(v) => setP({ ...p, country: v })} />
          <div className="sm:col-span-2"><AzButton variant="brand">Save changes</AzButton></div>
        </form>
      </section>

      {/* Bank accounts */}
      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Bank accounts &amp; UPI</h2>
            <p className="text-xs text-muted-foreground">Withdrawals are paid to your <b>primary</b> account. The account from your KYC is added automatically as primary.</p>
          </div>
          <AzButton size="sm" variant="outline" onClick={() => setShowAddAcc((s) => !s)}><Plus className="mr-1 h-4 w-4" />Add account</AzButton>
        </div>

        {accounts.length === 0 && <div className="rounded border bg-secondary/30 p-4 text-sm text-muted-foreground">No bank account saved yet. Complete KYC or add one manually.</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <div key={a.id} className={`rounded border p-3 text-sm ${a.is_primary ? "border-primary bg-primary/5" : "bg-secondary/20"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold">
                  {a.label || (a.source === "kyc" ? "Primary (from KYC)" : "Bank account")}
                  {a.is_primary && <span className="ml-2 inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground"><Star className="h-3 w-3" />Primary</span>}
                </div>
                <button onClick={() => removeAccount(a.id)} title="Remove" className="text-destructive hover:opacity-80"><Trash2 className="h-4 w-4" /></button>
              </div>
              {a.account_holder && <div className="mt-1"><b>Holder:</b> {a.account_holder}</div>}
              {a.account_number && <div><b>A/C:</b> ••••{a.account_number.slice(-4)}</div>}
              {a.bank_name && <div><b>Bank:</b> {a.bank_name}</div>}
              {a.ifsc_swift && <div><b>IFSC/SWIFT:</b> {a.ifsc_swift}</div>}
              {a.upi_id && <div><b>UPI:</b> {a.upi_id}</div>}
              {!a.is_primary && (
                <button onClick={() => setPrimary(a.id)} className="mt-2 text-xs font-bold text-primary underline">Set as primary</button>
              )}
            </div>
          ))}
        </div>

        {showAddAcc && (
          <form onSubmit={addAccount} className="mt-4 grid gap-3 rounded border bg-secondary/30 p-4 sm:grid-cols-2">
            <In label="Label (e.g. HDFC Savings)" v={newAcc.label || ""} on={(v) => setNewAcc({ ...newAcc, label: v })} />
            <In label="Account holder name" v={newAcc.account_holder || ""} on={(v) => setNewAcc({ ...newAcc, account_holder: v })} />
            <In label="Account number" v={newAcc.account_number || ""} on={(v) => setNewAcc({ ...newAcc, account_number: v })} />
            <In label="Bank name" v={newAcc.bank_name || ""} on={(v) => setNewAcc({ ...newAcc, bank_name: v })} />
            <In label="IFSC / SWIFT" v={newAcc.ifsc_swift || ""} on={(v) => setNewAcc({ ...newAcc, ifsc_swift: v })} />
            <In label="UPI ID (optional)" v={newAcc.upi_id || ""} on={(v) => setNewAcc({ ...newAcc, upi_id: v })} />
            <label className="flex items-center gap-2 sm:col-span-2 text-sm">
              <input type="checkbox" checked={!!newAcc.is_primary} onChange={(e) => setNewAcc({ ...newAcc, is_primary: e.target.checked })} />
              Make this my primary account
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <AzButton variant="brand" disabled={savingAcc}>{savingAcc ? "Saving…" : "Save account"}</AzButton>
              <AzButton type="button" variant="outline" onClick={() => setShowAddAcc(false)}>Cancel</AzButton>
            </div>
          </form>
        )}
      </section>

      {/* Login & security */}
      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Login &amp; security</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <form onSubmit={changeEmail} className="space-y-2">
            <h3 className="text-sm font-bold">Change email</h3>
            <p className="text-xs text-muted-foreground">Current: <b>{user?.email}</b></p>
            <input
              type="email"
              required
              value={emailForm.new_email}
              onChange={(e) => setEmailForm({ new_email: e.target.value })}
              placeholder="new@example.com"
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">A confirmation link will be sent to your new email.</p>
            <AzButton variant="brand" disabled={busyAuth}>Send confirmation</AzButton>
          </form>

          <form onSubmit={changePassword} className="space-y-2">
            <h3 className="text-sm font-bold">Change password</h3>
            <input type="password" required minLength={8} value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="New password (min 8 chars)" className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            <input type="password" required minLength={8} value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Confirm new password" className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            <AzButton variant="brand" disabled={busyAuth}>Update password</AzButton>
          </form>
        </div>
      </section>
    </div>
  );
}

function In({ label, v, on, full }: { label: string; v: string; on: (v: string) => void; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <input value={v || ""} onChange={(e) => on(e.target.value)} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
    </label>
  );
}
