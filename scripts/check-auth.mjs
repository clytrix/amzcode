import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://egamyzmrubgptylgpzgr.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ';

const supabase = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkAuth() {
  console.log('Checking auth users in new Supabase...\n');
  
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log(`Total users: ${users.users.length}\n`);
  
  // Check which users have passwords set
  let withPassword = 0;
  let withoutPassword = 0;
  
  for (const user of users.users.slice(0, 5)) {
    console.log(`Email: ${user.email}`);
    console.log(`  Created: ${user.created_at}`);
    console.log(`  Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`  Has password: ${user.last_sign_in_at ? 'Yes' : 'Unknown'}`);
    console.log('');
  }
  
  console.log('\nNote: Password hashes are not visible via API for security.');
  console.log('If users can\'t login, they need to use "Forgot Password" to reset.');
}

checkAuth();
