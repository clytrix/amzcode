import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { adminCreateJob, adminUpdateJob, adminDeleteJob, adminToggleJobActive } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/jobs")({ component: AdminJobs });

interface Cat { id: string; name: string; slug: string }
interface Job {
  id: string; title: string; description: string; requirements: string | null; responsibilities: string | null;
  location: string; employment_type: string; salary_min: number | null; salary_max: number | null;
  salary_currency: string; category_id: string | null; is_active: boolean;
}

const empty: Partial<Job> = {
  title: "", description: "", requirements: "", responsibilities: "",
  location: "Remote / Work From Home", employment_type: "Full-time",
  salary_min: 15000, salary_max: 35000, salary_currency: "INR",
  category_id: null, is_active: true,
};

function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Job> | null>(null);

  const load = async () => {
    const [j, c] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("job_categories").select("id, name, slug").order("name"),
    ]);
    setJobs((j.data as Job[]) || []);
    setCats((c.data as Cat[]) || []);
  };
  useEffect(() => { void load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const payload = {
      title: editing.title || "",
      description: editing.description || "",
      requirements: editing.requirements ?? null,
      responsibilities: editing.responsibilities ?? null,
      location: editing.location || "Remote / Work From Home",
      employment_type: editing.employment_type || "Full-time",
      salary_min: editing.salary_min ?? null,
      salary_max: editing.salary_max ?? null,
      salary_currency: "INR",
      category_id: editing.category_id || null,
      is_active: editing.is_active ?? true,
    };
    try {
      if (editing.id) {
        await adminUpdateJob({ data: { id: editing.id, ...payload } as any });
      } else {
        await adminCreateJob({ data: payload as any });
      }
      toast.success(editing.id ? "Job updated!" : "Job posted!");
      setEditing(null);
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Could not save job");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this job? Existing applications will remain.")) return;
    try {
      await adminDeleteJob({ data: { id } });
      toast.success("Deleted");
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Could not delete");
    }
  };

  const toggleActive = async (j: Job) => {
    try {
      await adminToggleJobActive({ data: { id: j.id, is_active: !j.is_active } });
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Could not toggle");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Jobs</h1>
        <AzButton variant="brand" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4" /> Post new job</AzButton>
      </div>

      {editing && (
        <form onSubmit={save} className="grid gap-3 rounded-md border bg-card p-5 shadow-sm sm:grid-cols-2">
          <h2 className="sm:col-span-2 font-bold">{editing.id ? "Edit job" : "New job"}</h2>
          <Field label="Title" v={editing.title} on={(v) => setEditing({ ...editing, title: v })} required />
          <Field label="Employment type" v={editing.employment_type} on={(v) => setEditing({ ...editing, employment_type: v })} />
          <Field label="Location" v={editing.location} on={(v) => setEditing({ ...editing, location: v })} />
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Category</span>
            <select value={editing.category_id || ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="">— Uncategorized —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <Field label="Salary min (₹/month)" type="number" v={editing.salary_min as any} on={(v) => setEditing({ ...editing, salary_min: Number(v) })} />
          <Field label="Salary max (₹/month)" type="number" v={editing.salary_max as any} on={(v) => setEditing({ ...editing, salary_max: Number(v) })} />
          <TextArea label="Description" v={editing.description} on={(v) => setEditing({ ...editing, description: v })} required full />
          <TextArea label="Responsibilities" v={editing.responsibilities || ""} on={(v) => setEditing({ ...editing, responsibilities: v })} full />
          <TextArea label="Requirements" v={editing.requirements || ""} on={(v) => setEditing({ ...editing, requirements: v })} full />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            Active (visible to job seekers)
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <AzButton variant="brand">{editing.id ? "Update job" : "Post job"}</AzButton>
            <AzButton type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</AzButton>
          </div>
        </form>
      )}

      <div className="rounded-md border bg-card shadow-sm">
        {jobs.length === 0 && <div className="p-6 text-sm text-muted-foreground">No jobs yet.</div>}
        {jobs.map((j) => (
          <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{j.title}</h3>
                {!j.is_active && <span className="rounded bg-muted px-2 py-0.5 text-xs">Inactive</span>}
              </div>
              <div className="text-xs text-muted-foreground">{j.location} · {j.employment_type} · {inr(j.salary_min || 0)} – {inr(j.salary_max || 0)}/mo</div>
            </div>
            <div className="flex gap-1">
              <AzButton size="sm" variant="outline" onClick={() => toggleActive(j)}>{j.is_active ? "Deactivate" : "Activate"}</AzButton>
              <AzButton size="sm" variant="outline" onClick={() => setEditing(j)}><Pencil className="h-3.5 w-3.5" /></AzButton>
              <AzButton size="sm" variant="outline" onClick={() => remove(j.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></AzButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, v, on, type = "text", required }: { label: string; v: any; on: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <input type={type} value={v ?? ""} onChange={(e) => on(e.target.value)} required={required}
        className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
    </label>
  );
}
function TextArea({ label, v, on, full, required }: { label: string; v: string | null | undefined; on: (v: string) => void; full?: boolean; required?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <textarea value={v ?? ""} onChange={(e) => on(e.target.value)} rows={3} required={required}
        className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
    </label>
  );
}
