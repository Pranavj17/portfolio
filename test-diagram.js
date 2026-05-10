const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
(async () => {
    const out = path.join(__dirname, 'mobile-test-screens');
    fs.mkdirSync(out, { recursive: true });
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => sessionStorage.setItem('bootSeen','1'));
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    const info = await page.evaluate(() => {
        const items = document.querySelectorAll('.artifact');
        const target = items[1];
        target.scrollIntoView({ block: 'start' });
        return { count: items.length, top: window.scrollY };
    });
    await new Promise(r => setTimeout(r, 400));
    const file = path.join(out, 'diagram.png');
    await page.screenshot({ path: file });
    console.log('saved', file, 'artifacts:', info.count, 'scrollY:', info.top);
    await browser.close();
})();
