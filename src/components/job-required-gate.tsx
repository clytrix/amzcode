import { Link } from "@tanstack/react-router";
import { Briefcase, Lock, ArrowRight } from "lucide-react";
import { useJobApproval } from "@/hooks/use-job-approval";

/**
 * Wrapper that renders its children only when the user has at least one
 * approved job application. Otherwise it renders an onboarding CTA pushing
 * them to apply / wait for review.
 */
export function JobRequiredGate({ children, feature }: { children: React.ReactNode; feature: string }) {
  const { approved, loading, totalCount, pendingCount } = useJobApproval();
  if (loading) {
    return <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (approved) return <>{children}</>;

  const hasPending = pendingCount > 0;
  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Lock className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-bold">{feature} unlocks after approval</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {totalCount === 0
          ? "Apply to a remote role first — once your application is approved by an admin you'll get tasks, payouts and the rest of the workspace."
          : hasPending
          ? "Your application is under review. We'll email you the moment it's approved and the full dashboard will unlock automatically."
          : "Your previous applications were not approved. Apply for another open role to get started."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/jobs" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow hover:opacity-90">
          <Briefcase className="h-4 w-4" /> Browse open roles <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/dashboard/applications" className="inline-flex items-center gap-2 rounded-md border bg-secondary px-5 py-2.5 text-sm font-bold hover:bg-accent">
          View my applications
        </Link>
      </div>
    </div>
  );
}
