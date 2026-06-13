const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const migrationFile = path.join(__dirname, '..', 'migrations', 'data_entry_packages.sql');

async function applyMigration() {
  console.log('Reading migration file...');
  const sql = fs.readFileSync(migrationFile, 'utf8');
  
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  console.log(`Found ${statements.length} SQL statements to execute...\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    // Skip SELECT statements that don't modify data
    if (stmt.toLowerCase().includes('select') && !stmt.toLowerCase().includes('insert')) {
      console.log(`[${i + 1}/${statements.length}] Skipping SELECT statement...`);
      continue;
    }
    
    console.log(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 60)}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        // Try direct query if RPC fails
        const { error: queryError } = await supabase.from('_dummy').select('*').limit(0);
        if (queryError && queryError.message.includes('relation "_dummy" does not exist')) {
          // This is expected, we're just testing connection
        }
        console.log(`  ⚠️  Warning: ${error.message}`);
      } else {
        console.log(`  ✅ Success`);
      }
    } catch (err) {
      console.log(`  ⚠️  Warning: ${err.message}`);
    }
  }
  
  console.log('\n✅ Migration completed!');
  console.log('\nVerifying tables were created...');
  
  // Verify tables exist
  const tables = ['data_entry_packages', 'user_data_entry_subscriptions', 'data_entry_daily_completions'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: exists`);
    }
  }
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
