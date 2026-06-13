import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const supabase = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const SITE_URL = 'https://amzsolution.site';

async function sendResetEmails() {
  console.log('Fetching all users from new Supabase...\n');
  
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('❌ Failed to fetch users:', error.message);
    return;
  }
  
  console.log(`Found ${users.users.length} users\n`);
  console.log('Sending password reset emails...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const user of users.users) {
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${SITE_URL}/reset-password`,
      });
      
      if (resetError) {
        console.log(`❌ ${user.email}: ${resetError.message}`);
        failCount++;
      } else {
        console.log(`✅ ${user.email}`);
        successCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`❌ ${user.email}: ${err.message}`);
      failCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount} sent, ${failCount} failed`);
  console.log(`\n✅ Password reset emails sent!`);
  console.log(`\n📝 Users will receive emails with a link to:`);
  console.log(`   ${SITE_URL}/reset-password`);
  console.log(`\nThey can set a new password and then login normally.`);
}

sendResetEmails().catch(console.error);
