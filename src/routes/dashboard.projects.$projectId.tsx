import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { JobRequiredGate } from "@/components/job-required-gate";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import {
  ArrowLeft, Folder, Link as LinkIcon, ListChecks, Clock,
  CheckCircle2, AlertTriangle, ExternalLink, Users,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/projects/$projectId")({
  component: ProjectDetailGated,
});

function ProjectDetailGated() {
  return (
    <JobRequiredGate feature="Project workspace">
      <ProjectDetail />
    </JobRequiredGate>
  );
}

type Project = {
  id: string; title: string; description: string | null;
  status: string; created_at: string;
};
type Module = {
  id: string; project_id: string; title: string;
  description: string | null; status: string; order_index: number;
};
type Task = {
  id: string; user_id: string; project_id: string | null; module_id: string | null;
  title: string; description: string; status: string;
  priority: string; reward_amount: number; deadline: string | null;
};
type Resource = {
  id: string; project_id: string; kind: "file" | "url";
  label: string; url_or_path: string; notes: string | null;
};
type Member = {
  id: string; project_id: string; user_id: string; role: string;
};
type Profile = { id: string; full_name: string | null; email: string };

const taskStatusBadge: Record<string, string> = {
  assigned: "bg-secondary text-foreground",
  in_progress: "bg-primary/15 text-primary",
  blocked: "bg-warning/20 text-warning",
  submitted: "bg-warning/15 text-warning",
  changes_requested: "bg-destructive/15 text-destructive",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};
const moduleStatusBadge: Record<string, string> = {
  todo: "bg-secondary text-foreground",
  in_progress: "bg-primary/15 text-primary",
  review: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
};
const priorityBadge: Record<string, string> = {
  low: "bg-secondary text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive font-bold",
};

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const [{ data: proj }, { data: mods }, { data: ts }, { data: rs }, { data: mems }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("modules").select("*").eq("project_id", projectId).order("order_index"),
        supabase.from("tasks").select("*").eq("project_id", projectId).eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("project_resources").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("project_members").select("*").eq("project_id", projectId),
      ]);
      setProject((proj as Project) || null);
      setModules((mods as Module[]) || []);
      setTasks((ts as Task[]) || []);
      setResources((rs as Resource[]) || []);
      setMembers((mems as Member[]) || []);

      const memberIds = ((mems as Member[]) || []).map((m) => m.user_id);
      if (memberIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name, email").in("id", memberIds);
        const map: Record<string, Profile> = {};
        (profs || []).forEach((p) => { map[p.id] = p as Profile; });
        setProfilesById(map);
      }
      setLoading(false);
    })();
  }, [projectId, user?.id]);

  const tasksByModule = useMemo(() => {
    const map: Record<string, Task[]> = { __none: [] };
    tasks.forEach((t) => {
      const k = t.module_id || "__none";
      (map[k] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading project…</div>;
  if (!project) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-muted-foreground">Project not found or you don't have access.</p>
        <Link to="/dashboard/projects" className="text-primary hover:underline">← Back to projects</Link>
      </div>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "approved").length;
  const earned = tasks.filter((t) => t.status === "approved").reduce((acc, t) => acc + Number(t.reward_amount || 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => navigate({ to: "/dashboard/projects" })}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold capitalize">
            {project.status.replace(/_/g, " ")}
          </span>
        </div>
        {project.description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground whitespace-pre-wrap">
            {project.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{totalTasks} of your tasks</span>
          <span>{doneTasks} approved</span>
          {earned > 0 && <span>Earned: <b className="text-success">{inr(earned)}</b></span>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <ListChecks className="h-4 w-4" /> Modules &amp; tasks
            </h2>

            {modules.length === 0 && tasks.length === 0 && (
              <div className="rounded-md border border-dashed bg-secondary/30 p-6 text-center text-xs text-muted-foreground">
                No modules or tasks yet.
              </div>
            )}

            <div className="space-y-3">
              {modules.map((m) => {
                const mTasks = tasksByModule[m.id] || [];
                if (mTasks.length === 0) return null;
                return (
                  <ModuleBlock key={m.id} module={m} tasks={mTasks} />
                );
              })}
              {(tasksByModule.__none || []).length > 0 && (
                <ModuleBlock
                  module={{
                    id: "__none", project_id: project.id, title: "Other tasks",
                    description: null, status: "todo", order_index: 999,
                  }}
                  tasks={tasksByModule.__none}
                  isVirtual
                />
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {resources.length > 0 && (
            <section className="rounded-md border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Folder className="h-4 w-4" /> Shared resources
              </h2>
              <ul className="space-y-2 text-sm">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <span className="mt-0.5">
                      {r.kind === "file" ? <Folder className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={r.url_or_path}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {r.label} <ExternalLink className="h-3 w-3" />
                      </a>
                      {r.notes && (
                        <div className="text-xs text-muted-foreground">{r.notes}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {members.length > 0 && (
            <section className="rounded-md border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-4 w-4" /> Team
              </h2>
              <ul className="space-y-2 text-sm">
                {members.map((m) => {
                  const p = profilesById[m.user_id];
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{p?.full_name || p?.email || "Member"}</span>
                      <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold capitalize">
                        {m.role}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleBlock({ module: m, tasks, isVirtual = false }: { module: Module; tasks: Task[]; isVirtual?: boolean }) {
  return (
    <div className="rounded-md border bg-secondary/20">
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <b className="truncate">{m.title}</b>
          {!isVirtual && (
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold capitalize ${moduleStatusBadge[m.status] || moduleStatusBadge.todo}`}>
              {m.status.replace(/_/g, " ")}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      {!isVirtual && m.description && (
        <p className="border-b bg-card px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {m.description}
        </p>
      )}
      <ul className="divide-y">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link
              to="/dashboard/tasks/$taskId"
              params={{ taskId: t.id }}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{t.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${taskStatusBadge[t.status] || ""}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] capitalize ${priorityBadge[t.priority] || ""}`}>
                    {t.priority}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Reward {inr(t.reward_amount)}
                  {t.deadline && <> · Due {new Date(t.deadline).toLocaleDateString("en-IN")}</>}
                </div>
              </div>
              <span className="text-xs text-primary">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
