/**
 * End-to-end test (Phase 3 Task 7): visit journey.html?v=2, walk into ITICS's
 * chapter band, let v2 detect the chapter via the v1 bridge, walk the full
 * 3-act flow, assert localStorage.journey.chapters.itics.phase === 'complete'.
 *
 * ITICS chapter.x = 500, so band detection fires at playerX >= 300. A short
 * 2-3s walk from x=0 is enough.
 *
 * Beats are unlocked by triggering v1's openLoreCard for each quest beat via
 * the window.__journey debug handle. ITICS quest needs 3 of 4:
 * football-match · cricket-match · sports-day · assembly-stage.
 */
const puppeteer = require('puppeteer');
const { waitVisible, holdRightFor, collectBeatsViaV1 } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // ITICS chapter.x ≈ 500 — short walk to enter band (detection at playerX >= 300)
  await holdRightFor(page, 3000);
  await waitVisible(page, '#v2-cutscene', 10000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  await collectBeatsViaV1(page, 'itics', ['football-match', 'cricket-match', 'sports-day']);

  await waitVisible(page, '#v2-minigame', 8000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 6500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');
  await new Promise(r => setTimeout(r, 200));

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.itics;
  if (!ch || ch.phase !== 'complete') throw new Error(`ITICS phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('ITICS score missing');

  console.log(`PASS: ITICS full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
