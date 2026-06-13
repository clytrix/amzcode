#!/usr/bin/env node
/**
 * Smart Migration - Only migrate data for users that exist in new auth
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

async function getNewAuthUserIds() {
  const { data, error } = await newSupabase.auth.admin.listUsers();
  if (error) throw error;
  return new Set(data.users.map(u => u.id));
}

async function migrateTable(tableName, newUserIds) {
  console.log(`\n📊 Migrating ${tableName}...`);
  
  // Fetch from old
  const { data: rows, error } = await oldSupabase.from(tableName).select('*');
  if (error || !rows || rows.length === 0) {
    console.log(`  ⏭️  No data`);
    return 0;
  }
  
  // Filter rows that have valid user_ids in new auth
  const validRows = rows.filter(row => {
    if (!row.user_id) return true; // No user_id constraint
    return newUserIds.has(row.user_id);
  });
  
  const skipped = rows.length - validRows.length;
  if (skipped > 0) {
    console.log(`  ⏭️  Skipped ${skipped} rows (user not in auth)`);
  }
  
  if (validRows.length === 0) {
    console.log(`  ⏭️  No valid rows to migrate`);
    return 0;
  }
  
  // Insert to new in batches
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize);
    
    const { error: insertError } = await newSupabase
      .from(tableName)
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
    
    if (insertError) {
      console.log(`  ⚠️  Batch ${i/batchSize + 1}: ${insertError.message.substring(0, 80)}`);
    } else {
      inserted += batch.length;
    }
  }
  
  console.log(`  ✅ ${inserted}/${validRows.length} rows`);
  return inserted;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     SMART MIGRATION - Skip invalid users                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const newUserIds = await getNewAuthUserIds();
  console.log(`\n✅ Found ${newUserIds.size} auth users in new Supabase`);
  
  const tables = [
    'profiles', 'user_roles', 'wallets', 'kyc_submissions', 
    'employment_packages', 'projects', 'jobs', 'job_applications',
    'tasks', 'tickets', 'ticket_messages', 'attendance',
    'earnings', 'wallet_transactions', 'salary_disbursements', 
    'withdrawals', 'data_entry_submissions', 'login_ips'
  ];
  
  let total = 0;
  for (const table of tables) {
    total += await migrateTable(table, newUserIds);
  }
  
  console.log(`\n✅ Migration Complete! Total rows: ${total}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
