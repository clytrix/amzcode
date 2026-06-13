import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/applications")({ component: AppsPage });

function AppsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    void supabase.from("job_applications").select("*, jobs(title)").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setApps(data || []));
  }, [user]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Applications</h1>
      <div className="rounded-md border bg-card shadow-sm">
        {apps.length === 0 && <div className="p-6 text-sm text-muted-foreground">No applications yet.</div>}
        {apps.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
            <div>
              <div className="font-bold">{a.jobs?.title || "Job"}</div>
              <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</div>
            </div>
            <span className={`rounded px-2 py-1 text-xs font-bold capitalize ${a.status === "approved" ? "bg-success/15 text-success" : a.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
