import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const SITE_URL = 'https://amzsolution.site';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const usersJson = readFileSync(join(__dirname, 'users.json'), 'utf8');
  const users = JSON.parse(usersJson);
  
  console.log(`Recreating ${users.length} users via Auth API and sending reset emails...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      // Step 1: Delete existing user if exists
      try {
        await supabase.auth.admin.deleteUser(user.id);
        console.log(`🗑️ Deleted existing: ${user.email}`);
      } catch (e) {
        // User might not exist, continue
      }
      
      // Step 2: Create user with admin API
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,  // Auto-confirm email
        user_metadata: {
          full_name: user.metadata?.full_name || '',
          phone: user.metadata?.phone || '',
        },
        id: user.id,  // Preserve original ID for FK relationships
      });
      
      if (createError) {
        console.error(`❌ ${user.email}: Create failed - ${createError.message}`);
        failed++;
        continue;
      }
      
      console.log(`✅ Created: ${user.email} (ID: ${newUser.user.id})`);
      
      // Step 3: Send password reset email (uses Supabase default email provider)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${SITE_URL}/reset-password`,
      });
      
      if (resetError) {
        console.error(`⚠️ ${user.email}: Reset email failed - ${resetError.message}`);
      } else {
        console.log(`📧 Reset email queued: ${user.email}`);
      }
      
      success++;
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`❌ ${user.email}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Done! ${success} users recreated, ${failed} failed`);
  console.log(`\n⚠️ Note: Password reset emails are sent via Supabase's default email provider.`);
  console.log(`To use ZeptoMail, configure it in Supabase Dashboard → Auth → Email → SMTP Settings`);
}

main().catch(console.error);
