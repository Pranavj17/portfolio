/**
 * Loads ?v=2, drives window.__journeyV2.presentNpc through its three phases
 * (choose → reply → close) and asserts the picked choice index is captured.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  const pickedIdxP = page.evaluate(() => new Promise(res =>
    window.__journeyV2.presentNpc('__placeholder', res)
  ));

  // Overlay should be visible
  await new Promise(r => setTimeout(r, 150));
  const visible = await page.evaluate(() =>
    document.getElementById('v2-npc').getAttribute('aria-hidden') === 'false'
  );
  if (!visible) throw new Error('NPC overlay did not appear');

  // Click choice index 1
  await page.click('.v2-npc-choice[data-idx="1"]');
  await new Promise(r => setTimeout(r, 100));
  // Click to advance to close line
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  // Click to dismiss
  await page.click('#v2-npc');

  const pickedIdx = await pickedIdxP;
  if (pickedIdx !== 1) throw new Error(`expected pickedIdx=1, got ${pickedIdx}`);

  console.log('PASS: NPC dialog choice flow');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
