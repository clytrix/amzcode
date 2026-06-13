#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const supabase = createClient(NEW_URL, NEW_SERVICE_KEY);

async function checkSchema() {
  console.log('Checking schema in NEW Supabase...\n');
  
  const tables = ['profiles', 'user_roles', 'wallets', 'kyc_submissions'];
  
  for (const table of tables) {
    console.log(`\n📋 Table: ${table}`);
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', table);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log(`  ❌ Table does not exist`);
    } else {
      console.log(`  ✅ Columns: ${data.map(c => c.column_name).join(', ')}`);
    }
  }
}

checkSchema();
