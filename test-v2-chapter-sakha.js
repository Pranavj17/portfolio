const puppeteer = require('puppeteer');
const {
  waitVisible,
  collectBeatsViaV1,
  seedCompletedChapters,
} = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

// Walk until the bridge reports the desired chapter or we time out.
// SAKHA chapter.x = 3600 — between ITICS (500) and SCRIPBOX (4400).
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
  // Pre-seed earlier v2-enabled chapters (those at x < SAKHA's x=3600) so the
  // orchestrator's re-entry guard skips them as the player walks past.
  // ITICS=500, CMR=1200 are before SAKHA. SCRIPBOX=4400 and NOW=6200 are after,
  // so the player won't reach them in this walk and they don't need seeding.
  await seedCompletedChapters(page, ['itics', 'cmr', 'college']);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await walkUntilChapter(page, 'sakha', 90000);
  await waitVisible(page, '#v2-cutscene', 12000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  await collectBeatsViaV1(page, 'sakha', ['interview-day', 'first-paycheck', 'wfh-covid']);

  await waitVisible(page, '#v2-minigame', 8000);
  // standup-bingo: random cells flash; tap repeatedly at center to potentially catch
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  for (let i = 0; i < 10; i++) {
    await page.mouse.click(box.left + box.w / 2, box.top + box.h / 2);
    await new Promise(r => setTimeout(r, 900));
  }
  await new Promise(r => setTimeout(r, 1500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.evaluate(() => document.getElementById('v2-culmination').click());

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.sakha;
  if (!ch || ch.phase !== 'complete') throw new Error(`SAKHA phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('SAKHA score missing');

  console.log(`PASS: SAKHA full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
