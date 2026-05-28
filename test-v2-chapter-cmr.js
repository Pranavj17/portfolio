/**
 * End-to-end test: visit journey.html?v=2#cmr, walk the full 3-act flow,
 * assert localStorage.journey.chapters.cmr.phase === 'complete'.
 *
 * Note: still uses the hash-based bridge — Task 6 will rewrite to use real
 * v1 walking. After refactor in Task 6 this file becomes the template for
 * the 7 chapter-test files in Phase 3b.
 */
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2#cmr`, { waitUntil: 'networkidle0' });

  await waitVisible(page, '#v2-cutscene');
  await page.click('#v2-cutscene');
  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  await page.evaluate(() => {
    window.__cmrAddBeat('tuition-rush');
    window.__cmrAddBeat('mock-test');
    window.__cmrAddBeat('first-crush');
  });

  await waitVisible(page, '#v2-minigame', 3000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 8500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  if (!persisted || persisted.v !== 2) throw new Error('storage v != 2');
  const ch = persisted.chapters?.cmr;
  if (!ch) throw new Error('chapters.cmr missing');
  if (ch.phase !== 'complete') throw new Error(`expected phase=complete, got ${ch.phase}`);
  if (typeof ch.score !== 'number') throw new Error(`expected score:number, got ${ch.score}`);
  if (ch.npcChoice !== 0) throw new Error(`expected npcChoice=0, got ${ch.npcChoice}`);

  console.log(`PASS: CMR full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
