const pw = require('../client/node_modules/playwright-core');

async function captureViewerPages() {
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="text"], input[name="identifier"], input[placeholder*="ID"], input[placeholder*="Email"]', 'ssr');
  await page.fill('input[type="password"]', 'faculty@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // Go to viewer
  const magId = 'MAG-NEW-1791542342264';
  const viewUrl = `http://localhost:5173/faculty/magazines/view/${magId}`;
  await page.goto(viewUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Jump to specific pages using page input or next button
  const pageInput = page.locator('input[type="number"]').first();

  for (const pNum of [1, 2, 4, 7, 13, 16]) {
    if (await pageInput.isVisible()) {
      await pageInput.fill(String(pNum));
      await pageInput.press('Enter');
      await page.waitForTimeout(1000);
      const sheet = page.locator('.shadow-2xl').first();
      await sheet.screenshot({ path: `scratch/classic_sheet_p${pNum}.png` });
      console.log(`Captured sheet p${pNum}`);
    }
  }

  // Also download the PDF using the Download PDF button!
  console.log('Testing PDF download...');
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  const downloadBtn = page.locator('button:has-text("Download PDF")').first();
  await downloadBtn.click();
  const download = await downloadPromise;
  const pdfPath = 'scratch/Reflection_Issue_33_Classic.pdf';
  await download.saveAs(pdfPath);
  console.log('Saved PDF to:', pdfPath);

  await browser.close();
}

captureViewerPages().catch(console.error);
