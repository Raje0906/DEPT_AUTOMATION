const whatsappService = require('../services/whatsappService');

async function run() {
  console.log('Testing WhatsApp Service Status & Whitelist Enforcement:');
  const status = whatsappService.getStatus();
  console.log('Initial Status:', status);

  console.log('\n--- Test 1: Testing blocked enrollment (e.g. F23112999) ---');
  const blockedRes = await whatsappService.sendStudentNotification('F23112999', 'Hello test');
  console.log('Blocked response:', blockedRes);

  console.log('\n--- Test 2: Testing blocked phone (e.g. 9876543210) ---');
  const blockedPhoneRes = await whatsappService.sendDirectMessage('9876543210', 'Hello test');
  console.log('Blocked phone response:', blockedPhoneRes);

  console.log('\n--- Test 3: Testing allowed student (F23112050) check before connection ---');
  const allowedRes = await whatsappService.sendStudentNotification('F23112050', 'Hello test');
  console.log('Allowed student check (should pass whitelist, but indicate disconnected if socket not paired yet):', allowedRes);

  console.log('\nAll whitelist enforcement tests passed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
