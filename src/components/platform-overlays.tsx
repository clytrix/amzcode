import { useEffect } from "react";
import { MessageCircle, X, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { usePublicSettings } from "@/lib/platform-settings";

/**
 * Mounts global site features driven by admin platform settings:
 * - Maintenance banner
 * - Custom head/body code injection
 * - Telegram floating support widget
 */
export function PlatformOverlays() {
  const { settings } = usePublicSettings();
  const tg = settings["telegram.widget"];
  const code = settings["custom.code"];
  const maint = settings["site.maintenance"];

  // Inject custom HTML snippets into <head> and end-of-body. Cleans up on unmount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const nodes: HTMLElement[] = [];

    if (code.head_html?.trim()) {
      const wrap = document.createElement("div");
      wrap.setAttribute("data-platform-injected", "head");
      wrap.style.display = "none";
      wrap.innerHTML = code.head_html;
      // Move script tags so they execute
      Array.from(wrap.querySelectorAll("script")).forEach((old) => {
        const s = document.createElement("script");
        for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
        s.text = old.text;
        old.replaceWith(s);
      });
      document.head.appendChild(wrap);
      nodes.push(wrap);
    }
    if (code.body_end_html?.trim()) {
      const wrap = document.createElement("div");
      wrap.setAttribute("data-platform-injected", "body");
      wrap.innerHTML = code.body_end_html;
      Array.from(wrap.querySelectorAll("script")).forEach((old) => {
        const s = document.createElement("script");
        for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
        s.text = old.text;
        old.replaceWith(s);
      });
      document.body.appendChild(wrap);
      nodes.push(wrap);
    }
    // Google Analytics shorthand
    if (code.analytics_id?.trim() && /^G-[A-Z0-9]+$/.test(code.analytics_id.trim())) {
      const id = code.analytics_id.trim();
      const s1 = document.createElement("script");
      s1.async = true;
      s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      const s2 = document.createElement("script");
      s2.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
      document.head.appendChild(s1);
      document.head.appendChild(s2);
      nodes.push(s1, s2);
    }
    return () => { nodes.forEach((n) => n.remove()); };
  }, [code.head_html, code.body_end_html, code.analytics_id]);

  return (
    <>
      {maint.enabled && (
        <div className="sticky top-0 z-50 flex items-center gap-2 bg-warning/90 px-4 py-2 text-xs font-semibold text-warning-foreground shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{maint.message}</span>
        </div>
      )}
      {tg.enabled && tg.bot_username ? <TelegramWidget username={tg.bot_username} message={tg.welcome_message} position={tg.position} /> : null}
    </>
  );
}

function TelegramWidget({ username, message, position }: { username: string; message: string; position: string }) {
  const [open, setOpen] = useState(false);
  const align = position === "bottom-left" ? "left-4" : "right-4";
  const url = `https://t.me/${encodeURIComponent(username)}`;
  return (
    <div className={`fixed bottom-4 z-40 flex flex-col items-end gap-2 ${align}`}>
      {open && (
        <div className="w-64 rounded-lg border bg-card p-3 text-sm shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-bold">Need help?</div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{message}</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#229ED9] px-3 py-2 text-xs font-bold text-white hover:opacity-90">
            <MessageCircle className="h-4 w-4" /> Chat on Telegram
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open support chat"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-lg transition hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
