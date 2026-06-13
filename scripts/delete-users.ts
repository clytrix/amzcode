// Temporary script to delete users from auth.users
// Run with: npx tsx scripts/delete-users.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    storage: undefined,
    persistSession: false,
    autoRefreshToken: false,
  }
});

const usersToDelete = [
  'c630e94c-f874-4667-9a55-dd7f8bcab557', // webersmitra@hotmail.com
  '725136c6-6b5d-4abf-9ccb-26e4956dd0b0', // prout2197@gmail.com
  '8fe02186-8533-428a-9b4c-0ea2ae28f55d', // cloudsovereign@gmail.com
];

async function deleteUsers() {
  console.log('Deleting users from auth.users...');
  
  for (const userId of usersToDelete) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        console.error(`Failed to delete user ${userId}:`, error.message);
      } else {
        console.log(`Deleted user ${userId}`);
      }
    } catch (e: any) {
      console.error(`Error deleting user ${userId}:`, e.message);
    }
  }
  
  console.log('Done');
}

deleteUsers().catch(console.error);
