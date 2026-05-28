/**
 * Shared Puppeteer scaffolding for v2 integration tests.
 * Every test should call `await withV2Page(url, async (page, browser) => { ... })`
 * which handles launch + viewport + cleanup. `waitVisible` polls an overlay's
 * aria-hidden flag.
 */
const puppeteer = require('puppeteer');

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

async function withV2Page(url, fn, { viewport = { width: 800, height: 600 } } = {}) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(`${url}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); });
    // journey-v2.js is appended dynamically, so domcontentloaded fires before
    // the v2 bootstrap has run. Wait for the integration-test handle.
    await page.waitForFunction(() => !!window.__journeyV2, { timeout: 5000 });
    await fn(page, browser);
  } finally {
    await browser.close();
  }
}

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

// Trigger v1's openLoreCard for each beatId on the given chapter, then dismiss.
// v1 stores beats as `${ch}:${id}`; the bridge strips the prefix so v2 sees the
// bare id. Used by chapter tests to satisfy each chapter's 3-of-4 quest gate.
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

// Pre-seed earlier chapters as 'complete' so the orchestrator's re-entry guard
// (src/journey/core.js: `if (phase === 'complete') return;`) skips them when the
// player walks past their world-x positions. Without this, walking from x=0
// toward a later chapter (e.g. CMR at x=1200) would auto-fire every earlier
// v2 chapter's 3-act flow in sequence and pollute the DOM.
async function seedCompletedChapters(page, chapterIds) {
  await page.evaluate((ids) => {
    const chapters = {};
    for (const id of ids) {
      chapters[id] = { phase: 'complete', score: null, npcChoice: null };
    }
    localStorage.setItem('journey', JSON.stringify({ v: 2, chapters }));
  }, chapterIds);
}

module.exports = { waitVisible, withV2Page, holdRightFor, collectBeatsViaV1, seedCompletedChapters };
