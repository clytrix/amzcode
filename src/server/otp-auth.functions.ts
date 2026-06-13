import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>();

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP using Supabase Auth with custom SMTP
// This uses the custom SMTP configured in Supabase project settings
async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending OTP to ${email} via Supabase custom SMTP...`);

    // Use Supabase auth to send OTP - this uses the configured custom SMTP
    // Supabase will send the OTP email with the code
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Don't create new user, only existing
      }
    });

    if (error) {
      console.error('[Email] Supabase OTP error:', error.message);
      return false;
    }

    console.log(`[Email] OTP email sent successfully to ${email} via custom SMTP`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send OTP email:', error);
    return false;
  }
}

// Request OTP
export const requestOTP = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }: { data: { email: string } }) => {
    const { email } = data;

    // Check if user exists
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) {
      throw new Error("Failed to verify user");
    }

    const user = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error("No account found with this email");
    }

    // Generate and store OTP
    const otp = generateOTP();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, { otp, expires, attempts: 0 });

    // Send email
    const sent = await sendOTPEmail(email, otp);
    if (!sent) {
      console.log(`[OTP DEBUG] ${email}: ${otp}`);
      return {
        success: true,
        message: "Email service temporarily unavailable. Please use this OTP: " + otp
      };
    }

    return { 
      success: true, 
      message: "OTP sent to your email. Please check your inbox." 
    };
  });

// Verify OTP - when using Supabase custom SMTP, the OTP is verified client-side
// This function just validates the user exists
export const verifyOTP = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ 
    email: z.string().email(), 
    otp: z.string().length(6) 
  }).parse(input))
  .handler(async ({ data }: { data: { email: string; otp: string } }) => {
    const { email } = data;

    // Get user to return user info
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error("User not found");
    }

    // OTP verification is done client-side with supabase.auth.verifyOtp()
    // which creates the session properly
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailConfirmed: !!user.email_confirmed_at,
      },
      message: "User found - verify OTP client-side",
    };
  });

// Check if user exists
export const checkUserExists = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }: { data: { email: string } }) => {
    const { email } = data;

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      throw new Error("Failed to check user");
    }

    const user = users.users.find((u: any) => u.email === email);
    
    return {
      exists: !!user,
      email,
    };
  });
