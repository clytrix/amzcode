#!/usr/bin/env node
/**
 * Complete Migration - Schema + Data + Storage
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function migrateStorage() {
  console.log('\n📁 Migrating Storage Buckets...\n');
  
  // Get buckets from old
  const { data: oldBuckets, error: oldError } = await oldSupabase.storage.listBuckets();
  if (oldError) {
    console.error('❌ Failed to list old buckets:', oldError.message);
    return;
  }
  
  console.log(`Found ${oldBuckets.length} buckets in old Supabase`);
  
  for (const bucket of oldBuckets) {
    try {
      // Check if bucket exists in new
      const { data: existing } = await newSupabase.storage.getBucket(bucket.id);
      if (existing) {
        console.log(`⏭️  Bucket ${bucket.id} already exists`);
        continue;
      }
    } catch {
      // Bucket doesn't exist, create it
    }
    
    try {
      const { error } = await newSupabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: bucket.file_size_limit,
        allowedMimeTypes: bucket.allowed_mime_types,
      });
      
      if (error) {
        console.error(`❌ Failed to create bucket ${bucket.id}:`, error.message);
      } else {
        console.log(`✅ Created bucket: ${bucket.id} (public: ${bucket.public})`);
      }
    } catch (err) {
      console.error(`❌ Error creating bucket ${bucket.id}:`, err.message);
    }
  }
}

async function migrateTableData(tableName) {
  try {
    console.log(`📊 Migrating ${tableName}...`);
    
    // Fetch from old
    const { data: rows, error } = await oldSupabase.from(tableName).select('*');
    if (error) {
      console.log(`  ⚠️  ${tableName}: ${error.message}`);
      return 0;
    }
    
    if (!rows || rows.length === 0) {
      console.log(`  ⏭️  ${tableName}: no data`);
      return 0;
    }
    
    // Insert to new in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const { error: insertError } = await newSupabase
        .from(tableName)
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
      
      if (insertError) {
        console.log(`  ⚠️  ${tableName} batch ${i/batchSize + 1}: ${insertError.message}`);
      } else {
        inserted += batch.length;
      }
    }
    
    console.log(`  ✅ ${tableName}: ${inserted}/${rows.length} rows`);
    return inserted;
  } catch (err) {
    console.error(`  ❌ ${tableName}: ${err.message}`);
    return 0;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     COMPLETE MIGRATION - Data & Storage                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  // 1. Migrate storage buckets
  await migrateStorage();
  
  // 2. Migrate all tables
  console.log('\n📊 Migrating Table Data...\n');
  
  const tables = [
    'profiles', 'user_roles', 'platform_settings', 'wallets',
    'kyc_submissions', 'employment_packages', 'email_templates',
    'projects', 'jobs', 'job_applications', 'tasks',
    'tickets', 'ticket_messages', 'attendance',
    'earnings', 'wallet_transactions', 'salary_disbursements', 'withdrawals',
    'data_entry_invoices', 'data_entry_daily_pool', 'data_entry_submissions',
    'login_ips'
  ];
  
  let totalRows = 0;
  for (const table of tables) {
    totalRows += await migrateTableData(table);
  }
  
  // 3. Data Entry Package tables (if they exist)
  console.log('\n📦 Migrating Data Entry Package tables...\n');
  await migrateTableData('data_entry_packages');
  await migrateTableData('user_data_entry_subscriptions');
  await migrateTableData('data_entry_daily_completions');
  
  console.log(`\n✅ Migration Complete!`);
  console.log(`   Total rows migrated: ${totalRows}`);
  
  // 4. Verify
  console.log('\n🔍 Verification...');
  const { data: profiles } = await newSupabase.from('profiles').select('count', { count: 'exact', head: true });
  const { data: buckets } = await newSupabase.storage.listBuckets();
  
  console.log(`   Profiles: ${profiles?.count || 0} rows`);
  console.log(`   Buckets: ${buckets?.length || 0}`);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
