/**
 * End-to-end test: visit journey.html?v=2#cmr, walk the full 3-act flow,
 * assert localStorage.journey.chapters.cmr.phase === 'complete'.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

async function waitVisible(page, sel, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate(s => {
      const el = document.querySelector(s);
      return el && el.getAttribute('aria-hidden') === 'false';
    }, sel);
    if (ok) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`timeout waiting for ${sel} to become visible`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  // Clear storage for a fresh run
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2#cmr`, { waitUntil: 'networkidle0' });

  // 1. Cutscene appears
  await waitVisible(page, '#v2-cutscene');
  await page.click('#v2-cutscene');

  // 2. Quest HUD appears
  await waitVisible(page, '#v2-quest-hud');

  // 3. NPC appears (~800ms after exploring)
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');  // advance to close line
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');  // dismiss

  // 4. Add 3 beats to satisfy the quest
  await page.evaluate(() => {
    window.__cmrAddBeat('tuition-rush');
    window.__cmrAddBeat('mock-test');
    window.__cmrAddBeat('first-crush');
  });

  // 5. Mini-game appears
  await waitVisible(page, '#v2-minigame', 3000);
  // Tap option 1
  await page.click('#v2-minigame-canvas');
  // Wait the mock-test duration + buffer
  await new Promise(r => setTimeout(r, 8500));

  // 6. Culmination appears
  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  // 7. Assert phase complete + score recorded
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
