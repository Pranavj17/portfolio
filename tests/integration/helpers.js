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

module.exports = { waitVisible, withV2Page };
