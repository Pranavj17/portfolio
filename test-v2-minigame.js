const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  const resultP = page.evaluate(() => new Promise(res =>
    window.__journeyV2.initMinigame('__stub', res)
  ));

  // Overlay should be visible during the run
  await new Promise(r => setTimeout(r, 200));
  const visibleDuring = await page.evaluate(() =>
    document.getElementById('v2-minigame').getAttribute('aria-hidden') === 'false'
  );
  if (!visibleDuring) throw new Error('mini-game overlay never appeared');

  // Wait for auto-complete (durationMs 1500)
  const result = await resultP;
  if (typeof result.score !== 'number') throw new Error('score is not a number');
  if (!result.label || typeof result.label !== 'string') throw new Error('label is missing');

  const hiddenAfter = await page.evaluate(() =>
    document.getElementById('v2-minigame').getAttribute('aria-hidden') === 'true'
  );
  if (!hiddenAfter) throw new Error('overlay did not dismiss after completion');

  console.log(`PASS: mini-game harness · score=${result.score} label=${result.label}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
