import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { JobRequiredGate } from "@/components/job-required-gate";
import { FolderKanban, ListChecks, Clock, CheckCircle2 } from "lucide-react";
import { inr } from "@/lib/currency";

export const Route = createFileRoute("/dashboard/projects")({
  component: DashboardProjectsLayout,
});

function DashboardProjectsLayout() {
  const matches = useMatches();
  const hasChild = matches.some((m) => m.routeId.startsWith("/dashboard/projects/$"));
  if (hasChild) return <Outlet />;
  return (
    <JobRequiredGate feature="Projects">
      <ProjectsList />
    </JobRequiredGate>
  );
}

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
};

type Stats = {
  total: number;
  active: number;
  done: number;
  earned: number;
};

function ProjectsList() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      // Get project IDs the user is a member of OR has tasks in.
      const [{ data: memberRows }, { data: taskRows }] = await Promise.all([
        supabase.from("project_members").select("project_id").eq("user_id", user.id),
        supabase.from("tasks").select("project_id, status, reward_amount").eq("user_id", user.id),
      ]);
      const ids = new Set<string>();
      (memberRows || []).forEach((r) => r.project_id && ids.add(r.project_id));
      (taskRows || []).forEach((t) => t.project_id && ids.add(t.project_id));

      if (ids.size === 0) {
        setProjects([]);
        setStats({});
        setLoading(false);
        return;
      }

      const { data: projs } = await supabase
        .from("projects")
        .select("id, title, description, status, created_at")
        .in("id", Array.from(ids))
        .order("created_at", { ascending: false });

      const statsMap: Record<string, Stats> = {};
      (taskRows || []).forEach((t) => {
        if (!t.project_id) return;
        const s = (statsMap[t.project_id] ||= { total: 0, active: 0, done: 0, earned: 0 });
        s.total += 1;
        if (t.status === "approved") {
          s.done += 1;
          s.earned += Number(t.reward_amount || 0);
        } else if (t.status === "assigned" || t.status === "in_progress" || t.status === "blocked" || t.status === "submitted" || t.status === "changes_requested") {
          s.active += 1;
        }
      });

      setProjects((projs as Project[]) || []);
      setStats(statsMap);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading projects…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Projects</h1>
        <p className="text-sm text-muted-foreground">
          Workspaces where your tasks live. Open a project to see modules, shared resources, and credentials.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          <FolderKanban className="mx-auto mb-3 h-8 w-8 opacity-50" />
          You're not on any projects yet. Tasks assigned without a project will still appear in{" "}
          <Link to="/dashboard/tasks" className="font-bold text-primary hover:underline">My Tasks</Link>.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const s = stats[p.id] || { total: 0, active: 0, done: 0, earned: 0 };
            return (
              <Link
                key={p.id}
                to="/dashboard/projects/$projectId"
                params={{ projectId: p.id }}
                className="block rounded-md border bg-card p-4 shadow-sm transition hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-bold">{p.title}</h3>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold capitalize">
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <ListChecks className="h-3 w-3" /> {s.total} task{s.total !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    <Clock className="h-3 w-3" /> {s.active} active
                  </span>
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3 w-3" /> {s.done} approved
                  </span>
                  {s.earned > 0 && <span className="font-bold text-success">{inr(s.earned)} earned</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
