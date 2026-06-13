/**
 * Recreate auth users in the TARGET Supabase project.
 * Sends each user a password-reset email so they can set a new password.
 *
 * Run with:
 *   TARGET_URL=https://pwjybjpsvojmrdbdmssq.supabase.co \
 *   TARGET_SERVICE_KEY=<service role key> \
 *   SITE_URL=https://amzsolution.site \
 *   bun run import-users.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const url = process.env.TARGET_URL!;
const key = process.env.TARGET_SERVICE_KEY!;
const site = process.env.SITE_URL || "https://amzsolution.site";
if (!url || !key) { console.error("Set TARGET_URL and TARGET_SERVICE_KEY"); process.exit(1); }

const sb = createClient(url, key);
const users = JSON.parse(readFileSync("./users.json", "utf8"));

let ok = 0, fail = 0, skipped = 0;
for (const u of users) {
  try {
    // Recreate with a temporary random password — user resets via email.
    const tempPwd = crypto.randomUUID() + "Aa1!";
    const { error } = await sb.auth.admin.createUser({
      // CRITICAL: preserve the original UUID so all FK references to user_id stay valid.
      id: u.id,
      email: u.email,
      phone: u.phone || undefined,
      password: tempPwd,
      email_confirm: true,
      user_metadata: u.metadata || {},
    } as any);
    if (error) {
      if (/already.*registered|exists/i.test(error.message)) { skipped++; console.log("⊙ skip", u.email); continue; }
      throw error;
    }
    // Send password reset email
    await sb.auth.resetPasswordForEmail(u.email, { redirectTo: `${site}/login` });
    ok++;
    console.log("✓", u.email);
  } catch (e: any) {
    fail++;
    console.error("✗", u.email, e.message);
  }
}
console.log(`\nDone. ok=${ok} skipped=${skipped} fail=${fail}`);
