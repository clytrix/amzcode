import { createFileRoute } from "@tanstack/react-router";
import { SuspendedPageContent } from "@/components/suspended-page";
import { usePublicSettings } from "@/lib/platform-settings";

export const Route = createFileRoute("/suspended")({
  component: SuspendedPage,
  head: () => ({
    meta: [
      { title: "Account Suspended — Clytrix Hosting" },
      { name: "description", content: "This website has been suspended by Clytrix Hosting for violating our Terms of Service. Contact our webmaster for assistance." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Account Suspended — Clytrix Hosting" },
      { property: "og:description", content: "This website has been suspended by Clytrix Hosting for violating our Terms of Service." },
    ],
  }),
});

function SuspendedPage() {
  const { settings } = usePublicSettings();
  const reason = settings["site.suspended"]?.reason;
  return <SuspendedPageContent reason={reason} />;
}
