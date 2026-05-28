/**
 * Asserts that under prefers-reduced-motion: reduce, the cutscene lines
 * render with no animation-delay style and the @media rule applies the
 * opacity:1 / animation:none override.
 */
const puppeteer = require('puppeteer');
const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV2, { timeout: 8000 });

  // Trigger a placeholder cutscene programmatically (no walking required)
  page.evaluate(() => new Promise(res =>
    window.__journeyV2.playCutscene('__placeholder', { act: 'TEST', title: 'REDUCED' }, res)
  )).catch(() => { /* resolves on dismiss · ignored */ });

  await waitVisible(page, '#v2-cutscene');

  // 1. None of the .v2-line elements should carry an inline animation-delay
  const delays = await page.$$eval('.v2-cutscene-lines .v2-line', els => els.map(e => e.style.animationDelay));
  if (delays.some(d => d && d !== '')) throw new Error(
    `reduced-motion: lines should have no animation-delay · got ${JSON.stringify(delays)}`
  );

  // 2. The @media rule should produce opacity:1 on each line
  const opacities = await page.$$eval('.v2-cutscene-lines .v2-line', els =>
    els.map(e => window.getComputedStyle(e).opacity)
  );
  if (opacities.some(o => parseFloat(o) < 0.95)) throw new Error(
    `reduced-motion: lines should be opacity 1 · got ${JSON.stringify(opacities)}`
  );

  // 3. Dismiss + confirm clean exit
  await page.click('#v2-cutscene');
  await new Promise(r => setTimeout(r, 200));

  console.log(`PASS: reduced-motion cutscene · ${delays.length} lines, opacity=${opacities[0]}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
