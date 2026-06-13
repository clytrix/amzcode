import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import {
  ArrowLeft, Plus, Trash2, Pencil, UserPlus, X, Link as LinkIcon,
  FileText, Users, Folder, ListChecks, Lock, Eye, EyeOff, Copy,
  ExternalLink, KanbanSquare, Settings,
} from "lucide-react";
import {
  updateProject, deleteProject, addProjectMember, removeProjectMember,
  addProjectResource, deleteProjectResource, upsertModule, deleteModule,
  createTaskRich, upsertCredential, deleteCredential, revealCredential,
  requestChanges, notifyModuleAssigned, adminSetTaskStatus,
} from "@/server/projects.functions";
import { notifyTaskAssigned } from "@/server/notifications.functions";

export const Route = createFileRoute("/admin/projects/$projectId")({
  component: AdminProjectDetail,
});

// ---------------------------------- types ----------------------------------

type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
type ModuleStatus = "todo" | "in_progress" | "review" | "done";
type TaskStatus =
  | "assigned" | "in_progress" | "blocked" | "submitted"
  | "approved" | "rejected" | "changes_requested";

type Profile = { id: string; full_name: string | null; email: string };
type Project = {
  id: string; title: string; description: string | null;
  status: ProjectStatus; owner_id: string | null; created_at: string;
};
type Module = {
  id: string; project_id: string; title: string; description: string | null;
  status: ModuleStatus; order_index: number;
};
type ChecklistItem = { id: string; text: string; done: boolean };
type Task = {
  id: string; user_id: string; project_id: string | null; module_id: string | null;
  title: string; description: string;
  status: TaskStatus; priority: "low" | "medium" | "high" | "urgent";
  reward_amount: number; deadline: string | null;
  estimate_hours: number | null;
  submission_notes: string | null; submission_url: string | null;
  review_notes: string | null;
  checklist: ChecklistItem[] | null;
  created_at: string;
};
type Member = { id: string; project_id: string; user_id: string; role: "lead" | "member" | "viewer" };
type Resource = {
  id: string; project_id: string; kind: "file" | "url"; label: string;
  url_or_path: string; notes: string | null;
};
type Credential = {
  id: string; task_id: string; label: string;
  username: string | null; url: string | null; notes: string | null;
};

// ---------------------------------- main ----------------------------------

const STATUS_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "submitted", label: "Submitted" },
  { key: "changes_requested", label: "Changes requested" },
  { key: "approved", label: "Approved" },
];

function AdminProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [credentialsByTask, setCredentialsByTask] = useState<Record<string, Credential[]>>({});
  const [loading, setLoading] = useState(true);

  const [editingProject, setEditingProject] = useState(false);
  const [moduleEditor, setModuleEditor] = useState<Module | "new" | null>(null);
  const [taskEditor, setTaskEditor] = useState<Task | { module_id?: string | null } | null>(null);
  const [credentialsTask, setCredentialsTask] = useState<Task | null>(null);

  const profilesById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])) as Record<string, Profile>,
    [employees],
  );

  const load = async () => {
    setLoading(true);
    const [{ data: proj }, { data: mods }, { data: ts }, { data: mem }, { data: res }, { data: emps }] =
      await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("modules").select("*").eq("project_id", projectId).order("order_index"),
        supabase.from("tasks").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("project_members").select("*").eq("project_id", projectId),
        supabase.from("project_resources").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
      ]);
    setProject((proj as Project) || null);
    setModules((mods as Module[]) || []);
    setTasks((ts as Task[]) || []);
    setMembers((mem as Member[]) || []);
    setResources((res as Resource[]) || []);
    setEmployees((emps as Profile[]) || []);

    const taskIds = ((ts as Task[]) || []).map((t) => t.id);
    if (taskIds.length) {
      const { data: creds } = await supabase
        .from("task_credentials")
        .select("id, task_id, label, username, url, notes")
        .in("task_id", taskIds);
      const grouped: Record<string, Credential[]> = {};
      ((creds as Credential[]) || []).forEach((c) => { (grouped[c.task_id] ||= []).push(c); });
      setCredentialsByTask(grouped);
    } else {
      setCredentialsByTask({});
    }

    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [projectId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading project…</div>;
  if (!project) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link to="/admin/projects" className="text-primary hover:underline">← Back to projects</Link>
      </div>
    );
  }

  const memberIds = new Set(members.map((m) => m.user_id));
  const memberProfiles = members
    .map((m) => ({ ...m, profile: profilesById[m.user_id] }))
    .filter((m) => m.profile);
  const totalReward = tasks.reduce((acc, t) => acc + Number(t.reward_amount || 0), 0);
  const approvedReward = tasks.filter((t) => t.status === "approved").reduce((acc, t) => acc + Number(t.reward_amount || 0), 0);

  const handleDeleteProject = async () => {
    if (!window.confirm("Delete this project? Modules, tasks, and resources will be removed.")) return;
    try {
      await deleteProject({ data: { id: project.id } });
      toast.success("Project deleted");
      navigate({ to: "/admin/projects" });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => navigate({ to: "/admin/projects" })}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold capitalize">
              {project.status.replace(/_/g, " ")}
            </span>
          </div>
          {project.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{tasks.length} tasks</span>
            <span>{modules.length} modules</span>
            <span>{members.length} members</span>
            <span>Approved payout: <b className="text-success">{inr(approvedReward)}</b></span>
            <span>Total budget: {inr(totalReward)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <AzButton size="sm" variant="outline" onClick={() => setEditingProject(true)}>
            <Settings className="h-3.5 w-3.5" /> Edit
          </AzButton>
          <AzButton size="sm" variant="destructive" onClick={handleDeleteProject}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </AzButton>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* main column: modules + kanban */}
        <div className="space-y-5 lg:col-span-2">
          <ModulesPanel
            project={project}
            modules={modules}
            tasks={tasks}
            employees={employees.filter((e) => memberIds.has(e.id) || memberIds.size === 0)}
            allEmployees={employees}
            credentialsByTask={credentialsByTask}
            profilesById={profilesById}
            onEditModule={(m) => setModuleEditor(m)}
            onAddModule={() => setModuleEditor("new")}
            onAddTask={(modId) => setTaskEditor({ module_id: modId ?? null })}
            onEditTask={(t) => setTaskEditor(t)}
            onManageCredentials={(t) => setCredentialsTask(t)}
            onChanged={load}
          />

          <KanbanPanel
            tasks={tasks}
            profilesById={profilesById}
            onEditTask={(t) => setTaskEditor(t)}
            onChanged={load}
          />
        </div>

        {/* right column: members + resources */}
        <div className="space-y-5">
          <MembersPanel
            project={project}
            members={memberProfiles}
            allEmployees={employees}
            onChanged={load}
          />
          <ResourcesPanel
            projectId={project.id}
            resources={resources}
            onChanged={load}
          />
        </div>
      </div>

      {editingProject && (
        <ProjectEditDialog
          project={project}
          onClose={() => setEditingProject(false)}
          onSaved={() => { setEditingProject(false); void load(); }}
        />
      )}
      {moduleEditor && (
        <ModuleEditDialog
          projectId={project.id}
          module={moduleEditor === "new" ? null : moduleEditor}
          nextOrder={modules.length}
          onClose={() => setModuleEditor(null)}
          onSaved={() => { setModuleEditor(null); void load(); }}
        />
      )}
      {taskEditor && (
        <TaskEditDialog
          projectId={project.id}
          modules={modules}
          employees={employees}
          memberIds={memberIds}
          existing={"id" in taskEditor ? (taskEditor as Task) : null}
          defaultModuleId={"module_id" in taskEditor ? (taskEditor as { module_id?: string | null }).module_id ?? null : null}
          onClose={() => setTaskEditor(null)}
          onSaved={() => { setTaskEditor(null); void load(); }}
        />
      )}
      {credentialsTask && (
        <CredentialsDialog
          task={credentialsTask}
          credentials={credentialsByTask[credentialsTask.id] || []}
          onClose={() => setCredentialsTask(null)}
          onSaved={() => { setCredentialsTask(null); void load(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------- modules ----------------------------------

function ModulesPanel({
  project, modules, tasks, employees, allEmployees, credentialsByTask, profilesById,
  onEditModule, onAddModule, onAddTask, onEditTask, onManageCredentials, onChanged,
}: {
  project: Project;
  modules: Module[];
  tasks: Task[];
  employees: Profile[];
  allEmployees: Profile[];
  credentialsByTask: Record<string, Credential[]>;
  profilesById: Record<string, Profile>;
  onEditModule: (m: Module) => void;
  onAddModule: () => void;
  onAddTask: (moduleId: string | null) => void;
  onEditTask: (t: Task) => void;
  onManageCredentials: (t: Task) => void;
  onChanged: () => void | Promise<void>;
}) {
  const tasksByModule = useMemo(() => {
    const map: Record<string, Task[]> = { __none: [] };
    tasks.forEach((t) => {
      const k = t.module_id || "__none";
      (map[k] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  const removeModule = async (m: Module) => {
    if (!window.confirm(`Delete module "${m.title}"? Tasks inside will lose their module link.`)) return;
    try { await deleteModule({ data: { id: m.id } }); toast.success("Module removed"); await onChanged(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <ListChecks className="h-4 w-4" /> Modules
        </h2>
        <AzButton size="sm" onClick={onAddModule}>
          <Plus className="h-3.5 w-3.5" /> New module
        </AzButton>
      </div>

      <div className="space-y-3">
        {modules.map((m) => (
          <ModuleRow
            key={m.id}
            module={m}
            tasks={tasksByModule[m.id] || []}
            credentialsByTask={credentialsByTask}
            profilesById={profilesById}
            onEdit={() => onEditModule(m)}
            onDelete={() => removeModule(m)}
            onAddTask={() => onAddTask(m.id)}
            onEditTask={onEditTask}
            onManageCredentials={onManageCredentials}
          />
        ))}

        {(tasksByModule.__none || []).length > 0 && (
          <ModuleRow
            module={{ id: "__none", project_id: project.id, title: "Unassigned tasks", description: null, status: "todo", order_index: 999 }}
            tasks={tasksByModule.__none || []}
            credentialsByTask={credentialsByTask}
            profilesById={profilesById}
            onEdit={() => {}}
            onDelete={() => {}}
            onAddTask={() => onAddTask(null)}
            onEditTask={onEditTask}
            onManageCredentials={onManageCredentials}
            isVirtual
          />
        )}

        {modules.length === 0 && (tasksByModule.__none || []).length === 0 && (
          <div className="rounded-md border border-dashed bg-secondary/30 p-6 text-center text-xs text-muted-foreground">
            No modules yet. Create one to break this project into deliverables.
          </div>
        )}
      </div>
    </section>
  );
}

const moduleStatusBadge: Record<ModuleStatus, string> = {
  todo: "bg-secondary text-foreground",
  in_progress: "bg-primary/15 text-primary",
  review: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
};
const taskStatusBadge: Record<TaskStatus, string> = {
  assigned: "bg-secondary text-foreground",
  in_progress: "bg-primary/15 text-primary",
  blocked: "bg-warning/20 text-warning",
  submitted: "bg-warning/15 text-warning",
  changes_requested: "bg-destructive/15 text-destructive",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

function ModuleRow({
  module: m, tasks, credentialsByTask, profilesById, onEdit, onDelete, onAddTask,
  onEditTask, onManageCredentials, isVirtual = false,
}: {
  module: Module; tasks: Task[];
  credentialsByTask: Record<string, Credential[]>;
  profilesById: Record<string, Profile>;
  onEdit: () => void; onDelete: () => void; onAddTask: () => void;
  onEditTask: (t: Task) => void; onManageCredentials: (t: Task) => void;
  isVirtual?: boolean;
}) {
  return (
    <div className="rounded-md border bg-secondary/20">
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <b className="truncate">{m.title}</b>
          {!isVirtual && (
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold capitalize ${moduleStatusBadge[m.status]}`}>
              {m.status.replace(/_/g, " ")}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={onAddTask} className="rounded p-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" title="Add task">
            <Plus className="h-3.5 w-3.5" />
          </button>
          {!isVirtual && (
            <>
              <button onClick={onEdit} className="rounded p-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" title="Edit module">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} className="rounded p-1 text-xs text-destructive hover:bg-destructive/10" title="Delete module">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {!isVirtual && m.description && (
        <p className="border-b bg-card px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">{m.description}</p>
      )}

      <ul className="divide-y">
        {tasks.map((t) => {
          const credCount = (credentialsByTask[t.id] || []).length;
          const assignee = profilesById[t.user_id];
          return (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-card">
              <button onClick={() => onEditTask(t)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{t.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${taskStatusBadge[t.status]}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{assignee?.full_name || assignee?.email || "Unassigned"}</span>
                  <span>{inr(t.reward_amount)}</span>
                  {t.deadline && <span>Due {new Date(t.deadline).toLocaleDateString("en-IN")}</span>}
                </div>
              </button>
              <button
                onClick={() => onManageCredentials(t)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-secondary ${credCount > 0 ? "text-primary" : "text-muted-foreground"}`}
                title="Credentials">
                <Lock className="h-3 w-3" /> {credCount}
              </button>
            </li>
          );
        })}
        {tasks.length === 0 && (
          <li className="px-3 py-3 text-xs text-muted-foreground">
            No tasks in this module yet.{" "}
            <button onClick={onAddTask} className="font-medium text-primary hover:underline">Add one →</button>
          </li>
        )}
      </ul>
    </div>
  );
}

// ---------------------------------- kanban ----------------------------------

function KanbanPanel({
  tasks, profilesById, onEditTask, onChanged,
}: {
  tasks: Task[];
  profilesById: Record<string, Profile>;
  onEditTask: (t: Task) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const assignees = useMemo(() => {
    const ids = Array.from(new Set(tasks.map((t) => t.user_id)));
    return ids.map((id) => profilesById[id]).filter(Boolean) as Profile[];
  }, [tasks, profilesById]);

  const visible = useMemo(
    () => (assigneeFilter === "all" ? tasks : tasks.filter((t) => t.user_id === assigneeFilter)),
    [tasks, assigneeFilter],
  );

  const onDrop = async (col: TaskStatus) => {
    setOverCol(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === col) return;
    setSavingId(id);
    try {
      await adminSetTaskStatus({ data: { task_id: id, status: col } });
      toast.success(`Moved to ${col.replace(/_/g, " ")}`);
      await onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingId(null); }
  };

  if (tasks.length === 0) return null;

  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <KanbanSquare className="h-4 w-4" /> Pipeline
          <span className="text-[11px] font-normal normal-case text-muted-foreground/70">
            (drag cards between columns)
          </span>
        </h2>
        {assignees.length > 0 && (
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded border border-input bg-white px-2 py-1 text-xs"
            aria-label="Filter by assignee"
          >
            <option value="all">All assignees ({tasks.length})</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name || a.email} ({tasks.filter((t) => t.user_id === a.id).length})
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STATUS_COLUMNS.map((col) => {
          const items = visible.filter((t) => t.status === col.key);
          const isOver = overCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => onDrop(col.key)}
              className={`min-w-[200px] flex-1 rounded-md p-2 transition ${
                isOver ? "bg-primary/10 ring-2 ring-primary" : "bg-secondary/30"
              }`}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>{col.label}</span>
                <span className="rounded bg-card px-1.5 py-0.5 text-[10px]">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((t) => {
                  const a = profilesById[t.user_id];
                  const dragging = dragId === t.id;
                  const saving = savingId === t.id;
                  return (
                    <div
                      key={t.id}
                      draggable={!saving}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onClick={() => onEditTask(t)}
                      className={`block w-full cursor-grab rounded border bg-card p-2 text-left text-xs shadow-sm transition hover:border-primary active:cursor-grabbing ${
                        dragging ? "opacity-40" : ""
                      } ${saving ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <div className="font-medium">{t.title}</div>
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">{a?.full_name || a?.email}</div>
                      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{inr(t.reward_amount)}</span>
                        {t.deadline && <span>{new Date(t.deadline).toLocaleDateString("en-IN")}</span>}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="rounded border border-dashed p-2 text-center text-[11px] text-muted-foreground">
                    {isOver ? "Drop here" : "—"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------- members ----------------------------------

function MembersPanel({
  project, members, allEmployees, onChanged,
}: {
  project: Project;
  members: (Member & { profile: Profile })[];
  allEmployees: Profile[];
  onChanged: () => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"lead" | "member" | "viewer">("member");
  const [busy, setBusy] = useState(false);

  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = allEmployees.filter((e) => !memberIds.has(e.id));

  const add = async () => {
    if (!userId) return toast.error("Pick an employee");
    setBusy(true);
    try {
      await addProjectMember({ data: { project_id: project.id, user_id: userId, role } });
      toast.success("Member added");
      setAdding(false); setUserId(""); setRole("member");
      await onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (m: Member) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await removeProjectMember({ data: { project_id: project.id, user_id: m.user_id } });
      toast.success("Removed");
      await onChanged();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Users className="h-4 w-4" /> Team ({members.length})
        </h2>
        <AzButton size="sm" onClick={() => setAdding(!adding)}>
          <UserPlus className="h-3.5 w-3.5" /> Add
        </AzButton>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded border bg-secondary/30 p-2">
          <select value={userId} onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded border border-input bg-white px-2 py-1 text-sm">
            <option value="">— select employee —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}
              className="flex-1 rounded border border-input bg-white px-2 py-1 text-xs">
              <option value="lead">Lead</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <AzButton size="sm" disabled={busy || !userId} onClick={add}>Add</AzButton>
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded bg-secondary/30 px-2 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{m.profile.full_name || m.profile.email}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{m.role}</div>
            </div>
            <button onClick={() => remove(m)} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {members.length === 0 && (
          <li className="rounded border border-dashed py-3 text-center text-xs text-muted-foreground">
            No members yet. Add employees so they can see this project.
          </li>
        )}
      </ul>
    </section>
  );
}

// ---------------------------------- resources ----------------------------------

function ResourcesPanel({
  projectId, resources, onChanged,
}: { projectId: string; resources: Resource[]; onChanged: () => void | Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: "url" as "url" | "file", label: "", url_or_path: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!form.label.trim() || !form.url_or_path.trim()) return toast.error("Label and URL required");
    setBusy(true);
    try {
      await addProjectResource({ data: {
        project_id: projectId, kind: form.kind, label: form.label.trim(),
        url_or_path: form.url_or_path.trim(), notes: form.notes || null,
      }});
      toast.success("Resource added");
      setAdding(false); setForm({ kind: "url", label: "", url_or_path: "", notes: "" });
      await onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (r: Resource) => {
    if (!window.confirm(`Remove "${r.label}"?`)) return;
    try { await deleteProjectResource({ data: { id: r.id } }); toast.success("Removed"); await onChanged(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Folder className="h-4 w-4" /> Resources ({resources.length})
        </h2>
        <AzButton size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-3.5 w-3.5" /> Add
        </AzButton>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded border bg-secondary/30 p-2">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "url" | "file" })}
            className="w-full rounded border border-input bg-white px-2 py-1 text-xs">
            <option value="url">Link / URL</option>
            <option value="file">File path / link</option>
          </select>
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label (e.g. Brand kit)"
            className="w-full rounded border border-input bg-white px-2 py-1 text-sm" />
          <input value={form.url_or_path} onChange={(e) => setForm({ ...form, url_or_path: e.target.value })} placeholder="https://… or file URL"
            className="w-full rounded border border-input bg-white px-2 py-1 text-sm" />
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)"
            className="w-full rounded border border-input bg-white px-2 py-1 text-xs" />
          <AzButton size="sm" disabled={busy} onClick={add}>Save resource</AzButton>
        </div>
      )}

      <ul className="space-y-1.5">
        {resources.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-2 rounded bg-secondary/30 px-2 py-1.5 text-sm">
            <div className="min-w-0 flex-1">
              <a href={r.url_or_path} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 truncate font-medium text-primary hover:underline">
                {r.kind === "file" ? <FileText className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                {r.label}
              </a>
              {r.notes && <div className="text-[11px] text-muted-foreground">{r.notes}</div>}
            </div>
            <button onClick={() => remove(r)} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {resources.length === 0 && (
          <li className="rounded border border-dashed py-3 text-center text-xs text-muted-foreground">
            Share docs, brand kits, or reference links so the team can find them quickly.
          </li>
        )}
      </ul>
    </section>
  );
}

// ---------------------------------- dialogs ----------------------------------

function Modal({ title, onClose, children, wide = false }:
  { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className={`mt-12 w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-md border bg-card shadow-xl`}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function ProjectEditDialog({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: project.title, description: project.description || "", status: project.status,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await updateProject({ data: { id: project.id, title: form.title, description: form.description || null, status: form.status } });
      toast.success("Saved");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Edit project" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
            className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <AzButton variant="outline" onClick={onClose}>Cancel</AzButton>
          <AzButton variant="brand" disabled={busy} onClick={save}>Save</AzButton>
        </div>
      </div>
    </Modal>
  );
}

function ModuleEditDialog({
  projectId, module: m, nextOrder, onClose, onSaved,
}: { projectId: string; module: Module | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: m?.title || "",
    description: m?.description || "",
    status: (m?.status || "todo") as ModuleStatus,
    order_index: m?.order_index ?? nextOrder,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setBusy(true);
    try {
      await upsertModule({ data: {
        id: m?.id, project_id: projectId,
        title: form.title.trim(), description: form.description || null,
        status: form.status, order_index: form.order_index,
      }});
      toast.success(m ? "Module updated" : "Module created");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={m ? "Edit module" : "New module"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ModuleStatus })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="todo">Todo</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </Field>
          <Field label="Order">
            <input type="number" min={0} value={form.order_index}
              onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value || "0", 10) })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <AzButton variant="outline" onClick={onClose}>Cancel</AzButton>
          <AzButton variant="brand" disabled={busy} onClick={save}>Save</AzButton>
        </div>
      </div>
    </Modal>
  );
}

function TaskEditDialog({
  projectId, modules, employees, memberIds, existing, defaultModuleId, onClose, onSaved,
}: {
  projectId: string; modules: Module[]; employees: Profile[]; memberIds: Set<string>;
  existing: Task | null; defaultModuleId: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    user_id: existing?.user_id || "",
    module_id: existing?.module_id || defaultModuleId || "",
    title: existing?.title || "",
    description: existing?.description || "",
    reward_amount: existing?.reward_amount ?? 500,
    deadline: existing?.deadline ? existing.deadline.slice(0, 16) : "",
    priority: (existing?.priority || "medium") as Task["priority"],
    estimate_hours: existing?.estimate_hours ?? 0,
    review_notes: "",
    checklist: (existing?.checklist || []) as ChecklistItem[],
  });
  const [newCheckText, setNewCheckText] = useState("");
  const [busy, setBusy] = useState(false);

  const employeeOptions = employees;
  // Suggest project members at the top
  const memberFirst = [...employeeOptions].sort((a, b) => Number(memberIds.has(b.id)) - Number(memberIds.has(a.id)));

  const addCheck = () => {
    if (!newCheckText.trim()) return;
    setForm({ ...form, checklist: [...form.checklist, { id: crypto.randomUUID().slice(0, 8), text: newCheckText.trim(), done: false }] });
    setNewCheckText("");
  };
  const removeCheck = (id: string) => setForm({ ...form, checklist: form.checklist.filter((c) => c.id !== id) });

  const save = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.user_id) {
      return toast.error("Title, description, and assignee required");
    }
    setBusy(true);
    try {
      if (existing) {
        const { error } = await supabase.from("tasks").update({
          title: form.title.trim(),
          description: form.description.trim(),
          reward_amount: Number(form.reward_amount) || 0,
          deadline: form.deadline || null,
          priority: form.priority,
          estimate_hours: form.estimate_hours || null,
          module_id: form.module_id || null,
          checklist: form.checklist,
          user_id: form.user_id,
        }).eq("id", existing.id);
        if (error) throw new Error(error.message);
        toast.success("Task updated");
      } else {
        const res = await createTaskRich({ data: {
          user_id: form.user_id,
          project_id: projectId,
          module_id: form.module_id || null,
          title: form.title.trim(),
          description: form.description.trim(),
          reward_amount: Number(form.reward_amount) || 0,
          deadline: form.deadline || null,
          priority: form.priority,
          estimate_hours: form.estimate_hours || null,
          checklist: form.checklist,
        }});
        try { await notifyTaskAssigned({ data: { task_id: res.id } }); } catch { /* email errors are non-fatal */ }
        toast.success("Task assigned");
      }
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const requestChangesAction = async () => {
    if (!existing) return;
    if (!form.review_notes.trim()) return toast.error("Add review notes");
    setBusy(true);
    try {
      await requestChanges({ data: { task_id: existing.id, notes: form.review_notes.trim() } });
      toast.success("Changes requested");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={existing ? `Edit task — ${existing.title}` : "New task"} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee">
            <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="">— select —</option>
              {memberFirst.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name || e.email}{memberIds.has(e.id) ? " ★" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Module">
            <select value={form.module_id} onChange={(e) => setForm({ ...form, module_id: e.target.value })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="">No module</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
        </Field>
        <Field label="Description (Markdown supported)">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={5} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
        </Field>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Reward (₹)">
            <input type="number" min={0} value={form.reward_amount}
              onChange={(e) => setForm({ ...form, reward_amount: Number(e.target.value) })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </Field>
          <Field label="Estimate (hrs)">
            <input type="number" min={0} step={0.5} value={form.estimate_hours}
              onChange={(e) => setForm({ ...form, estimate_hours: Number(e.target.value) })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field label="Deadline">
            <input type="datetime-local" value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </Field>
        </div>

        <Field label="Acceptance checklist">
          <ul className="space-y-1">
            {form.checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded bg-secondary/30 px-2 py-1 text-sm">
                <span className="flex-1">{c.text}</span>
                <button onClick={() => removeCheck(c.id)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            <li className="flex gap-2">
              <input value={newCheckText} onChange={(e) => setNewCheckText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheck(); } }}
                placeholder="Add a checklist item…"
                className="flex-1 rounded border border-input bg-white px-2 py-1 text-sm" />
              <AzButton size="sm" type="button" onClick={addCheck}>Add</AzButton>
            </li>
          </ul>
        </Field>

        {existing && existing.status === "submitted" && (
          <div className="space-y-2 rounded border border-warning/40 bg-warning/5 p-3">
            <Field label="Request changes (notes for the employee)">
              <textarea value={form.review_notes} onChange={(e) => setForm({ ...form, review_notes: e.target.value })}
                rows={2} placeholder="What needs to change before approval?"
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </Field>
            <AzButton size="sm" variant="destructive" disabled={busy} onClick={requestChangesAction}>
              Request changes
            </AzButton>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <AzButton variant="outline" onClick={onClose}>Cancel</AzButton>
          <AzButton variant="brand" disabled={busy} onClick={save}>
            {existing ? "Save changes" : "Create task"}
          </AzButton>
        </div>
      </div>
    </Modal>
  );
}

function CredentialsDialog({
  task, credentials, onClose, onSaved,
}: { task: Task; credentials: Credential[]; onClose: () => void; onSaved: () => void }) {
  const [adding, setAdding] = useState(credentials.length === 0);
  const [form, setForm] = useState({ label: "", username: "", password: "", url: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!form.label.trim() || !form.password.trim()) return toast.error("Label and password required");
    setBusy(true);
    try {
      await upsertCredential({ data: {
        task_id: task.id, label: form.label.trim(),
        username: form.username || null, password: form.password,
        url: form.url || null, notes: form.notes || null,
      }});
      toast.success("Credential saved (encrypted)");
      setForm({ label: "", username: "", password: "", url: "", notes: "" });
      setAdding(false);
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (c: Credential) => {
    if (!window.confirm(`Delete credential "${c.label}"?`)) return;
    try { await deleteCredential({ data: { id: c.id } }); toast.success("Removed"); onSaved(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Modal title={`Credentials — ${task.title}`} onClose={onClose}>
      <p className="mb-3 flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Passwords are encrypted with AES-256-GCM and only revealed to the assignee or admins.
        Every reveal is logged.
      </p>

      <ul className="space-y-2">
        {credentials.map((c) => <AdminCredentialRow key={c.id} cred={c} onRemove={() => remove(c)} />)}
      </ul>

      {adding ? (
        <div className="mt-4 space-y-2 rounded border bg-secondary/30 p-3">
          <Field label="Label"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Username"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" /></Field>
            <Field label="Password"><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded border border-input bg-white px-3 py-2 text-sm font-mono" /></Field>
          </div>
          <Field label="URL"><input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className="w-full rounded border border-input bg-white px-3 py-2 text-sm" /></Field>
          <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <AzButton size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</AzButton>
            <AzButton size="sm" variant="brand" disabled={busy} onClick={add}>Save credential</AzButton>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <AzButton size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add credential
          </AzButton>
        </div>
      )}
    </Modal>
  );
}

function AdminCredentialRow({ cred, onRemove }: { cred: Credential; onRemove: () => void }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reveal = async () => {
    setBusy(true);
    try {
      const res = await revealCredential({ data: { credential_id: cred.id } });
      setRevealed(res.password);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const copy = (text: string, label: string) => { void navigator.clipboard.writeText(text); toast.success(`${label} copied`); };
  return (
    <li className="rounded border bg-secondary/30 p-3 text-sm">
      <div className="flex items-center justify-between">
        <b>{cred.label}</b>
        <button onClick={onRemove} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {cred.url && (
        <a href={cred.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {cred.url} <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {cred.username && (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">User:</span>
          <span className="flex items-center gap-1 font-mono">
            {cred.username}
            <button onClick={() => copy(cred.username || "", "Username")} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
          </span>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Password:</span>
        {revealed ? (
          <span className="flex items-center gap-1 font-mono">
            {revealed}
            <button onClick={() => copy(revealed, "Password")} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
            <button onClick={() => setRevealed(null)} className="text-muted-foreground hover:text-foreground"><EyeOff className="h-3 w-3" /></button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold">{label}</span>
      {children}
    </label>
  );
}
