// Admin Review Queue
//
// A focused triage surface for tasks that need reviewer attention:
// `submitted` (waiting for approval) and `changes_requested` (returned but
// still on the reviewer's radar). Each row shows SLA indicators based on
// how long since submission and the original deadline, plus one-click
// approve / request-changes / open-workspace actions.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, Filter,
  MessageSquareWarning, RefreshCw, Search, Timer, User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/currency";
import { requestChanges } from "@/server/projects.functions";
import { adminReviewTask } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/review")({ component: AdminReview });

type Profile = { id: string; full_name: string | null; email: string };
type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  reward_amount: number;
  deadline: string | null;
  submission_url: string | null;
  submission_notes: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  priority: string;
  project_id: string | null;
};
type Attachment = {
  id: string; task_id: string; file_name: string;
  file_size_bytes: number; storage_path: string; mime_type: string | null;
};

// -- SLA helpers -----------------------------------------------------------

type SlaTone = "ok" | "warn" | "danger";
type Sla = { tone: SlaTone; label: string; ageHours: number };

/** Hours since the task was last updated (reasonable proxy for "time waiting in review"). */
function slaForReview(t: Task): Sla {
  const ref = new Date(t.updated_at || t.created_at).getTime();
  const ageMs = Date.now() - ref;
  const ageHours = ageMs / 36e5;
  if (ageHours < 8) return { tone: "ok", label: `${formatAge(ageHours)} in queue`, ageHours };
  if (ageHours < 24) return { tone: "warn", label: `${formatAge(ageHours)} waiting`, ageHours };
  return { tone: "danger", label: `${formatAge(ageHours)} overdue review`, ageHours };
}

function formatAge(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function deadlineState(deadline: string | null): { tone: SlaTone; label: string } | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  const hrs = ms / 36e5;
  if (hrs < 0) return { tone: "danger", label: `Past deadline ${formatAge(-hrs)}` };
  if (hrs < 24) return { tone: "warn", label: `Due in ${formatAge(hrs)}` };
  return { tone: "ok", label: `Due in ${formatAge(hrs)}` };
}

const toneClasses: Record<SlaTone, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 border-emerald-300/60 dark:text-emerald-300",
  warn: "bg-amber-500/10 text-amber-700 border-amber-300/60 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive border-destructive/40",
};

// -------------------------------------------------------------------------

function AdminReview() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [tab, setTab] = useState<"queue" | "changes" | "all">("queue");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [t, p, a] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, user_id, title, description, status, reward_amount, deadline, submission_url, submission_notes, review_notes, reviewed_at, created_at, updated_at, priority, project_id")
        .in("status", ["submitted", "changes_requested"])
        .order("updated_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("task_attachments").select("id, task_id, file_name, file_size_bytes, storage_path, mime_type"),
    ]);
    setTasks(((t.data as Task[]) || []));
    const map: Record<string, Profile> = {};
    for (const pp of (p.data as Profile[]) || []) map[pp.id] = pp;
    setProfiles(map);
    const grouped: Record<string, Attachment[]> = {};
    for (const att of (a.data as Attachment[]) || []) (grouped[att.task_id] ||= []).push(att);
    setAttachments(grouped);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({
    queue: tasks.filter((t) => t.status === "submitted").length,
    changes: tasks.filter((t) => t.status === "changes_requested").length,
    all: tasks.length,
    overdue: tasks.filter((t) => slaForReview(t).tone === "danger" && t.status === "submitted").length,
  }), [tasks]);

  const visible = useMemo(() => {
    let list = tasks;
    if (tab === "queue") list = list.filter((t) => t.status === "submitted");
    if (tab === "changes") list = list.filter((t) => t.status === "changes_requested");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => {
        const p = profiles[t.user_id];
        return t.title.toLowerCase().includes(q)
          || (p?.full_name || "").toLowerCase().includes(q)
          || (p?.email || "").toLowerCase().includes(q);
      });
    }
    // sort: danger first, then warn, then by oldest update
    return [...list].sort((a, b) => {
      const sa = slaForReview(a), sb = slaForReview(b);
      const order = { danger: 0, warn: 1, ok: 2 } as const;
      if (order[sa.tone] !== order[sb.tone]) return order[sa.tone] - order[sb.tone];
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    });
  }, [tasks, tab, search, profiles]);

  const approve = async (t: Task) => {
    if (!user) return;
    setBusyId(t.id);
    try {
      const res = await adminReviewTask({
        data: { task_id: t.id, status: "approved", review_notes: null },
      });
      if (res?.credited) {
        toast.success(`Approved · ${inr(res.credited)} credited`);
      } else {
        toast.success("Approved");
      }
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const submitChanges = async (t: Task) => {
    if (!reviewNotes.trim()) return toast.error("Please provide change notes");
    setBusyId(t.id);
    try {
      await requestChanges({ data: { task_id: t.id, notes: reviewNotes.trim() } });
      toast.success("Sent back to employee with notes");
      setReviewingId(null); setReviewNotes("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not request changes");
    } finally {
      setBusyId(null);
    }
  };

  const openAttachment = async (a: Attachment) => {
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(a.storage_path, 300);
    if (error || !data) return toast.error("Could not generate link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Review Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Triage submitted work, enforce SLAs, and credit earnings.
          </p>
        </div>
        <AzButton variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </AzButton>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Awaiting review" value={counts.queue} icon={Clock} tone="warn" />
        <Stat label="Overdue (>24h)" value={counts.overdue} icon={AlertTriangle} tone="danger" />
        <Stat label="Changes pending" value={counts.changes} icon={MessageSquareWarning} tone="ok" />
        <Stat label="Total open" value={counts.all} icon={Timer} tone="ok" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TabBtn active={tab === "queue"} onClick={() => setTab("queue")}>
          Submitted <Badge variant="secondary" className="ml-1">{counts.queue}</Badge>
        </TabBtn>
        <TabBtn active={tab === "changes"} onClick={() => setTab("changes")}>
          Changes requested <Badge variant="secondary" className="ml-1">{counts.changes}</Badge>
        </TabBtn>
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
          All open <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
        </TabBtn>
        <div className="ml-auto relative w-full max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title, employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border bg-card p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm text-muted-foreground">
            All clear. No tasks waiting for review in this view.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => {
            const sla = slaForReview(t);
            const dl = deadlineState(t.deadline);
            const profile = profiles[t.user_id];
            const atts = attachments[t.id] || [];
            return (
              <Card key={t.id} className="border-l-4" style={{ borderLeftColor: borderTone(sla.tone) }}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link
                          to="/dashboard/tasks/$taskId"
                          params={{ taskId: t.id }}
                          className="hover:underline"
                        >
                          {t.title}
                        </Link>
                        <Badge variant="outline" className="text-[10px] uppercase">{t.priority}</Badge>
                        {t.status === "changes_requested" && (
                          <Badge className="bg-amber-500/15 text-amber-700 border border-amber-300/50">
                            changes requested
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {profile?.full_name || profile?.email || "Unknown"}
                        </span>
                        <span>· Reward {inr(t.reward_amount)}</span>
                        <span>· Submitted {new Date(t.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClasses[sla.tone]}`}>
                        <Clock className="inline h-3 w-3 mr-1" />{sla.label}
                      </span>
                      {dl && (
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClasses[dl.tone]}`}>
                          <Timer className="inline h-3 w-3 mr-1" />{dl.label}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {t.submission_notes && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">Submission notes</div>
                      <p className="whitespace-pre-wrap">{t.submission_notes}</p>
                    </div>
                  )}
                  {t.submission_url && (
                    <a
                      href={t.submission_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {t.submission_url}
                    </a>
                  )}
                  {atts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {atts.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => openAttachment(a)}
                          className="inline-flex items-center gap-1 rounded border bg-card px-2 py-1 text-xs hover:bg-accent"
                        >
                          <FileText className="h-3 w-3" /> {a.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {t.review_notes && t.status === "changes_requested" && (
                    <div className="rounded-md border border-amber-300/50 bg-amber-500/10 p-3 text-sm">
                      <div className="text-[11px] font-semibold uppercase text-amber-700 mb-1">Last review notes</div>
                      <p className="whitespace-pre-wrap">{t.review_notes}</p>
                    </div>
                  )}

                  {reviewingId === t.id ? (
                    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="What needs to change? Be specific so the employee can act on it."
                        rows={3}
                        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <AzButton
                          variant="brand"
                          size="sm"
                          onClick={() => submitChanges(t)}
                          disabled={busyId === t.id}
                        >
                          Send back to employee
                        </AzButton>
                        <AzButton
                          variant="outline"
                          size="sm"
                          onClick={() => { setReviewingId(null); setReviewNotes(""); }}
                        >
                          Cancel
                        </AzButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {t.status === "submitted" && (
                        <AzButton
                          variant="brand"
                          size="sm"
                          onClick={() => approve(t)}
                          disabled={busyId === t.id}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve & credit {inr(t.reward_amount)}
                        </AzButton>
                      )}
                      <AzButton
                        variant="outline"
                        size="sm"
                        onClick={() => { setReviewingId(t.id); setReviewNotes(t.review_notes || ""); }}
                      >
                        <MessageSquareWarning className="h-4 w-4" /> Request changes
                      </AzButton>
                      <Link
                        to="/dashboard/tasks/$taskId"
                        params={{ taskId: t.id }}
                        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Open workspace <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function borderTone(tone: SlaTone) {
  if (tone === "danger") return "hsl(var(--destructive))";
  if (tone === "warn") return "rgb(245 158 11)";
  return "rgb(16 185 129)";
}

function Stat({
  label, value, icon: Icon, tone,
}: { label: string; value: number; icon: any; tone: SlaTone }) {
  return (
    <div className={`rounded-md border bg-card p-4 ${tone === "danger" && value > 0 ? "ring-1 ring-destructive/40" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card hover:bg-accent"
      }`}
    >
      <Filter className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
