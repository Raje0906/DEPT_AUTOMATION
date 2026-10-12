const pw = require('../client/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Launching browser (msedge)...');
  const browser = await pw.chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

  // Log in as Dr. S. S. Raskar
  console.log('Logging in as Dr. S. S. Raskar...');
  await page.fill('input[type="text"], input[name="identifier"], input[placeholder*="ID"], input[placeholder*="Email"]', 'ssr');
  await page.fill('input[type="password"]', 'faculty@123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
  console.log('Current URL after login:', page.url());

  // TEST REQUEST 3: Direct view of draft magazine in OnlineMagazineViewer without opening editor first!
  const viewUrl = 'http://localhost:5173/faculty/magazines/view/MAG-NEW-1791542342264';
  console.log(`Testing direct View mode for draft magazine: ${viewUrl}`);
  await page.goto(viewUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check thumbnails count in OnlineMagazineViewer
  const viewerThumbnails = await page.locator('button:has(p.truncate)').count();
  console.log(`OnlineMagazineViewer found ${viewerThumbnails} page thumbnails rendered for draft magazine.`);
  if (viewerThumbnails > 5) {
    console.log('SUCCESS: Draft magazine is fully visible and rendered in View mode directly!');
  } else {
    console.warn(`Warning: viewer thumbnails count is ${viewerThumbnails}`);
  }

  // Navigate to magazine preview
  const previewUrl = 'http://localhost:5173/faculty/magazines/preview/MAG-NEW-1791542342264';
  console.log(`Navigating to preview URL: ${previewUrl}`);
  await page.goto(previewUrl, { waitUntil: 'networkidle' });

  // Wait for magazine pages to render
  console.log('Waiting for magazine pages to render...');
  await page.waitForSelector('.magazine-pdf-page', { timeout: 20000 });

  const pageCount = await page.locator('.magazine-pdf-page').count();
  console.log(`Found ${pageCount} magazine-pdf-page elements in DOM.`);

  // Wait extra 2 seconds for all images/fonts to paint
  await page.waitForTimeout(2500);

  // Now trigger PDF generation
  console.log('Triggering "Generate PDF"...');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90000 }),
    page.click('button:has-text("Generate PDF")'),
  ]);

  const destPath = path.join(__dirname, 'Reflection_Issue_33_New.pdf');
  await download.saveAs(destPath);
  console.log(`PDF successfully saved to: ${destPath}`);

  const stat = fs.statSync(destPath);
  console.log(`PDF File Size: ${stat.size} bytes`);

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error during execution:', err);
  process.exit(1);
});
