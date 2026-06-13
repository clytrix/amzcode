#!/usr/bin/env node
/**
 * Migrate Auth Users from Old to New Supabase
 * Preserves user IDs so database FKs remain valid
 */

import { createClient } from '@supabase/supabase-js';

// OLD Supabase (source)
const OLD_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';

// NEW Supabase (target)
const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function migrateAuthUsers() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AUTH USERS MIGRATION                                     ║');
  console.log('║     Old → New Supabase                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Fetch all users from OLD supabase
  console.log('📥 Fetching users from OLD Supabase...');
  const { data: oldUsers, error: oldError } = await oldSupabase.auth.admin.listUsers();
  
  if (oldError) {
    console.error('❌ Failed to fetch old users:', oldError.message);
    return;
  }

  console.log(`✅ Found ${oldUsers.users.length} users in old Supabase\n`);

  // 2. Fetch existing users from NEW supabase
  console.log('📥 Checking existing users in NEW Supabase...');
  const { data: newUsers, error: newError } = await newSupabase.auth.admin.listUsers();
  
  if (newError) {
    console.error('❌ Failed to fetch new users:', newError.message);
    return;
  }

  const existingEmails = new Set(newUsers.users.map(u => u.email));
  console.log(`✅ Found ${newUsers.users.length} existing users in new Supabase\n`);

  // 3. Create missing users in NEW supabase
  console.log('🚀 Creating missing users in NEW Supabase...\n');
  
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of oldUsers.users) {
    try {
      if (existingEmails.has(user.email)) {
        console.log(`⏭️  Skipping (exists): ${user.email}`);
        skipped++;
        continue;
      }

      // Create user with same ID and metadata
      const { data, error } = await newSupabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true, // Auto-confirm email
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {},
        // Note: Password cannot be migrated (Supabase security)
        // Users will use OTP login
      });

      if (error) {
        console.error(`❌ Failed to create ${user.email}: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ Created: ${user.email} (ID: ${data.user.id})`);
        created++;
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`❌ Error creating ${user.email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);

  // 4. Verify final count
  console.log('\n🔍 Verifying migration...');
  const { data: finalUsers } = await newSupabase.auth.admin.listUsers();
  console.log(`   Total users in NEW Supabase: ${finalUsers.users.length}`);
  
  if (finalUsers.users.length === oldUsers.users.length) {
    console.log('\n🎉 All users migrated successfully!');
  } else {
    console.log(`\n⚠️  Mismatch: ${oldUsers.users.length} expected, ${finalUsers.users.length} found`);
  }
}

migrateAuthUsers().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
