const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  const doneP = page.evaluate(() => new Promise(res =>
    window.__journeyV2.showCulmination('__placeholder', 'PLACEHOLDER', res)
  ));

  await new Promise(r => setTimeout(r, 150));
  const visible = await page.evaluate(() =>
    document.getElementById('v2-culmination').getAttribute('aria-hidden') === 'false'
  );
  if (!visible) throw new Error('culmination overlay did not appear');

  const txt = await page.$eval('#v2-culmination-text', el => el.textContent);
  if (!txt || txt.length < 10) throw new Error(`culmination text empty: "${txt}"`);

  await page.click('#v2-culmination');
  await doneP;

  console.log('PASS: culmination card visible + dismissable');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
