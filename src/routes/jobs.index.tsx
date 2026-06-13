import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { z } from "zod";
import { inr } from "@/lib/currency";

const search = z.object({ category: z.string().optional() });

export const Route = createFileRoute("/jobs/")({
  component: JobsPage,
  validateSearch: search.parse,
});

interface Job {
  id: string; title: string; description: string; location: string; employment_type: string;
  salary_min: number | null; salary_max: number | null; salary_currency: string;
  category_id: string | null;
}
interface Cat { id: string; slug: string; name: string }

function JobsPage() {
  const { category } = Route.useSearch();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: catsData } = await supabase.from("job_categories").select("*").order("name");
      const cs = (catsData as Cat[]) || [];
      setCats(cs);

      let query = supabase.from("jobs").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (category) {
        const cat = cs.find((c) => c.slug === category);
        if (cat) query = query.eq("category_id", cat.id);
      }
      const { data } = await query;
      setJobs((data as Job[]) || []);
      setLoading(false);
    })();
  }, [category]);

  const activeCat = useMemo(() => cats.find((c) => c.slug === category), [cats, category]);

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold">{activeCat ? activeCat.name : "All remote jobs"}</h1>
            <p className="text-sm text-muted-foreground">{jobs.length} opening{jobs.length === 1 ? "" : "s"}</p>
          </div>
          {category && <Link to="/jobs" className="text-sm text-[oklch(0.45_0.13_240)] hover:underline">Clear filter</Link>}
        </div>
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="rounded-md border bg-card p-3 shadow-sm md:sticky md:top-4 md:h-fit">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Categories</div>
            <Link to="/jobs" className={`block rounded px-2 py-1.5 text-sm ${!category ? "bg-secondary font-semibold" : "hover:bg-secondary"}`}>All</Link>
            {cats.map((c) => (
              <Link key={c.id} to="/jobs" search={{ category: c.slug } as any} className={`block rounded px-2 py-1.5 text-sm ${category === c.slug ? "bg-secondary font-semibold" : "hover:bg-secondary"}`}>
                {c.name}
              </Link>
            ))}
          </aside>
          <div className="grid gap-3">
            {loading && <div className="rounded border bg-card p-6 text-sm text-muted-foreground">Loading jobs…</div>}
            {!loading && jobs.length === 0 && <div className="rounded border bg-card p-6 text-sm text-muted-foreground">No openings in this category right now.</div>}
            {jobs.map((j) => (
              <Link key={j.id} to="/jobs/$jobId" params={{ jobId: j.id }} className="rounded-md border bg-card p-4 shadow-sm transition hover:shadow-md">
                <h2 className="text-lg font-bold text-foreground hover:text-primary">{j.title}</h2>
                <div className="mt-1 text-xs text-muted-foreground">{j.location} · {j.employment_type}</div>
                <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{j.description}</p>
                {(j.salary_min || j.salary_max) && (
                  <div className="mt-2 text-sm font-bold text-success">{inr(j.salary_min ?? 0)} – {inr(j.salary_max ?? 0)} / month</div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
