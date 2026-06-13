import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { Plus, FileText, CheckCircle2, XCircle, Clock, AlertCircle, Link as LinkIcon, Filter } from "lucide-react";
import { notifyTaskAssigned } from "@/server/notifications.functions";
import { adminCreateTask, adminReviewTask } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/tasks")({ component: AdminTasks });

type Task = any;
type Attachment = { id: string; task_id: string; file_name: string; file_size_bytes: number; storage_path: string; mime_type: string | null };

function AdminTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "submitted" | "active" | "done">("submitted");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [form, setForm] = useState({ user_id: "", title: "", description: "", priority: "medium", deadline: "" });

  const load = async () => {
    const [t, p, a] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("task_attachments").select("*"),
    ]);
    const profileMap = new Map((p.data || []).map((pp: any) => [pp.id, pp]));
    const tasksWithProfile = ((t.data as any[]) || []).map((row) => ({
      ...row,
      profiles: profileMap.get(row.user_id) || null,
    }));
    setTasks(tasksWithProfile);
    setEmployees((p.data as any[]) || []);
    const grouped: Record<string, Attachment[]> = {};
    for (const att of (a.data as Attachment[]) || []) (grouped[att.task_id] ||= []).push(att);
    setAttachments(grouped);
  };
  useEffect(() => { void load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.user_id) return toast.error("Select an employee");
    try {
      const res = await adminCreateTask({
        data: {
          user_id: form.user_id,
          title: form.title,
          description: form.description,
          priority: form.priority as any,
          deadline: form.deadline || null,
          reward_amount: 0,
        },
      });
      toast.success("Task assigned!");
      if (res?.id) {
        try {
          await notifyTaskAssigned({ data: { task_id: res.id } });
          toast.success("Notification email sent to employee");
        } catch (mailErr: any) {
          toast.warning(`Task created, but email failed: ${mailErr?.message || "unknown error"}`);
        }
      }
      setCreating(false);
      setForm({ user_id: "", title: "", description: "", priority: "medium", deadline: "" });
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Could not create task");
    }
  };

  const review = async (t: Task, status: "approved" | "rejected") => {
    if (status === "rejected" && !reviewNotes.trim()) return toast.error("Please provide a reason for declining");
    try {
      const res = await adminReviewTask({
        data: { task_id: t.id, status, review_notes: reviewNotes.trim() || null },
      });
      if (status === "approved") {
        toast.success(res?.credited ? `Task approved · ₹${res.credited} credited` : "Task approved");
      } else {
        toast.success("Task declined");
      }
      setReviewingId(null);
      setReviewNotes("");
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Review failed");
    }
  };

  const downloadAttachment = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(a.storage_path, 300);
    if (error || !data) return toast.error("Could not generate download link");
    window.open(data.signedUrl, "_blank");
  };

  const filtered = tasks.filter((t) => {
    if (filter === "submitted") return t.status === "submitted";
    if (filter === "active") return t.status === "assigned" || t.status === "in_progress";
    if (filter === "done") return t.status === "approved" || t.status === "rejected";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Assign work and review submissions.</p>
        </div>
        <AzButton variant="brand" onClick={() => setCreating(!creating)}><Plus className="h-4 w-4" /> Assign new task</AzButton>
      </div>

      {creating && (
        <form onSubmit={create} className="grid gap-3 rounded-md border bg-card p-5 shadow-sm sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold">Assign to employee</span>
            <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} required className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="">— Select employee —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.email} · {e.email}</option>)}
            </select>
          </label>
          <Field label="Task title" v={form.title} on={(v) => setForm({ ...form, title: v })} required />
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <Field label="Deadline" type="datetime-local" v={form.deadline} on={(v) => setForm({ ...form, deadline: v })} />
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <AzButton variant="brand">Assign task</AzButton>
            <AzButton type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</AzButton>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 text-xs">
        <Filter className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        {([
          { v: "submitted", l: "Awaiting review", icon: <AlertCircle className="h-3 w-3" /> },
          { v: "active", l: "Active", icon: <Clock className="h-3 w-3" /> },
          { v: "done", l: "Completed", icon: <CheckCircle2 className="h-3 w-3" /> },
          { v: "all", l: "All", icon: null },
        ] as const).map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`flex items-center gap-1 rounded px-3 py-1 font-bold ${filter === f.v ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
            {f.icon} {f.l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">No tasks in this view.</div>}
        {filtered.map((t) => {
          const atts = attachments[t.id] || [];
          const reviewing = reviewingId === t.id;
          return (
            <div key={t.id} className="rounded-md border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.profiles?.full_name || t.profiles?.email} · Priority <span className="capitalize">{t.priority}</span> · Created {new Date(t.created_at).toLocaleDateString("en-IN")}
                    {t.deadline && <> · Due {new Date(t.deadline).toLocaleString("en-IN")}</>}
                  </div>
                </div>
                <span className="rounded bg-secondary px-2 py-1 text-xs font-bold capitalize">{String(t.status).replace(/_/g, " ")}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>

              {(t.submission_notes || t.submission_url || atts.length > 0) && (
                <div className="mt-3 space-y-2 rounded bg-secondary/40 p-3 text-sm">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Submission</div>
                  {t.submission_notes && <div><b>Notes:</b> <span className="whitespace-pre-wrap">{t.submission_notes}</span></div>}
                  {t.submission_url && <div className="flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5" /><a className="text-primary hover:underline" href={t.submission_url} target="_blank" rel="noreferrer">{t.submission_url}</a></div>}
                  {atts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {atts.map((a) => (
                        <button key={a.id} onClick={() => downloadAttachment(a)} className="flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-secondary">
                          <FileText className="h-3 w-3" /> {a.file_name} <span className="text-muted-foreground">({(a.file_size_bytes / 1024).toFixed(0)} KB)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {t.review_notes && (t.status === "approved" || t.status === "rejected") && (
                <div className={`mt-2 rounded p-2 text-xs ${t.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                  <b>Your note:</b> {t.review_notes}
                </div>
              )}

              {t.status === "submitted" && !reviewing && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <AzButton size="sm" variant="brand" onClick={() => { setReviewingId(t.id); setReviewNotes(""); }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Review
                  </AzButton>
                </div>
              )}

              {reviewing && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
                    placeholder="Optional note for approval, required for declining…"
                    className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <AzButton size="sm" variant="brand" onClick={() => review(t, "approved")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </AzButton>
                    <AzButton size="sm" variant="outline" onClick={() => review(t, "rejected")}>
                      <XCircle className="h-3.5 w-3.5" /> Decline
                    </AzButton>
                    <AzButton size="sm" variant="ghost" onClick={() => { setReviewingId(null); setReviewNotes(""); }}>Cancel</AzButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
