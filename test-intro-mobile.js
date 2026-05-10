const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await page.goto('https://pranavjagadish.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bootSeen', '1'));
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const samples = [50, 150, 300, 500, 800, 1200];
    for (const at of samples) {
        const wait = at - (Date.now() - t0);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        const d = await page.evaluate(() => ({
            cls: document.body.className,
            hero: parseFloat(getComputedStyle(document.querySelector('#home')).opacity).toFixed(2),
            work: parseFloat(getComputedStyle(document.querySelector('#work')).opacity).toFixed(2),
            sb:   parseFloat(getComputedStyle(document.querySelector('.statusbar')).opacity).toFixed(2),
        }));
        console.log(`  t=${String(at).padStart(4)}ms  class="${d.cls}"  hero=${d.hero}  work=${d.work}  statusbar=${d.sb}`);
    }
    await browser.close();
})();
