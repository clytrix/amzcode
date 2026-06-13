#!/usr/bin/env node
/**
 * Complete Migration with proper user ID mapping
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function getAllAuthUsers(supabase) {
  let allUsers = [];
  let page = 1;
  
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    if (!data.users.length) break;
    
    allUsers = allUsers.concat(data.users);
    page++;
    
    if (page > 10) break; // Safety limit
  }
  
  return { users: allUsers };
}

async function buildUserMapping() {
  console.log('Building user ID mapping...\n');
  
  // Get all old auth users
  const oldAuth = await getAllAuthUsers(oldSupabase);
  
  // Get all new auth users  
  const newAuth = await getAllAuthUsers(newSupabase);
  
  // Build email -> new_user_id map
  const emailToNewId = {};
  for (const user of newAuth.users) {
    emailToNewId[user.email.toLowerCase()] = user.id;
  }
  
  // Build old_user_id -> new_user_id map by matching emails
  const userIdMap = {};
  let matched = 0;
  let unmatched = 0;
  
  for (const oldUser of oldAuth.users) {
    const newId = emailToNewId[oldUser.email.toLowerCase()];
    if (newId) {
      userIdMap[oldUser.id] = newId;
      matched++;
    } else {
      console.log(`⚠️  No match for old auth: ${oldUser.email}`);
      unmatched++;
    }
  }
  
  console.log(`✅ Matched: ${matched}, ⚠️ Unmatched: ${unmatched}\n`);
  return userIdMap;
}

function remapIds(data, userIdMap, fields = ['user_id']) {
  return data.map(row => {
    const newRow = { ...row };
    let skip = false;
    
    for (const field of fields) {
      if (row[field] && userIdMap[row[field]]) {
        newRow[field] = userIdMap[row[field]];
      } else if (row[field] && !userIdMap[row[field]]) {
        // User not found in mapping
        skip = true;
        break;
      }
    }
    
    return skip ? null : newRow;
  }).filter(row => row !== null);
}

async function migrateTable(tableName, userIdMap, fields = ['user_id']) {
  console.log(`📊 ${tableName}...`);
  
  // Fetch from old
  const { data: rows, error } = await oldSupabase.from(tableName).select('*');
  if (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
    return 0;
  }
  if (!rows || rows.length === 0) {
    console.log(`  ⏭️  No data`);
    return 0;
  }
  
  // Filter and remap
  const validRows = remapIds(rows, userIdMap, fields);
  const skipped = rows.length - validRows.length;
  
  if (skipped > 0) {
    console.log(`  ⏭️  Skipped ${skipped}/${rows.length}`);
  }
  
  if (validRows.length === 0) {
    return 0;
  }
  
  // Insert in batches
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize);
    
    const { error: insertError } = await newSupabase
      .from(tableName)
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
    
    if (insertError) {
      console.log(`  ⚠️  Batch ${i/batchSize + 1}: ${insertError.message.substring(0, 100)}`);
    } else {
      inserted += batch.length;
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log(`  ✅ ${inserted}/${validRows.length}`);
  return inserted;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     COMPLETE MIGRATION - Fixed User ID Mapping             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const userIdMap = await buildUserMapping();
  
  if (Object.keys(userIdMap).length === 0) {
    console.log('❌ No user mappings found!');
    return;
  }
  
  const tables = [
    { name: 'profiles', fields: ['id'] },
    { name: 'user_roles', fields: ['user_id'] },
    { name: 'wallets', fields: ['user_id'] },
    { name: 'kyc_submissions', fields: ['user_id', 'reviewed_by'] },
    { name: 'employment_packages', fields: ['user_id', 'created_by'] },
    { name: 'job_applications', fields: ['user_id', 'reviewed_by'] },
    { name: 'tasks', fields: ['user_id', 'assigned_by', 'reviewed_by'] },
    { name: 'tickets', fields: ['user_id', 'assigned_to'] },
    { name: 'ticket_messages', fields: ['sender_id'] },
    { name: 'attendance', fields: ['user_id'] },
    { name: 'wallet_transactions', fields: ['user_id'] },
    { name: 'salary_disbursements', fields: ['user_id', 'generated_by', 'approved_by'] },
    { name: 'withdrawals', fields: ['user_id', 'processed_by'] },
    { name: 'data_entry_submissions', fields: ['user_id', 'reviewed_by'] },
    { name: 'login_ips', fields: ['user_id'] },
  ];
  
  let total = 0;
  for (const { name, fields } of tables) {
    total += await migrateTable(name, userIdMap, fields);
  }
  
  console.log(`\n✅ MIGRATION COMPLETE! Total: ${total} rows`);
}

main().catch(console.error);
