import { AlertTriangle, ShieldAlert, Globe, Server, Lock } from "lucide-react";

export function SuspendedPageContent({ reason }: { reason?: string }) {
  return (
    <div className="min-h-screen bg-[#0a0e27] flex flex-col">
      {/* Clytrix Header */}
      <header className="border-b border-white/10 bg-[#0a0e27]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <div className="text-white font-bold text-xl tracking-tight">
            CLY<span className="text-[#3b82f6]">TRIX</span>
          </div>
          <span className="ml-auto text-xs text-gray-400 font-medium hidden sm:block">
            Secure Cloud Hosting Solutions
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center">
          {/* Suspended Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/30">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Account Suspended
          </h1>

          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <div className="flex items-start gap-3 text-left">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-200">
                  {reason || "This hosting account has been suspended due to malicious activity."}
                </p>
                <p className="mt-3 text-xs text-gray-300 font-medium">
                  If you think this is a fault, contact the webmaster.
                </p>
              </div>
            </div>
          </div>

          {/* Reference */}
          <p className="mt-4 text-xs text-gray-500">
            Ticket ID: SUSP-{Math.random().toString(36).substring(2, 10).toUpperCase()} &middot; Incident logged at {new Date().toISOString().slice(0, 10)}
          </p>

          {/* Divider */}
          <div className="my-8 border-t border-white/10" />

          {/* SEO Promo Section about Clytrix */}
          <div className="text-left">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
              About Clytrix Hosting
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <Globe className="h-6 w-6 text-[#3b82f6] mb-2" />
                <h3 className="text-sm font-bold text-white">Global CDN</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Lightning-fast content delivery across 40+ edge locations worldwide with 99.9% uptime SLA.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <Server className="h-6 w-6 text-[#3b82f6] mb-2" />
                <h3 className="text-sm font-bold text-white">Cloud VPS</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Scalable virtual private servers starting at just $2.99/mo. SSD storage, DDoS protection included.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <Lock className="h-6 w-6 text-[#3b82f6] mb-2" />
                <h3 className="text-sm font-bold text-white">Enterprise Security</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Free SSL certificates, Web Application Firewall, and automated malware scanning on all plans.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="text-[#3b82f6] font-semibold">Clytrix.com</span> is a leading web hosting provider trusted by over 50,000 websites globally. We offer shared hosting, WordPress hosting, dedicated servers, and domain registration at unbeatable prices. Our 24/7 support team is available via live chat, Telegram, and email. Whether you are launching a personal blog or a high-traffic e-commerce store, Clytrix provides the infrastructure, security, and reliability your business needs. <span className="text-gray-500">This suspension page is powered by Clytrix Abuse Detection & Network Protection systems.</span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0a0e27]/95">
        <div className="mx-auto max-w-5xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            Powered by <span className="text-gray-300 font-semibold">Clytrix Hosting Solutions</span>
          </span>
          <span className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} Clytrix Inc. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
