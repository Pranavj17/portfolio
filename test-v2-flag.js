/**
 * Asserts journey.html (default) loads only journey.js,
 * and journey.html?v=2 loads BOTH journey.js (always) and journey-v2.js.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // Default load — only v1
  const v1Reqs = [];
  const page = await browser.newPage();
  page.on('request', r => { if (r.url().includes('journey')) v1Reqs.push(r.url()); });
  await page.goto(`${URL}/journey.html`, { waitUntil: 'networkidle0' });
  if (!v1Reqs.some(u => /journey\.js(\?|$)/.test(u))) {
    throw new Error(`default load did not request journey.js · got ${JSON.stringify(v1Reqs)}`);
  }
  if (v1Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error('default load incorrectly requested journey-v2.js');
  }

  // ?v=2 — BOTH
  const v2Reqs = [];
  const page2 = await browser.newPage();
  page2.on('request', r => { if (r.url().includes('journey')) v2Reqs.push(r.url()); });
  await page2.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  if (!v2Reqs.some(u => /journey\.js(\?|$)/.test(u))) {
    throw new Error(`?v=2 load did not request journey.js · got ${JSON.stringify(v2Reqs)}`);
  }
  if (!v2Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error(`?v=2 load did not request journey-v2.js · got ${JSON.stringify(v2Reqs)}`);
  }

  console.log('PASS: feature-flag wiring works');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
