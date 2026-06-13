// Admin Security Audit Logs
// View credential access, login IP history, and OTP events with
// filters by user, IP, and time range.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText, RefreshCw, KeyRound, Globe, MailWarning, Filter } from "lucide-react";
import { AzButton } from "@/components/az-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getAuditLogs,
  listUsersForAudit,
  type AuditPayload,
} from "@/server/audit.functions";

export const Route = createFileRoute("/admin/audit-logs")({ component: AuditLogsPage });

type Range = "24h" | "7d" | "30d" | "all" | "custom";

function rangeToIso(range: Range, customFrom: string, customTo: string): { fromIso: string | null; toIso: string | null } {
  if (range === "all") return { fromIso: null, toIso: null };
  if (range === "custom") {
    return {
      fromIso: customFrom ? new Date(customFrom).toISOString() : null,
      toIso: customTo ? new Date(customTo).toISOString() : null,
    };
  }
  const ms = range === "24h" ? 24 * 3600 * 1000 : range === "7d" ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
  return { fromIso: new Date(Date.now() - ms).toISOString(), toIso: null };
}

function AuditLogsPage() {
  const fetchLogs = useServerFn(getAuditLogs);
  const fetchUsers = useServerFn(listUsersForAudit);

  const [users, setUsers] = useState<{ id: string; email: string; full_name: string | null }[]>([]);
  const [data, setData] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [ipAddress, setIpAddress] = useState<string>("");
  const [range, setRange] = useState<Range>("7d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const { fromIso, toIso } = rangeToIso(range, customFrom, customTo);
      const res = await fetchLogs({
        data: {
          userId: userId || null,
          ipAddress: ipAddress.trim() || null,
          fromIso,
          toIso,
          limit: 300,
        },
      });
      setData(res);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers({ data: undefined as any })
      .then(setUsers)
      .catch((e) => toast.error(e?.message || "Failed to load users"));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    if (!data) return { cred: 0, ips: 0, otp: 0, newIps: 0 };
    const newIps = data.otpEvents.filter((e) => e.purpose === "new_ip").length;
    return {
      cred: data.credentialAccess.length,
      ips: data.loginIps.length,
      otp: data.otpEvents.length,
      newIps,
    };
  }, [data]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ScrollText className="h-6 w-6" /> Security &amp; Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Credential access, login IP history, and OTP verification events.
          </p>
        </div>
        <AzButton variant="outline" size="md" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </AzButton>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">User</span>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ? `${u.full_name} — ` : ""}{u.email}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">IP address (contains)</span>
            <input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168 or 2401"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Time range</span>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
              <option value="custom">Custom…</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <AzButton variant="brand" size="md" className="flex-1" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Apply filters"}
            </AzButton>
          </div>

          {range === "custom" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">From</span>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">To</span>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard icon={<KeyRound className="h-4 w-4" />} label="Credential views" value={stats.cred} />
        <StatCard icon={<Globe className="h-4 w-4" />} label="Login IP records" value={stats.ips} />
        <StatCard icon={<MailWarning className="h-4 w-4" />} label="OTP events" value={stats.otp} />
        <StatCard icon={<MailWarning className="h-4 w-4 text-amber-500" />} label="New-IP challenges" value={stats.newIps} />
      </div>

      {/* Tables */}
      <Tabs defaultValue="credentials" className="w-full">
        <TabsList>
          <TabsTrigger value="credentials">Credential access</TabsTrigger>
          <TabsTrigger value="ips">Login IPs</TabsTrigger>
          <TabsTrigger value="otp">OTP events</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase">
                    <tr>
                      <Th>When</Th>
                      <Th>Viewer</Th>
                      <Th>Credential</Th>
                      <Th>Task</Th>
                      <Th>IP</Th>
                      <Th>Device</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.credentialAccess.length ? (
                      data.credentialAccess.map((r) => (
                        <tr key={r.id} className="border-t">
                          <Td>{formatDate(r.viewed_at)}</Td>
                          <Td>
                            <div className="font-medium">{r.viewer_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.viewer_email || r.viewer_id.slice(0, 8)}</div>
                          </Td>
                          <Td>{r.credential_label || r.credential_id.slice(0, 8)}</Td>
                          <Td className="max-w-[240px] truncate">{r.task_title || "—"}</Td>
                          <Td><code className="text-xs">{r.ip_address || "—"}</code></Td>
                          <Td className="max-w-[300px] truncate text-xs text-muted-foreground">{r.user_agent || "—"}</Td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow cols={6} loading={loading} />
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ips" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase">
                    <tr>
                      <Th>Last seen</Th>
                      <Th>User</Th>
                      <Th>IP</Th>
                      <Th>Device</Th>
                      <Th>First seen</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.loginIps.length ? (
                      data.loginIps.map((r) => (
                        <tr key={r.id} className="border-t">
                          <Td>{formatDate(r.last_seen_at)}</Td>
                          <Td>
                            <div className="font-medium">{r.user_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.user_email || r.user_id.slice(0, 8)}</div>
                          </Td>
                          <Td><code className="text-xs">{r.ip_address}</code></Td>
                          <Td className="max-w-[300px] truncate text-xs text-muted-foreground">{r.user_agent || "—"}</Td>
                          <Td className="text-xs text-muted-foreground">{formatDate(r.created_at)}</Td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow cols={5} loading={loading} />
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="otp" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase">
                    <tr>
                      <Th>When</Th>
                      <Th>Email</Th>
                      <Th>Purpose</Th>
                      <Th>Status</Th>
                      <Th>Attempts</Th>
                      <Th>IP</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.otpEvents.length ? (
                      data.otpEvents.map((r) => {
                        const status = r.consumed_at
                          ? "consumed"
                          : new Date(r.expires_at) < new Date()
                            ? "expired"
                            : "pending";
                        return (
                          <tr key={r.id} className="border-t">
                            <Td>{formatDate(r.created_at)}</Td>
                            <Td className="max-w-[220px] truncate">{r.email}</Td>
                            <Td>
                              <Badge variant={r.purpose === "new_ip" ? "destructive" : "secondary"}>{r.purpose}</Badge>
                            </Td>
                            <Td>
                              <Badge variant={status === "consumed" ? "default" : status === "expired" ? "outline" : "secondary"}>
                                {status}
                              </Badge>
                            </Td>
                            <Td>{r.attempts}</Td>
                            <Td><code className="text-xs">{r.ip_address || "—"}</code></Td>
                          </tr>
                        );
                      })
                    ) : (
                      <EmptyRow cols={6} loading={loading} />
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        <div className="rounded-md bg-muted p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className || ""}`}>{children}</td>;
}

function EmptyRow({ cols, loading }: { cols: number; loading: boolean }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-sm text-muted-foreground">
        {loading ? "Loading…" : "No matching records."}
      </td>
    </tr>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
