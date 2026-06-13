import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { enforceSessionIp } from "@/server/session-ip.functions";
import { getOrCreateDeviceId } from "@/lib/device-id";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Install a global fetch wrapper exactly once, in the browser, that attaches:
//   1. The stable device id (X-Device-Id) to every same-origin request — server
//      functions use this to bind sessions to the device instead of the IP.
//   2. The current Supabase access token (Authorization: Bearer …) to same-
//      origin TanStack Start server-function calls (`/_serverFn/...`). Without
//      this, requireSupabaseAuth rejects every server-fn call with 401 in
//      production because the browser never attaches the JWT itself.
function installDeviceIdHeader() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __awz_fetch_patched__?: boolean };
  if (w.__awz_fetch_patched__) return;
  w.__awz_fetch_patched__ = true;

  const deviceId = getOrCreateDeviceId();
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      // Only attach to same-origin requests so we don't leak the id or token
      // to third parties (e.g. Supabase REST is on a different origin and is
      // already authenticated by the supabase-js client).
      const url = typeof input === "string"
        ? input
        : input instanceof URL ? input.toString() : (input as Request).url;
      const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
      if (!sameOrigin) return originalFetch(input, init);

      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has("X-Device-Id")) headers.set("X-Device-Id", deviceId);

      // Attach the Supabase access token to server-function calls so the
      // requireSupabaseAuth middleware can identify the caller. We restrict
      // this to the `/_serverFn/` namespace so we don't override caller-set
      // Authorization headers on other same-origin endpoints (e.g. webhooks).
      const path = url.startsWith("/") ? url : new URL(url).pathname;
      if (path.startsWith("/_serverFn/") && !headers.has("Authorization")) {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("Authorization", `Bearer ${token}`);
        } catch {
          // fall through — server fn will reject with 401 if auth is required
        }
      }

      return originalFetch(input, { ...init, headers });
    } catch {
      return originalFetch(input, init);
    }
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Track the last device-touch we did, so we don't ping on every token refresh.
  const lastTouchRef = useRef<{ uid: string; at: number } | null>(null);

  const checkRole = async (uid: string | undefined) => {
    if (!uid) { setIsAdmin(false); return; }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  // Lightweight device "ping" — refreshes last_seen_at so admins/users can see
  // device activity, and bootstraps a record for pre-existing sessions.
  // It NEVER signs the user out: the new logic returns `trusted: true` in all
  // normal cases, and we treat any error as a no-op.
  const touchDevice = async (uid: string | undefined) => {
    if (!uid) return;
    const now = Date.now();
    const last = lastTouchRef.current;
    // Throttle to once per 5 minutes per user to avoid hammering the server fn
    // on every token refresh / window focus.
    if (last && last.uid === uid && now - last.at < 5 * 60 * 1000) return;
    lastTouchRef.current = { uid, at: now };
    try {
      await enforceSessionIp({ data: undefined as unknown as never });
    } catch {
      // fail-soft — never log the user out from a transient network error
    }
  };

  useEffect(() => {
    installDeviceIdHeader();

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setTimeout(() => { void checkRole(newSession?.user?.id); }, 0);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setTimeout(() => { void touchDevice(newSession?.user?.id); }, 0);
      }
      // Intentionally do NOT touch on TOKEN_REFRESHED — Supabase refreshes hourly
      // and there's no security benefit to re-pinging that often.
    });

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      void checkRole(s?.user?.id).finally(() => setLoading(false));
      void touchDevice(s?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    lastTouchRef.current = null;
  };

  const refreshRole = async () => { await checkRole(user?.id); };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
