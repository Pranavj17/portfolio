const puppeteer = require('puppeteer');

const BASE = process.env.JOURNEY_URL || 'http://localhost:4178';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXEC || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(`${BASE}/journey.html?v=2`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__journeyV2 && window.__journeyV2.openMemoryRoom, { timeout: 8000 });

  let failures = 0;
  const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} · ${name}`); if (!cond) failures++; };

  // 1 · all 8 chapters build a valid room (enriched from v1 BEATS)
  const build = await page.evaluate(() => {
    const ids = ['itics', 'cmr', 'college', 'fever104', 'sakha', 'scripbox', 'vwgt', 'now'];
    return ids.map(id => {
      const r = window.__journeyV2.buildRoom(id);
      const k = r.props.map(p => p.kind);
      const mems = r.props.filter(p => p.kind === 'memory');
      return { id, mem: mems.length,
        fixtures: ['video', 'minigame', 'culmination', 'exit'].every(x => k.includes(x)),
        enriched: mems.every(m => m.title && m.body && m.icon) };
    });
  });
  check('all 8 chapters build a room', build.length === 8);
  check('every room has the 4 fixtures', build.every(b => b.fixtures));
  check('every room has >=4 memories', build.every(b => b.mem >= 4));
  check('memory cards enriched (title+body+icon)', build.every(b => b.enriched));

  // 2 · open CMR room
  const opened = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__journeyV2.openMemoryRoom('cmr');
    await wait(1300);
    const c = document.getElementById('v2-room-canvas');
    return {
      shown: document.getElementById('v2-room').getAttribute('aria-hidden') === 'false',
      title: document.getElementById('v2-room-title').textContent,
      bodyClass: document.body.classList.contains('v2-room-open'),
      canvasW: c.width, canvasH: c.height,
    };
  });
  check('room overlay shown on open', opened.shown);
  check('room title is CMR NATIONAL', opened.title === 'CMR NATIONAL');
  check('body.v2-room-open set', opened.bodyClass);
  check('canvas has non-zero backing buffer', opened.canvasW > 0 && opened.canvasH > 0);

  // 3 · canvas renders a lit scene (not blank)
  const px = await page.evaluate(() => {
    const c = document.getElementById('v2-room-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l < min) min = l; if (l > max) max = l; }
    return { min, max };
  });
  check('canvas renders a lit scene (dynamic range)', px.max - px.min > 60);

  // 4 · tapping memories opens cards + persists
  const tapped = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const c = document.getElementById('v2-room-canvas');
    const rect = c.getBoundingClientRect();
    const w = c.width, h = c.height, dpr = w / rect.width;
    const scale = Math.min(w / 1000, h / 600) * 1.08;
    const card = document.getElementById('v2-room-card');
    let opened = 0;
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const rx = (300 + t * 430) - 500, ry = (258 + (i % 2) * 74) - 300;
      const o = { bubbles: true, cancelable: true,
        clientX: rect.left + (w / 2 + rx * scale) / dpr, clientY: rect.top + (h / 2 + ry * scale) / dpr };
      c.dispatchEvent(new MouseEvent('mousedown', o));
      c.dispatchEvent(new MouseEvent('mouseup', o));
      await wait(80);
      if (card.getAttribute('aria-hidden') === 'false') { opened++; card.click(); await wait(120); }
    }
    const saved = JSON.parse(localStorage.getItem('journey') || '{}');
    return { opened, played: ((saved.chapters || {}).cmr || {}).memoriesPlayed || [] };
  });
  check('all 4 memory taps open cards', tapped.opened === 4);
  check('played memories persisted', tapped.played.length >= 1);

  // 5 · close returns to overworld cleanly
  const closed = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__journeyV2.closeMemoryRoom();
    for (let i = 0; i < 30 && window.__journeyV2.isRoomOpen(); i++) await wait(100);
    return { open: window.__journeyV2.isRoomOpen(),
      hidden: document.getElementById('v2-room').getAttribute('aria-hidden') === 'true',
      bodyClass: document.body.classList.contains('v2-room-open') };
  });
  check('room closes', !closed.open && closed.hidden);
  check('body.v2-room-open cleared on close', !closed.bodyClass);

  // 6 · the door appears in a completed chapter band, and opens the room
  const door = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const store = window.__journeyV2.store;
    ['ENTER', 'DISMISS', 'QUEST_COMPLETE', 'MINIGAME_DONE', 'DISMISS'].forEach(e => store.send('cmr', e));
    const CH = window.__journey.CHAPTERS.find(c => c.id === 'cmr');
    if (CH) window.__journey.state.playerX = CH.x + 5;
    await wait(700);
    const shown = document.getElementById('v2-room-door').getAttribute('aria-hidden') === 'false';
    let fromDoor = false;
    if (shown) { document.getElementById('v2-room-door').click(); await wait(1300); fromDoor = window.__journeyV2.isRoomOpen(); window.__journeyV2.closeMemoryRoom(); }
    return { phase: store.getChapter('cmr').phase, shown, fromDoor };
  });
  check('cmr driven to complete', door.phase === 'complete');
  check('"step inside" door appears in completed band', door.shown);
  check('door opens the memory room', door.fromDoor);

  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log('  errors:', errors.slice(0, 5));

  await browser.close();
  process.exit(failures ? 1 : 0);
})();
