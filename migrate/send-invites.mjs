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
  
  console.log(`Sending invite emails to ${users.length} users...\n`);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const user of users) {
    try {
      // First check if user exists
      const { data: existing, error: checkError } = await supabase
        .from('auth.users')
        .select('id, email_confirmed_at')
        .eq('email', user.email)
        .maybeSingle();
      
      if (checkError) {
        console.log(`⚠️ ${user.email}: Check failed - ${checkError.message}`);
      }
      
      if (existing && existing.email_confirmed_at) {
        console.log(`⏭️ ${user.email}: Already confirmed, skipping`);
        skipped++;
        continue;
      }
      
      // Send invite which triggers password reset email via Supabase's configured email provider
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(user.email, {
        redirectTo: `${SITE_URL}/reset-password`,
        data: {
          full_name: user.metadata?.full_name || '',
          phone: user.metadata?.phone || '',
        }
      });
      
      if (error) {
        // If invite fails because user exists, try generate link instead
        if (error.message.includes('already exists') || error.message.includes('already registered')) {
          console.log(`⚠️ ${user.email}: User exists, trying password reset...`);
          
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${SITE_URL}/reset-password`,
          });
          
          if (resetError) {
            console.error(`❌ ${user.email}: Reset failed - ${resetError.message}`);
            failed++;
          } else {
            console.log(`✅ ${user.email}: Password reset email sent`);
            success++;
          }
        } else {
          console.error(`❌ ${user.email}: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`✅ ${user.email}: Invite sent`);
        success++;
      }
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`❌ ${user.email}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Done! ${success} sent, ${failed} failed, ${skipped} skipped`);
}

main().catch(console.error);
