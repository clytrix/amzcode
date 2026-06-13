import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const migrationFile = path.join(__dirname, '..', 'migrations', 'data_entry_packages.sql');

async function applyMigration() {
  console.log('🚀 Starting migration...\n');
  console.log('Reading migration file...');
  
  const sql = fs.readFileSync(migrationFile, 'utf8');
  
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  console.log(`Found ${statements.length} SQL statements to execute...\n`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    const preview = stmt.substring(0, 70).replace(/\s+/g, ' ');
    
    try {
      // Use the Supabase REST API to execute SQL
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ sql: stmt })
      });
      
      if (!response.ok) {
        const error = await response.text();
        // Check if it's a "relation already exists" error which is fine
        if (error.includes('already exists')) {
          console.log(`[${i + 1}/${statements.length}] ⏭️  Already exists: ${preview}...`);
          skipCount++;
        } else {
          console.log(`[${i + 1}/${statements.length}] ⚠️  Warning: ${preview}...`);
          console.log(`     ${error.substring(0, 100)}`);
          errorCount++;
        }
      } else {
        console.log(`[${i + 1}/${statements.length}] ✅ ${preview}...`);
        successCount++;
      }
    } catch (err) {
      console.log(`[${i + 1}/${statements.length}] ⚠️  Error: ${preview}...`);
      console.log(`     ${err.message.substring(0, 100)}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount} success, ${skipCount} skipped, ${errorCount} errors`);
  
  // Verify tables exist
  console.log('\n🔍 Verifying tables...');
  const tables = ['data_entry_packages', 'user_data_entry_subscriptions', 'data_entry_daily_completions'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.log(`  ❌ ${table}: ${error.message}`);
      } else {
        console.log(`  ✅ ${table}: exists`);
      }
    } catch (e) {
      console.log(`  ❌ ${table}: ${e.message}`);
    }
  }
  
  console.log('\n🎉 Migration process completed!');
}

applyMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
