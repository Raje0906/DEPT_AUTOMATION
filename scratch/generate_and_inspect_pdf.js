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

  // Navigate to magazine preview
  const previewUrl = 'http://localhost:5173/faculty/magazines/preview/MAG-NEW-1791542342264';
  console.log(`Navigating to preview URL: ${previewUrl}`);
  await page.goto(previewUrl, { waitUntil: 'networkidle' });

  // Wait for magazine pages to render
  console.log('Waiting for magazine pages to render...');
  await page.waitForSelector('.magazine-pdf-page', { timeout: 15000 });

  const pageCount = await page.locator('.magazine-pdf-page').count();
  console.log(`Found ${pageCount} magazine-pdf-page elements in DOM.`);

  // Wait extra 2 seconds for all images/fonts to paint
  await page.waitForTimeout(2500);

  // Take screenshots of offscreen rendered sheets or visible pages for verification
  // Notice .magazine-pdf-page elements are inside #magazine-print-container which is at left: -9999px.
  // We can temporarily inspect or screenshot specific pages by cloning or bringing them into view, or screenshot the preview DOM!
  // In the preview pane, PagePreview renders pages in a scrollable list.
  const previewPages = await page.locator('.magazine-sheet');
  const previewPagesCount = await previewPages.count();
  console.log(`Found ${previewPagesCount} preview sheets in viewport.`);

  // Ensure artifacts/scratch screenshots directory
  const outDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Let's capture screenshots of specific preview sheets if available
  for (let i = 0; i < previewPagesCount; i++) {
    const pNumber = i + 1;
    if ([1, 4, 5, 6, 7, 8, 9, 13].includes(pNumber)) {
      const sheet = previewPages.nth(i);
      await sheet.screenshot({ path: path.join(outDir, `page_${pNumber}.png`) });
      console.log(`Saved screenshot for page ${pNumber}`);
    }
  }

  // Now trigger PDF generation
  console.log('Triggering "Generate PDF"...');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
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
