const puppeteer = require('puppeteer');
const {
  waitVisible,
  collectBeatsViaV1,
  seedCompletedChapters,
} = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

// Walk until the bridge reports the desired chapter or we time out.
// SCRIPBOX chapter.x = 4400 — much farther than CMR/ITICS, so use a longer
// timeout. With vehicle auto-upgrades (run/cycle/bike) the walk is faster
// than a pure 60 px/s baseline.
async function walkUntilChapter(page, chapterId, maxMs = 90000) {
  await page.keyboard.down('ArrowRight');
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < maxMs) {
      const cur = await page.evaluate(() => window.__journeyV1Bridge.getCurrentChapterId());
      if (cur === chapterId) return;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`timeout walking to chapter ${chapterId} (last seen via bridge)`);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });

  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  // Pre-seed earlier chapters so the orchestrator's re-entry guard skips them
  // when the player walks past their world-x positions. Seed BEFORE the
  // second load so the v2 store reads the seeded snapshot at bootstrap.
  await seedCompletedChapters(page, ['itics', 'cmr']);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await walkUntilChapter(page, 'scripbox');
  await waitVisible(page, '#v2-cutscene', 12000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  await collectBeatsViaV1(page, 'scripbox', ['pr-review', 'anthropic-catalog', 'claude-code']);

  await waitVisible(page, '#v2-minigame', 8000);
  // debug-the-pr is TAP-on-line. Tap roughly at line 1 (the bug line).
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 8500));

  await waitVisible(page, '#v2-culmination', 3000);
  // v1's playStageVideo may overlay culmination; click via in-page dispatch
  await page.evaluate(() => document.getElementById('v2-culmination').click());

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.scripbox;
  if (!ch || ch.phase !== 'complete') throw new Error(`SCRIPBOX phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('SCRIPBOX score missing');

  console.log(`PASS: SCRIPBOX full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
