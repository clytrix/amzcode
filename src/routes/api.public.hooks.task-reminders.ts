import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendEmailViaZepto } from "@/server/email";

// Cron-triggered endpoint that sends due-soon and overdue task reminder emails.
// Called by pg_cron via pg_net. Reminders are throttled per task using
// `tasks.last_reminder_sent_at` so each task is reminded at most once per ~20h.
// Email wording comes from the editable `email_templates` table (keys
// `task_due_soon` and `task_overdue`).

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://amzsolution.site";

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function substitute(template: string, vars: Record<string, string | number>, opts: { html: boolean }) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    if (v === undefined || v === null) return "";
    return opts.html ? escapeHtml(String(v)) : String(v);
  });
}

function wrap(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F1111">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e7e7e7;border-radius:8px;overflow:hidden">
    <div style="background:#131A22;padding:18px 24px"><div style="color:#FF9900;font-weight:700;font-size:20px">AWZ<span style="color:#fff">.Jobs</span></div></div>
    <div style="padding:28px 24px"><h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(title)}</h1>${body}</div>
    <div style="background:#f7f8fa;padding:14px 24px;border-top:1px solid #e7e7e7;font-size:12px;color:#565959;text-align:center">© AMZ.Jobs — Remote Work Opportunities</div>
  </div></body></html>`;
}

export const Route = createFileRoute("/api/public/hooks/task-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
        }
        const supabase = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const now = new Date();
        const soonThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const throttleCutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000);

        const { data: tasks, error } = await supabase
          .from("tasks")
          .select("id, user_id, title, deadline, reward_amount, last_reminder_sent_at, status")
          .in("status", ["assigned", "in_progress"])
          .not("deadline", "is", null)
          .lt("deadline", soonThreshold.toISOString())
          .order("deadline", { ascending: true })
          .limit(200);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const due = (tasks || []).filter((t: any) => {
          if (!t.last_reminder_sent_at) return true;
          return new Date(t.last_reminder_sent_at) < throttleCutoff;
        });
        if (due.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }));

        const userIds = Array.from(new Set(due.map((t: any) => t.user_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        // Load both task templates once (admin-editable).
        const { data: templates } = await supabase
          .from("email_templates")
          .select("template_key, subject, body_html")
          .in("template_key", ["task_due_soon", "task_overdue"]);
        const tplMap = new Map((templates || []).map((t: any) => [t.template_key, t]));

        const taskUrl = `${SITE_URL.replace(/\/$/, "")}/dashboard/tasks`;

        let sent = 0;
        const errors: string[] = [];
        for (const t of due) {
          const p: any = pMap.get(t.user_id);
          if (!p?.email) continue;
          const dl = new Date(t.deadline);
          const overdue = dl < now;
          const tpl: any = tplMap.get(overdue ? "task_overdue" : "task_due_soon");
          if (!tpl) continue;

          const vars = {
            employee_name: p.full_name || "there",
            task_title: t.title,
            reward_amount: Number(t.reward_amount || 0),
            deadline: dl.toLocaleString("en-IN"),
            task_url: taskUrl,
          };
          const subject = substitute(tpl.subject, vars, { html: false });
          const body = substitute(tpl.body_html, vars, { html: true });
          const html = wrap(subject, body);

          try {
            await sendEmailViaZepto({ to: p.email, toName: p.full_name || undefined, subject, html });
            await supabase.from("tasks").update({ last_reminder_sent_at: now.toISOString() }).eq("id", t.id);
            sent++;
          } catch (e: any) {
            errors.push(`${t.id}: ${e?.message || "send failed"}`);
          }
        }

        return new Response(JSON.stringify({ ok: true, sent, errors }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
