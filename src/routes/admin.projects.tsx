import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import {
  Plus, FolderKanban, Search, RefreshCw, X, Loader2,
  Sparkles, ListChecks, Users, CalendarDays, ArrowRight,
} from "lucide-react";
import { createProject } from "@/server/projects.functions";

export const Route = createFileRoute("/admin/projects")({ component: AdminProjectsLayout });

function AdminProjectsLayout() {
  const matches = useMatches();
  const hasChild = matches.some((m) => m.routeId.startsWith("/admin/projects/$"));
  if (hasChild) return <Outlet />;
  return <AdminProjects />;
}

type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
type Project = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
};
type ProjectStats = {
  members: number;
  tasks: number;
  approved: number;
  modules: number;
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planning",  label: "Planning" },
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning:  "bg-secondary text-foreground",
  active:    "bg-primary/15 text-primary",
  on_hold:   "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  archived:  "bg-muted text-muted-foreground",
};

type FilterValue = "all" | ProjectStatus;

function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, description, status, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setProjects([]);
      setStats({});
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError(null);
    const list = (data as Project[]) || [];
    setProjects(list);

    // Pull counts for each project in parallel — small fan-out, fine for a list page.
    if (list.length) {
      const projIds = list.map((p) => p.id);
      const [{ data: mems }, { data: ts }, { data: mods }] = await Promise.all([
        supabase.from("project_members").select("project_id").in("project_id", projIds),
        supabase.from("tasks").select("project_id, status").in("project_id", projIds),
        supabase.from("modules").select("project_id").in("project_id", projIds),
      ]);
      const next: Record<string, ProjectStats> = {};
      list.forEach((p) => { next[p.id] = { members: 0, tasks: 0, approved: 0, modules: 0 }; });
      (mems || []).forEach((m) => { if (m.project_id && next[m.project_id]) next[m.project_id].members++; });
      (mods || []).forEach((m) => { if (m.project_id && next[m.project_id]) next[m.project_id].modules++; });
      (ts || []).forEach((t) => {
        if (!t.project_id || !next[t.project_id]) return;
        next[t.project_id].tasks++;
        if (t.status === "approved") next[t.project_id].approved++;
      });
      setStats(next);
    } else {
      setStats({});
    }

    setLoading(false);
    setRefreshing(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    });
  }, [projects, search, filter]);

  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = {
      all: projects.length, planning: 0, active: 0, on_hold: 0, completed: 0, archived: 0,
    };
    projects.forEach((p) => { c[p.status]++; });
    return c;
  }, [projects]);

  const totalTasks    = Object.values(stats).reduce((a, s) => a + s.tasks, 0);
  const totalApproved = Object.values(stats).reduce((a, s) => a + s.approved, 0);
  const activeCount   = counts.active;

  const handleCreated = async (newId: string) => {
    setShowCreate(false);
    // Optimistic toast then refresh — the new row should appear at top
    toast.success("Project created", { description: "Opening the workspace…" });
    await load(true);
    // eslint-disable-next-line no-console
    console.info("[projects] created", newId);
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Group related tasks into projects with shared modules, members, resources and a credential vault.
          </p>
        </div>
        <div className="flex gap-2">
          <AzButton size="sm" variant="outline" disabled={refreshing} onClick={() => load(true)}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </AzButton>
          <AzButton variant="brand" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New project
          </AzButton>
        </div>
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<FolderKanban className="h-4 w-4" />} label="Total projects" value={String(projects.length)} />
        <StatCard icon={<Sparkles className="h-4 w-4 text-primary" />} label="Active" value={String(activeCount)} hint={`${counts.planning} planning`} />
        <StatCard icon={<ListChecks className="h-4 w-4" />} label="Open tasks" value={String(totalTasks - totalApproved)} hint={`${totalApproved} approved`} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Total tasks" value={String(totalTasks)} />
      </div>

      {/* search + filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
            className="w-full rounded border border-input bg-white pl-8 pr-8 py-2 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-secondary"
              aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...STATUS_OPTIONS.map((s) => s.value)] as FilterValue[]).map((f) => {
            const label = f === "all" ? "All" : STATUS_OPTIONS.find((s) => s.value === f)!.label;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card hover:border-primary/40"
                }`}
              >
                {label}
                <span className={`ml-1.5 ${active ? "opacity-90" : "text-muted-foreground"}`}>{counts[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          Failed to load projects: {loadError}
        </div>
      )}

      {/* list */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-md border bg-card" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : filtered.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No projects match "{search || filter}". Try clearing filters.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} stats={stats[p.id]} />
          ))}
        </div>
      )}

      <div className="rounded-md border border-dashed bg-secondary/30 p-4 text-xs text-muted-foreground">
        💡 Inside each project: modules, kanban board, encrypted credential vault, member roster and shared resources.
        Use the <Link to="/admin/tasks" className="font-bold text-primary hover:underline">Tasks page</Link> to jump straight to a task.
      </div>

      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

// ---------------------------------- pieces ----------------------------------

function StatCard({
  icon, label, value, hint,
}: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ProjectCard({ project, stats }: { project: Project; stats?: ProjectStats }) {
  const created = new Date(project.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const tasks    = stats?.tasks    ?? 0;
  const approved = stats?.approved ?? 0;
  const members  = stats?.members  ?? 0;
  const modules  = stats?.modules  ?? 0;
  const progress = tasks ? Math.round((approved / tasks) * 100) : 0;

  return (
    <Link
      to="/admin/projects/$projectId"
      params={{ projectId: project.id }}
      className="group block rounded-md border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold group-hover:text-primary">{project.title}</h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_COLORS[project.status]}`}>
          {project.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Mini icon={<ListChecks className="h-3 w-3" />} label="Tasks"   value={String(tasks)} />
        <Mini icon={<Users      className="h-3 w-3" />} label="Members" value={String(members)} />
        <Mini icon={<FolderKanban className="h-3 w-3" />} label="Modules" value={String(modules)} />
      </div>

      {tasks > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Progress</span><span>{approved}/{tasks} · {progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {created}</span>
        <span className="inline-flex items-center gap-1 font-bold text-primary opacity-0 transition group-hover:opacity-100">
          Open <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border bg-secondary/30 px-1 py-1.5">
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-md border-2 border-dashed bg-card p-10 text-center">
      <FolderKanban className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
      <h3 className="text-base font-bold">No projects yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Projects are workspaces that bundle modules, tasks, members, files and a secure credentials vault for your remote team.
      </p>
      <div className="mt-4">
        <AzButton variant="brand" onClick={onCreate}>
          <Plus className="h-4 w-4" /> Create your first project
        </AzButton>
      </div>
    </div>
  );
}

// ---------------------------------- create dialog ----------------------------------

function CreateProjectDialog({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const [form, setForm] = useState<{ title: string; description: string; status: ProjectStatus }>({
    title: "", description: "", status: "planning",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim()) {
      setFormError("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createProject({
        data: {
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: form.status,
        },
      });
      await onCreated(res.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      setFormError(msg);
      toast.error(msg);
      // eslint-disable-next-line no-console
      console.error("[projects] create failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-md border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">New project</h2>
            <p className="text-xs text-muted-foreground">
              Start with the basics — you can add modules, tasks, members and credentials right after.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold">Project title <span className="text-destructive">*</span></span>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            autoFocus
            maxLength={200}
            placeholder="e.g. Amazon Catalog Cleanup — Q3"
            className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            maxLength={5000}
            placeholder="What's this project about? Goals, scope, anything teammates should know upfront."
            className="w-full resize-y rounded border border-input bg-white px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">{form.description.length}/5000</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold">Initial status</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
            className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        {formError && (
          <p className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {formError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <AzButton type="button" variant="outline" disabled={submitting} onClick={onClose}>Cancel</AzButton>
          <AzButton variant="brand" disabled={submitting}>
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>) : (<><Plus className="h-4 w-4" /> Create project</>)}
          </AzButton>
        </div>
      </form>
    </div>
  );
}
