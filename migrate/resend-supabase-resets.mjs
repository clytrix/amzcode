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
  
  console.log(`Sending password reset emails to ${users.length} users via Supabase (ZeptoMail SMTP)...`);
  console.log(`Site URL: ${SITE_URL}\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      // Use Supabase auth resetPasswordForEmail - this will use your configured SMTP
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${SITE_URL}/reset-password`,
      });
      
      if (error) {
        console.error(`❌ ${user.email}: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ ${user.email}: Reset email sent via Supabase`);
        success++;
      }
      
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
