// Server-only email sender. Never import from client code.

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmailViaZepto(params: SendEmailParams): Promise<void> {
  const token = process.env.ZEPTOMAIL_API_TOKEN;
  const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL;
  const fromName = process.env.ZEPTOMAIL_FROM_NAME || "AMZ.jobs";

  if (!token) throw new Error("ZEPTOMAIL_API_TOKEN is not configured");
  if (!fromEmail) throw new Error("ZEPTOMAIL_FROM_EMAIL is not configured");

  // ZeptoMail India region
  const endpoint = "https://api.zeptomail.in/v1.1/email";

  const body = {
    from: { address: fromEmail, name: fromName },
    to: [{ email_address: { address: params.to, name: params.toName || params.to } }],
    subject: params.subject,
    htmlbody: params.html,
    ...(params.text ? { textbody: params.text } : {}),
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token.startsWith("Zoho-enczapikey ") ? token : `Zoho-enczapikey ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`ZeptoMail send failed (${resp.status}): ${errText.slice(0, 500)}`);
  }
}

export async function sendEmailViaResend(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME || process.env.ZEPTOMAIL_FROM_NAME || "AMZ.jobs";

  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (!fromEmail) throw new Error("RESEND_FROM_EMAIL or ZEPTOMAIL_FROM_EMAIL is not configured");

  const endpoint = "https://api.resend.com/emails";

  const body = {
    from: `${fromName} <${fromEmail}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    ...(params.text ? { text: params.text } : {}),
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Resend send failed (${resp.status}): ${errText.slice(0, 500)}`);
  }
}

export function buildOtpEmailHtml(opts: {
  code: string;
  purpose: "signup" | "new_ip";
  ip?: string;
  userAgent?: string;
}): string {
  const heading =
    opts.purpose === "signup"
      ? "Verify your email"
      : "New device sign-in verification";
  const intro =
    opts.purpose === "signup"
      ? "Welcome to AMZ.Jobs! Use the code below to verify your email address and complete signup."
      : "We noticed a sign-in to your AMZ.Jobs account from a new IP address. Enter this code to confirm it was you.";
  const meta = opts.ip
    ? `<p style="font-size:12px;color:#565959;margin:16px 0 0">IP: ${escapeHtml(opts.ip)}${opts.userAgent ? `<br/>Device: ${escapeHtml(opts.userAgent.slice(0, 120))}` : ""}</p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F1111">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border:1px solid #e7e7e7;border-radius:8px;overflow:hidden">
    <div style="background:#131A22;padding:18px 24px"><div style="color:#FF9900;font-weight:700;font-size:20px">AWZ<span style="color:#fff">.Jobs</span></div></div>
    <div style="padding:28px 24px">
      <h1 style="margin:0 0 12px;font-size:22px;color:#0F1111">${heading}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#0F1111">${intro}</p>
      <div style="background:#f7f8fa;border:1px solid #e7e7e7;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:13px;color:#565959;margin-bottom:6px">Your verification code</div>
        <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0F1111">${escapeHtml(opts.code)}</div>
        <div style="font-size:12px;color:#565959;margin-top:8px">Expires in 10 minutes</div>
      </div>
      <p style="margin:18px 0 0;font-size:13px;color:#565959">If you didn't request this, you can safely ignore this email.</p>
      ${meta}
    </div>
    <div style="background:#f7f8fa;padding:14px 24px;border-top:1px solid #e7e7e7;font-size:12px;color:#565959;text-align:center">© AMZ.Jobs — Remote Work Opportunities</div>
  </div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
