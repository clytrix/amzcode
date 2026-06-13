// Admin Security Center
//
// One page to inspect the project's security posture:
//   * Live RLS coverage per table (from get_security_report() helper)
//   * Function search-path hardening
//   * Required platform secrets presence
//   * Production-readiness checklist (auth, storage, encryption key, …)
//
// Everything here is read-only. No mutations from the UI — admins should fix
// findings via migrations / settings, then re-run the report.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Shield, ShieldCheck, ShieldAlert, RefreshCw, KeyRound, Database,
  Lock, AlertTriangle, CheckCircle2, XCircle, Eye, FileSearch, Server,
} from "lucide-react";
import { AzButton } from "@/components/az-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSecurityReport, type SecurityReport } from "@/server/security.functions";

export const Route = createFileRoute("/admin/security")({ component: AdminSecurity });

function AdminSecurity() {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "tables" | "functions" | "secrets" | "checklist">("overview");

  const load = async () => {
    setLoading(true);
    try {
      const r = await getSecurityReport();
      setReport(r);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load security report");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const score = useMemo(() => computeScore(report), [report]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Security Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Live snapshot of RLS coverage, function hardening, and secret configuration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(report.generated_at).toLocaleString()}
            </span>
          )}
          <AzButton variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Re-scan
          </AzButton>
        </div>
      </div>

      <ScoreCard score={score} report={report} />

      <div className="flex flex-wrap items-center gap-2">
        <TabBtn active={tab === "overview"}  onClick={() => setTab("overview")}  icon={ShieldAlert}>Findings</TabBtn>
        <TabBtn active={tab === "tables"}    onClick={() => setTab("tables")}    icon={Database}>Tables &amp; RLS</TabBtn>
        <TabBtn active={tab === "functions"} onClick={() => setTab("functions")} icon={FileSearch}>DB functions</TabBtn>
        <TabBtn active={tab === "secrets"}   onClick={() => setTab("secrets")}   icon={KeyRound}>Secrets</TabBtn>
        <TabBtn active={tab === "checklist"} onClick={() => setTab("checklist")} icon={CheckCircle2}>Production checklist</TabBtn>
      </div>

      {!report ? (
        <SkeletonCard />
      ) : (
        <>
          {tab === "overview"  && <FindingsPanel report={report} />}
          {tab === "tables"    && <TablesPanel report={report} />}
          {tab === "functions" && <FunctionsPanel report={report} />}
          {tab === "secrets"   && <SecretsPanel report={report} />}
          {tab === "checklist" && <ChecklistPanel report={report} />}
        </>
      )}
    </div>
  );
}

// ─── Score ────────────────────────────────────────────────────────────────

function computeScore(r: SecurityReport | null): { value: number; label: string; tone: "ok" | "warn" | "danger" } {
  if (!r) return { value: 0, label: "Loading…", tone: "warn" };
  const total =
    r.summary.tables_total +
    r.summary.functions_total +
    r.secrets.filter((s) => s.required).length;
  const failures =
    r.summary.tables_without_rls * 3 +
    r.summary.tables_without_policies * 2 +
    r.summary.functions_without_search_path +
    r.secrets.filter((s) => s.required && !s.present).length * 2;
  const value = Math.max(0, Math.min(100, Math.round(100 - (failures / Math.max(1, total)) * 25)));
  if (value >= 90) return { value, label: "Strong", tone: "ok" };
  if (value >= 75) return { value, label: "Needs attention", tone: "warn" };
  return { value, label: "Action required", tone: "danger" };
}

function ScoreCard({ score, report }: { score: ReturnType<typeof computeScore>; report: SecurityReport | null }) {
  const toneBg =
    score.tone === "ok"     ? "from-emerald-500/15 to-emerald-500/0 border-emerald-300/50"
    : score.tone === "warn" ? "from-amber-500/15 to-amber-500/0 border-amber-300/50"
                            : "from-destructive/15 to-destructive/0 border-destructive/40";
  const Icon = score.tone === "ok" ? ShieldCheck : score.tone === "warn" ? ShieldAlert : AlertTriangle;
  const iconColor =
    score.tone === "ok"     ? "text-emerald-600"
    : score.tone === "warn" ? "text-amber-600"
                            : "text-destructive";
  return (
    <div className={`rounded-lg border bg-gradient-to-br p-5 ${toneBg}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm">
            <Icon className={`h-7 w-7 ${iconColor}`} />
          </div>
          <div>
            <div className="text-3xl font-bold leading-none">{score.value}<span className="text-base text-muted-foreground">/100</span></div>
            <div className="text-sm font-medium">{score.label}</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 max-w-2xl">
          <Mini label="Tables" value={report?.summary.tables_total ?? 0} sub={`${report?.summary.tables_without_rls ?? 0} unprotected`} danger={(report?.summary.tables_without_rls ?? 0) > 0} />
          <Mini label="Anon-readable" value={report?.summary.tables_anon_readable ?? 0} sub="public reads" />
          <Mini label="DB functions" value={report?.summary.functions_total ?? 0} sub={`${report?.summary.functions_without_search_path ?? 0} unhardened`} danger={(report?.summary.functions_without_search_path ?? 0) > 0} />
          <Mini label="Required secrets" value={report?.secrets.filter((s) => s.required).length ?? 0} sub={`${report?.secrets.filter((s) => s.required && !s.present).length ?? 0} missing`} danger={(report?.secrets.filter((s) => s.required && !s.present).length ?? 0) > 0} />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, sub, danger }: { label: string; value: number; sub: string; danger?: boolean }) {
  return (
    <div className="rounded-md bg-card/80 px-3 py-2 backdrop-blur">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className={`text-[11px] ${danger ? "text-destructive" : "text-muted-foreground"}`}>{sub}</div>
    </div>
  );
}

// ─── Findings ─────────────────────────────────────────────────────────────

type Finding = {
  level: "error" | "warn" | "info";
  title: string;
  detail: string;
  affected?: string[];
  fix?: string;
};

function deriveFindings(r: SecurityReport): Finding[] {
  const f: Finding[] = [];

  const noRls = r.tables.filter((t) => !t.rls_enabled).map((t) => t.table);
  if (noRls.length) {
    f.push({
      level: "error",
      title: "Tables without Row-Level Security",
      detail: "RLS is the only barrier between authenticated clients and your data. Tables without it are publicly accessible to anyone with an anon key.",
      affected: noRls,
      fix: "Run: ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;  then add policies.",
    });
  }

  const noPolicies = r.tables.filter((t) => t.rls_enabled && t.policy_count === 0).map((t) => t.table);
  if (noPolicies.length) {
    f.push({
      level: "error",
      title: "RLS enabled but no policies defined",
      detail: "When RLS is on without policies, all client requests are denied — including legitimate ones from your own app.",
      affected: noPolicies,
      fix: "Add at minimum a SELECT policy scoped to auth.uid() and an admin override using has_role(auth.uid(),'admin').",
    });
  }

  const anonReadable = r.tables.filter((t) => t.anon_readable).map((t) => t.table);
  if (anonReadable.length) {
    f.push({
      level: "warn",
      title: "Tables readable by the anonymous role",
      detail: "These tables can be read by anyone holding the publishable key. Confirm only public-by-design content lives here (e.g. job listings, FX rates).",
      affected: anonReadable,
    });
  }

  const fnNoSearch = r.functions.filter((fn) => !fn.has_search_path).map((fn) => fn.name);
  if (fnNoSearch.length) {
    f.push({
      level: "warn",
      title: "Database functions without pinned search_path",
      detail: "SECURITY DEFINER functions without a fixed search_path are vulnerable to schema-shadow attacks.",
      affected: fnNoSearch,
      fix: "Add  SET search_path = public  to each function definition.",
    });
  }

  const missingSecrets = r.secrets.filter((s) => s.required && !s.present).map((s) => s.name);
  if (missingSecrets.length) {
    f.push({
      level: "error",
      title: "Required secrets are missing",
      detail: "Server functions depending on these will throw at runtime.",
      affected: missingSecrets,
      fix: "Set them in your hosting provider's environment (Lovable Cloud → Connectors, or your own .env).",
    });
  }

  if (f.length === 0) {
    f.push({
      level: "info",
      title: "No automated findings",
      detail: "Scanner did not detect missing RLS, unhardened functions, or missing required secrets. Run the production checklist for human-verified controls.",
    });
  }
  return f;
}

function FindingsPanel({ report }: { report: SecurityReport }) {
  const findings = deriveFindings(report);
  return (
    <div className="space-y-3">
      {findings.map((f, i) => (
        <Card key={i} className={`border-l-4 ${
          f.level === "error" ? "border-l-destructive"
          : f.level === "warn" ? "border-l-amber-500"
                              : "border-l-emerald-500"
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {f.level === "error" && <XCircle className="h-4 w-4 text-destructive" />}
              {f.level === "warn" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              {f.level === "info" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {f.title}
              <Badge variant="outline" className="ml-2 text-[10px] uppercase">{f.level}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{f.detail}</p>
            {f.affected && f.affected.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">Affected</div>
                <div className="flex flex-wrap gap-1">
                  {f.affected.map((a) => (
                    <code key={a} className="rounded bg-muted px-1.5 py-0.5 text-xs">{a}</code>
                  ))}
                </div>
              </div>
            )}
            {f.fix && (
              <div className="rounded-md border bg-muted/40 p-2 text-xs">
                <span className="font-semibold">Fix · </span>{f.fix}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────

function TablesPanel({ report }: { report: SecurityReport }) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Table</th>
            <th className="px-3 py-2 text-center">RLS</th>
            <th className="px-3 py-2 text-center">Policies</th>
            <th className="px-3 py-2 text-center">SELECT</th>
            <th className="px-3 py-2 text-center">Modify</th>
            <th className="px-3 py-2 text-center">Anon read</th>
          </tr>
        </thead>
        <tbody>
          {report.tables.map((t) => (
            <tr key={t.table} className="border-t hover:bg-accent/30">
              <td className="px-3 py-2 font-mono text-xs">{t.table}</td>
              <td className="px-3 py-2 text-center">
                {t.rls_enabled
                  ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                  : <XCircle className="mx-auto h-4 w-4 text-destructive" />}
              </td>
              <td className="px-3 py-2 text-center">
                <Badge variant={t.policy_count === 0 ? "destructive" : "secondary"}>{t.policy_count}</Badge>
              </td>
              <td className="px-3 py-2 text-center">{t.has_select_policy ? "✓" : "—"}</td>
              <td className="px-3 py-2 text-center">{t.has_modify_policy ? "✓" : "—"}</td>
              <td className="px-3 py-2 text-center">
                {t.anon_readable
                  ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><Eye className="h-3 w-3" /> public</span>
                  : <Lock className="mx-auto h-3.5 w-3.5 text-muted-foreground" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Functions ────────────────────────────────────────────────────────────

function FunctionsPanel({ report }: { report: SecurityReport }) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Function</th>
            <th className="px-3 py-2 text-center">search_path</th>
            <th className="px-3 py-2 text-center">SECURITY DEFINER</th>
          </tr>
        </thead>
        <tbody>
          {report.functions.map((f) => (
            <tr key={f.name} className="border-t hover:bg-accent/30">
              <td className="px-3 py-2 font-mono text-xs">{f.name}</td>
              <td className="px-3 py-2 text-center">
                {f.has_search_path
                  ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                  : <XCircle className="mx-auto h-4 w-4 text-destructive" />}
              </td>
              <td className="px-3 py-2 text-center text-xs">
                {f.is_security_definer
                  ? <Badge variant="outline">DEFINER</Badge>
                  : <span className="text-muted-foreground">INVOKER</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Secrets ──────────────────────────────────────────────────────────────

function SecretsPanel({ report }: { report: SecurityReport }) {
  return (
    <div className="space-y-2">
      {report.secrets.map((s) => (
        <div key={s.name} className="flex items-center justify-between rounded-md border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-mono text-sm">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {s.required ? "Required" : "Optional"} · value never displayed
              </div>
            </div>
          </div>
          {s.present ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-300/50">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Set
            </Badge>
          ) : s.required ? (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" /> Missing
            </Badge>
          ) : (
            <Badge variant="outline">Not set</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────

function ChecklistPanel({ report }: { report: SecurityReport }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("security_checklist") || "{}"); }
    catch { return {}; }
  });
  const toggle = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try { localStorage.setItem("security_checklist", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const items = buildChecklist(report);
  const completed = items.filter((it) => done[it.id] || it.auto).length;

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Production readiness</span>
          <span className="text-muted-foreground">{completed} / {items.length} verified</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(completed / Math.max(1, items.length)) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it) => {
          const isAuto = it.auto !== undefined;
          const isDone = isAuto ? !!it.auto : !!done[it.id];
          return (
            <button
              key={it.id}
              onClick={() => !isAuto && toggle(it.id)}
              disabled={isAuto}
              className={`w-full text-left rounded-md border bg-card px-4 py-3 transition ${
                !isAuto ? "hover:bg-accent" : ""
              } ${isDone ? "border-emerald-300/50 bg-emerald-500/5" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  isDone ? "border-emerald-500 bg-emerald-500 text-white" : "border-input bg-background"
                }`}>
                  {isDone && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {it.label}
                    {isAuto && <Badge variant="outline" className="text-[10px]">auto</Badge>}
                  </div>
                  {it.hint && <div className="mt-1 text-xs text-muted-foreground">{it.hint}</div>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildChecklist(r: SecurityReport): { id: string; label: string; hint?: string; auto?: boolean }[] {
  const allRls = r.summary.tables_without_rls === 0;
  const allPolicies = r.summary.tables_without_policies === 0;
  const allFns = r.summary.functions_without_search_path === 0;
  const reqSecretsOk = r.secrets.filter((s) => s.required).every((s) => s.present);
  return [
    { id: "rls_all_tables", label: "RLS enabled on every public table",
      auto: allRls,
      hint: "Verified live from pg_catalog." },
    { id: "policies_present", label: "Every RLS-enabled table has at least one policy",
      auto: allPolicies },
    { id: "functions_search_path", label: "All SECURITY DEFINER functions pin search_path",
      auto: allFns },
    { id: "required_secrets", label: "All required server secrets are configured",
      auto: reqSecretsOk },
    { id: "encryption_key_rotated", label: "TASK_CREDENTIAL_ENC_KEY is unique to production",
      hint: "Generate with: openssl rand -base64 32. Never reuse the dev key." },
    { id: "auth_email_confirm", label: "Email confirmation is enabled in auth settings",
      hint: "Disable auto-confirm before launch — verify it via the auth dashboard." },
    { id: "auth_strong_password", label: "Strong password policy enabled (length ≥ 8, leaked-password check on)",
      hint: "Auth → Policies in your backend settings." },
    { id: "storage_buckets_private", label: "task-attachments and kyc-documents buckets are private",
      hint: "Both already configured private — re-confirm if you cloned to a new project." },
    { id: "service_role_server_only", label: "SUPABASE_SERVICE_ROLE_KEY is never shipped to the client",
      hint: "Only used in *.functions.ts / *.server.ts files. Audit with: grep -r SERVICE_ROLE src/." },
    { id: "admin_role_audit", label: "Reviewed user_roles table — only intended users have 'admin'",
      hint: "Run: select u.email from user_roles r join profiles u on u.id=r.user_id where r.role='admin'." },
    { id: "credential_audit_reviewed", label: "Reviewed credential_access_log for unexpected reveals",
      hint: "Spot-check the latest 50 entries in your DB before each release." },
    { id: "backups_enabled", label: "Automated daily backups enabled on the database",
      hint: "On managed Supabase: Project Settings → Database → Backups. On self-hosted: enable pg_dump cron." },
    { id: "rate_limiting", label: "Edge / WAF rate limiting in place for /api/public/* and auth endpoints",
      hint: "Configure Cloudflare WAF, fly.io rate limit, or your reverse proxy." },
    { id: "tls_enforced", label: "HTTPS is enforced (HSTS) on the production domain",
      hint: "Cloudflare → SSL/TLS → Full Strict + HSTS, or your CDN's equivalent." },
  ];
}

// ─── UI bits ──────────────────────────────────────────────────────────────

function TabBtn({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: any; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card hover:bg-accent"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
      <Server className="mx-auto h-8 w-8 animate-pulse" />
      <p className="mt-2">Running security scan…</p>
    </div>
  );
}
