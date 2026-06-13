const ZEPTOMAIL_TOKEN = 'PHtE6r0OFru9g2F88RYBs/TtEc+lNYx4qL80KQZFs4ZFCKQCHk0B/Yh4xzeyoh4sXKRGQqGTyIppsbvK5+PRd2zoNmxKCWqyqK3sx/VYSPOZsbq6x00UtVkddUTZU4Xme9Rr1y3Uv96X';
const ZEPTOMAIL_FROM = 'info@amzsolution.site';

async function testZeptoMail() {
  const endpoint = 'https://api.zeptomail.in/v1.1/email';
  const token = ZEPTOMAIL_TOKEN.startsWith('Zoho-enczapikey ') 
    ? ZEPTOMAIL_TOKEN 
    : `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`;
  
  const body = {
    from: { address: ZEPTOMAIL_FROM, name: 'AMZ.jobs' },
    to: [{ email_address: { address: 'cloudsovereign@gmail.com', name: 'Test User' } }],
    subject: 'ZeptoMail Test - AMZ.jobs',
    htmlbody: `<h1>Test Email</h1><p>This is a test from AMZ.jobs system.</p>`,
  };
  
  console.log('Sending test email via ZeptoMail...');
  console.log('Endpoint:', endpoint);
  console.log('From:', ZEPTOMAIL_FROM);
  
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const result = await resp.text();
    console.log('\nResponse status:', resp.status);
    console.log('Response body:', result);
    
    if (resp.ok) {
      console.log('\n✅ ZeptoMail API is working!');
    } else {
      console.log('\n❌ ZeptoMail API failed');
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  }
}

testZeptoMail();
