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
  await seedCompletedChapters(page, ['itics', 'cmr', 'sakha', 'scripbox']);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await walkUntilChapter(page, 'now', 120000);
  await waitVisible(page, '#v2-cutscene', 15000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  await collectBeatsViaV1(page, 'now', ['morning-routine', 'code-flow', 'anthropic-goal', 'forward-horizon']);

  await waitVisible(page, '#v2-minigame', 8000);
  // type-the-future: tap 4 letter zones in order (column 0..3)
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  for (let i = 0; i < 4; i++) {
    const x = box.left + (i + 0.5) * (box.w / 4);
    const y = box.top + box.h / 2;
    await page.mouse.click(x, y);
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 7500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.evaluate(() => document.getElementById('v2-culmination').click());

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.now;
  if (!ch || ch.phase !== 'complete') throw new Error(`NOW phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('NOW score missing');

  console.log(`PASS: NOW full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
