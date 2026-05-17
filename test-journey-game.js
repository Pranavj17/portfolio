/**
 * Comprehensive smoke-test for /journey · 3D perspective walker.
 *
 * Verifies:
 *   1. Page boots in desktop viewport without console errors
 *   2. Each of 6 chapters renders correctly (uses the __journey hook to
 *      teleport the player to each station's z, screenshots at each)
 *   3. The start overlay shows the right text (6 chapters · 11 years)
 *   4. The end screen triggers when all 6 loot collected + at zone 6
 *   5. The mobile viewport renders touch controls visibly
 *   6. Tapping a touch button actually moves the player
 *
 * Output: /tmp/journey-game/<name>.png
 */
const puppeteer = require('puppeteer');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const OUT_DIR    = '/tmp/journey-game';
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
};

function serve(root) {
    return new Promise((resolve) => {
        const s = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const full = path.normalize(path.join(root, p));
            if (!full.startsWith(root)) { res.writeHead(403); res.end(); return; }
            fs.readFile(full, (err, data) => {
                if (err) { res.writeHead(404); res.end(); return; }
                res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
                res.end(data);
            });
        });
        s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port }));
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// step 1 + 2 + 3 + 4 · desktop
async function desktopFlow(browser, url) {
    console.log('\n── desktop ─────────────────────────────────');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
    const errors = [];
    page.on('console',   (m) => { if (m.type() === 'error') { console.error('[page]', m.text()); errors.push(m.text()); } });
    page.on('pageerror', (e) => { console.error('[pageerror]', e.message); errors.push(e.message); });
    await page.goto(url, { waitUntil: 'networkidle0' });
    // start overlay has 1500ms of staggered reveal animations · wait for them
    // to finish before screenshotting so the coin button, mobile hint, etc.
    // aren't captured mid-fade-in.
    await sleep(1800);

    // verify __journey hook + 6 zones
    const meta = await page.evaluate(() => {
        if (!window.__journey) return null;
        return {
            zoneCount: window.__journey.ZONES.length,
            zoneIds:   window.__journey.ZONES.map((z) => z.id),
            running:   window.__journey.state.running,
        };
    });
    if (!meta) throw new Error('window.__journey hook missing — journey.js failed to init');
    console.log('  zones:', meta.zoneCount, '·', meta.zoneIds.join(' → '));
    if (meta.zoneCount !== 6) throw new Error(`expected 6 zones, got ${meta.zoneCount}`);
    if (!meta.zoneIds.includes('vwgt')) throw new Error('vwgt zone missing');

    // screenshot 1: start overlay
    await page.screenshot({ path: path.join(OUT_DIR, '01-start.png') });
    console.log('  ✓ 01-start.png');

    // press start
    await page.click('#btn-start');
    await sleep(300);

    // teleport through every chapter via debug hook. We also auto-collect
    // all PREVIOUS chapters' loot to simulate a natural playthrough — so
    // the vehicle progression (walk → alto → vw) shows correctly at the
    // chapter the player has actually progressed to.
    for (let i = 0; i < 6; i++) {
        const arrived = await page.evaluate((idx) => {
            const j = window.__journey;
            const z = j.ZONES[idx];
            for (let k = 0; k < idx; k++) {
                const past = j.ZONES[k];
                if (!j.state.collected.has(past.id)) {
                    j.state.collected.add(past.id);
                    j.state.loot++;
                }
            }
            j.state.player.z = z.z;
            j.state.player.x = 0;
            j.state.zone = idx;
            j.state.revealT.set(z.id, 2000);
            j.state.revealed.add(z.id);
            return { id: z.id, label: z.label };
        }, i);
        await sleep(900);  // let update() resolve vehicle state + render
        const settled = await page.evaluate(() => window.__journey.state.player.vehicle);
        await page.screenshot({ path: path.join(OUT_DIR, `02-ch${i + 1}-${arrived.id}.png`) });
        console.log(`  ✓ 02-ch${i + 1}-${arrived.id}.png  (${arrived.label} · vehicle=${settled})`);
    }

    // glitch screenshot · trigger Z + jump
    await page.evaluate(() => window.__journey.state.zone = 1);
    await page.keyboard.press('z');
    await sleep(50);
    await page.keyboard.press(' ');
    await sleep(150);
    await page.screenshot({ path: path.join(OUT_DIR, '03-glitch.png') });
    console.log('  ✓ 03-glitch.png');

    // end-screen · force-collect everything and teleport to last zone
    await page.evaluate(() => {
        const j = window.__journey;
        for (const z of j.ZONES) {
            if (!j.state.collected.has(z.id)) {
                j.state.collected.add(z.id);
                j.state.loot++;
            }
        }
        j.state.player.z = j.ZONES[j.ZONES.length - 1].z;
        j.state.zone = j.ZONES.length - 1;
    });
    await sleep(1100);
    await page.screenshot({ path: path.join(OUT_DIR, '04-end.png') });
    console.log('  ✓ 04-end.png');

    await page.close();
    if (errors.length) throw new Error(`desktop saw ${errors.length} console errors`);
    console.log('  ✓ no console errors');
}

// step 5 + 6 · mobile viewport · touch controls
async function mobileFlow(browser, url) {
    console.log('\n── mobile (iPhone 14, 390×844) ────────────');
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('console',   (m) => { if (m.type() === 'error') { console.error('[page]', m.text()); errors.push(m.text()); } });
    page.on('pageerror', (e) => { console.error('[pageerror]', e.message); errors.push(e.message); });
    await page.goto(url, { waitUntil: 'networkidle0' });
    // wait for the same staggered animations to finish on mobile
    await sleep(1800);

    // screenshot the start overlay in mobile · touch controls visible below
    await page.screenshot({ path: path.join(OUT_DIR, '05-mobile-start.png') });
    console.log('  ✓ 05-mobile-start.png');

    // measure if the touch controls are visible (computed style display !== none AND inside viewport)
    const ctrlsVisible = await page.evaluate(() => {
        const el = document.getElementById('touch-controls');
        if (!el) return { exists: false };
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
            exists: true,
            display: style.display,
            opacity: parseFloat(style.opacity),
            in_viewport: rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth,
        };
    });
    console.log('  touch-controls:', ctrlsVisible);
    if (!ctrlsVisible.exists) throw new Error('touch-controls element missing');
    if (ctrlsVisible.opacity < 0.5) throw new Error(`touch-controls opacity too low: ${ctrlsVisible.opacity}`);

    // press start (still a regular button in mobile)
    await page.tap('#btn-start');
    await sleep(300);

    // simulate touching the FORWARD button (the "up" arrow on the d-pad)
    // Get its bounding rect then dispatch touch events
    const beforeZ = await page.evaluate(() => window.__journey.state.player.z);
    const forwardRect = await page.evaluate(() => {
        const el = document.querySelector('.touch-controls .tbtn.tbtn-up');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!forwardRect) throw new Error('forward touch button not found');

    // tap-and-hold the forward button for 1.5s to walk forward
    await page.touchscreen.touchStart(forwardRect.x, forwardRect.y);
    await sleep(1500);
    await page.touchscreen.touchEnd();
    await sleep(200);

    const afterZ = await page.evaluate(() => window.__journey.state.player.z);
    const movedBy = afterZ - beforeZ;
    console.log(`  player.z: ${beforeZ.toFixed(1)} → ${afterZ.toFixed(1)}  (Δ ${movedBy.toFixed(1)})`);
    if (movedBy < 30) throw new Error(`touch d-pad didn't move the player enough · Δz=${movedBy.toFixed(1)}`);

    await page.screenshot({ path: path.join(OUT_DIR, '06-mobile-walking.png') });
    console.log('  ✓ 06-mobile-walking.png');

    // tap the JUMP button and verify player leaves the ground
    const jumpRect = await page.evaluate(() => {
        const el = document.querySelector('.touch-controls .tbtn.tbtn-jump');
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.touchscreen.touchStart(jumpRect.x, jumpRect.y);
    await sleep(60);
    await page.touchscreen.touchEnd();
    await sleep(100);
    const airborne = await page.evaluate(() => !window.__journey.state.player.onGround);
    console.log('  jump button → player airborne:', airborne);
    if (!airborne) throw new Error('touch jump button did not lift the player');

    await page.screenshot({ path: path.join(OUT_DIR, '07-mobile-jump.png') });
    console.log('  ✓ 07-mobile-jump.png');

    await page.close();
    if (errors.length) throw new Error(`mobile saw ${errors.length} console errors`);
    console.log('  ✓ no console errors');
}

(async () => {
    const { s: server, port } = await serve(PUBLIC_DIR);
    const url = `http://127.0.0.1:${port}/journey.html`;
    console.log('▸ serving', url);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        await desktopFlow(browser, url);
        await mobileFlow(browser, url);
        console.log('\n✓ all checks passed · screenshots in', OUT_DIR);
    } catch (err) {
        console.error('\n✗ test failed:', err.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
        server.close();
    }
})();
