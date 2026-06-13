import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const SITE_URL = 'https://amzsolution.site';
const ZEPTOMAIL_TOKEN = 'PHtE6r0OFru9g2F88RYBs/TtEc+lNYx4qL80KQZFs4ZFCKQCHk0B/Yh4xzeyoh4sXKRGQqGTyIppsbvK5+PRd2zoNmxKCWqyqK3sx/VYSPOZsbq6x00UtVkddUTZU4Xme9Rr1y3Uv96X';
const ZEPTOMAIL_FROM = 'info@amzsolution.site';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendZeptoEmail(to, subject, html) {
  const endpoint = 'https://api.zeptomail.in/v1.1/email';
  const token = ZEPTOMAIL_TOKEN.startsWith('Zoho-enczapikey ') 
    ? ZEPTOMAIL_TOKEN 
    : `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`;
  
  const body = {
    from: { address: ZEPTOMAIL_FROM, name: 'AMZ.jobs' },
    to: [{ email_address: { address: to, name: to } }],
    subject,
    htmlbody: html,
  };
  
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`ZeptoMail failed (${resp.status}): ${err.slice(0, 200)}`);
  }
  
  return await resp.json();
}

function buildResetEmail(resetUrl, email) {
  return `<!doctype html>
<html>
<body style="margin:0;background:#f3f3f3;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F1111">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border:1px solid #e7e7e7;border-radius:8px;overflow:hidden">
    <div style="background:#131A22;padding:18px 24px">
      <div style="color:#FF9900;font-weight:700;font-size:20px">AMZ<span style="color:#fff">.jobs</span></div>
    </div>
    <div style="padding:28px 24px">
      <h1 style="margin:0 0 12px;font-size:22px;color:#0F1111">Reset your password</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#0F1111">
        We received a request to reset the password for your account (${email}). 
        Click the button below to reset your password.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${resetUrl}" 
           style="display:inline-block;background:#FF9900;color:#0F1111;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:15px">
          Reset Password
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#565959">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:8px 0;font-size:12px;color:#565959;word-break:break-all">
        ${resetUrl}
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

// Generate a secure token for password reset
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function main() {
  const usersJson = readFileSync(join(__dirname, 'users.json'), 'utf8');
  const users = JSON.parse(usersJson);
  
  console.log(`Sending password reset emails to ${users.length} users via ZeptoMail...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      // Generate a secure reset token
      const token = generateToken();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Store the token in the user's recovery_token field
      const { error: updateError } = await supabase
        .from('auth.users')
        .update({ 
          recovery_token: tokenHash,
          recovery_sent_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`❌ ${user.email}: Failed to store token - ${updateError.message}`);
        failed++;
        continue;
      }
      
      // Build reset URL with the raw token
      const resetUrl = `${SITE_URL}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}&type=recovery`;
      
      // Send via ZeptoMail
      await sendZeptoEmail(
        user.email,
        'Reset your AMZ.jobs password',
        buildResetEmail(resetUrl, user.email)
      );
      
      console.log(`✅ ${user.email}: Reset email sent`);
      success++;
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`❌ ${user.email}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Done! ${success} sent, ${failed} failed`);
}

main().catch(console.error);
