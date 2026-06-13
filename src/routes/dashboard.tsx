import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { DashboardSidebarNav } from "@/components/dashboard-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/dashboard")({ component: DashboardLayout });

function DashboardLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />
      <SidebarProvider>
        <div className="flex w-full flex-1">
          <DashboardSidebarNav />
          <div className="flex flex-1 flex-col">
            <div className="flex h-12 items-center gap-2 border-b bg-card px-4 shadow-sm md:hidden">
              <SidebarTrigger />
              <span className="text-sm font-bold">Employee Hub</span>
            </div>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
              <div className="mb-3 hidden items-center gap-2 md:flex">
                <SidebarTrigger className="-ml-1" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Employee Hub
                </span>
              </div>
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Footer />
    </div>
  );
}
