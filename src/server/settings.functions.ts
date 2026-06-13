import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailViaResend } from "./email";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Admin access required");
}

export const listAllSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("*")
      .order("key");
    if (error) throw new Error(error.message);
    return { settings: data ?? [] };
  });

export const updateSetting = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string; value: Record<string, any> }) => {
    if (!input?.key || typeof input.key !== "string") throw new Error("key required");
    if (input.key.length > 128) throw new Error("key too long");
    if (typeof input.value !== "object" || input.value === null) throw new Error("value must be object");
    const json = JSON.stringify(input.value);
    if (json.length > 50_000) throw new Error("value too large");
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({
        key: data.key,
        value: data.value,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        is_public: true,
      }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { to: string }) => {
    if (!input?.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.to)) throw new Error("Valid recipient email required");
    if (input.to.length > 255) throw new Error("Email too long");
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    await sendEmailViaResend({
      to: data.to,
      subject: "ZeptoMail test from your admin panel",
      html: `<p>This is a test email sent at ${new Date().toISOString()} from your platform admin settings.</p><p>If you received this, your ZeptoMail configuration is working correctly.</p>`,
      text: `Test email at ${new Date().toISOString()}`,
    });
    return { ok: true };
  });
