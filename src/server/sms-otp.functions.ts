import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  normaliseMobile,
  isValidIndianMobile,
  createAndSendSmsOtp,
  verifySmsOtp,
  findUserByMobile,
  findUserByEmail,
} from "./sms-otp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── SERVER FUNCTIONS ─────────────────────────────────────────────────────────

/** LOGIN: step 1 — look up account, send SMS OTP. Accepts email or Indian mobile. */
export const requestLoginOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ identifier: z.string().trim().min(1).max(255) }).parse)
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    let mobile: string;

    if (raw.includes("@")) {
      const user = await findUserByEmail(raw);
      if (!user) throw new Error("No account found with this email address.");
      if (!user.phone) throw new Error("No mobile number on file for this account. Contact support.");
      if (!isValidIndianMobile(user.phone)) throw new Error("Mobile number on file is not valid. Contact support.");
      mobile = normaliseMobile(user.phone);
    } else {
      if (!isValidIndianMobile(raw)) {
        throw new Error("Enter a valid 10-digit Indian mobile number or your registered email.");
      }
      mobile = normaliseMobile(raw);
      const user = await findUserByMobile(mobile);
      if (!user) throw new Error("No account found with this mobile number.");
    }

    const { sent } = await createAndSendSmsOtp(mobile, "login");
    if (!sent) throw new Error("Failed to send OTP via SMS. Please try again.");

    const digits = mobile.slice(-4);
    return { success: true, mobile, maskedTarget: `+91 xxxxxx${digits}` };
  });

/** LOGIN: step 2 — verify OTP, return hashed token for Supabase session. */
export const verifyLoginOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      mobile: z.string().min(10).max(15),
      code: z.string().regex(/^\d{6}$/),
    }).parse,
  )
  .handler(async ({ data }) => {
    const mobile = normaliseMobile(data.mobile);
    const result = await verifySmsOtp(mobile, data.code, "login");
    if (!result.ok) throw new Error(result.error);

    const user = await findUserByMobile(mobile);
    if (!user) throw new Error("User not found.");

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
      options: { redirectTo: "/dashboard" },
    });
    if (error || !linkData?.properties?.hashed_token) {
      throw new Error("Failed to create session token. Please try again.");
    }

    return {
      success: true,
      email: user.email,
      hashedToken: linkData.properties.hashed_token,
    };
  });

/** SIGNUP: step 1 — validate mobile, send SMS OTP */
export const requestSignupSmsOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ mobile: z.string().trim().min(1).max(20) }).parse)
  .handler(async ({ data }) => {
    if (!isValidIndianMobile(data.mobile)) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }
    const mobile = normaliseMobile(data.mobile);

    const existing = await findUserByMobile(mobile);
    if (existing) throw new Error("This mobile number is already registered. Please login.");

    const { sent } = await createAndSendSmsOtp(mobile, "signup");
    if (!sent) throw new Error("Failed to send OTP via SMS. Please try again.");

    return { success: true, mobile };
  });

/** SIGNUP: step 2 — verify OTP and create account */
export const verifySignupSmsOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      mobile: z.string().min(10).max(15),
      code: z.string().regex(/^\d{6}$/),
      fullName: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(255),
      password: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const mobile = normaliseMobile(data.mobile);

    const result = await verifySmsOtp(mobile, data.code, "signup");
    if (!result.ok) throw new Error(result.error);

    const emailUser = await findUserByEmail(data.email);
    if (emailUser) throw new Error("This email address is already registered.");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      phone: mobile,
      phone_confirm: true,
      user_metadata: { full_name: data.fullName, phone: mobile },
    });
    if (createErr) throw new Error(createErr.message || "Failed to create account.");

    if (created.user) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: created.user.id,
        role: "employee",
      });

      // Create profile record
      await supabaseAdmin.from("profiles").insert({
        id: created.user.id,
        email: created.user.email,
        full_name: data.fullName,
        phone: mobile,
        phone_verified: true,
        email_verified: true,
      });
    }

    return { ok: true };
  });

/** FORGOT PASSWORD: step 1 — send SMS OTP. Accepts email or mobile. */
export const requestForgotPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ identifier: z.string().trim().min(1).max(255) }).parse)
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    let mobile: string;
    let email: string;

    if (raw.includes("@")) {
      const user = await findUserByEmail(raw);
      if (!user) throw new Error("No account found with this email address.");
      if (!user.phone) throw new Error("No mobile number on file. Contact support.");
      mobile = normaliseMobile(user.phone);
      email = user.email;
    } else {
      if (!isValidIndianMobile(raw)) throw new Error("Enter a valid 10-digit Indian mobile number.");
      mobile = normaliseMobile(raw);
      const user = await findUserByMobile(mobile);
      if (!user) throw new Error("No account found with this mobile number.");
      email = user.email;
    }

    if (!isValidIndianMobile(mobile)) throw new Error("Mobile number on file is not valid. Contact support.");

    const { sent } = await createAndSendSmsOtp(mobile, "forgot");
    if (!sent) throw new Error("Failed to send OTP via SMS. Please try again.");

    const digits = mobile.slice(-4);
    return { success: true, mobile, email, maskedTarget: `+91 xxxxxx${digits}` };
  });

/** FORGOT PASSWORD: step 2 — verify OTP + set new password */
export const verifyForgotPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      mobile: z.string().min(10).max(15),
      code: z.string().regex(/^\d{6}$/),
      newPassword: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const mobile = normaliseMobile(data.mobile);
    const result = await verifySmsOtp(mobile, data.code, "forgot");
    if (!result.ok) throw new Error(result.error);

    const user = await findUserByMobile(mobile);
    if (!user) throw new Error("User not found.");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.newPassword,
    });
    if (error) throw new Error("Failed to update password: " + error.message);

    return { ok: true };
  });
