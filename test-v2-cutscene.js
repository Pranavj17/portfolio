/**
 * Loads ?v=2, calls window.__journeyV2.playCutscene from the page console,
 * asserts the overlay becomes visible, asserts a click dismisses it.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  // Trigger placeholder cutscene
  const dismissP = page.evaluate(() => {
    return new Promise(res => window.__journeyV2.playCutscene('__placeholder', { act: 'TEST', title: 'PLACEHOLDER' }, res));
  });

  // Overlay should be visible immediately after the call returns
  await new Promise(r => setTimeout(r, 200));
  const visible = await page.evaluate(() => {
    return document.getElementById('v2-cutscene').getAttribute('aria-hidden') === 'false';
  });
  if (!visible) throw new Error('cutscene overlay did not become visible');

  // Click the overlay to dismiss
  await page.click('#v2-cutscene');
  await dismissP;

  const hidden = await page.evaluate(() =>
    document.getElementById('v2-cutscene').getAttribute('aria-hidden') === 'true'
  );
  if (!hidden) throw new Error('cutscene overlay did not dismiss on click');

  console.log('PASS: cutscene visible + dismissable');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
