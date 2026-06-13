import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { notifyApplicationDecision } from "@/server/notifications.functions";
import { approveApplicationWithPackage } from "@/server/salary.functions";
import { adminGetCvDownloadUrl } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/applications")({ component: AdminApps });

function AdminApps() {
  const [apps, setApps] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pkgFor, setPkgFor] = useState<any | null>(null);
  const [pkgForm, setPkgForm] = useState({
    monthly_salary: "",
    perks: "",
    starts_on: new Date().toISOString().slice(0, 10),
  });
  const [pkgSubmitting, setPkgSubmitting] = useState(false);

  const load = async () => {
    let q = supabase.from("job_applications").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data: appRows } = await q;
    const userIds = Array.from(new Set((appRows || []).map((a: any) => a.user_id)));
    const jobIds = Array.from(new Set((appRows || []).map((a: any) => a.job_id)));
    const [profileRes, jobRes] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds) : Promise.resolve({ data: [] }),
      jobIds.length ? supabase.from("jobs").select("id, title").in("id", jobIds) : Promise.resolve({ data: [] }),
    ]);
    const pMap = new Map((profileRes.data || []).map((p: any) => [p.id, p]));
    const jMap = new Map((jobRes.data || []).map((j: any) => [j.id, j]));
    setApps(((appRows as any[]) || []).map((a) => ({ ...a, profiles: pMap.get(a.user_id) || null, jobs: jMap.get(a.job_id) || null })));
  };
  useEffect(() => { void load(); }, [filter]);

  const reject = async (a: any) => {
    setBusyId(a.id);
    try {
      const adminNote = notes[a.id]?.trim() || null;
      const { error } = await supabase.from("job_applications").update({ status: "rejected", admin_notes: adminNote }).eq("id", a.id);
      if (error) throw error;
      try {
        await notifyApplicationDecision({ data: { application_id: a.id, status: "rejected", admin_notes: adminNote } });
        toast.success("Application rejected · email sent");
      } catch (mailErr: any) {
        toast.warning(`Rejected. Email failed: ${mailErr?.message || "unknown error"}`);
      }
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Could not update application");
    } finally {
      setBusyId(null);
    }
  };

  const submitPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgFor) return;
    const salary = Number(pkgForm.monthly_salary);
    if (!salary || salary <= 0) return toast.error("Enter a valid monthly salary.");
    setPkgSubmitting(true);
    try {
      await approveApplicationWithPackage({
        data: {
          application_id: pkgFor.id,
          monthly_salary: salary,
          currency: "INR",
          perks: pkgForm.perks || null,
          starts_on: pkgForm.starts_on,
          admin_notes: notes[pkgFor.id] || null,
        },
      });
      toast.success("Approved · employment package created · email sent");
      setPkgFor(null);
      setPkgForm({ monthly_salary: "", perks: "", starts_on: new Date().toISOString().slice(0, 10) });
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Approval failed");
    } finally {
      setPkgSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Job Applications</h1>
          <p className="text-sm text-muted-foreground">
            Approving creates an employment package (monthly salary + perks) and emails the applicant.
          </p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="rounded border border-input bg-white px-3 py-2 text-sm">
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All applications</option>
        </select>
      </div>

      <div className="space-y-3">
        {apps.length === 0 && <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">No applications.</div>}
        {apps.map((a) => (
          <div key={a.id} className="rounded-md border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold">{a.jobs?.title || "Job"}</div>
                <div className="text-sm">{a.profiles?.full_name || "(no name)"} · <span className="text-muted-foreground">{a.profiles?.email}</span> {a.profiles?.phone ? `· ${a.profiles.phone}` : ""}</div>
                <div className="text-xs text-muted-foreground">Applied {new Date(a.created_at).toLocaleString("en-IN")}</div>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-bold capitalize ${a.status === "approved" ? "bg-success/15 text-success" : a.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>{a.status}</span>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              {a.contact_email && <div><b>Email:</b> {a.contact_email}</div>}
              {a.contact_whatsapp && <div><b>WhatsApp:</b> {a.contact_whatsapp}</div>}
              {a.expected_salary && <div><b>Expected salary:</b> ₹{Number(a.expected_salary).toLocaleString("en-IN")}/mo</div>}
              {a.linkedin_url && <div><b>LinkedIn:</b> <a href={a.linkedin_url} target="_blank" rel="noreferrer" className="text-primary underline break-all">{a.linkedin_url}</a></div>}
              {a.github_url && <div><b>GitHub/Portfolio:</b> <a href={a.github_url} target="_blank" rel="noreferrer" className="text-primary underline break-all">{a.github_url}</a></div>}
              {a.cv_path && (
                <div className="sm:col-span-2">
                  <b>CV:</b>{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={async () => {
                      try {
                        const result = await adminGetCvDownloadUrl({ data: { cv_path: a.cv_path } });
                        if (result?.signedUrl) {
                          window.open(result.signedUrl, "_blank", "noopener,noreferrer");
                        } else {
                          toast.error("Could not generate download link");
                        }
                      } catch (err: any) {
                        toast.error(err?.message || "Could not generate download link");
                      }
                    }}
                  >Download CV</button>
                </div>
              )}
            </div>
            {a.cover_letter && <div className="mt-3 rounded bg-secondary/40 p-3 text-sm"><b>Cover letter:</b><br/>{a.cover_letter}</div>}
            {a.experience && <div className="mt-2 rounded bg-secondary/40 p-3 text-sm"><b>Experience:</b><br/>{a.experience}</div>}
            {a.admin_notes && <div className="mt-2 text-xs text-muted-foreground"><b>Admin notes:</b> {a.admin_notes}</div>}
            {a.status === "pending" && (
              <div className="mt-3 space-y-2">
                <textarea placeholder="Optional admin note (included in the email to the applicant)" value={notes[a.id] || ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} rows={2} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <AzButton size="sm" variant="brand" disabled={busyId === a.id} onClick={() => setPkgFor(a)}>Approve & set package</AzButton>
                  <AzButton size="sm" variant="outline" disabled={busyId === a.id} onClick={() => reject(a)}>Reject & email</AzButton>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Employment package modal */}
      {pkgFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pkgSubmitting && setPkgFor(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitPackage} className="w-full max-w-md space-y-3 rounded-md border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-bold">Set employment package</h2>
            <p className="text-xs text-muted-foreground">
              {pkgFor.profiles?.full_name || "Applicant"} · {pkgFor.jobs?.title}
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-bold">Monthly salary (₹ INR)</span>
              <input type="number" min="1" step="1" required value={pkgForm.monthly_salary}
                onChange={(e) => setPkgForm({ ...pkgForm, monthly_salary: e.target.value })}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" autoFocus />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold">Start date</span>
              <input type="date" required value={pkgForm.starts_on}
                onChange={(e) => setPkgForm({ ...pkgForm, starts_on: e.target.value })}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold">Perks &amp; allowances (optional)</span>
              <textarea rows={3} value={pkgForm.perks}
                onChange={(e) => setPkgForm({ ...pkgForm, perks: e.target.value })}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                placeholder="e.g. Internet allowance ₹1000/mo, performance bonus, paid leave…" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <AzButton type="button" variant="outline" disabled={pkgSubmitting} onClick={() => setPkgFor(null)}>Cancel</AzButton>
              <AzButton variant="brand" disabled={pkgSubmitting}>
                {pkgSubmitting ? "Saving…" : "Approve & email"}
              </AzButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
