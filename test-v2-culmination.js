const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const doneP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.showCulmination('__placeholder', 'PLACEHOLDER', res)
    ));
    await waitVisible(page, '#v2-culmination');
    const txt = await page.$eval('#v2-culmination-text', el => el.textContent);
    if (!txt || txt.length < 10) throw new Error(`culmination text empty: "${txt}"`);
    await page.click('#v2-culmination');
    await doneP;
    console.log('PASS: culmination card visible + dismissable');
  });
})().catch(e => { console.error(e); process.exit(1); });
