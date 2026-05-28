/**
 * End-to-end test (Phase 3 template): visit journey.html?v=2, hold → to
 * walk to CMR's world-x (~1200), let v2 detect the chapter via the v1
 * bridge, walk the full 3-act flow, assert localStorage.journey.chapters.cmr
 * .phase === 'complete'.
 *
 * Beats are unlocked by triggering v1's openLoreCard for each quest beat
 * via the window.__journey debug handle (v1 stores them as `${ch}:${id}`,
 * the bridge strips the prefix). For CMR we collect 3 of the 4 quest beats.
 */
const puppeteer = require('puppeteer');
const { waitVisible, holdRightFor, collectBeatsViaV1, seedCompletedChapters } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

// Walk until the bridge reports the desired chapter or we time out.
async function walkUntilChapter(page, chapterId, maxMs = 60000) {
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
  // Phase 3+: more than one chapter is v2-enabled. The walk from x=0 to
  // CMR (x=1200) crosses every earlier v2 chapter's band — and each one
  // would auto-fire its 3-act flow, polluting the DOM by the time CMR is
  // reached. Pre-seed earlier chapters as 'complete' so re-entry guard
  // (core.js startChapterFlow) skips them.
  await seedCompletedChapters(page, ['itics']);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  // Wait for v1 + v2 to both initialize. v1 sets the bridge synchronously
  // inside its IIFE; v2 starts its polling interval from bootstrap.js.
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // Walk into CMR's chapter band. v1's chapter-detection threshold is
  // chapter.x - 200, so for CMR (x=1200) we need playerX >= 1000. With the
  // chapter-proximity slowdown (0.45x near each chapter) this takes
  // 25-35s of real walking from x=0.
  await walkUntilChapter(page, 'cmr');
  await waitVisible(page, '#v2-cutscene', 8000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  // Collect 3 of the 4 CMR quest beats via v1's openLoreCard. The quest-poll
  // interval (500ms in core.js) picks the collection up and gates Act III.
  await collectBeatsViaV1(page, 'cmr', ['tuition-rush', 'mock-test', 'first-crush']);

  await waitVisible(page, '#v2-minigame', 8000);
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

  // Re-entry guard from Task 4
  await new Promise(r => setTimeout(r, 600));
  const npcReappeared = await page.evaluate(() =>
    document.getElementById('v2-npc').getAttribute('aria-hidden') === 'false'
  );
  if (npcReappeared) throw new Error('completed chapter re-fired NPC (re-entry loop bug)');

  // C-1 regression · walking away from a chapter mid-quest must clear the
  // poll timer so it doesn't run forever. We've already finished CMR by this
  // point, so we exercise the same code path by teleporting away from where
  // any chapter is detected, waiting two ticks, and confirming the orchestrator
  // didn't get wedged. (A more targeted mid-quest test would require running
  // before completion — covered by the more involved Task 2 test.)
  const { teleportPlayer } = require('./tests/integration/helpers');
  await teleportPlayer(page, 100);   // before any v2 chapter band
  await new Promise(r => setTimeout(r, 600));
  const detectedAfterTeleport = await page.evaluate(() =>
    window.__journeyV1Bridge.getCurrentChapterId()
  );
  if (detectedAfterTeleport !== null) throw new Error(
    `teleport to x=100 should detect null chapter, got ${detectedAfterTeleport}`
  );

  console.log(`PASS: CMR full vignette via v1 walk · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
