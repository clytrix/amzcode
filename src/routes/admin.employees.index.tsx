import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Loader2 } from "lucide-react";
import { inr } from "@/lib/currency";

export const Route = createFileRoute("/admin/employees/")({ component: AdminEmployees });

function AdminEmployees() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch ALL profiles (everyone who registered)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const allUserIds = (profiles || []).map((p: any) => p.id);

      // Fetch user roles for all profiles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .in("user_id", allUserIds);

      // Create role map
      const roleMap = new Map((userRoles || []).map((ur: any) => [ur.user_id, ur.role]));

      // Fetch wallets (salary + incentive balance)
      const { data: wallets } = await supabase
        .from("wallets")
        .select("user_id, salary_balance, incentive_balance")
        .in("user_id", allUserIds);

      // Fetch KYC status
      const { data: kycData } = await supabase
        .from("kyc_submissions")
        .select("user_id, status")
        .in("user_id", allUserIds);

      // Fetch withdrawals for balance calculation
      const { data: withdrawals } = await supabase
        .from("withdrawals")
        .select("user_id, amount, status")
        .in("user_id", allUserIds);

      // Create lookup maps
      const kycMap = new Map((kycData || []).map((k: any) => [k.user_id, k.status]));
      
      const walletMap = new Map<string, { salary: number; incentive: number }>();
      (wallets || []).forEach((w: any) => {
        walletMap.set(w.user_id, {
          salary: Number(w.salary_balance || 0),
          incentive: Number(w.incentive_balance || 0),
        });
      });

      const withdrawnMap = new Map<string, number>();
      (withdrawals || []).forEach((w: any) => {
        if (["pending", "approved", "paid"].includes(w.status)) {
          withdrawnMap.set(w.user_id, (withdrawnMap.get(w.user_id) || 0) + Number(w.amount));
        }
      });

      // Build rows for ALL profiles (everyone who registered)
      const combinedRows = (profiles || []).map((profile: any) => {
        const userId = profile.id;
        const userRole = roleMap.get(userId) || "none"; // "employee", "admin", or "none"
        const wallet = walletMap.get(userId);
        const totalBalance = (wallet?.salary || 0) + (wallet?.incentive || 0);
        const withdrawn = withdrawnMap.get(userId) || 0;

        return {
          id: userId,
          full_name: profile.full_name || null,
          email: profile.email || null,
          phone: profile.phone || null,
          city: profile.city || null,
          created_at: profile.created_at,
          kyc: kycMap.get(userId) || "not_started",
          role: userRole,
          earned: totalBalance + withdrawn,
          balance: totalBalance,
          wallet: wallet || { salary: 0, incentive: 0 },
        };
      });

      setRows(combinedRows);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = rows.filter((r) =>
    !q || r.email?.toLowerCase().includes(q.toLowerCase()) || r.full_name?.toLowerCase().includes(q.toLowerCase()) || r.phone?.includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Employees</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border border-input bg-white px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          <input placeholder="Search by name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded border border-input bg-white px-3 py-2 text-sm w-64" />
        </div>
      </div>
      {lastRefresh && (
        <div className="text-xs text-muted-foreground">
          Last updated: {lastRefresh.toLocaleString("en-IN")} • {rows.length} users found (all roles)
        </div>
      )}
      <div className="overflow-x-auto rounded-md border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/50">
            <tr><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>City</Th><Th>KYC</Th><Th>Role</Th><Th className="text-right">Wallet (Salary+Incentive)</Th><Th className="text-right">Balance</Th><Th>Joined</Th><Th></Th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-secondary/40">
                <Td>
                  <Link to="/admin/employees/$userId" params={{ userId: r.id }} className="font-semibold text-primary hover:underline">
                    {r.full_name || "—"}
                  </Link>
                </Td>
                <Td className="text-xs">{r.email}</Td>
                <Td>{r.phone || "—"}</Td>
                <Td>{r.city || "—"}</Td>
                <Td><span className={`rounded px-2 py-0.5 text-xs font-bold capitalize ${r.kyc === "approved" ? "bg-success/15 text-success" : r.kyc === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>{r.kyc.replace(/_/g, " ")}</span></Td>
                <Td><span className={`rounded px-2 py-0.5 text-xs font-bold capitalize ${r.role === "admin" ? "bg-primary/15 text-primary" : r.role === "employee" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>{r.role}</span></Td>
                <Td className="text-right text-xs">
                  <div className="font-semibold">{inr(r.wallet.salary + r.wallet.incentive)}</div>
                  <div className="text-muted-foreground">S:{inr(r.wallet.salary)} | I:{inr(r.wallet.incentive)}</div>
                </Td>
                <Td className="text-right font-semibold text-success">{inr(r.balance)}</Td>
                <Td className="text-xs">{new Date(r.created_at).toLocaleDateString("en-IN")}</Td>
                <Td><Link to="/admin/employees/$userId" params={{ userId: r.id }} className="text-xs font-bold text-primary hover:underline">Manage →</Link></Td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No users match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Th({ children, className }: any) { return <th className={`px-3 py-2 text-left font-bold ${className || ""}`}>{children}</th>; }
function Td({ children, className }: any) { return <td className={`px-3 py-2 ${className || ""}`}>{children}</td>; }
