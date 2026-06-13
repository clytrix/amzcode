// Server-only helpers for loading and rendering admin-editable email templates.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailViaResend } from "@/server/email";

export type TemplateKey =
  | "task_assigned"
  | "task_due_soon"
  | "task_overdue"
  | "kyc_documents_submitted"
  | "kyc_fee_paid"
  | "kyc_in_review"
  | "kyc_approved"
  | "kyc_rejected";

interface RenderedTemplate {
  subject: string;
  html: string;
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function substitute(template: string, vars: Record<string, string | number | null | undefined>, opts: { html: boolean }) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    if (v === undefined || v === null || v === "") return "";
    return opts.html ? escapeHtml(String(v)) : String(v);
  });
}

function wrapHtml(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F1111">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e7e7e7;border-radius:8px;overflow:hidden">
    <div style="background:#131A22;padding:18px 24px"><div style="color:#FF9900;font-weight:700;font-size:20px">AWZ<span style="color:#fff">.Jobs</span></div></div>
    <div style="padding:28px 24px"><h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(title)}</h1>${body}</div>
    <div style="background:#f7f8fa;padding:14px 24px;border-top:1px solid #e7e7e7;font-size:12px;color:#565959;text-align:center">© AMZ.Jobs — Remote Work Opportunities</div>
  </div></body></html>`;
}

export async function renderTemplate(
  key: TemplateKey,
  vars: Record<string, string | number | null | undefined>,
): Promise<RenderedTemplate> {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("subject, body_html")
    .eq("template_key", key)
    .maybeSingle();
  if (error) throw new Error(`Template load failed: ${error.message}`);
  if (!data) throw new Error(`Email template "${key}" not found`);

  const subject = substitute(data.subject, vars, { html: false });
  const body = substitute(data.body_html, vars, { html: true });
  return { subject, html: wrapHtml(subject, body) };
}

interface SendOptions {
  to: string;
  toName?: string;
  templateKey: TemplateKey;
  variables: Record<string, string | number | null | undefined>;
}

export async function sendTemplatedEmail(opts: SendOptions): Promise<void> {
  const rendered = await renderTemplate(opts.templateKey, opts.variables);
  await sendEmailViaResend({
    to: opts.to,
    toName: opts.toName,
    subject: rendered.subject,
    html: rendered.html,
  });
}

export function buildTaskUrl(): string {
  const base = process.env.PUBLIC_SITE_URL || "https://amzsolution.site";
  return `${base.replace(/\/$/, "")}/dashboard/tasks`;
}

export function buildDashboardUrl(): string {
  const base = process.env.PUBLIC_SITE_URL || "https://amzsolution.site";
  return `${base.replace(/\/$/, "")}/dashboard`;
}

export function buildKycUrl(): string {
  const base = process.env.PUBLIC_SITE_URL || "https://amzsolution.site";
  return `${base.replace(/\/$/, "")}/dashboard/kyc`;
}
