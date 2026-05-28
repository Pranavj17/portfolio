const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const pickedIdxP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.presentNpc('__placeholder', res)
    ));
    await waitVisible(page, '#v2-npc');
    await page.click('.v2-npc-choice[data-idx="1"]');
    await new Promise(r => setTimeout(r, 100));
    await page.click('#v2-npc');
    await new Promise(r => setTimeout(r, 100));
    await page.click('#v2-npc');
    const pickedIdx = await pickedIdxP;
    if (pickedIdx !== 1) throw new Error(`expected pickedIdx=1, got ${pickedIdx}`);
    console.log('PASS: NPC dialog choice flow');
  });
})().catch(e => { console.error(e); process.exit(1); });
