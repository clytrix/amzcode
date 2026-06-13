import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { JobRequiredGate } from "@/components/job-required-gate";

import {
  ArrowLeft, Clock, Play, Square, AlertTriangle, CheckCircle2, XCircle,
  FileText, Link as LinkIcon, Upload, X, Paperclip, Lock, Eye, EyeOff,
  Copy, MessageSquare, ListChecks, Folder, ExternalLink, Send, Timer,
} from "lucide-react";
import {
  startTask, blockTask, unblockTask, submitTask, updateChecklist,
  startTimer, stopTimer, logTimeManually, postComment, revealCredential,
} from "@/server/projects.functions";

export const Route = createFileRoute("/dashboard/tasks/$taskId")({
  component: TaskWorkspaceGated,
});

function TaskWorkspaceGated() {
  return (
    <JobRequiredGate feature="Task workspace">
      <TaskWorkspace />
    </JobRequiredGate>
  );
}

// --------------------------------- types ---------------------------------

type TaskStatus =
  | "assigned" | "in_progress" | "blocked" | "submitted"
  | "approved" | "rejected" | "changes_requested";

type ChecklistItem = { id: string; text: string; done: boolean };

type Task = {
  id: string;
  user_id: string;
  project_id: string | null;
  module_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "urgent";
  reward_amount: number;
  estimate_hours: number | null;
  deadline: string | null;
  started_at: string | null;
  blocked_reason: string | null;
  submission_notes: string | null;
  submission_url: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  checklist: ChecklistItem[] | null;
  created_at: string;
};

type Attachment = {
  id: string; task_id: string; file_name: string;
  file_size_bytes: number; storage_path: string; mime_type: string | null;
};
type Resource = {
  id: string; project_id: string;
  kind: "file" | "url"; label: string; url_or_path: string; notes: string | null;
};
type Credential = {
  id: string; task_id: string; label: string;
  username: string | null; url: string | null; notes: string | null;
};
type Comment = {
  id: string; task_id: string; author_id: string; body: string; created_at: string;
};
type TimeLog = {
  id: string; task_id: string; user_id: string;
  started_at: string; ended_at: string | null; minutes: number | null; note: string | null;
};
type Activity = {
  id: string; task_id: string; actor_id: string | null; kind: string;
  payload: Record<string, unknown>; created_at: string;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// --------------------------------- helpers ---------------------------------

function deadlineMeta(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const hoursLeft = (d.getTime() - Date.now()) / 36e5;
  if (hoursLeft < 0) return { tone: "overdue" as const, label: `Overdue by ${Math.abs(Math.round(hoursLeft))}h` };
  if (hoursLeft < 24) return { tone: "soon" as const, label: `Due in ${Math.round(hoursLeft)}h` };
  return { tone: "ok" as const, label: `Due ${d.toLocaleString("en-IN")}` };
}

const statusBadge: Record<TaskStatus, string> = {
  assigned: "bg-secondary text-foreground",
  in_progress: "bg-primary/15 text-primary",
  blocked: "bg-warning/20 text-warning",
  submitted: "bg-warning/15 text-warning",
  changes_requested: "bg-destructive/15 text-destructive",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

const priorityBadge = {
  low: "bg-secondary text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive font-bold",
} as const;

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// --------------------------------- main ---------------------------------

function TaskWorkspace() {
  const { taskId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: t, error } = await supabase
      .from("tasks").select("*").eq("id", taskId).maybeSingle();
    if (error || !t) { setLoading(false); return; }
    setTask(t as Task);

    const [{ data: atts }, { data: creds }, { data: cmts }, { data: act }, { data: tl }] = await Promise.all([
      supabase.from("task_attachments").select("*").eq("task_id", taskId),
      supabase.from("task_credentials").select("id, task_id, label, username, url, notes").eq("task_id", taskId),
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_activity").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(50),
      supabase.from("task_time_logs").select("*").eq("task_id", taskId).eq("user_id", user.id).order("started_at", { ascending: false }),
    ]);
    setAttachments((atts as Attachment[]) || []);
    setCredentials((creds as Credential[]) || []);
    setComments((cmts as Comment[]) || []);
    setActivity((act as Activity[]) || []);
    setTimeLogs((tl as TimeLog[]) || []);

    if (t.project_id) {
      const { data: rs } = await supabase
        .from("project_resources").select("*").eq("project_id", t.project_id);
      setResources((rs as Resource[]) || []);
    }

    // resolve author names for comments/activity
    const ids = new Set<string>();
    (cmts as Comment[] | null)?.forEach((c) => ids.add(c.author_id));
    (act as Activity[] | null)?.forEach((a) => a.actor_id && ids.add(a.actor_id));
    if (ids.size) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", Array.from(ids));
      const map: Record<string, string> = {};
      profs?.forEach((p) => { map[p.id] = p.full_name || p.email || "User"; });
      setAuthorNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [taskId, user?.id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading task…</div>;
  if (!task) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-muted-foreground">Task not found or you don't have access.</p>
        <Link to="/dashboard/tasks" className="text-primary hover:underline">← Back to tasks</Link>
      </div>
    );
  }

  const dl = deadlineMeta(task.deadline);
  const checklist = task.checklist || [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const totalMinutes = timeLogs.reduce((acc, l) => acc + (l.minutes || 0), 0);
  const isFinal = task.status === "approved" || task.status === "rejected";

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => navigate({ to: "/dashboard/tasks" })}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to tasks
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <span className={`rounded px-2 py-0.5 text-xs font-bold capitalize ${statusBadge[task.status]}`}>
              {task.status.replace(/_/g, " ")}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs capitalize ${priorityBadge[task.priority]}`}>
              {task.priority}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {task.estimate_hours != null && <span>Est. {task.estimate_hours}h</span>}
            {dl && <span className={dl.tone === "overdue" ? "font-bold text-destructive" : dl.tone === "soon" ? "font-bold text-warning" : ""}>{dl.label}</span>}
            <span>Logged {fmtDuration(totalMinutes)}</span>
            {checklist.length > 0 && <span>Checklist {checklistDone}/{checklist.length}</span>}
          </div>
        </div>
        <LifecycleActions task={task} onChanged={load} />
      </div>

      {/* status banners */}
      {task.status === "blocked" && task.blocked_reason && (
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          <b>Blocked:</b> {task.blocked_reason}
        </Banner>
      )}
      {task.status === "changes_requested" && task.review_notes && (
        <Banner tone="destructive" icon={<XCircle className="h-4 w-4" />}>
          <b>Reviewer requested changes:</b> {task.review_notes}
        </Banner>
      )}
      {task.status === "approved" && (
        <Banner tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>
          Approved — great work!
          {task.review_notes && <> <span className="text-muted-foreground">{task.review_notes}</span></>}
        </Banner>
      )}
      {task.status === "rejected" && task.review_notes && (
        <Banner tone="destructive" icon={<XCircle className="h-4 w-4" />}>
          <b>Declined:</b> {task.review_notes}
        </Banner>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Brief">
            <p className="whitespace-pre-wrap text-sm">{task.description}</p>
          </Card>

          {checklist.length > 0 && (
            <Checklist task={task} items={checklist} disabled={isFinal} onSaved={load} />
          )}

          <SubmissionPanel
            task={task}
            attachments={attachments}
            onChanged={load}
          />

          <CommentsPanel
            taskId={task.id}
            comments={comments}
            authorNames={authorNames}
            onAdded={load}
          />

          {activity.length > 0 && (
            <Card title="Activity">
              <ul className="space-y-2 text-xs">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("en-IN")}</span>
                    <span><b>{a.actor_id ? (authorNames[a.actor_id] || "User") : "System"}</b> {a.kind.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <TimerPanel task={task} timeLogs={timeLogs} totalMinutes={totalMinutes} onChanged={load} />
          <CredentialsPanel credentials={credentials} />
          {resources.length > 0 && <ResourcesPanel resources={resources} />}
        </div>
      </div>
    </div>
  );
}

// --------------------------------- panels ---------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Banner({ tone, icon, children }: { tone: "warning" | "success" | "destructive"; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = tone === "warning" ? "border-warning/30 bg-warning/5"
    : tone === "success" ? "border-success/30 bg-success/5"
    : "border-destructive/30 bg-destructive/5";
  return (
    <div className={`flex gap-2 rounded-md border p-3 text-sm ${cls}`}>
      <span className="shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function LifecycleActions({ task, onChanged }: { task: Task; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [reason, setReason] = useState("");

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await onChanged(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (task.status === "approved" || task.status === "rejected") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.status === "assigned" && (
        <AzButton size="sm" variant="brand" disabled={busy}
          onClick={() => run(() => startTask({ data: { task_id: task.id } }), "Task started")}>
          <Play className="h-3.5 w-3.5" /> Start task
        </AzButton>
      )}
      {(task.status === "in_progress" || task.status === "changes_requested") && (
        <>
          <AzButton size="sm" variant="outline" disabled={busy} onClick={() => setShowBlock((v) => !v)}>
            <AlertTriangle className="h-3.5 w-3.5" /> {showBlock ? "Cancel" : "Mark blocked"}
          </AzButton>
        </>
      )}
      {task.status === "blocked" && (
        <AzButton size="sm" disabled={busy}
          onClick={() => run(() => unblockTask({ data: { task_id: task.id } }), "Task resumed")}>
          Resume
        </AzButton>
      )}

      {showBlock && (
        <div className="flex w-full gap-2 rounded-md border bg-card p-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="What is blocking you?"
            className="flex-1 rounded border border-input bg-white px-2 py-1 text-sm" />
          <AzButton size="sm" variant="destructive" disabled={busy || !reason.trim()}
            onClick={() => run(() => blockTask({ data: { task_id: task.id, reason } }), "Marked blocked")}>
            Confirm
          </AzButton>
        </div>
      )}
    </div>
  );
}

function Checklist({ task, items, disabled, onSaved }: { task: Task; items: ChecklistItem[]; disabled: boolean; onSaved: () => void | Promise<void> }) {
  const [local, setLocal] = useState<ChecklistItem[]>(items);
  useEffect(() => { setLocal(items); }, [items]);
  const [saving, setSaving] = useState(false);

  const toggle = async (id: string) => {
    if (disabled) return;
    const next = local.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    setLocal(next);
    setSaving(true);
    try {
      await updateChecklist({ data: { task_id: task.id, checklist: next } });
      await onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Card title={`Acceptance checklist${saving ? " (saving…)" : ""}`}>
      <ul className="space-y-2">
        {local.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={c.done} disabled={disabled}
              onChange={() => toggle(c.id)} className="mt-1 h-4 w-4" />
            <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TimerPanel({ task, timeLogs, totalMinutes, onChanged }:
  { task: Task; timeLogs: TimeLog[]; totalMinutes: number; onChanged: () => void | Promise<void> }) {
  const running = timeLogs.find((l) => l.ended_at == null) || null;
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualMins, setManualMins] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setTick((x) => x + 1), 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
    setTick(0);
  }, [running?.id]);

  const elapsedSec = running ? Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000) : 0;
  void tick; // re-render trigger

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await onChanged(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const canTime = task.status === "in_progress" || task.status === "changes_requested";

  return (
    <Card title="Time tracking">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {running ? fmtElapsed(elapsedSec) : "00:00:00"}
          </div>
          <div className="text-xs text-muted-foreground">Total logged: {fmtDuration(totalMinutes)}</div>
        </div>
        {!running && canTime && (
          <AzButton size="sm" variant="brand" disabled={busy}
            onClick={() => run(() => startTimer({ data: { task_id: task.id } }), "Timer started")}>
            <Play className="h-3.5 w-3.5" /> Start
          </AzButton>
        )}
        {running && (
          <AzButton size="sm" variant="destructive" disabled={busy}
            onClick={() => run(() => stopTimer({ data: { task_id: task.id, note: note || null } }), "Timer stopped")}>
            <Square className="h-3.5 w-3.5" /> Stop
          </AzButton>
        )}
      </div>
      {running && (
        <input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for this session…"
          className="mt-3 w-full rounded border border-input bg-white px-2 py-1 text-xs" />
      )}

      {canTime && !running && (
        <div className="mt-4 border-t pt-3">
          <label className="block text-xs font-bold">Add time manually (minutes)</label>
          <div className="mt-1 flex gap-2">
            <input type="number" min={1} value={manualMins} onChange={(e) => setManualMins(e.target.value)}
              placeholder="e.g. 45"
              className="w-24 rounded border border-input bg-white px-2 py-1 text-sm" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
              className="flex-1 rounded border border-input bg-white px-2 py-1 text-sm" />
            <AzButton size="sm" disabled={busy || !manualMins}
              onClick={() => {
                const n = parseInt(manualMins, 10);
                if (!n || n < 1) return toast.error("Enter minutes");
                run(() => logTimeManually({ data: { task_id: task.id, minutes: n, note: note || null } }), "Logged")
                  .then(() => { setManualMins(""); setNote(""); });
              }}>
              <Timer className="h-3.5 w-3.5" /> Log
            </AzButton>
          </div>
        </div>
      )}

      {timeLogs.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Sessions ({timeLogs.length})</summary>
          <ul className="mt-2 space-y-1">
            {timeLogs.slice(0, 8).map((l) => (
              <li key={l.id} className="flex justify-between gap-2 border-b border-dashed py-1">
                <span>{new Date(l.started_at).toLocaleString("en-IN")}</span>
                <span className="font-mono">{l.minutes ? fmtDuration(l.minutes) : "running…"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function CredentialsPanel({ credentials }: { credentials: Credential[] }) {
  if (credentials.length === 0) {
    return (
      <Card title="Credentials">
        <p className="text-xs text-muted-foreground">No credentials shared for this task.</p>
      </Card>
    );
  }
  return (
    <Card title="Credentials">
      <p className="mb-3 text-[11px] text-muted-foreground">
        <Lock className="mr-1 inline h-3 w-3" />
        Reveals are logged. Use these only for this task and never share outside the platform.
      </p>
      <ul className="space-y-3">
        {credentials.map((c) => <CredentialRow key={c.id} cred={c} />)}
      </ul>
    </Card>
  );
}

function CredentialRow({ cred }: { cred: Credential }) {
  const [revealed, setRevealed] = useState<{ password: string; username?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const reveal = async () => {
    setBusy(true);
    try {
      const res = await revealCredential({ data: { credential_id: cred.id } });
      setRevealed({ password: res.password, username: res.username });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <li className="rounded border bg-secondary/30 p-3 text-sm">
      <div className="flex items-center justify-between">
        <b>{cred.label}</b>
        {cred.url && (
          <a href={cred.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Open <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {(cred.username || revealed?.username) && (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">User:</span>
          <span className="flex items-center gap-1 font-mono">
            {cred.username || revealed?.username}
            <button onClick={() => copy(cred.username || revealed?.username || "", "Username")}
              className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
          </span>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Password:</span>
        {revealed ? (
          <span className="flex items-center gap-1 font-mono">
            {revealed.password}
            <button onClick={() => copy(revealed.password, "Password")} className="text-muted-foreground hover:text-foreground">
              <Copy className="h-3 w-3" />
            </button>
            <button onClick={() => setRevealed(null)} className="text-muted-foreground hover:text-foreground">
              <EyeOff className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <button onClick={reveal} disabled={busy}
            className="inline-flex items-center gap-1 rounded border bg-white px-2 py-0.5 text-xs hover:bg-secondary disabled:opacity-50">
            <Eye className="h-3 w-3" /> {busy ? "…" : "Reveal"}
          </button>
        )}
      </div>
      {cred.notes && <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{cred.notes}</div>}
    </li>
  );
}

function ResourcesPanel({ resources }: { resources: Resource[] }) {
  return (
    <Card title="Project resources">
      <ul className="space-y-2 text-sm">
        {resources.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <span className="mt-0.5">{r.kind === "file" ? <Folder className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1">
              <a href={r.url_or_path} target="_blank" rel="noreferrer"
                className="font-medium text-primary hover:underline">{r.label}</a>
              {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CommentsPanel({ taskId, comments, authorNames, onAdded }:
  { taskId: string; comments: Comment[]; authorNames: Record<string, string>; onAdded: () => void | Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await postComment({ data: { task_id: taskId, body } });
      setBody("");
      await onAdded();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Card title={`Discussion (${comments.length})`}>
      {comments.length === 0 && <p className="mb-3 text-xs text-muted-foreground">No messages yet — use this to ask the reviewer questions.</p>}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded border bg-secondary/30 p-3 text-sm">
            <div className="flex justify-between text-xs text-muted-foreground">
              <b>{authorNames[c.author_id] || "User"}</b>
              <span>{new Date(c.created_at).toLocaleString("en-IN")}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a message…"
          className="flex-1 rounded border border-input bg-white px-2 py-1 text-sm" />
        <AzButton size="sm" disabled={busy || !body.trim()} onClick={send}>
          <Send className="h-3.5 w-3.5" /> Send
        </AzButton>
      </div>
    </Card>
  );
}

function SubmissionPanel({ task, attachments, onChanged }:
  { task: Task; attachments: Attachment[]; onChanged: () => void | Promise<void> }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState(task.submission_notes || "");
  const [url, setUrl] = useState(task.submission_url || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setNotes(task.submission_notes || "");
    setUrl(task.submission_url || "");
  }, [task.id]);

  const editable = task.status === "in_progress" || task.status === "changes_requested" || task.status === "assigned";

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) { toast.error(`${file.name} exceeds 10MB`); continue; }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${task.id}/${user.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file, { upsert: false });
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
        const { error: rowErr } = await supabase.from("task_attachments").insert({
          task_id: task.id, user_id: user.id, storage_path: path,
          file_name: file.name, file_size_bytes: file.size, mime_type: file.type || null,
        });
        if (rowErr) toast.error(`${file.name}: ${rowErr.message}`);
      }
      toast.success("Files uploaded");
      await onChanged();
    } finally { setUploading(false); }
  };
  const removeAtt = async (a: Attachment) => {
    await supabase.storage.from("task-attachments").remove([a.storage_path]);
    await supabase.from("task_attachments").delete().eq("id", a.id);
    await onChanged();
  };
  const downloadAtt = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(a.storage_path, 300);
    if (error || !data) return toast.error("Could not generate download link");
    window.open(data.signedUrl, "_blank");
  };

  const submit = async () => {
    if (!notes.trim() && !url.trim() && attachments.length === 0) {
      return toast.error("Add notes, a link, or an attachment before submitting");
    }
    const checklist = task.checklist || [];
    if (checklist.length > 0 && checklist.some((c) => !c.done)) {
      const ok = window.confirm("Some checklist items are not done. Submit anyway?");
      if (!ok) return;
    }
    setBusy(true);
    try {
      await submitTask({ data: { task_id: task.id, submission_notes: notes, submission_url: url || null } });
      toast.success("Submitted for review");
      await onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Submission">
      {!editable && (
        <p className="mb-3 text-xs text-muted-foreground">
          {task.status === "submitted" ? "Awaiting reviewer." :
           task.status === "approved" ? "Approved." :
           task.status === "rejected" ? "Declined." :
           task.status === "blocked" ? "Resume the task to keep editing your submission." : ""}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-bold">Progress notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} disabled={!editable}
          placeholder="Describe what you did and any context for the reviewer…"
          className="w-full rounded border border-input bg-white px-3 py-2 text-sm disabled:bg-secondary/40" />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-bold">Link (optional)</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} disabled={!editable}
          placeholder="https://…"
          className="w-full rounded border border-input bg-white px-3 py-2 text-sm disabled:bg-secondary/40" />
      </label>

      <div className="mt-3">
        <span className="mb-1 block text-xs font-bold">Attachments</span>
        {editable && (
          <label className={`flex cursor-pointer items-center gap-2 rounded border border-dashed border-input bg-secondary/30 px-3 py-2 text-xs hover:bg-secondary ${uploading ? "opacity-50" : ""}`}>
            <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Click to upload (max 10MB each)"}
            <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => uploadFiles(e.target.files)} />
          </label>
        )}
        {attachments.length > 0 && (
          <ul className="mt-2 space-y-1">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded bg-secondary/40 px-2 py-1 text-xs">
                <button onClick={() => downloadAtt(a)} className="flex min-w-0 items-center gap-1 truncate hover:underline">
                  <Paperclip className="h-3 w-3" /> {a.file_name}
                  <span className="text-muted-foreground">({(a.file_size_bytes / 1024).toFixed(0)} KB)</span>
                </button>
                {editable && (
                  <button onClick={() => removeAtt(a)} className="text-destructive hover:underline" aria-label="Remove">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editable && (
        <div className="mt-4 flex justify-end">
          <AzButton variant="brand" disabled={busy} onClick={submit}>
            <Send className="h-3.5 w-3.5" /> Send for review
          </AzButton>
        </div>
      )}
    </Card>
  );
}
