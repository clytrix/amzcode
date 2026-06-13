#!/usr/bin/env node
/**
 * Final Migration - Map old user IDs to new user IDs by email
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

async function buildUserIdMap() {
  console.log('Building user ID mapping...\n');
  
  // Get old profiles with emails
  const { data: oldProfiles } = await oldSupabase.from('profiles').select('id, email');
  
  // Get new auth users
  const { data: newUsers } = await newSupabase.auth.admin.listUsers();
  
  // Build email -> new_user_id map
  const emailToNewId = {};
  for (const user of newUsers.users) {
    emailToNewId[user.email.toLowerCase()] = user.id;
  }
  
  // Build old_id -> new_id map
  const userIdMap = {};
  let matched = 0;
  let unmatched = 0;
  
  for (const profile of oldProfiles) {
    const newId = emailToNewId[profile.email.toLowerCase()];
    if (newId) {
      userIdMap[profile.id] = newId;
      matched++;
    } else {
      console.log(`⚠️  No match for: ${profile.email}`);
      unmatched++;
    }
  }
  
  console.log(`✅ Matched: ${matched}, ⚠️ Unmatched: ${unmatched}\n`);
  return userIdMap;
}

function remapUserIds(data, userIdMap, userIdFields = ['user_id']) {
  return data.map(row => {
    const newRow = { ...row };
    for (const field of userIdFields) {
      if (row[field] && userIdMap[row[field]]) {
        newRow[field] = userIdMap[row[field]];
      } else if (row[field] && !userIdMap[row[field]]) {
        // User not found - mark for filtering
        newRow._skip = true;
      }
    }
    return newRow;
  }).filter(row => !row._skip);
}

async function migrateTable(tableName, userIdMap, userIdFields = ['user_id']) {
  console.log(`\n📊 Migrating ${tableName}...`);
  
  const { data: rows, error } = await oldSupabase.from(tableName).select('*');
  if (error || !rows || rows.length === 0) {
    console.log(`  ⏭️  No data`);
    return 0;
  }
  
  // Remap user IDs
  const remappedRows = remapUserIds(rows, userIdMap, userIdFields);
  const skipped = rows.length - remappedRows.length;
  
  if (skipped > 0) {
    console.log(`  ⏭️  Skipped ${skipped} rows (user not found)`);
  }
  
  if (remappedRows.length === 0) {
    console.log(`  ⏭️  No valid rows`);
    return 0;
  }
  
  // Insert in batches
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < remappedRows.length; i += batchSize) {
    const batch = remappedRows.slice(i, i + batchSize);
    
    const { error: insertError } = await newSupabase
      .from(tableName)
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
    
    if (insertError) {
      console.log(`  ⚠️  Batch ${i/batchSize + 1}: ${insertError.message.substring(0, 60)}`);
    } else {
      inserted += batch.length;
    }
  }
  
  console.log(`  ✅ ${inserted}/${remappedRows.length} rows`);
  return inserted;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     FINAL MIGRATION - With User ID Remapping                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const userIdMap = await buildUserIdMap();
  
  if (Object.keys(userIdMap).length === 0) {
    console.log('❌ No user mappings found!');
    return;
  }
  
  const tables = [
    { name: 'profiles', fields: ['id'] },
    { name: 'user_roles', fields: ['user_id'] },
    { name: 'wallets', fields: ['user_id'] },
    { name: 'kyc_submissions', fields: ['user_id', 'admin_approved_by'] },
    { name: 'employment_packages', fields: ['user_id'] },
    { name: 'job_applications', fields: ['user_id', 'reviewed_by'] },
    { name: 'tasks', fields: ['user_id', 'assigned_by'] },
    { name: 'tickets', fields: ['user_id', 'assigned_to'] },
    { name: 'ticket_messages', fields: ['sender_id'] },
    { name: 'attendance', fields: ['user_id'] },
    { name: 'wallet_transactions', fields: ['user_id', 'wallet_id'] },
    { name: 'salary_disbursements', fields: ['user_id', 'generated_by', 'approved_by'] },
    { name: 'withdrawals', fields: ['user_id', 'processed_by'] },
    { name: 'data_entry_submissions', fields: ['user_id', 'reviewed_by'] },
    { name: 'login_ips', fields: ['user_id'] },
  ];
  
  let total = 0;
  for (const { name, fields } of tables) {
    total += await migrateTable(name, userIdMap, fields);
  }
  
  console.log(`\n✅ MIGRATION COMPLETE! Total rows: ${total}`);
  
  // Verify
  const { data: count } = await newSupabase.from('profiles').select('count', { count: 'exact', head: true });
  console.log(`📊 New Supabase now has ${count.count} profiles`);
}

main().catch(console.error);
