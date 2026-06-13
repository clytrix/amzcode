#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const supabase = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debug() {
  console.log('Debugging new Supabase auth...\n');
  
  // 1. List all users
  const { data, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log(`✅ Total users: ${data.users.length}\n`);
  
  // 2. Show first 10 users
  console.log('First 10 users:');
  data.users.slice(0, 10).forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email}`);
  });
  
  // 3. Check storage buckets
  console.log('\n📁 Checking storage buckets...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error('❌ Bucket error:', bucketError.message);
  } else {
    console.log(`✅ Buckets: ${buckets.length}`);
    buckets.forEach(b => console.log(`  - ${b.name} (public: ${b.public})`));
  }
  
  // 4. Check profiles
  console.log('\n👤 Checking profiles table...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .limit(5);
    
  if (profileError) {
    console.error('❌ Profile error:', profileError.message);
  } else {
    console.log(`✅ Profiles: ${profiles.length} sample rows`);
    profiles.forEach(p => console.log(`  - ${p.email}: ${p.full_name}`));
  }
}

debug();
