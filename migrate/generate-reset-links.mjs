import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://pwjybjpsvojmrdbdmssq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1Njk3NSwiZXhwIjoyMDkyMzMyOTc1fQ.q24Pviu84arjUbghrziy3rfj7z43uwaKGCEq_mvRrjw';
const SITE_URL = 'https://amzsolution.site';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const usersJson = readFileSync(join(__dirname, 'users.json'), 'utf8');
  const users = JSON.parse(usersJson);
  
  console.log('Generating password reset links...\n');
  
  let links = [];
  
  for (const user of users) {
    try {
      // Generate password reset link
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: {
          redirectTo: `${SITE_URL}/reset-password`,
        },
      });
      
      if (error) {
        console.error(`❌ ${user.email}: ${error.message}`);
        continue;
      }
      
      const resetUrl = data.properties.action_link;
      links.push({
        email: user.email,
        name: user.metadata?.full_name || user.email,
        link: resetUrl
      });
      
      console.log(`✅ ${user.email}`);
      
      // Small delay
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`❌ ${user.email}: ${err.message}`);
    }
  }
  
  // Save to file
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Password Reset Links - AMZ.jobs</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; }
    a { color: #0066cc; word-break: break-all; }
    .copy-btn { 
      background: #FF9900; 
      color: #0F1111; 
      border: none; 
      padding: 8px 12px; 
      cursor: pointer; 
      border-radius: 4px;
      font-size: 12px;
    }
    .copy-btn:hover { background: #e88a00; }
  </style>
</head>
<body>
  <h1>AMZ.jobs Password Reset Links</h1>
  <p>Share these links with users. Each link expires in 1 hour.</p>
  <table>
    <tr>
      <th>User</th>
      <th>Email</th>
      <th>Reset Link</th>
      <th>Copy</th>
    </tr>
${links.map(u => `    <tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><a href="${u.link}" target="_blank">Click to Reset</a></td>
      <td><button class="copy-btn" onclick="navigator.clipboard.writeText('${u.link}')">Copy Link</button></td>
    </tr>`).join('\n')}
  </table>
  <script>
    console.log('Password reset links loaded');
  </script>
</body>
</html>`;
  
  writeFileSync(join(__dirname, 'reset-links.html'), htmlContent);
  
  console.log(`\n✅ Generated ${links.length} reset links`);
  console.log(`📄 Saved to: reset-links.html`);
  console.log('\n--- Links ---\n');
  
  links.forEach(u => {
    console.log(`${u.email}:`);
    console.log(`${u.link}\n`);
  });
}

main().catch(console.error);
