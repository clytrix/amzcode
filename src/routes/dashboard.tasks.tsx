import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { JobRequiredGate } from "@/components/job-required-gate";

import {
  Clock, AlertCircle, CheckCircle2, AlertTriangle, ListChecks,
  Lock, Folder, Filter,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/tasks")({ component: TasksLayout });

function TasksLayout() {
  const matches = useMatches();
  const hasChild = matches.some((m) => m.routeId.startsWith("/dashboard/tasks/$"));
  if (hasChild) return <Outlet />;
  return (
    <JobRequiredGate feature="Tasks">
      <TasksPage />
    </JobRequiredGate>
  );
}

type TaskStatus =
  | "assigned" | "in_progress" | "blocked" | "submitted"
  | "approved" | "rejected" | "changes_requested";

type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "urgent";
  reward_amount: number;
  deadline: string | null;
  estimate_hours: number | null;
  project_id: string | null;
  module_id: string | null;
  checklist: { id: string; text: string; done: boolean }[] | null;
  review_notes: string | null;
  blocked_reason: string | null;
  created_at: string;
};

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

type FilterKey = "all" | "active" | "review" | "done";

function deadlineMeta(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const hoursLeft = (d.getTime() - Date.now()) / 36e5;
  if (hoursLeft < 0) return { tone: "overdue" as const, label: `Overdue by ${Math.abs(Math.round(hoursLeft))}h` };
  if (hoursLeft < 24) return { tone: "soon" as const, label: `Due in ${Math.round(hoursLeft)}h` };
  return { tone: "ok" as const, label: `Due ${d.toLocaleString("en-IN")}` };
}

function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<Record<string, string>>({});
  const [credCount, setCredCount] = useState<Record<string, number>>({});
  const [attCount, setAttCount] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FilterKey>("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const { data: ts } = await supabase
        .from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      const taskList = (ts as Task[]) || [];
      setTasks(taskList);

      const projectIds = Array.from(new Set(taskList.map((t) => t.project_id).filter(Boolean) as string[]));
      const moduleIds = Array.from(new Set(taskList.map((t) => t.module_id).filter(Boolean) as string[]));
      const taskIds = taskList.map((t) => t.id);

      const [projRes, modRes, credsRes, attsRes] = await Promise.all([
        projectIds.length
          ? supabase.from("projects").select("id, title").in("id", projectIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        moduleIds.length
          ? supabase.from("modules").select("id, title").in("id", moduleIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        taskIds.length
          ? supabase.from("task_credentials").select("task_id").in("task_id", taskIds)
          : Promise.resolve({ data: [] as { task_id: string }[] }),
        taskIds.length
          ? supabase.from("task_attachments").select("task_id").in("task_id", taskIds)
          : Promise.resolve({ data: [] as { task_id: string }[] }),
      ]);

      const pMap: Record<string, string> = {};
      (projRes.data || []).forEach((p) => { pMap[p.id] = p.title; });
      const mMap: Record<string, string> = {};
      (modRes.data || []).forEach((m) => { mMap[m.id] = m.title; });
      const cMap: Record<string, number> = {};
      (credsRes.data || []).forEach((c) => { cMap[c.task_id] = (cMap[c.task_id] || 0) + 1; });
      const aMap: Record<string, number> = {};
      (attsRes.data || []).forEach((a) => { aMap[a.task_id] = (aMap[a.task_id] || 0) + 1; });
      setProjects(pMap);
      setModules(mMap);
      setCredCount(cMap);
      setAttCount(aMap);
      setLoading(false);
    })();
  }, [user?.id]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "active") return ["assigned", "in_progress", "blocked", "changes_requested"].includes(t.status);
      if (filter === "review") return t.status === "submitted";
      if (filter === "done") return t.status === "approved" || t.status === "rejected";
      return true;
    });
  }, [tasks, filter]);

  const counts = useMemo(() => ({
    active: tasks.filter((t) => ["assigned", "in_progress", "blocked", "changes_requested"].includes(t.status)).length,
    review: tasks.filter((t) => t.status === "submitted").length,
    done: tasks.filter((t) => t.status === "approved" || t.status === "rejected").length,
    all: tasks.length,
  }), [tasks]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading tasks…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            All work assigned to you. Click a task to open its workspace with timer, checklist, credentials and discussion.
          </p>
        </div>
        <Link to="/dashboard/projects" className="text-xs font-bold text-primary hover:underline">
          View by project →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 text-xs">
        <Filter className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        {([
          { v: "active", l: "Active", icon: <Clock className="h-3 w-3" />, n: counts.active },
          { v: "review", l: "Awaiting review", icon: <AlertCircle className="h-3 w-3" />, n: counts.review },
          { v: "done", l: "Completed", icon: <CheckCircle2 className="h-3 w-3" />, n: counts.done },
          { v: "all", l: "All", icon: null, n: counts.all },
        ] as const).map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`flex items-center gap-1 rounded px-3 py-1 font-bold ${
              filter === f.v ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            }`}
          >
            {f.icon} {f.l} <span className="opacity-70">({f.n})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          No tasks in this view.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((t) => (
            <TaskRow
              key={t.id}
              t={t}
              projectTitle={t.project_id ? projects[t.project_id] : null}
              moduleTitle={t.module_id ? modules[t.module_id] : null}
              credCount={credCount[t.id] || 0}
              attCount={attCount[t.id] || 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  t, projectTitle, moduleTitle, credCount, attCount,
}: {
  t: Task;
  projectTitle: string | null;
  moduleTitle: string | null;
  credCount: number;
  attCount: number;
}) {
  const dl = deadlineMeta(t.deadline);
  const checklist = t.checklist || [];
  const checklistDone = checklist.filter((c) => c.done).length;

  return (
    <li>
      <Link
        to="/dashboard/tasks/$taskId"
        params={{ taskId: t.id }}
        className="block rounded-md border bg-card p-4 shadow-sm transition hover:border-primary"
      >
        {(projectTitle || moduleTitle) && (
          <div className="mb-1 flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {projectTitle && (
              <span className="inline-flex items-center gap-1">
                <Folder className="h-3 w-3" /> {projectTitle}
              </span>
            )}
            {projectTitle && moduleTitle && <span className="opacity-60">/</span>}
            {moduleTitle && <span>{moduleTitle}</span>}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{t.title}</h3>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold capitalize ${statusBadge[t.status]}`}>
                {t.status.replace(/_/g, " ")}
              </span>
              <span className={`rounded px-2 py-0.5 text-[11px] capitalize ${priorityBadge[t.priority]}`}>
                {t.priority}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {t.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {t.estimate_hours != null && (
                <span className="text-muted-foreground">Est. {t.estimate_hours}h</span>
              )}
              {dl && (
                <span className={
                  dl.tone === "overdue" ? "font-bold text-destructive"
                  : dl.tone === "soon" ? "font-bold text-warning"
                  : "text-muted-foreground"
                }>
                  {dl.label}
                </span>
              )}
              {checklist.length > 0 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <ListChecks className="h-3 w-3" /> {checklistDone}/{checklist.length}
                </span>
              )}
              {credCount > 0 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" /> {credCount} credential{credCount !== 1 ? "s" : ""}
                </span>
              )}
              {attCount > 0 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  📎 {attCount} file{attCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {t.status === "blocked" && t.blocked_reason && (
              <div className="mt-2 inline-flex gap-1 rounded border border-warning/30 bg-warning/5 px-2 py-1 text-xs">
                <AlertTriangle className="h-3 w-3 text-warning" />
                <span><b>Blocked:</b> {t.blocked_reason}</span>
              </div>
            )}
            {t.status === "changes_requested" && t.review_notes && (
              <div className="mt-2 rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs">
                <b>Reviewer:</b> {t.review_notes}
              </div>
            )}
          </div>
          <span className="shrink-0 text-xs font-bold text-primary">Open →</span>
        </div>
      </Link>
    </li>
  );
}
