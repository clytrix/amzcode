import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { Mail, Save, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/email-templates")({ component: AdminEmailTemplates });

interface Template {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body_html: string;
  description: string | null;
  variables: string[] | null;
  updated_at: string;
}

function AdminEmailTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body_html: string }>({ subject: "", body_html: "" });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("template_key", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setTemplates(data as Template[]);
      if (!activeKey && data && data.length > 0) {
        setActiveKey((data[0] as Template).template_key);
        setDraft({ subject: (data[0] as Template).subject, body_html: (data[0] as Template).body_html });
      }
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const active = templates.find((t) => t.template_key === activeKey) || null;

  const selectTemplate = (key: string) => {
    const t = templates.find((x) => x.template_key === key);
    if (!t) return;
    setActiveKey(key);
    setDraft({ subject: t.subject, body_html: t.body_html });
    setShowPreview(false);
  };

  const save = async () => {
    if (!active || !user) return;
    if (!draft.subject.trim() || !draft.body_html.trim()) {
      return toast.error("Subject and body cannot be empty.");
    }
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({ subject: draft.subject, body_html: draft.body_html, updated_by: user.id })
      .eq("id", active.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Template saved.");
    void load();
  };

  const reset = () => {
    if (!active) return;
    setDraft({ subject: active.subject, body_html: active.body_html });
    toast.info("Reverted to last saved version.");
  };

  const insertVariable = (v: string) => {
    setDraft((d) => ({ ...d, body_html: d.body_html + ` {{${v}}}` }));
  };

  // Live preview substitution with sample values
  const renderPreview = (html: string | null | undefined): string => {
    if (!active || !html) return html || "";
    const samples: Record<string, string> = {
      employee_name: "Priya Sharma",
      task_title: "Tag 50 product images for Q4 launch",
      task_description: "Please review and tag the assigned product images according to the guidelines.",
      reward_amount: "250",
      deadline: "Apr 30, 2026, 6:00 PM",
      task_url: "https://amzsolution.site/dashboard/tasks",
      payment_reference: "PAY-1714060000-AB12CD",
      fee_amount: "79",
      admin_notes: "ID document image was unclear. Please reupload with better lighting.",
      dashboard_url: "https://amzsolution.site/dashboard",
      kyc_url: "https://amzsolution.site/dashboard/kyc",
      full_name: "Priya Sharma",
      due_date: "Apr 30, 2026, 6:00 PM",
      priority: "High",
      rejection_reason: "ID document image was unclear. Please reupload with better lighting.",
    };
    return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => samples[k] ?? `{{${k}}}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Email Templates</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the wording of automated ZeptoMail notifications. Use{" "}
          <code className="rounded bg-secondary px-1 text-xs">{`{{variable_name}}`}</code> placeholders — they're
          replaced with real values when each email is sent.
        </p>
      </div>

      {loading && <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Loading…</div>}

      {!loading && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* Template list */}
          <aside className="space-y-1 rounded-md border bg-card p-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t.template_key)}
                className={`w-full rounded px-3 py-2 text-left text-sm transition ${
                  t.template_key === activeKey ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                <div className="font-bold">{t.name}</div>
                <div className={`mt-0.5 truncate text-[11px] ${t.template_key === activeKey ? "opacity-90" : "text-muted-foreground"}`}>
                  {t.template_key}
                </div>
              </button>
            ))}
          </aside>

          {/* Editor */}
          {active && (
            <div className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{active.name}</h2>
                  {active.description && <p className="text-xs text-muted-foreground">{active.description}</p>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Last updated: {new Date(active.updated_at).toLocaleString("en-IN")}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase">Subject</label>
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase">Body (HTML)</label>
                  <div className="flex flex-wrap gap-1">
                    {(active.variables || []).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] hover:bg-secondary/70"
                        title="Click to insert"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={draft.body_html}
                  onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
                  rows={14}
                  className="w-full rounded border border-input bg-white px-3 py-2 font-mono text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <AzButton variant="brand" size="sm" onClick={save} disabled={saving}>
                  <Save className="mr-1 h-3 w-3" />
                  {saving ? "Saving…" : "Save changes"}
                </AzButton>
                <AzButton variant="outline" size="sm" onClick={reset} disabled={saving}>
                  Reset
                </AzButton>
                <AzButton variant="outline" size="sm" onClick={() => setShowPreview((s) => !s)}>
                  <Eye className="mr-1 h-3 w-3" />
                  {showPreview ? "Hide preview" : "Show preview"}
                </AzButton>
              </div>

              {showPreview && (
                <div className="mt-3 rounded border bg-secondary/40 p-3">
                  <div className="mb-2 text-xs">
                    <span className="font-bold">Subject preview:</span>{" "}
                    {renderPreview(draft.subject)}
                  </div>
                  <div
                    className="rounded border bg-white p-3 text-sm"
                    // Live preview only — content comes from admin-controlled template + sample values, not user input
                    dangerouslySetInnerHTML={{ __html: renderPreview(draft.body_html) }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
