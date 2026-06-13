import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailViaResend } from "./email";

// Generate password reset link and send via ZeptoMail
export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
    }).parse
  )
  .handler(async ({ data }) => {
    const siteUrl = process.env.PUBLIC_SITE_URL || "https://amzsolution.site";
    
    // Generate password reset link via Supabase
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: data.email,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    if (linkError) {
      console.error("Failed to generate reset link:", linkError);
      throw new Error("Failed to generate password reset link");
    }

    const resetUrl = linkData.properties.action_link;
    
    // Send email via ZeptoMail
    try {
      await sendEmailViaResend({
        to: data.email,
        subject: "Reset your AMZ.jobs password",
        html: buildPasswordResetEmailHtml({ resetUrl, email: data.email }),
      });
      
      return { sent: true };
    } catch (e) {
      console.error("Password reset email failed:", e);
      throw new Error("Failed to send password reset email");
    }
  });

function buildPasswordResetEmailHtml(opts: { resetUrl: string; email: string }): string {
  return `<!doctype html>
<html>
<body style="margin:0;background:#f3f3f3;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F1111">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border:1px solid #e7e7e7;border-radius:8px;overflow:hidden">
    <div style="background:#150226;padding:18px 24px">
      <div style="color:#7216a5;font-weight:700;font-size:20px">AMZ<span style="color:#fff">.jobs</span></div>
    </div>
    <div style="padding:28px 24px">
      <h1 style="margin:0 0 12px;font-size:22px;color:#0F1111">Reset your password</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#0F1111">
        We received a request to reset the password for your account (${opts.email}). 
        Click the button below to reset your password.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${opts.resetUrl}" 
           style="display:inline-block;background:#7216a5;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:15px">
          Reset Password
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#565959">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:8px 0;font-size:12px;color:#565959;word-break:break-all">
        ${opts.resetUrl}
      </p>
      <p style="margin:18px 0 0;font-size:13px;color:#565959">
        This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f7f8fa;padding:14px 24px;border-top:1px solid #e7e7e7;font-size:12px;color:#565959;text-align:center">
      © AMZ.jobs — Remote Work Opportunities
    </div>
  </div>
</body>
</html>`;
}
