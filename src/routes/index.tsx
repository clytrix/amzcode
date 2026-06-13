import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { AzButton } from "@/components/az-button";
import {
  Headphones, Database, Package, Wrench, PenTool, Users, Server, Briefcase,
  Wallet, ShieldCheck, Clock, Home, GraduationCap, HeartPulse, TrendingUp,
  CheckCircle2, Star, MapPin, Smartphone, FileCheck, Banknote, Quote,
} from "lucide-react";
import { inr } from "@/lib/currency";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "AMZ.Jobs — Remote Work From Home Jobs in India" },
      { name: "description", content: "Apply to genuine remote work-from-home jobs in India. Customer service, data entry, virtual assistant, content writing. Fixed monthly salary, bonus, paid leaves & free training." },
    ],
  }),
});

const ICONS: Record<string, any> = {
  Headphones, Database, Package, Wrench, PenTool, Users, Server,
};

interface Cat { id: string; name: string; slug: string; description: string | null; icon: string | null }
interface Job { id: string; title: string; salary_min: number | null; salary_max: number | null; salary_currency: string; employment_type: string; location: string }

function HomePage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    void (async () => {
      const [c, j] = await Promise.all([
        supabase.from("job_categories").select("*").order("name"),
        supabase.from("jobs").select("id, title, salary_min, salary_max, salary_currency, employment_type, location").eq("is_active", true).limit(6).order("created_at", { ascending: false }),
      ]);
      setCats((c.data as Cat[]) || []);
      setJobs((j.data as Job[]) || []);
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-nav via-nav-secondary to-nav text-nav-foreground">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Now hiring · Work from home
            </div>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              Find genuine remote jobs.
              <span className="block text-primary">Get paid every month.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-nav-foreground/80 md:text-lg">
              Customer service, data entry, virtual assistant, content writing & more.
              Fixed monthly salary in ₹, performance bonus, paid leaves, and free training —
              all from the comfort of your home in India.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/jobs"><AzButton variant="brand" size="lg">Browse jobs</AzButton></Link>
              <Link to="/signup"><AzButton variant="primary" size="lg">Create account</AzButton></Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-nav-foreground/85">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Secure OTP login</span>
              <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-primary" /> On-time salary</span>
              <span className="flex items-center gap-1.5"><Home className="h-4 w-4 text-primary" /> 100% Work from home</span>
            </div>
          </div>

          {/* Hero card stack */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-brand/20 blur-2xl" />
            <div className="relative space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-nav-foreground/60">This month's payout</div>
                    <div className="mt-1 text-3xl font-bold text-primary">₹ 28,500</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Banknote className="h-6 w-6 text-primary" /></div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-nav-foreground/70">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Credited to bank · 1st of month
                </div>
              </div>
              <div className="ml-8 rounded-xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20"><Headphones className="h-5 w-5 text-brand" /></div>
                  <div>
                    <div className="font-semibold">Customer Service Associate</div>
                    <div className="text-xs text-nav-foreground/70">Remote · Full-time · ₹18k–₹32k</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20"><FileCheck className="h-5 w-5 text-success" /></div>
                  <div>
                    <div className="font-semibold">KYC verified ✓</div>
                    <div className="text-xs text-nav-foreground/70">Withdraw anytime to UPI / Bank</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="border-t border-white/10 bg-black/20">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 text-center text-sm md:grid-cols-4">
            <Trust n="50,000+" l="Active employees" />
            <Trust n="₹12 Cr+" l="Salaries paid" />
            <Trust n="200+" l="Cities in India" />
            <Trust n="4.6 ★" l="Employee rating" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto mt-14 w-full max-w-7xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Browse by category</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick a role that matches your skills.</p>
          </div>
          <Link to="/jobs" className="hidden text-sm font-semibold text-nav hover:text-primary md:block">All categories →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {cats.map((c) => {
            const Icon = ICONS[c.icon || ""] || Briefcase;
            return (
              <Link key={c.id} to="/jobs" search={{ category: c.slug } as any} className="group rounded-lg border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-nav transition group-hover:bg-primary group-hover:text-nav-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-16 w-full max-w-7xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">How it works</h2>
          <p className="mt-1 text-sm text-muted-foreground">From signup to your first salary in 4 simple steps.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { n: "01", Icon: Smartphone, t: "Sign up with OTP", d: "Create your account in 2 minutes using email OTP. No paperwork." },
            { n: "02", Icon: Briefcase, t: "Apply to jobs", d: "Browse openings and apply. Hear back from our team within 48 hours." },
            { n: "03", Icon: FileCheck, t: "Complete KYC", d: "One-time KYC for secure salary withdrawals to your bank/UPI." },
            { n: "04", Icon: Banknote, t: "Earn & withdraw", d: "Complete tasks, earn rewards & monthly salary. Withdraw anytime." },
          ].map(({ n, Icon, t, d }) => (
            <div key={n} className="relative rounded-lg border bg-card p-5 shadow-sm">
              <div className="absolute right-4 top-4 text-3xl font-black text-primary/20">{n}</div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-nav text-primary"><Icon className="h-5 w-5" /></div>
              <h3 className="font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Latest jobs */}
      <section className="mx-auto mt-16 w-full max-w-7xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Latest openings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fresh jobs posted by our team.</p>
          </div>
          <Link to="/jobs" className="text-sm font-semibold text-nav hover:text-primary">See all jobs →</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.length === 0 && <div className="col-span-full rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">No jobs posted yet. Check back soon!</div>}
          {jobs.map((j) => (
            <Link key={j.id} to="/jobs/$jobId" params={{ jobId: j.id }} className="group rounded-lg border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
              <div className="mb-2 inline-block rounded bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase text-accent-foreground">{j.employment_type}</div>
              <h3 className="font-bold text-foreground group-hover:text-primary">{j.title}</h3>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {j.location}</div>
              {(j.salary_min || j.salary_max) && (
                <div className="mt-3 text-sm font-bold text-success">{inr(j.salary_min ?? 0)} – {inr(j.salary_max ?? 0)} <span className="text-xs font-normal text-muted-foreground">/ month</span></div>
              )}
              <div className="mt-4 text-xs font-semibold text-primary">View details →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mt-20 bg-card">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Why work with us?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Real benefits, on-time payments, real growth.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              { Icon: Wallet, t: "Salary & Payment", d: "Fixed monthly salary based on role. Overtime pay and night-shift allowance available." },
              { Icon: Home, t: "Work From Home Setup", d: "Some roles include company laptop/headset and internet allowance. Training is fully online." },
              { Icon: HeartPulse, t: "Health Benefits", d: "Medical insurance (employee + family in some cases) and accidental insurance." },
              { Icon: TrendingUp, t: "Incentives & Bonus", d: "Performance bonus and Diwali/festival bonus depending on role." },
              { Icon: GraduationCap, t: "Training & Growth", d: "Free training programs, skill development, and promotion to team leader / manager roles." },
              { Icon: Clock, t: "Paid Leaves", d: "Casual leave, sick leave, and paid holidays — all transparent and on time." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="rounded-lg border bg-secondary/40 p-5 transition hover:border-primary hover:bg-secondary">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-nav">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto mt-16 w-full max-w-7xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Loved by employees across India</h2>
          <p className="mt-1 text-sm text-muted-foreground">Real stories from people earning from home.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: "Priya S.", c: "Bengaluru", r: "I started as a customer service associate. Got my first salary on the 1st itself. KYC was smooth and payouts to UPI work in seconds.", role: "Customer Service" },
            { n: "Rahul K.", c: "Lucknow", r: "Best part is the flexibility — I work data entry shifts after college. Earned ₹22,000 last month including bonus.", role: "Data Entry" },
            { n: "Aisha M.", c: "Hyderabad", r: "Free training helped me move from VA to team leader in 6 months. Salary nearly doubled. Genuine company.", role: "Virtual Assistant" },
          ].map((t) => (
            <div key={t.n} className="rounded-lg border bg-card p-6 shadow-sm">
              <Quote className="h-6 w-6 text-primary/40" />
              <p className="mt-3 text-sm text-foreground">{t.r}</p>
              <div className="mt-4 flex items-center gap-1 text-primary">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <div className="mt-3 border-t pt-3">
                <div className="font-bold">{t.n}</div>
                <div className="text-xs text-muted-foreground">{t.role} · {t.c}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-16 w-full max-w-4xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Frequently asked questions</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: "Is this a real work-from-home job?", a: "Yes. All listed roles are 100% remote with fixed monthly salary in INR, paid via bank transfer or UPI on the 1st of every month." },
            { q: "How quickly will I get paid?", a: "Task rewards are credited instantly on approval. Monthly salary is paid on the 1st of every month directly to your registered bank/UPI." },
            { q: "What documents do I need for KYC?", a: "Aadhaar card (front + back), PAN card, a selfie, and bank account or UPI details. The whole process takes under 5 minutes." },
            { q: "Can I work part-time?", a: "Yes. Many roles support flexible shifts — perfect for students, homemakers, and people with another job." },
          ].map((f) => (
            <details key={f.q} className="group rounded-lg border bg-card p-5 shadow-sm">
              <summary className="flex cursor-pointer items-center justify-between font-bold text-foreground">
                {f.q}
                <span className="text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-20 bg-gradient-to-br from-nav-secondary to-nav text-nav-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-14 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Ready to start earning from home?</h2>
            <p className="mt-2 text-sm text-nav-foreground/80">Create your free account and apply in minutes. No paperwork.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/signup"><AzButton variant="brand" size="lg">Create free account</AzButton></Link>
            <Link to="/jobs"><AzButton variant="outline" size="lg" className="border-white/30 bg-transparent text-nav-foreground hover:bg-white/10">Browse jobs</AzButton></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Trust({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-primary md:text-2xl">{n}</div>
      <div className="text-xs text-nav-foreground/70">{l}</div>
    </div>
  );
}
