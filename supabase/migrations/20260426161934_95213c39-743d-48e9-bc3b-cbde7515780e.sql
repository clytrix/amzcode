
-- Email templates table for admin-editable email wording
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  description TEXT,
  variables TEXT[] NOT NULL DEFAULT '{}',
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage email templates"
ON public.email_templates FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_email_templates_updated
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default templates. {{var}} placeholders are substituted server-side.
INSERT INTO public.email_templates (template_key, name, subject, body_html, description, variables) VALUES
('task_assigned',
 'Task assigned',
 'New task assigned: {{task_title}}',
 '<p>Hi {{employee_name}},</p>
<p>A new task has been assigned to you on Amazon Jobs Portal.</p>
<div style="background:#f7f8fa;border:1px solid #e7e7e7;border-radius:8px;padding:14px;margin:14px 0">
  <div style="font-weight:700;font-size:16px;margin-bottom:6px">{{task_title}}</div>
  <div style="font-size:13px;color:#565959;white-space:pre-wrap">{{task_description}}</div>
  <div style="margin-top:10px;font-size:12px"><b>Reward:</b> ₹{{reward_amount}} · <b>Deadline:</b> {{deadline}}</div>
</div>
<p style="margin:14px 0"><a href="{{task_url}}" style="background:#FF9900;color:#0F1111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open task</a></p>
<p style="margin:14px 0;font-size:12px;color:#565959">Or copy this link: {{task_url}}</p>',
 'Sent when an admin assigns a new task to an employee.',
 ARRAY['employee_name','task_title','task_description','reward_amount','deadline','task_url']),

('task_due_soon',
 'Task due soon',
 'Reminder: "{{task_title}}" is due soon',
 '<p>Hi {{employee_name}},</p>
<p>This is a friendly reminder that your task <b>{{task_title}}</b> is due on <b>{{deadline}}</b>.</p>
<p>Reward on approval: <b>₹{{reward_amount}}</b></p>
<p style="margin:14px 0"><a href="{{task_url}}" style="background:#FF9900;color:#0F1111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open task</a></p>
<p style="margin:14px 0;font-size:12px;color:#565959">Sign in to submit your work or request more time.</p>',
 'Sent automatically when a task deadline is within 24 hours.',
 ARRAY['employee_name','task_title','reward_amount','deadline','task_url']),

('task_overdue',
 'Task overdue',
 'Overdue: {{task_title}}',
 '<p>Hi {{employee_name}},</p>
<p>Your task <b>{{task_title}}</b> was due <b>{{deadline}}</b> and is now <b style="color:#b12704">overdue</b>. Please submit it as soon as possible.</p>
<p>Reward on approval: <b>₹{{reward_amount}}</b></p>
<p style="margin:14px 0"><a href="{{task_url}}" style="background:#b12704;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Submit task now</a></p>',
 'Sent automatically when a task passes its deadline without submission.',
 ARRAY['employee_name','task_title','reward_amount','deadline','task_url']),

('kyc_documents_submitted',
 'KYC — documents submitted',
 'KYC received — under review',
 '<p>Hi {{employee_name}},</p>
<p>Thanks — we''ve received your KYC submission and your security deposit payment.</p>
<p>Our team will verify your documents within 24 hours and email you with the outcome.</p>
<p style="font-size:12px;color:#565959">Payment reference: <b>{{payment_reference}}</b></p>',
 'Sent when an employee completes KYC submission with payment.',
 ARRAY['employee_name','payment_reference']),

('kyc_fee_paid',
 'KYC — fee paid',
 'Payment received for KYC verification',
 '<p>Hi {{employee_name}},</p>
<p>We''ve received your KYC processing fee of <b>${{fee_amount}}</b>. Your submission will move into review shortly.</p>
<p style="font-size:12px;color:#565959">Payment reference: <b>{{payment_reference}}</b></p>',
 'Sent when the KYC fee payment is recorded.',
 ARRAY['employee_name','fee_amount','payment_reference']),

('kyc_in_review',
 'KYC — review in progress',
 'Your KYC is now in review',
 '<p>Hi {{employee_name}},</p>
<p>An admin has started reviewing your KYC documents. You''ll receive another email shortly with the final decision.</p>',
 'Sent when an admin opens the submission for active review.',
 ARRAY['employee_name']),

('kyc_approved',
 'KYC — approved',
 'Your KYC has been approved 🎉',
 '<p>Hi {{employee_name}},</p>
<p>Great news — your KYC verification has been <b style="color:#067d62">approved</b>. You can now request withdrawals from the dashboard.</p>
<p style="margin:14px 0"><a href="{{dashboard_url}}" style="background:#067d62;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Go to dashboard</a></p>',
 'Sent when the admin approves the KYC submission.',
 ARRAY['employee_name','dashboard_url']),

('kyc_rejected',
 'KYC — rejected',
 'Update on your KYC submission',
 '<p>Hi {{employee_name}},</p>
<p>Unfortunately your KYC submission was <b style="color:#b12704">not approved</b>. Please review the note below, correct any issues, and resubmit.</p>
<div style="background:#f7f8fa;border-left:3px solid #b12704;padding:10px 14px;margin:14px 0;font-size:13px"><b>Reason:</b><br/>{{admin_notes}}</div>
<p style="margin:14px 0"><a href="{{kyc_url}}" style="background:#FF9900;color:#0F1111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Resubmit KYC</a></p>',
 'Sent when an admin rejects the KYC submission.',
 ARRAY['employee_name','admin_notes','kyc_url']);
