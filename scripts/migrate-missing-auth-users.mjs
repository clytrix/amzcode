#!/usr/bin/env node
/**
 * Migrate missing auth users from old to new Supabase
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

async function main() {
  console.log('Migrating missing auth users...\n');
  
  // Get users from both
  const { data: oldUsers } = await oldSupabase.auth.admin.listUsers();
  const { data: newUsers } = await newSupabase.auth.admin.listUsers();
  
  const newUserIds = new Set(newUsers.users.map(u => u.id));
  const missingUsers = oldUsers.users.filter(u => !newUserIds.has(u.id));
  
  console.log(`Old Supabase: ${oldUsers.users.length} users`);
  console.log(`New Supabase: ${newUsers.users.length} users`);
  console.log(`Missing: ${missingUsers.length} users\n`);
  
  let created = 0;
  let failed = 0;
  
  for (const user of missingUsers) {
    try {
      const { error } = await newSupabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {},
      });
      
      if (error) {
        console.log(`❌ ${user.email}: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ ${user.email}`);
        created++;
      }
      
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.log(`❌ ${user.email}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Created: ${created}, ❌ Failed: ${failed}`);
  
  // Verify
  const { data: finalUsers } = await newSupabase.auth.admin.listUsers();
  console.log(`\nNew Supabase now has: ${finalUsers.users.length} users`);
}

main().catch(console.error);
