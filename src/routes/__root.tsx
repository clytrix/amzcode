import { Outlet, createRootRoute, HeadContent, Scripts, Link, useLocation } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { PlatformOverlays } from "@/components/platform-overlays";
import { usePublicSettings } from "@/lib/platform-settings";
import { SuspendedPageContent } from "@/components/suspended-page";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AMZ.Jobs — Remote Work From Home Jobs" },
      { name: "description", content: "Apply to remote work-from-home jobs: customer service, data entry, virtual assistant, content writing, and more. Earn, track tasks, and withdraw securely." },
      { name: "author", content: "AMZ.Jobs" },
      { property: "og:title", content: "AMZ.Jobs — Remote Work From Home Jobs" },
      { property: "og:description", content: "Apply to remote work-from-home jobs: customer service, data entry, virtual assistant, content writing, and more. Earn, track tasks, and withdraw securely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "AMZ.Jobs — Remote Work From Home Jobs" },
      { name: "twitter:description", content: "Apply to remote work-from-home jobs: customer service, data entry, virtual assistant, content writing, and more. Earn, track tasks, and withdraw securely." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/58291f19-eabe-4bdd-81f9-e441c0725eba/id-preview-6ee721fa--14f6a58b-86a9-4e78-901f-97f36d5344e1.lovable.app-1777333785284.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/58291f19-eabe-4bdd-81f9-e441c0725eba/id-preview-6ee721fa--14f6a58b-86a9-4e78-901f-97f36d5344e1.lovable.app-1777333785284.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SuspensionGate({ children }: { children: React.ReactNode }) {
  const { settings, loading } = usePublicSettings();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e27]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  const suspended = settings["site.suspended"];
  const isAdminRoute = location.pathname.startsWith("/admin");

  if (suspended?.enabled && !isAdminRoute) {
    return <SuspendedPageContent reason={suspended.reason} />;
  }

  return <>{children}</>;
}

function RootComponent() {
  return (
    <AuthProvider>
      <SuspensionGate>
        <Outlet />
      </SuspensionGate>
      <PlatformOverlays />
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}
