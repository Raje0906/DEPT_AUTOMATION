const pw = require('../client/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Launching Edge browser...');
  const browser = await pw.chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

  // Log in as Dr. S. S. Raskar
  console.log('Logging in...');
  await page.fill('input[type="text"], input[name="identifier"], input[placeholder*="ID"], input[placeholder*="Email"]', 'ssr');
  await page.fill('input[type="password"]', 'faculty@123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
  console.log('Logged in. URL:', page.url());

  // Navigate to preview page
  const magId = 'MAG-NEW-1791542342264';
  const previewUrl = `http://localhost:5173/faculty/magazines/preview/${magId}`;
  console.log(`Navigating to preview: ${previewUrl}`);
  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on "Change Template" or open template switcher
  console.log('Looking for Template Switcher button...');
  const templateBtn = page.locator('button:has-text("Change Template"), button:has-text("Template")').first();
  if (await templateBtn.isVisible()) {
    console.log('Clicking Change Template button...');
    await templateBtn.click();
    await page.waitForTimeout(1000);

    // Look for Reflection Classic card
    console.log('Selecting Reflection Classic template...');
    const classicCard = page.locator('div:has-text("Reflection Classic")').last();
    if (await classicCard.isVisible()) {
      await classicCard.click();
      await page.waitForTimeout(500);

      // Click "Apply Template" or "Save"
      const applyBtn = page.locator('button:has-text("Apply Template"), button:has-text("Apply")').first();
      if (await applyBtn.isVisible()) {
        await applyBtn.click();
        console.log('Applied Reflection Classic template!');
        await page.waitForTimeout(2000);
      }
    }
  } else {
    console.log('Template button not directly found, updating magazine via API...');
  }

  // Also ensure magazine has template set to reflection-classic via API fetch just in case
  await page.evaluate(async (mId) => {
    try {
      const res = await fetch(`/api/magazines/${mId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'reflection-classic' }),
      });
      console.log('API update status:', res.status);
    } catch (e) {
      console.error(e);
    }
  }, magId);

  // Reload preview to ensure fresh state
  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.magazine-pdf-page', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Check how many pages rendered
  const pageCount = await page.locator('.magazine-pdf-page').count();
  console.log(`Rendered ${pageCount} pages with Reflection Classic template.`);

  // Screenshot Page 1 (Cover)
  console.log('Taking screenshot of Page 1 (Cover)...');
  const page1El = page.locator('.magazine-pdf-page').first();
  await page1El.screenshot({ path: 'scratch/classic_preview_p1.png' });

  // Navigate to Page 2 (Class Toppers) if multi-page controls exist, or screenshot 2nd page in print/scroll
  const pageButtons = page.locator('button:has-text("Next"), button[aria-label="Next page"]');
  // Or in preview, there is a page selector or pagination
  console.log('Testing page navigation...');
  // Let's screenshot all available pages or jump to pages 2, 5, 12, 15
  for (const pNum of [2, 3, 5, 12, 15]) {
    // Check if there is an input or button to jump to page
    const pageJumpInput = page.locator('input[type="number"], input[aria-label*="page"]').first();
    if (await pageJumpInput.isVisible()) {
      await pageJumpInput.fill(String(pNum));
      await pageJumpInput.press('Enter');
      await page.waitForTimeout(1000);
      await page1El.screenshot({ path: `scratch/classic_preview_p${pNum}.png` });
      console.log(`Captured screenshot of page ${pNum}`);
    }
  }

  // Also test direct View mode
  const viewUrl = `http://localhost:5173/faculty/magazines/view/${magId}`;
  console.log(`Navigating to viewer: ${viewUrl}`);
  await page.goto(viewUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scratch/classic_viewer_full.png' });

  console.log('Done test!');
  await browser.close();
}

main().catch(console.error);
