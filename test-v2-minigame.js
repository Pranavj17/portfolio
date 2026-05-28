const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const resultP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.initMinigame('__stub', res)
    ));
    await waitVisible(page, '#v2-minigame');
    const result = await resultP;
    if (typeof result.score !== 'number') throw new Error('score is not a number');
    if (!result.label || typeof result.label !== 'string') throw new Error('label is missing');
    const hiddenAfter = await page.evaluate(() =>
      document.getElementById('v2-minigame').getAttribute('aria-hidden') === 'true'
    );
    if (!hiddenAfter) throw new Error('overlay did not dismiss after completion');
    console.log(`PASS: mini-game harness · score=${result.score} label=${result.label}`);
  });
})().catch(e => { console.error(e); process.exit(1); });
