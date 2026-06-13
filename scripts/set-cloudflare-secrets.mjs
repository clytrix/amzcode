#!/usr/bin/env node
/**
 * Set Cloudflare Worker Secrets
 */

import { execSync } from 'child_process';

const secrets = {
  'SUPABASE_URL': 'https://egamyzmrubgptylgpzgr.supabase.co',
  'SUPABASE_PUBLISHABLE_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjY3ODAsImV4cCI6MjA5MzgwMjc4MH0.2KqHvdUaH53FwqTD4VzVAeM0RHtdwN8mG0MwSy4CIaI',
  'SUPABASE_SERVICE_ROLE_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW15em1ydWJncHR5bGdwemdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIyNjc4MCwiZXhwIjoyMDkzODAyNzgwfQ.sdQcoPAMYEtHRyrgPbGemfEz1a-C3Obi156vLnzSLJQ',
  'VITE_SUPABASE_URL': 'https://egamyzmrubgptylgpzgr.supabase.co',
  'VITE_SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_tKDGSg2bpmBuGZE3v50dYQ_6Jr4Fsob',
  'VITE_SUPABASE_PROJECT_ID': 'egamyzmrubgptylgpzgr',
  'CRON_SECRET': 'cron-secret-amzsolution-2025',
  'ZEPTOMAIL_API_TOKEN': 'PHtE6r0OFru9g2F88RYBs/TtEc+lNYx4qL80KQZFs4ZFCKQCHk0B/Yh4xzeyoh4sXKRGQqGTyIppsbvK5+PRd2zoNmxKCWqyqK3sx/VYSPOZsbq6x00UtVkddUTZU4Xme9Rr1y3Uv96X',
  'ZEPTOMAIL_FROM_EMAIL': 'info@amzsolution.site',
  'ZEPTOMAIL_FROM_NAME': 'AMZ.jobs',
};

console.log('Setting Cloudflare Worker secrets...\n');

for (const [key, value] of Object.entries(secrets)) {
  console.log(`Setting ${key}...`);
  try {
    // Use echo to pipe the value
    const cmd = `echo "${value.replace(/"/g, '\\"')}" | npx wrangler secret put ${key} --name amzsolution`;
    execSync(cmd, { stdio: 'inherit', shell: true });
    console.log(`✅ ${key} set\n`);
  } catch (err) {
    console.error(`❌ Failed to set ${key}:`, err.message);
  }
}

console.log('\n🎉 All secrets set!');
