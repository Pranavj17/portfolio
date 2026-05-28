const puppeteer = require('puppeteer');
const {
  waitVisible,
  collectBeatsViaV1,
  seedCompletedChapters,
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
  await seedCompletedChapters(page, ['itics', 'cmr', 'college', 'fever104', 'sakha', 'scripbox']);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await walkUntilChapter(page, 'vwgt', 110000);
  await waitVisible(page, '#v2-cutscene', 15000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  await collectBeatsViaV1(page, 'vwgt', ['test-drive', 'documents-signing', 'keys-handover', 'first-drive-out']);

  await waitVisible(page, '#v2-minigame', 8000);
  // parallel-park: a couple of horizontal swipes (right)
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  for (let s = 0; s < 2; s++) {
    await page.mouse.move(box.left + box.w * 0.3, box.top + box.h * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.left + box.w * 0.7, box.top + box.h * 0.5, { steps: 6 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 200));
  }
  // parallel-park durationMs=10000; we've used ~0.8s on swipes
  await new Promise(r => setTimeout(r, 9500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.vwgt;
  if (!ch || ch.phase !== 'complete') throw new Error(`THE GT phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('THE GT score missing');

  console.log(`PASS: THE GT full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
