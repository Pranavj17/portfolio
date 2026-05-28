/**
 * Loads ?v=2, calls window.__journeyV2.playCutscene from the page console,
 * asserts the overlay becomes visible, asserts a click dismisses it.
 */
const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const dismissP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.playCutscene('__placeholder', { act: 'TEST', title: 'PLACEHOLDER' }, res)
    ));
    await waitVisible(page, '#v2-cutscene');
    await page.click('#v2-cutscene');
    await dismissP;
    const hidden = await page.evaluate(() =>
      document.getElementById('v2-cutscene').getAttribute('aria-hidden') === 'true'
    );
    if (!hidden) throw new Error('cutscene overlay did not dismiss on click');
    console.log('PASS: cutscene visible + dismissable');
  });
})().catch(e => { console.error(e); process.exit(1); });
