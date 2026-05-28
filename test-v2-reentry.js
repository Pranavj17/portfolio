/**
 * C-2 regression · walks into CMR, completes the cutscene and NPC, then
 * teleports BACK to before the chapter band, waits, teleports forward into
 * the band again, and asserts:
 *   - The NPC overlay does NOT re-present.
 *   - The quest HUD reappears.
 *   - Adding the remaining beats completes Act III and dismisses cleanly.
 */
const puppeteer = require('puppeteer');
const {
  waitVisible,
  collectBeatsViaV1,
  seedCompletedChapters,
  teleportPlayer,
} = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function walkUntilChapter(page, chapterId, maxMs = 60000) {
  await page.keyboard.down('ArrowRight');
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < maxMs) {
      const cur = await page.evaluate(() => window.__journeyV1Bridge.getCurrentChapterId());
      if (cur === chapterId) return;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`timeout walking to chapter ${chapterId}`);
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
  await seedCompletedChapters(page, ['itics']);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // 1. Walk into CMR (chapter.x = 1200; band starts at 1000)
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

  // 2. Confirm store snapshot · NPC choice recorded, no quest complete yet
  const midState = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  if (midState.chapters?.cmr?.npcChoice !== 0) throw new Error(
    `expected cmr.npcChoice=0 after dialog, got ${midState.chapters?.cmr?.npcChoice}`
  );
  if (midState.chapters?.cmr?.phase !== 'exploring') throw new Error(
    `expected cmr.phase=exploring mid-flow, got ${midState.chapters?.cmr?.phase}`
  );

  // 3. Teleport BACK before CMR's band (x=100, well before band start 1000)
  await teleportPlayer(page, 100);
  await new Promise(r => setTimeout(r, 600));   // two 250ms ticks

  // 4. Assert the bridge no longer reports cmr (C-1 already covers this)
  const detected = await page.evaluate(() => window.__journeyV1Bridge.getCurrentChapterId());
  if (detected !== null) throw new Error(
    `after teleport-back, expected null chapter, got ${detected}`
  );

  // 5. Quest HUD should hide (Task 1 cleanup)
  await new Promise(r => setTimeout(r, 200));
  const hudHiddenAfterLeave = await page.evaluate(() =>
    document.getElementById('v2-quest-hud').getAttribute('aria-hidden') === 'true'
  );
  if (!hudHiddenAfterLeave) throw new Error(
    `quest HUD should hide when player leaves chapter band`
  );

  // 6. Teleport FORWARD into CMR band again (x=1100, well inside band)
  await teleportPlayer(page, 1100);
  await new Promise(r => setTimeout(r, 600));   // wait for tick to detect + start

  // 7. Quest HUD should reappear
  await waitVisible(page, '#v2-quest-hud', 2000);

  // 8. NPC overlay should NOT re-present (C-2 fix)
  await new Promise(r => setTimeout(r, 1000));   // > 800ms NPC auto-present delay
  const npcReentered = await page.evaluate(() =>
    document.getElementById('v2-npc').getAttribute('aria-hidden') === 'false'
  );
  if (npcReentered) throw new Error(
    `C-2: NPC re-presented on re-entry (should be skipped since npcChoice was set)`
  );

  // 9. Add the remaining beats — Act III should fire and dismiss cleanly
  await collectBeatsViaV1(page, 'cmr', ['tuition-rush', 'mock-test', 'first-crush']);
  await waitVisible(page, '#v2-minigame', 5000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 8500));
  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  // 10. Final state must be complete
  const finalState = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  if (finalState.chapters?.cmr?.phase !== 'complete') throw new Error(
    `expected cmr.phase=complete after re-entry flow, got ${finalState.chapters?.cmr?.phase}`
  );

  console.log(`PASS: CMR re-entry flow · npcChoice=${finalState.chapters.cmr.npcChoice} score=${finalState.chapters.cmr.score}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
