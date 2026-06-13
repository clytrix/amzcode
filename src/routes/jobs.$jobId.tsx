import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { AzButton } from "@/components/az-button";
import { Briefcase, MapPin, IndianRupee } from "lucide-react";
import { inr } from "@/lib/currency";

export const Route = createFileRoute("/jobs/$jobId")({ component: JobDetail });

interface Job {
  id: string; title: string; description: string; requirements: string | null; responsibilities: string | null;
  location: string; employment_type: string; salary_min: number | null; salary_max: number | null; salary_currency: string;
}

function JobDetail() {
  const { jobId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [form, setForm] = useState({
    cover_letter: "", experience: "",
    contact_email: "", contact_whatsapp: "",
    expected_salary: "", linkedin_url: "", github_url: "",
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      setJob((data as Job) || null);
      if (user) {
        const { data: app } = await supabase.from("job_applications").select("id").eq("job_id", jobId).eq("user_id", user.id).maybeSingle();
        setHasApplied(!!app);
        setForm((f) => ({ ...f, contact_email: user.email || f.contact_email }));
      }
      setLoading(false);
    })();
  }, [jobId, user]);

  const submitApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate({ to: "/login" }); return; }
    if (!cvFile) { toast.error("Please attach your CV (PDF or DOC)."); return; }
    if (cvFile.size > 5 * 1024 * 1024) { toast.error("CV must be under 5MB."); return; }
    if (!form.expected_salary || Number(form.expected_salary) <= 0) { toast.error("Enter your expected monthly salary."); return; }
    if (!form.contact_email && !form.contact_whatsapp) { toast.error("Provide email or WhatsApp."); return; }
    setSubmitting(true);
    try {
      const ext = cvFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${user.id}/${jobId}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("cv-uploads").upload(path, cvFile, { upsert: true, contentType: cvFile.type || undefined });
      if (up.error) throw up.error;
      const { error } = await supabase.from("job_applications").insert({
        job_id: jobId, user_id: user.id,
        cover_letter: form.cover_letter, experience: form.experience,
        cv_path: path,
        contact_email: form.contact_email || null,
        contact_whatsapp: form.contact_whatsapp || null,
        expected_salary: Number(form.expected_salary),
        linkedin_url: form.linkedin_url || null,
        github_url: form.github_url || null,
      });
      if (error) throw error;
      toast.success("Application submitted!");
      setHasApplied(true); setShowApply(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!job) return <div className="p-10 text-center text-muted-foreground">Job not found. <Link to="/jobs" className="text-primary underline">Browse all jobs</Link></div>;

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <Link to="/jobs" className="text-sm text-[oklch(0.45_0.13_240)] hover:underline">← Back to jobs</Link>
        <article className="mt-3 rounded-md border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold md:text-3xl">{job.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>
            <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" /> {job.employment_type}</span>
            {(job.salary_min || job.salary_max) && (
              <span className="flex items-center gap-1 font-semibold text-success"><IndianRupee className="h-4 w-4" /> {inr(job.salary_min ?? 0)} – {inr(job.salary_max ?? 0)} / month</span>
            )}
          </div>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-foreground">
            <Section title="Description" body={job.description} />
            {job.responsibilities && <Section title="Responsibilities" body={job.responsibilities} />}
            {job.requirements && <Section title="Requirements" body={job.requirements} />}
          </div>

          <div className="mt-8 flex items-center gap-3 border-t pt-6">
            {hasApplied ? (
              <div className="rounded bg-success/15 px-4 py-2 text-sm font-semibold text-success">✓ You've already applied to this job.</div>
            ) : showApply ? null : (
              <AzButton variant="brand" size="lg" onClick={() => (user ? setShowApply(true) : navigate({ to: "/login" }))}>
                {user ? "Apply now" : "Sign in to apply"}
              </AzButton>
            )}
          </div>

          {showApply && !hasApplied && (
            <form onSubmit={submitApp} className="mt-6 grid gap-3 rounded-md border bg-secondary/50 p-4 sm:grid-cols-2">
              <h2 className="font-bold sm:col-span-2">Your application</h2>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-bold">Why are you a good fit? <span className="text-destructive">*</span></span>
                <textarea value={form.cover_letter} onChange={(e) => setForm({ ...form, cover_letter: e.target.value })} rows={4} maxLength={2000} required className="w-full rounded border border-input bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-bold">Relevant experience</span>
                <textarea value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} rows={3} maxLength={2000} className="w-full rounded border border-input bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Contact email <span className="text-destructive">*</span></span>
                <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">WhatsApp number <span className="text-destructive">*</span></span>
                <input type="tel" value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} placeholder="+91…" className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Expected monthly salary (₹) <span className="text-destructive">*</span></span>
                <input type="number" min="1" required value={form.expected_salary} onChange={(e) => setForm({ ...form, expected_salary: e.target.value })} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">CV / Resume (PDF, DOC, max 5MB) <span className="text-destructive">*</span></span>
                <input type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setCvFile(e.target.files?.[0] || null)} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">LinkedIn URL</span>
                <input type="url" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/…" className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">GitHub / Portfolio URL</span>
                <input type="url" value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} placeholder="https://github.com/…" className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">Provide at least email or WhatsApp so we can reach you.</p>
              <div className="flex gap-2 sm:col-span-2">
                <AzButton variant="brand" disabled={submitting}>{submitting ? "Submitting…" : "Submit application"}</AzButton>
                <AzButton type="button" variant="outline" onClick={() => setShowApply(false)}>Cancel</AzButton>
              </div>
            </form>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">{title}</h2>
      <p className="whitespace-pre-wrap">{body}</p>
    </section>
  );
}
