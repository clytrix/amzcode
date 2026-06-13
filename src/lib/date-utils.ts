// Date utilities with Indian Standard Time (Asia/Kolkata) support

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Get current date/time in IST
 */
export function nowIST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE })
  );
}

/**
 * Format a date to IST locale string
 */
export function toISTLocaleString(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  const options: Intl.DateTimeFormatOptions = opts || {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  
  return d.toLocaleString("en-IN", { ...options, timeZone: IST_TIMEZONE });
}

/**
 * Format a date to IST date only
 */
export function toISTDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Format a date to IST time only
 */
export function toISTTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Get today's date in IST (YYYY-MM-DD format for database queries)
 */
export function todayIST(): string {
  const now = nowIST();
  return now.toISOString().split("T")[0];
}

/**
 * Convert a database timestamp to display format with IST
 * Handles null/invalid dates gracefully
 */
export function formatRewardTimestamp(date: string | Date | null | undefined): string {
  if (!date) return "Just now";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime()) || d.getFullYear() < 1971) return "Just now";
  
  return toISTLocaleString(d, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get relative time (e.g., "2 hours ago", "Just now") in IST context
 */
export function timeAgoIST(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  const now = nowIST();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  
  return toISTDate(d);
}
