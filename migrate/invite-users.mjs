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
  
  console.log(`Inviting ${users.length} users via Supabase Auth...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      // Use inviteUserByEmail - this sends an invite email and creates the user
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(user.email, {
        redirectTo: `${SITE_URL}/reset-password`,
        data: {
          full_name: user.metadata?.full_name || '',
          phone: user.metadata?.phone || '',
        },
      });
      
      if (error) {
        // If user already exists, try password reset instead
        if (error.message.includes('already') || error.message.includes('exists')) {
          console.log(`⚠️ ${user.email}: Already exists, sending reset email...`);
          
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${SITE_URL}/reset-password`,
          });
          
          if (resetError) {
            console.error(`❌ ${user.email}: Reset failed - ${resetError.message}`);
            failed++;
          } else {
            console.log(`✅ ${user.email}: Reset email sent`);
            success++;
          }
        } else {
          console.error(`❌ ${user.email}: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`✅ Invited: ${user.email} (ID: ${data.user.id})`);
        success++;
      }
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`❌ ${user.email}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Done! ${success} sent, ${failed} failed`);
}

main().catch(console.error);
