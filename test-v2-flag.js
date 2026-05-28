/**
 * Asserts journey.html?v=2 loads journey-v2.js and journey.html (no param)
 * loads journey.js.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 1. Default load — must use v1
  const v1Reqs = [];
  page.on('request', r => { if (r.url().includes('journey')) v1Reqs.push(r.url()); });
  await page.goto(`${URL}/journey.html`, { waitUntil: 'domcontentloaded' });
  if (!v1Reqs.some(u => u.endsWith('journey.js') || u.includes('journey.js?'))) {
    throw new Error(`default load did not request journey.js · got ${JSON.stringify(v1Reqs)}`);
  }
  if (v1Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error('default load incorrectly requested journey-v2.js');
  }

  // 2. ?v=2 load — must use v2
  const v2Reqs = [];
  const page2 = await browser.newPage();
  page2.on('request', r => { if (r.url().includes('journey')) v2Reqs.push(r.url()); });
  await page2.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  if (!v2Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error(`?v=2 load did not request journey-v2.js · got ${JSON.stringify(v2Reqs)}`);
  }

  console.log('PASS: feature-flag wiring works');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
