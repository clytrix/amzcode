// Stable per-browser device identifier.
// Stored in localStorage so it survives across sessions, tab closes, IP changes,
// and Wi-Fi/cellular network switches. Used by the auth flow to grant
// device-based trust instead of fragile IP-based trust.
//
// Notes:
//   * Not a strong fingerprint — just a random UUID we mint once per browser.
//   * If the user clears site data, they'll need to re-verify via OTP. That's
//     by design and acceptable security UX.
//   * Custom request header: X-Device-Id (read by server functions via
//     getRequestHeader).

const STORAGE_KEY = "awz.device.id";
const NAME_KEY = "awz.device.name";

function randomId(): string {
  // Prefer crypto.randomUUID when available (all modern browsers).
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // Fallback: 32 hex chars from getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;
    const fresh = randomId();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / storage disabled — return a per-session id (memory only).
    return randomId();
  }
}

/** Best-effort human-readable device label from the user-agent. */
export function describeDevice(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const cached = (() => {
    try { return window.localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
  })();
  if (cached) return cached;

  const ua = navigator.userAgent || "";
  const platform =
    /Windows/i.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/i.test(ua) ? "macOS" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Linux/i.test(ua) ? "Linux" :
    "Unknown OS";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" :
    "Browser";
  const label = `${browser} on ${platform}`;
  try { window.localStorage.setItem(NAME_KEY, label); } catch { /* ignore */ }
  return label;
}
