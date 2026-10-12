const pw = require('../client/node_modules/playwright-core');

(async () => {
  try {
    const b = await pw.chromium.launch({ channel: 'msedge', headless: true });
    console.log('msedge launch success!');
    await b.close();
  } catch (e) {
    console.log('msedge failed:', e.message);
    try {
      const b2 = await pw.chromium.launch({ channel: 'chrome', headless: true });
      console.log('chrome launch success!');
      await b2.close();
    } catch (e2) {
      console.log('chrome failed:', e2.message);
    }
  }
})();
