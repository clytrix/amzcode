import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { inr } from "@/lib/currency";
import { Copy, Users, TrendingUp, Gift, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { getMyReferralCode } from "@/server/data-entry-packages.functions";

export const Route = createFileRoute("/dashboard/data-entry/referral")({
  component: ReferralPage,
});

function ReferralPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getMyReferralCode()
      .then(setData)
      .catch((e: any) => toast.error(e?.message || "Failed to load referral data"))
      .finally(() => setLoading(false));
  }, []);

  const copyCode = () => {
    if (data?.code) {
      navigator.clipboard.writeText(data.code);
      toast.success("Referral code copied!");
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/dashboard/data-entry/packages?ref=${data?.code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-sm text-muted-foreground">
          Share your code and earn <b>5% commission</b> when someone purchases a data entry package using it.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label="Total Referrals"
          value={data?.total_referrals ?? 0}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          label="Total Earned"
          value={inr(data?.total_earned ?? 0)}
        />
        <StatCard
          icon={<Gift className="h-5 w-5 text-warning" />}
          label="Commission Rate"
          value="5%"
        />
      </div>

      {/* Referral Code */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-bold mb-3">Your Referral Code</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 rounded-lg border bg-secondary/30 px-4 py-3 text-2xl font-mono font-bold tracking-widest text-center">
            {data?.code || "—"}
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold hover:bg-secondary"
          >
            <Copy className="h-4 w-4" /> Copy Code
          </button>
        </div>
        <button
          onClick={copyLink}
          className="w-full rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
        >
          Copy Referral Link
        </button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Share this code with friends. When they purchase any package, you earn 5% commission instantly.
        </p>
      </div>

      {/* Commission History */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-sm">Commission History</div>
        {data?.commissions?.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No referrals yet. Share your code to start earning!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="px-4 py-2 text-left font-bold">Referred User</th>
                <th className="px-4 py-2 text-left font-bold">Commission</th>
                <th className="px-4 py-2 text-left font-bold">Status</th>
                <th className="px-4 py-2 text-left font-bold">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.commissions?.map((c: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">
                    {(c.profiles as any)?.full_name || "User"}
                  </td>
                  <td className="px-4 py-2 font-bold">{inr(Number(c.commission_amount))}</td>
                  <td className="px-4 py-2">
                    {c.status === "paid" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
                        <CheckCircle2 className="h-3 w-3" /> Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-warning">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className="rounded-lg bg-secondary p-2">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
