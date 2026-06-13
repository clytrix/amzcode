import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { UserCog, Crown, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { adminGrantAdminRole, adminRevokeAdminRole } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/roles")({ component: AdminRoles });

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

function AdminRoles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, phone, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    setProfiles((p as Profile[]) || []);
    setAdminIds(new Set((roles || []).map((r: any) => r.user_id)));
  };
  useEffect(() => { void load(); }, []);

  const grant = async (userId: string) => {
    setBusyId(userId);
    try {
      await adminGrantAdminRole({ data: { user_id: userId } });
      toast.success("Admin role granted.");
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not grant admin");
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (userId: string) => {
    if (userId === user?.id) return toast.error("You cannot revoke your own admin role.");
    setBusyId(userId);
    try {
      await adminRevokeAdminRole({ data: { user_id: userId } });
      toast.success("Admin role revoked.");
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not revoke admin");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = profiles.filter((p) =>
    !q || (p.email || "").toLowerCase().includes(q.toLowerCase()) || (p.full_name || "").toLowerCase().includes(q.toLowerCase())
  );
  const admins = filtered.filter((p) => adminIds.has(p.id));
  const nonAdmins = filtered.filter((p) => !adminIds.has(p.id));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Admin Roles</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Grant or revoke admin access to other users on the platform.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Crown className="h-4 w-4 text-primary" /> Current admins ({admins.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {admins.length === 0 && <div className="rounded-md border bg-card p-5 text-sm text-muted-foreground">No admins match your search.</div>}
          {admins.map((p) => (
            <div key={p.id} className="rounded-md border-2 border-primary/30 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-primary" />
                    <div className="font-bold">{p.full_name || "(no name)"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </div>
                <AzButton size="sm" variant="outline" disabled={busyId === p.id || p.id === user?.id} onClick={() => revoke(p.id)}>
                  <ShieldOff className="mr-1 h-3.5 w-3.5" /> {p.id === user?.id ? "You" : "Revoke"}
                </AzButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">All users ({nonAdmins.length})</h2>
        <div className="overflow-x-auto rounded-md border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/60">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Name</th>
                <th className="px-3 py-2 text-left font-bold">Email</th>
                <th className="px-3 py-2 text-left font-bold">Phone</th>
                <th className="px-3 py-2 text-left font-bold">Joined</th>
                <th className="px-3 py-2 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {nonAdmins.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No users to show.</td></tr>
              )}
              {nonAdmins.map((p) => (
                <tr key={p.id} className="border-t hover:bg-secondary/30">
                  <td className="px-3 py-2 font-medium">{p.full_name || "—"}</td>
                  <td className="px-3 py-2 text-xs">{p.email}</td>
                  <td className="px-3 py-2">{p.phone || "—"}</td>
                  <td className="px-3 py-2 text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-right">
                    <AzButton size="sm" variant="brand" disabled={busyId === p.id} onClick={() => grant(p.id)}>
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Grant admin
                    </AzButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
