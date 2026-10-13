const pw = require('../client/node_modules/playwright-core');
const fs = require('fs');

async function main() {
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="text"], input[name="identifier"], input[placeholder*="ID"], input[placeholder*="Email"]', 'ssr');
  await page.fill('input[type="password"]', 'faculty@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // Navigate to viewer
  const magId = 'MAG-NEW-1791542342264';
  const viewUrl = `http://localhost:5173/faculty/magazines/view/${magId}`;
  console.log('Navigating to viewer:', viewUrl);
  await page.goto(viewUrl, { waitUntil: 'domcontentloaded' });

  // Wait for the theme badge to confirm reflection-classic loaded
  await page.waitForSelector('text=Reflection Classic', { timeout: 15000 });
  console.log('Confirmed Reflection Classic theme is loaded in viewer.');
  await page.waitForTimeout(2000);

  // Take screenshot of Viewer Canvas for pages 1, 2, 3, 4, 7, 10, 13, 16
  const pagesToCapture = [1, 2, 3, 4, 7, 10, 13, 16];
  for (const pNum of pagesToCapture) {
    console.log(`Navigating to page ${pNum}...`);
    // Find thumbnail button with text pNum or set input
    const pageInput = page.locator('input[type="number"]').first();
    await pageInput.click();
    await pageInput.fill(String(pNum));
    await pageInput.dispatchEvent('change');
    await page.waitForTimeout(1200);

    const sheetContainer = page.locator('.shadow-2xl').first();
    const screenshotPath = `scratch/final_classic_p${pNum}.png`;
    await sheetContainer.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot: ${screenshotPath}`);
  }

  // Download PDF
  console.log('Triggering PDF download...');
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  const downloadBtn = page.locator('button:has-text("Download PDF")').first();
  await downloadBtn.click();
  const download = await downloadPromise;
  const pdfPath = 'scratch/Reflection_Issue_33_Classic_Final.pdf';
  await download.saveAs(pdfPath);
  console.log('Saved Final PDF:', pdfPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
