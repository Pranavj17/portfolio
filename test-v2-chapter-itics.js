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
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

async function collectBeatsViaV1(page, chapterId, beatIds) {
  await page.evaluate(({ ch, ids }) => {
    const j = window.__journey;
    if (!j) throw new Error('window.__journey not exposed by v1');
    for (const id of ids) {
      const beat = j.BEATS.find(b => b.ch === ch && b.id === id);
      if (!beat) continue;
      j.openLoreCard(beat);
      j.dismissLoreCard();
    }
  }, { ch: chapterId, ids: beatIds });
}

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
  // v1 fires its own playStageVideo on chapter entry (~1.6s after walking in).
  // For ITICS the stage video may still be playing when culmination opens,
  // blocking puppeteer clicks (it has higher z-index + pointer-events: auto
  // while body.stage-video-active). Dispatch the click in-page so the v2
  // culmination overlay's listener fires regardless of v1 stage overlay.
  await page.evaluate(() => document.getElementById('v2-culmination').click());
  await new Promise(r => setTimeout(r, 200));

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.itics;
  if (!ch || ch.phase !== 'complete') throw new Error(`ITICS phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('ITICS score missing');

  console.log(`PASS: ITICS full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
