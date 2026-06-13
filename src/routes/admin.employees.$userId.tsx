import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getEmployeeProfile,
  setEmployeeAdmin,
  fireEmployee,
  sendEmployeeEmail,
  adminUpdateWallet,
} from "@/server/employees.functions";
import { ArrowLeft, Crown, UserMinus, Mail, ShieldCheck, Loader2, Wallet, IndianRupee, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/admin/employees/$userId")({
  component: EmployeeDetail,
});

function EmployeeDetail() {
  const { userId } = Route.useParams();
  const router = useRouter();
  const fetchProfile = useServerFn(getEmployeeProfile);
  const setAdmin = useServerFn(setEmployeeAdmin);
  const fire = useServerFn(fireEmployee);
  const sendMail = useServerFn(sendEmployeeEmail);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // mail composer
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");

  // fire dialog
  const [showFire, setShowFire] = useState(false);
  const [fireReason, setFireReason] = useState("");
  const [fireDate, setFireDate] = useState(new Date().toISOString().slice(0, 10));

  // wallet management
  const [showWallet, setShowWallet] = useState(false);
  const [walletAction, setWalletAction] = useState<"credit" | "debit">("credit");
  const [walletType, setWalletType] = useState<"salary" | "incentive">("incentive");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchProfile({ data: { user_id: userId } });
      setData(res);
    } catch (e: any) {
      setErr(e.message || "Failed to load employee profile");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [userId]);

  async function togglePromote(makeAdmin: boolean) {
    setBusy(true); setActionMsg(null);
    try {
      await setAdmin({ data: { user_id: userId, make_admin: makeAdmin } });
      setActionMsg(makeAdmin ? "Promoted to admin." : "Demoted to employee.");
      await load();
    } catch (e: any) {
      setActionMsg("Error: " + e.message);
    } finally { setBusy(false); }
  }

  async function doFire() {
    if (fireReason.trim().length < 3) { setActionMsg("Reason is required."); return; }
    setBusy(true); setActionMsg(null);
    try {
      await fire({ data: { user_id: userId, reason: fireReason, effective_date: fireDate } });
      setActionMsg("Employee terminated. Notification email sent.");
      setShowFire(false);
      setFireReason("");
      await load();
    } catch (e: any) {
      setActionMsg("Error: " + e.message);
    } finally { setBusy(false); }
  }

  async function doSendMail() {
    if (mailSubject.trim().length < 2 || mailBody.trim().length < 2) {
      setActionMsg("Subject and message are required."); return;
    }
    setBusy(true); setActionMsg(null);
    try {
      await sendMail({ data: { user_id: userId, subject: mailSubject, message: mailBody } });
      setActionMsg("Email sent.");
      setMailSubject(""); setMailBody("");
    } catch (e: any) {
      setActionMsg("Error: " + e.message);
    } finally { setBusy(false); }
  }

  const updateWallet = useServerFn(adminUpdateWallet);

  async function doWalletUpdate() {
    const amount = Number(walletAmount);
    if (!amount || amount <= 0) {
      setActionMsg("Enter a valid amount.");
      return;
    }
    if (walletReason.trim().length < 2) {
      setActionMsg("Reason is required.");
      return;
    }
    setBusy(true); setActionMsg(null);
    try {
      await updateWallet({
        data: {
          user_id: userId,
          wallet: walletType,
          action: walletAction,
          amount: amount,
          reason: walletReason,
        }
      });
      setActionMsg(`${walletAction === "credit" ? "Credited" : "Debited"} ${amount} to ${walletType} wallet.`);
      setWalletAmount("");
      setWalletReason("");
      await load();
    } catch (e: any) {
      setActionMsg("Error: " + e.message);
    } finally { setBusy(false); }
  }

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading employee…</div>;
  if (err) return <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{err}</div>;
  if (!data?.profile) return <div className="p-6">Employee not found.</div>;

  const p = data.profile;
  const isAdmin = data.roles.includes("admin");
  const ap = data.activePackage;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.history.back()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <Link to="/admin/employees" className="text-sm text-primary hover:underline">All employees</Link>
      </div>

      <header className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{p.full_name || "(no name)"}</h1>
            <div className="mt-1 text-sm text-muted-foreground">{p.email} · {p.phone || "no phone"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{p.city || "—"}, {p.country || "—"} · joined {new Date(p.created_at).toLocaleDateString("en-IN")}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={`rounded px-2 py-0.5 font-bold ${isAdmin ? "bg-primary/15 text-primary" : "bg-secondary"}`}>{isAdmin ? "Admin" : "Employee"}</span>
              <span className={`rounded px-2 py-0.5 font-bold capitalize ${data.kyc?.status === "approved" ? "bg-success/15 text-success" : data.kyc?.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>KYC: {(data.kyc?.status || "not_started").replace(/_/g, " ")}</span>
              {ap ? (
                <span className="rounded bg-success/15 px-2 py-0.5 font-bold text-success">Active package: ₹{Number(ap.monthly_salary).toLocaleString("en-IN")}/mo</span>
              ) : (
                <span className="rounded bg-muted px-2 py-0.5 font-bold text-muted-foreground">No active package</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isAdmin ? (
              <button disabled={busy} onClick={() => togglePromote(true)} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <Crown className="h-3.5 w-3.5" /> Promote to Admin
              </button>
            ) : (
              <button disabled={busy} onClick={() => togglePromote(false)} className="inline-flex items-center gap-1 rounded border bg-card px-3 py-1.5 text-xs font-bold hover:bg-secondary disabled:opacity-50">
                <ShieldCheck className="h-3.5 w-3.5" /> Demote to Employee
              </button>
            )}
            {ap && (
              <button disabled={busy} onClick={() => setShowFire(true)} className="inline-flex items-center gap-1 rounded bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-50">
                <UserMinus className="h-3.5 w-3.5" /> Fire
              </button>
            )}
            <button disabled={busy} onClick={() => setShowWallet(true)} className="inline-flex items-center gap-1 rounded bg-success px-3 py-1.5 text-xs font-bold text-success-foreground hover:opacity-90 disabled:opacity-50">
              <Wallet className="h-3.5 w-3.5" /> Update Wallet
            </button>
          </div>
        </div>
        {actionMsg && (
          <div className={`mt-3 rounded px-3 py-2 text-xs ${actionMsg.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{actionMsg}</div>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Tasks (open)" value={data.stats.tasksOpen} />
        <Stat label="Tasks (done)" value={data.stats.tasksDone} />
        <Stat label="Total earned" value={`₹${data.stats.totalEarned.toLocaleString("en-IN")}`} />
        <Stat label="Available balance" value={`₹${data.stats.balance.toLocaleString("en-IN")}`} highlight />
      </div>

      {/* Send email */}
      <Card title={<span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> Send email</span>}>
        <div className="space-y-2">
          <input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} placeholder="Subject" className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          <textarea value={mailBody} onChange={(e) => setMailBody(e.target.value)} placeholder="Message…" rows={5} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          <button disabled={busy} onClick={doSendMail} className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? "Sending…" : "Send email"}
          </button>
        </div>
      </Card>

      {/* Tabs of data */}
      <Card title="Recent tasks">
        <Table headers={["Title", "Status", "Priority", "Reward", "Created"]}>
          {data.tasks.slice(0, 20).map((t: any) => (
            <tr key={t.id} className="border-t">
              <Td>{t.title}</Td>
              <Td className="capitalize">{t.status.replace(/_/g, " ")}</Td>
              <Td className="capitalize">{t.priority}</Td>
              <Td>₹{Number(t.reward_amount).toLocaleString("en-IN")}</Td>
              <Td className="text-xs">{new Date(t.created_at).toLocaleDateString("en-IN")}</Td>
            </tr>
          ))}
          {data.tasks.length === 0 && <Empty cols={5}>No tasks.</Empty>}
        </Table>
      </Card>

      <Card title="Salary disbursements">
        <Table headers={["Period", "Basic", "Overtime", "Bonus", "Net", "Status"]}>
          {data.disbursements.map((d: any) => (
            <tr key={d.id} className="border-t">
              <Td>{d.period_year}-{String(d.period_month).padStart(2, "0")}</Td>
              <Td>₹{Number(d.basic_amount).toLocaleString("en-IN")}</Td>
              <Td>₹{Number(d.overtime_amount).toLocaleString("en-IN")}</Td>
              <Td>₹{Number(d.bonus).toLocaleString("en-IN")}</Td>
              <Td className="font-bold">₹{Number(d.net_amount).toLocaleString("en-IN")}</Td>
              <Td className="capitalize">{d.status}{d.hold_reason ? ` — ${d.hold_reason}` : ""}</Td>
            </tr>
          ))}
          {data.disbursements.length === 0 && <Empty cols={6}>No disbursements yet.</Empty>}
        </Table>
      </Card>

      <Card title="Attendance (last 60)">
        <Table headers={["Date", "Check in", "Check out", "Hours"]}>
          {data.attendance.map((a: any, i: number) => (
            <tr key={i} className="border-t">
              <Td>{a.work_date}</Td>
              <Td className="text-xs">{a.check_in_at ? new Date(a.check_in_at).toLocaleTimeString("en-IN") : "—"}</Td>
              <Td className="text-xs">{a.check_out_at ? new Date(a.check_out_at).toLocaleTimeString("en-IN") : "—"}</Td>
              <Td>{a.hours_worked ?? "—"}</Td>
            </tr>
          ))}
          {data.attendance.length === 0 && <Empty cols={4}>No attendance records.</Empty>}
        </Table>
      </Card>

      <Card title="Withdrawals">
        <Table headers={["Date", "Amount", "Method", "Status", "Processed"]}>
          {data.withdrawals.map((w: any) => (
            <tr key={w.id} className="border-t">
              <Td className="text-xs">{new Date(w.created_at).toLocaleDateString("en-IN")}</Td>
              <Td>₹{Number(w.amount).toLocaleString("en-IN")}</Td>
              <Td>{w.payout_method || "—"}</Td>
              <Td className="capitalize">{w.status}</Td>
              <Td className="text-xs">{w.processed_at ? new Date(w.processed_at).toLocaleDateString("en-IN") : "—"}</Td>
            </tr>
          ))}
          {data.withdrawals.length === 0 && <Empty cols={5}>No withdrawals.</Empty>}
        </Table>
      </Card>

      <Card title="Login history">
        <Table headers={["IP", "User agent", "First seen", "Last seen"]}>
          {data.loginIps.map((l: any, i: number) => (
            <tr key={i} className="border-t">
              <Td className="font-mono text-xs">{l.ip_address}</Td>
              <Td className="max-w-md truncate text-xs text-muted-foreground" title={l.user_agent}>{l.user_agent || "—"}</Td>
              <Td className="text-xs">{new Date(l.created_at).toLocaleString("en-IN")}</Td>
              <Td className="text-xs">{new Date(l.last_seen_at).toLocaleString("en-IN")}</Td>
            </tr>
          ))}
          {data.loginIps.length === 0 && <Empty cols={4}>No login history.</Empty>}
        </Table>
      </Card>

      {/* Fire dialog */}
      {showFire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowFire(false)}>
          <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Terminate employment</h2>
            <p className="mt-1 text-xs text-muted-foreground">All active packages will be ended. The employee will be emailed.</p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-bold">Effective date</label>
              <input type="date" value={fireDate} onChange={(e) => setFireDate(e.target.value)} className="w-full rounded border border-input bg-white px-2 py-1.5 text-sm" />
              <label className="block text-xs font-bold">Reason</label>
              <textarea value={fireReason} onChange={(e) => setFireReason(e.target.value)} rows={4} className="w-full rounded border border-input bg-white px-2 py-1.5 text-sm" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowFire(false)} className="rounded border px-3 py-1.5 text-xs font-bold hover:bg-secondary">Cancel</button>
              <button disabled={busy} onClick={doFire} className="rounded bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-50">
                {busy ? "Terminating…" : "Confirm termination"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet dialog */}
      {showWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowWallet(false)}>
          <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold inline-flex items-center gap-2"><Wallet className="h-5 w-5" /> Update Wallet</h2>
            <p className="mt-1 text-xs text-muted-foreground">Credit or debit salary/incentive wallet.</p>
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWalletAction("credit")}
                  className={`flex-1 rounded px-3 py-2 text-xs font-bold ${walletAction === "credit" ? "bg-success text-success-foreground" : "border bg-white"}`}
                >
                  <Plus className="inline h-3 w-3 mr-1" /> Credit (Add)
                </button>
                <button
                  type="button"
                  onClick={() => setWalletAction("debit")}
                  className={`flex-1 rounded px-3 py-2 text-xs font-bold ${walletAction === "debit" ? "bg-destructive text-destructive-foreground" : "border bg-white"}`}
                >
                  <Minus className="inline h-3 w-3 mr-1" /> Debit (Deduct)
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWalletType("salary")}
                  className={`flex-1 rounded px-3 py-2 text-xs font-bold ${walletType === "salary" ? "bg-primary text-primary-foreground" : "border bg-white"}`}
                >
                  Salary Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setWalletType("incentive")}
                  className={`flex-1 rounded px-3 py-2 text-xs font-bold ${walletType === "incentive" ? "bg-primary text-primary-foreground" : "border bg-white"}`}
                >
                  Incentive Wallet
                </button>
              </div>
              <label className="block">
                <span className="text-xs font-bold">Amount (₹)</span>
                <div className="flex items-center gap-2 mt-1">
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={walletAmount}
                    onChange={(e) => setWalletAmount(e.target.value)}
                    placeholder="Enter amount"
                    min={1}
                    className="flex-1 rounded border border-input bg-white px-3 py-2 text-sm"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold">Reason / Description</span>
                <input
                  type="text"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  placeholder="e.g., Bonus, Correction, Advance"
                  className="w-full mt-1 rounded border border-input bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowWallet(false)} className="rounded border px-3 py-1.5 text-xs font-bold hover:bg-secondary">Cancel</button>
              <button
                disabled={busy || !walletAmount || !walletReason}
                onClick={doWalletUpdate}
                className={`rounded px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 ${walletAction === "credit" ? "bg-success" : "bg-destructive"}`}
              >
                {busy ? "Processing…" : walletAction === "credit" ? "Credit Amount" : "Debit Amount"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-4 shadow-sm ${highlight ? "border-success/40" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}
function Card({ title, children }: { title: any; children: any }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-2 text-sm font-bold">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}
function Table({ headers, children }: { headers: string[]; children: any }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary/50"><tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left font-bold">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, className }: any) { return <td className={`px-3 py-2 ${className || ""}`}>{children}</td>; }
function Empty({ cols, children }: { cols: number; children: any }) {
  return <tr><td colSpan={cols} className="p-6 text-center text-sm text-muted-foreground">{children}</td></tr>;
}
