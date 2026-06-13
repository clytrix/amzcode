import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { PublicHeader, Footer } from "@/components/site-chrome";
import { AdminSidebarNav } from "@/components/admin-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-secondary">
        <PublicHeader />
        <div className="mx-auto max-w-xl flex-1 px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-destructive">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">You need admin permissions to view this page.</p>
          <a href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">← Back to dashboard</a>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />
      <SidebarProvider>
        <div className="flex w-full flex-1">
          <AdminSidebarNav />
          <div className="flex flex-1 flex-col">
            <div className="flex h-12 items-center gap-2 border-b bg-card px-4 shadow-sm md:hidden">
              <SidebarTrigger />
              <span className="text-sm font-bold">Admin Panel</span>
            </div>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
              <div className="mb-3 hidden items-center gap-2 md:flex">
                <SidebarTrigger className="-ml-1" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Admin Panel
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
