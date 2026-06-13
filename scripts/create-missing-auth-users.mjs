#!/usr/bin/env node
/**
 * Create auth users for profiles that don't have them
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

async function main() {
  console.log('Creating missing auth users...\n');
  
  // Get old profiles
  const { data: oldProfiles } = await oldSupabase.from('profiles').select('id, email, full_name');
  
  // Get new auth users
  const { data: newAuth } = await newSupabase.auth.admin.listUsers();
  const newEmails = new Set(newAuth.users.map(u => u.email.toLowerCase()));
  
  // Find profiles without auth users
  const missingProfiles = oldProfiles.filter(p => !newEmails.has(p.email.toLowerCase()));
  
  console.log(`Found ${missingProfiles.length} profiles without auth users\n`);
  
  let created = 0;
  let failed = 0;
  
  for (const profile of missingProfiles) {
    try {
      // Create auth user with same ID as profile
      const { error } = await newSupabase.auth.admin.createUser({
        email: profile.email,
        email_confirm: true,
        user_metadata: { full_name: profile.full_name },
      });
      
      if (error) {
        console.log(`❌ ${profile.email}: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ Created auth user: ${profile.email}`);
        created++;
      }
      
      await new Promise(r => setTimeout(r, 200)); // Rate limit protection
    } catch (err) {
      console.log(`❌ ${profile.email}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Created: ${created}, ❌ Failed: ${failed}`);
  
  // Verify
  const { data: finalAuth } = await newSupabase.auth.admin.listUsers();
  console.log(`\nNew Supabase now has ${finalAuth.users.length} auth users`);
}

main().catch(console.error);
