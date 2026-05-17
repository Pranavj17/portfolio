/**
 * the journey · 2D side-scroller (canvas) · RDR-flavoured western chronicle
 * ─────────────────────────────────────────────────────────────────────────
 * Side-on 2D · player walks right when input is HELD (ArrowRight/D on
 * keyboard, touch-and-hold on mobile) · world scrolls left · 8 chapters
 * laid out along a sepia-toned horizon. Walking IS the feature: every
 * stride is visible, the character is the unmistakable subject of every
 * frame, and the parallax layers move at different speeds for depth.
 *
 * Locomotion progression (latched · one-way upgrade only):
 *   walk → run → cycle → bike → alto → vw
 * Each upgrade is gated by a world-x threshold or by collecting the
 * vwgt loot · once upgraded, the vehicle never downgrades.
 *
 * No framework. No Three.js. Plain canvas 2D drawing primitives + emoji.
 * Total payload ~12KB.
 */

(() => {
    'use strict';

    const canvas = document.getElementById('stage');
    const ctx    = canvas.getContext('2d', { alpha: false });

    // viewport-fitting canvas · sets EXPLICIT pixel dimensions (no "100%"
    // dependency on parent box-sizing). Re-runs on resize.
    function fitCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width  = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas, { passive: true });

    // ── chapter data ·  compressed world for the 6-vehicle progression ─
    const CHAPTERS = [
        { id: 'itics',    label: 'ITICS',           period: 'until 2013',           x:  500, color: '#a8b87a', icon: '🏫', achId: 'school-1',    achTitle: 'ITICS',                  achSub: 'where it began' },
        { id: 'cmr',      label: 'CMR NATIONAL',    period: '2013 — 2015',          x: 1200, color: '#5e7a8a', icon: '📐', achId: 'school-2',    achTitle: 'CMR NATIONAL',           achSub: 'pre-university · 2013–2015' },
        { id: 'college',  label: 'D.S.C.E.',        period: '2015 — 2019',          x: 2000, color: '#c47540', icon: '🎓', achId: 'first-steps', achTitle: 'D.S.C.E.',               achSub: 'mechanical engineering · 2015–2019' },
        { id: 'fever104', label: 'FEVER 104 FM',    period: 'mar — may 2019',       x: 2800, color: '#b84c32', icon: '📻', achId: 'fever-104',   achTitle: 'ON AIR · 104 FM',        achSub: '3-month producer stint' },
        { id: 'sakha',    label: 'SAKHA GLOBAL',    period: 'jul 2019 — sep 2022',  x: 3600, color: '#c9a151', icon: '💼', achId: 'first-job',   achTitle: 'FIRST JOB · ALTO',       achSub: 'maruti alto · jul 2019' },
        { id: 'scripbox', label: 'SCRIPBOX',        period: 'sep 2022 — present',   x: 4400, color: '#7a9a8a', icon: '🤖', achId: 'mcp-catalog', achTitle: 'ANTHROPIC CATALOG',      achSub: 'mcp-server-graylog · PR #2913' },
        { id: 'vwgt',     label: 'THE GT',           period: 'nov 16, 2025',         x: 5300, color: '#a4332e', icon: '🏎️', achId: 'got-the-gt',  achTitle: 'GOT THE GT',             achSub: 'vw virtus gt · nov 16, 2025' },
        { id: 'now',      label: 'NOW',              period: '2026 — present',       x: 6200, color: '#e6c285', icon: '🏁', achId: 'journey-end', achTitle: 'END OF THE TRAIL',       achSub: '8 chapters · 13 years' },
    ];

    // SIX locomotion stages · each one is a life-milestone in itself ·
    // each visibly faster than the last. Speeds in px/s.
    const VEHICLES = {
        walk:  { speed:  60, icon: '🚶',  label: 'WALKING',     sub: 'childhood pace · ITICS',        achId: null,        achTitle: null,           achSub: null },
        run:   { speed: 110, icon: '🏃',  label: 'RUNNING',     sub: 'CMR · the rush of growing up',  achId: 'on-run',    achTitle: 'PICKED UP THE PACE', achSub: 'school sports · CMR years' },
        cycle: { speed: 150, icon: '🚴',  label: 'BICYCLE',     sub: 'D.S.C.E. campus bike',          achId: 'on-cycle',  achTitle: 'ON TWO WHEELS',      achSub: 'engineering · bicycle days' },
        // bike icon · U+1F3CD requires VS16 (U+FE0F) to render as a color
        // emoji glyph in Chromium/macOS. Without it, the motorcycle falls
        // back to text presentation (or a missing-glyph box) on many systems.
        bike:  { speed: 200, icon: '🏍️', label: 'MOTORBIKE',   sub: 'commute to 104 FM',             achId: 'on-bike',   achTitle: 'TWO WHEELS, ENGINE', achSub: 'commute · radio days' },
        alto:  { speed: 260, icon: '🚗',  label: 'MARUTI ALTO', sub: 'first paycheck · SAKHA 2019',   achId: 'first-job', achTitle: 'FIRST JOB · ALTO',   achSub: 'maruti alto · jul 2019' },
        vw:    { speed: 340, icon: '🏎️', label: 'VW VIRTUS GT', sub: '1.5 TSI · turbo · nov 2025',  achId: 'got-the-gt', achTitle: 'GOT THE GT',         achSub: 'vw virtus gt · nov 16, 2025' },
    };
    // x-thresholds for vehicle upgrades · each upgrade lines up roughly
    // with a chapter (life milestone). VW special-cased on vwgt collection.
    const VEH_THRESH = { run: 800, cycle: 1700, bike: 2500, alto: 3300 };

    // ── parallax bands & ground constants ─────────────────────────────
    const HORIZON_PCT = 0.62;   // sky / ground split as % of viewport height
    const GROUND_PCT  = 0.88;   // player's feet land here

    // pre-generate distant hill points (silhouette polyline)
    const distHills = [];
    for (let i = 0; i < 800; i++) {
        const x = i * 80;
        const y = 60 + Math.sin(i * 0.18) * 28 + Math.cos(i * 0.41 + 1.3) * 22;
        distHills.push({ x, y });
    }

    // pre-generate mid-ground trees + telegraph poles at random x positions
    const midProps = [];
    for (let i = 0; i < 150; i++) {
        const x = i * 110 + (Math.random() - 0.5) * 50;
        midProps.push({
            x,
            kind: Math.random() < 0.65 ? 'tree' : 'pole',
            scale: 0.85 + Math.random() * 0.35,
        });
    }
    // pre-generate foreground tufts
    const fgTufts = [];
    for (let i = 0; i < 500; i++) {
        fgTufts.push({ x: i * 40 + (Math.random() - 0.5) * 20, h: 2 + Math.random() * 5 });
    }

    // ── game state ────────────────────────────────────────────────────
    const state = {
        running:      false,
        ended:        false,
        playerX:      0,            // world-space x of the player
        vehicle:      'walk',
        collected:    new Set(),
        achievements: new Set(),
        elapsedMs:    0,
        walkPhase:    0,
        prevWalkPhase:0,            // for step-sound trigger detection
        wheelPhase:   0,            // wheel rotation · always spins (idle drift)
        bobT:         0,
        shake:        { amp: 0, t: 0 },   // screen-shake (decays linearly)
        particles:    [],                  // collect-burst particles
        // INPUT · key-driven walking · player only moves when an input is
        // held. No auto-walk.
        keys: { right: false, left: false },
        touchHold: false,
    };

    // auto-start after splash (3.4s matches CSS splashFadeOut)
    setTimeout(() => { state.running = true; }, 3400);

    // ── AUDIO · synthesized WebAudio one-shots, no asset fetches ─────
    //   Lazy AudioContext creation on first user input (modern browsers
    //   require a user-gesture before audio can start). All SFX are
    //   constructed at call-time from Oscillator + Gain · zero payload.
    //   Aesthetic: low + warm + sparse — matches the RDR sepia world.
    let audioCtx = null;
    function initAudio() {
        if (audioCtx) return audioCtx;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
        } catch (_) { return null; }
        return audioCtx;
    }
    /** play a brief synthesized SFX. opts = {freq, type, dur, vol, sweep, q} */
    function sfx(opts) {
        const ac = initAudio(); if (!ac) return;
        const now = ac.currentTime;
        const osc  = ac.createOscillator();
        const gain = ac.createGain();
        osc.type   = opts.type || 'triangle';
        osc.frequency.setValueAtTime(opts.freq, now);
        if (opts.sweep) osc.frequency.exponentialRampToValueAtTime(opts.sweep, now + (opts.dur || 0.18));
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(opts.vol || 0.18, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (opts.dur || 0.18));
        osc.connect(gain); gain.connect(ac.destination);
        osc.start(now); osc.stop(now + (opts.dur || 0.18) + 0.05);
    }
    function sfxStep()    { sfx({ freq: 90,  type: 'square',   dur: 0.06, vol: 0.10, sweep: 50 }); }
    function sfxCollect() {
        // 3-note ascending arpeggio · feels rewarding without being saccharine
        sfx({ freq: 392, type: 'triangle', dur: 0.18, vol: 0.16 });           // G4
        setTimeout(() => sfx({ freq: 494, type: 'triangle', dur: 0.20, vol: 0.16 }), 80);  // B4
        setTimeout(() => sfx({ freq: 587, type: 'triangle', dur: 0.32, vol: 0.18 }), 180); // D5
    }
    function sfxUpgrade() {
        // descending whoosh + low thump · "I just got something"
        sfx({ freq: 740, type: 'sawtooth', dur: 0.32, vol: 0.14, sweep: 220 });
        setTimeout(() => sfx({ freq: 110, type: 'triangle', dur: 0.22, vol: 0.20 }), 90);
    }

    // ── PARTICLES · color-matched bursts on chapter collection ───────
    function burstParticles(x, y, color, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 80 + Math.random() * 140;
            state.particles.push({
                x, y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - 60,   // bias upward — feels celebratory
                life: 1.0,
                color,
                size: 1.5 + Math.random() * 2,
            });
        }
    }
    function updateParticles(dt) {
        const dts = dt / 1000;
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.vy += 280 * dts;            // gravity
            p.vx *= 0.97; p.vy *= 0.97;   // drag
            p.x  += p.vx * dts;
            p.y  += p.vy * dts;
            p.life -= dts / 1.2;          // 1.2s lifetime
            if (p.life <= 0) state.particles.splice(i, 1);
        }
    }
    function drawParticles() {
        for (const p of state.particles) {
            ctx.fillStyle = p.color.replace(')', `,${Math.max(0, p.life).toFixed(2)})`)
                                   .replace('rgb', 'rgba')
                                   .replace('#', '');
            // hex fallback: simple alpha overlay
            if (p.color[0] === '#') {
                const r = parseInt(p.color.slice(1, 3), 16);
                const g = parseInt(p.color.slice(3, 5), 16);
                const b = parseInt(p.color.slice(5, 7), 16);
                ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(0, p.life).toFixed(2)})`;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── SCREEN SHAKE · linear-decay impact accent ────────────────────
    function shake(amp, ms) {
        if (amp > state.shake.amp) {
            state.shake.amp = amp;
            state.shake.t   = ms;
        }
    }

    // ── HUD lookups (cached) ─────────────────────────────────────────
    const $vehicleIcon  = document.getElementById('vehicle-icon');
    const $vehicleLabel = document.getElementById('vehicle-label');
    const $vehicleCard  = document.getElementById('vehicle-card');
    const $progress     = document.getElementById('progress-strip');
    const $achStack     = document.getElementById('achievement-stack');
    const $scoreDist    = document.getElementById('score-dist');
    const $scoreChap    = document.getElementById('score-chap');
    const $scoreTime    = document.getElementById('score-time');
    const $missionIcon  = document.getElementById('mission-icon');
    const $missionText  = document.getElementById('mission-text');
    const $tapHint      = document.getElementById('tap-hint');
    const $end          = document.getElementById('end');

    // build progress dots once
    const dots = [];
    if ($progress) {
        CHAPTERS.forEach(() => {
            const d = document.createElement('span');
            d.className = 'dot';
            $progress.appendChild(d);
            dots.push(d);
        });
    }
    function updateProgress(currentIdx) {
        dots.forEach((d, i) => {
            d.classList.remove('done', 'current');
            if (state.collected.has(CHAPTERS[i].id)) d.classList.add('done');
            if (i === currentIdx)                    d.classList.add('current');
        });
    }

    function updateVehicleCard() {
        if (!$vehicleIcon) return;
        const v = VEHICLES[state.vehicle];
        $vehicleIcon.textContent  = v.icon;
        $vehicleLabel.textContent = v.label;
        if ($vehicleCard) $vehicleCard.style.borderColor = colorForCurrentChapter();
    }
    function colorForCurrentChapter() {
        for (let i = CHAPTERS.length - 1; i >= 0; i--) {
            if (state.playerX >= CHAPTERS[i].x - 200) return CHAPTERS[i].color;
        }
        return '#d4a653';
    }

    function pickNextObjective() {
        for (let i = 0; i < CHAPTERS.length; i++) {
            if (!state.collected.has(CHAPTERS[i].id)) return i;
        }
        return CHAPTERS.length - 1;
    }
    function updateMission(idx) {
        if (!$missionText) return;
        const ch = CHAPTERS[idx];
        if (!ch) return;
        if (state.collected.has(ch.id)) {
            $missionText.textContent = `Reached: ${ch.label}`;
            $missionIcon.textContent = '✓';
            $missionIcon.classList.add('done');
        } else {
            $missionText.textContent = `Approach: ${ch.label}`;
            $missionIcon.textContent = '▸';
            $missionIcon.classList.remove('done');
        }
    }

    function showAchievement(ch, opts) {
        if (!$achStack) return;
        // Stacking policy by KIND, not by timing:
        //   · 'peek'  (voluntary · Space / tap) → ALWAYS replace any other
        //     peek currently on screen, and never add a 2nd peek. Peeks are
        //     user-driven and should feel instant + single.
        //   · 'event' (involuntary · vehicle-upgrade, chapter-collect) →
        //     may stack up to 2 cards (so bike-upgrade + Fever104 chapter
        //     can be visible together). Any existing peek is removed first
        //     so an involuntary event always wins over voluntary noise.
        const kind = (opts && opts.kind) || 'event';
        // remove every existing peek card (regardless of incoming kind)
        const existing = [...$achStack.children];
        for (const node of existing) {
            if (node.dataset && node.dataset.kind === 'peek') {
                $achStack.removeChild(node);
            }
        }
        if (kind === 'peek') {
            // peek replaces ALL siblings (events included): only one card
            // ever shows for voluntary input, no matter how fast/slow taps.
            while ($achStack.firstChild) $achStack.removeChild($achStack.firstChild);
        } else {
            // event · cap at 2 simultaneous event cards (oldest bumped)
            while ($achStack.children.length >= 2) {
                $achStack.removeChild($achStack.firstChild);
            }
        }
        const el = document.createElement('div');
        el.className = 'achievement';
        el.dataset.kind = kind;
        el.innerHTML = `
            <span class="a-icon">${ch.icon}</span>
            <div class="a-text">
                <span class="a-title">${ch.achTitle}</span>
                <span class="a-sub">${ch.achSub}</span>
            </div>`;
        $achStack.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2900);
    }

    function triggerLetterbox(ms) {
        document.body.classList.add('cinematic');
        setTimeout(() => document.body.classList.remove('cinematic'), ms || 1100);
    }

    // ── input · interactive · player walks only while a key/touch is held ──
    // Desktop: ArrowRight/D = forward (held), ArrowLeft/A = back (held),
    //          Space = peek next chapter card (one-shot).
    // Mobile:  pointerdown on canvas = walking · pointerup = stop.
    //          A quick tap (held < 180ms with minimal travel) registers as
    //          a peek instead of walking.
    let tapHintSeen = false;
    let touchStartT = 0;
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    const TAP_TRAVEL_PX = 8;          // dwell-tolerant tap · finger jitter still counts
    function triggerPeek() {
        const nextIdx = pickNextObjective();
        const ch = CHAPTERS[nextIdx];
        if (ch) showAchievement(ch, { kind: 'peek' });
        if (!tapHintSeen && $tapHint) {
            tapHintSeen = true;
            $tapHint.classList.add('faded');
        }
    }
    window.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') {
            e.preventDefault(); state.keys.right = true;
        } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
            e.preventDefault(); state.keys.left = true;
        } else if (k === ' ' || k === 'Enter') {
            // ignore OS-driven auto-repeat: holding Space must not fire
            // triggerPeek() repeatedly. Only act on the initial press.
            if (e.repeat) { e.preventDefault(); return; }
            e.preventDefault(); triggerPeek();
        }
    });
    window.addEventListener('keyup', (e) => {
        const k = e.key;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') state.keys.right = false;
        if (k === 'ArrowLeft'  || k === 'a' || k === 'A') state.keys.left  = false;
    });
    canvas.addEventListener('pointerdown', (e) => {
        if (e.target !== canvas) return;
        state.touchHold = true;
        touchStartT = performance.now();
        touchMoved = false;
        touchStartX = e.clientX;
        touchStartY = e.clientY;
    });
    // pointermove · sets touchMoved=true once finger drags beyond TAP_TRAVEL_PX
    // (was missing entirely · the !touchMoved check in pointerup was dead code).
    canvas.addEventListener('pointermove', (e) => {
        if (!state.touchHold || touchMoved) return;
        const dx = e.clientX - touchStartX;
        const dy = e.clientY - touchStartY;
        if (dx * dx + dy * dy > TAP_TRAVEL_PX * TAP_TRAVEL_PX) touchMoved = true;
    });
    canvas.addEventListener('pointerup', (e) => {
        const heldMs = performance.now() - touchStartT;
        state.touchHold = false;
        // quick tap with no movement-hold = peek the next chapter card
        if (heldMs < 180 && !touchMoved) triggerPeek();
    });
    canvas.addEventListener('pointercancel', () => { state.touchHold = false; });

    // initial HUD paint
    updateProgress(0);
    updateVehicleCard();
    updateMission(0);

    // ── rendering helpers ────────────────────────────────────────────

    /** sky · time-of-day color progression. Maps player.x along the
     *  total world distance and interpolates through 5 sky moods:
     *  dawn → morning → midday → dusk → twilight. The journey through
     *  life becomes a single sunrise-to-sundown day. */
    const SKY_KEYS = [
        { t: 0.00, top: '#1a1018', mid: '#542a18', low: '#c66a3a' },  // dawn · early life
        { t: 0.25, top: '#221610', mid: '#5a3a22', low: '#d68548' },  // morning
        { t: 0.50, top: '#2a1c12', mid: '#6a4828', low: '#e6a05c' },  // midday
        { t: 0.75, top: '#3a1808', mid: '#7a3818', low: '#d05028' },  // dusk
        { t: 1.00, top: '#180c1a', mid: '#3a1a3a', low: '#7a3a5a' },  // twilight
    ];
    function lerpHex(a, b, t) {
        const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
        const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bl = Math.round(ab + (bb - ab) * t);
        return `rgb(${r}, ${g}, ${bl})`;
    }
    function skyAt(progress) {
        for (let i = 0; i < SKY_KEYS.length - 1; i++) {
            if (progress <= SKY_KEYS[i + 1].t) {
                const k0 = SKY_KEYS[i], k1 = SKY_KEYS[i + 1];
                const t = (progress - k0.t) / (k1.t - k0.t);
                return { top: lerpHex(k0.top, k1.top, t), mid: lerpHex(k0.mid, k1.mid, t), low: lerpHex(k0.low, k1.low, t) };
            }
        }
        return SKY_KEYS[SKY_KEYS.length - 1];
    }
    function drawSky(W, H, horizonY, progress) {
        const c = skyAt(progress);
        const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
        grad.addColorStop(0,    c.top);
        grad.addColorStop(0.55, c.mid);
        grad.addColorStop(1,    c.low);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, horizonY);

        // SUN · drawn with composite='lighter' (additive) so the radial
        // gradient's BOUNDING RECTANGLE produces no visible edge · only
        // the bright glow blends on top of the sky. Previously source-over
        // composite was painting subtle vertical seams at the rect edges.
        const sunSize = 70 + (1 - Math.abs(progress - 0.5) * 2) * 40;
        const sunX = W * (0.78 - progress * 0.3);
        const sunY = horizonY - 48 + progress * 28;
        const sg = ctx.createRadialGradient(sunX, sunY, 3, sunX, sunY, sunSize);
        let sunCore, sunMid, sunEdge;
        if (progress < 0.5) {
            sunCore = 'rgba(220, 190, 130, 1)'; sunMid = 'rgba(150, 100, 60, 0.5)'; sunEdge = 'rgba(0, 0, 0, 0)';
        } else if (progress < 0.85) {
            sunCore = 'rgba(220, 140, 80, 1)';  sunMid = 'rgba(150, 70, 40, 0.5)';  sunEdge = 'rgba(0, 0, 0, 0)';
        } else {
            sunCore = 'rgba(180, 110, 160, 1)'; sunMid = 'rgba(90, 40, 100, 0.5)';  sunEdge = 'rgba(0, 0, 0, 0)';
        }
        sg.addColorStop(0,   sunCore);
        sg.addColorStop(0.4, sunMid);
        sg.addColorStop(1,   sunEdge);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = sg;
        // Paint sun gradient over the WHOLE sky rect (not just the sun's
        // bounding box). Outer color stop is rgba(0,0,0,0), so 'lighter'
        // composite contributes nothing outside the gradient circle ·
        // this guarantees no rect-edge seam even on rendering backends
        // (Safari/macOS) that anti-alias fractional fillRect bounds.
        ctx.fillRect(0, 0, W, horizonY);
        ctx.restore();
    }

    /** distant hills · slow parallax silhouette */
    function drawDistHills(W, horizonY, cameraX) {
        const offset = -(cameraX * 0.15);
        ctx.fillStyle = '#3a2818';
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        for (let i = 0; i < distHills.length; i++) {
            const p = distHills[i];
            const px = p.x + offset;
            if (px > -100 && px < W + 100) {
                ctx.lineTo(px, horizonY - p.y * 0.6);
            }
        }
        ctx.lineTo(W, horizonY);
        ctx.closePath();
        ctx.fill();
    }

    /** mid-ground · trees + telegraph poles · medium parallax */
    function drawMidProps(W, horizonY, groundY, cameraX) {
        const offset = -(cameraX * 0.5);
        ctx.font = '36px serif';
        ctx.textBaseline = 'bottom';
        for (let i = 0; i < midProps.length; i++) {
            const p = midProps[i];
            const px = p.x + offset;
            if (px < -60 || px > W + 60) continue;
            if (p.kind === 'tree') {
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(px - 2, groundY - 24 * p.scale, 3, 24 * p.scale);
                ctx.fillStyle = '#5a3a1f';
                ctx.beginPath();
                ctx.arc(px, groundY - 24 * p.scale, 12 * p.scale, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // telegraph pole
                ctx.fillStyle = '#2a1808';
                ctx.fillRect(px - 1.5, groundY - 40 * p.scale, 3, 40 * p.scale);
                ctx.fillRect(px - 8 * p.scale, groundY - 38 * p.scale, 16 * p.scale, 2);
            }
        }
    }

    /** ground plane · warm dirt + texture marks · full parallax */
    function drawGround(W, H, horizonY, groundY, cameraX) {
        const grad = ctx.createLinearGradient(0, horizonY, 0, H);
        grad.addColorStop(0, '#7a4a26');
        grad.addColorStop(0.4, '#5a3418');
        grad.addColorStop(1, '#3a2010');
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizonY, W, H - horizonY);

        // ground tufts (foreground · fast parallax)
        const offset = -(cameraX * 1.0);
        ctx.fillStyle = 'rgba(20, 12, 6, 0.6)';
        for (let i = 0; i < fgTufts.length; i++) {
            const t = fgTufts[i];
            const px = t.x + offset;
            if (px < -10 || px > W + 10) continue;
            ctx.fillRect(px, groundY + 6, 2, t.h);
        }
        // a few horizontal ruts running across · explicit 'butt' cap +
        // integer endpoints to avoid inheriting 'round' cap from upstream
        // walker draws (which produced a vertical hairline of stacked
        // semicircle endcaps at x = W on prior builds).
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(20,12,6,0.35)';
        ctx.lineWidth = 2;
        const xEnd = Math.floor(W);
        for (let i = 0; i < 8; i++) {
            const y = groundY + 12 + i * 14;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(xEnd, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ── per-chapter custom landmark drawers · each chapter gets its own
    //    distinct silhouette so the world reads as a sequence of PLACES,
    //    not 8 copies of the same archway with different emoji on top.
    // =====================================================================
    // ENRICHED CHAPTER LANDMARKS · each chapter is now a LIVED ZONE with
    // approach props (left of landmark), heart (landmark itself), and
    // animated NPCs. All animation drives off state.elapsedMs.
    // =====================================================================

    function landmarkITICS(px, gY, color, collected) {
        // ITICS · primary school years (Bangalore, age 7-15, until 2013)
        // Approach: dropped bag, kicked football, swing set, math-tuition sign.
        // Heart: school building with bell tower + flag. NPCs: 2 kids playing football.
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        const t = state.elapsedMs;

        // SWING SET · two empty swings, distant background
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 230, gY); ctx.lineTo(px - 215, gY - 34);
        ctx.lineTo(px - 175, gY - 34); ctx.lineTo(px - 160, gY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - 215, gY - 34); ctx.lineTo(px - 160, gY - 34); ctx.stroke();
        const sway = Math.sin(t * 0.0018) * 4;
        ctx.strokeStyle = '#7a4a26';
        ctx.beginPath(); ctx.moveTo(px - 205 + sway * 0.4, gY - 33); ctx.lineTo(px - 203, gY - 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - 180 - sway * 0.4, gY - 33); ctx.lineTo(px - 178, gY - 12); ctx.stroke();
        ctx.fillStyle = '#a86434';
        ctx.fillRect(px - 207 + sway * 0.4, gY - 12, 8, 2);
        ctx.fillRect(px - 182 - sway * 0.4, gY - 12, 8, 2);

        // "MATH TUITION" sign · wooden stake
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 145, gY - 22, 2, 22);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 158, gY - 36, 28, 16);
        ctx.fillStyle = '#5a3a22';
        ctx.font = '7px monospace';
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        ctx.fillText('MATH', px - 155, gY - 28);
        ctx.fillText('TUITION', px - 156, gY - 22);

        // SCHOOL BAG · dropped on the path
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(px - 115, gY - 14, 18, 14);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 113, gY - 18, 14, 4);
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px - 106, gY - 8, 3, 0, Math.PI * 2); ctx.stroke();

        // FOOTBALL · kicked aside, wobbles slightly
        const ballBob = Math.sin(t * 0.004) * 1;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(px - 75, gY - 5 + ballBob, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px - 77, gY - 7 + ballBob, 2, 2);
        ctx.fillRect(px - 73, gY - 6 + ballBob, 2, 2);

        // KID NPCs · two silhouettes playing football
        drawSchoolKid(px - 195, gY, t * 0.005,        color);
        drawSchoolKid(px - 168, gY, t * 0.005 + 1.4,  '#7a4a26');

        // SCHOOL BUILDING (heart)
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px - 40, gY - 56, 80, 56);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(px - 46, gY - 56); ctx.lineTo(px, gY - 86); ctx.lineTo(px + 46, gY - 56); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1a0e08';
        ctx.fillRect(px - 8, gY - 30, 16, 30);
        ctx.fillRect(px - 30, gY - 44, 12, 12);
        ctx.fillRect(px + 18, gY - 44, 12, 12);
        ctx.strokeStyle = '#a8b87a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px - 24, gY - 44); ctx.lineTo(px - 24, gY - 32); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 24, gY - 44); ctx.lineTo(px + 24, gY - 32); ctx.stroke();

        // BELL TOWER + bell that swings
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px - 8, gY - 100, 16, 14);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(px - 10, gY - 100); ctx.lineTo(px, gY - 110); ctx.lineTo(px + 10, gY - 100); ctx.closePath();
        ctx.fill();
        const bellSwing = Math.sin(t * 0.003) * 2;
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(px + bellSwing, gY - 92, 3, 0, Math.PI); ctx.fill();
        ctx.fillRect(px - 1 + bellSwing, gY - 95, 2, 4);

        // FLAG on top
        const wave = Math.sin(t * 0.004);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 1, gY - 124, 2, 24);
        ctx.fillStyle = '#a86434';
        ctx.beginPath();
        ctx.moveTo(px + 1, gY - 124);
        ctx.lineTo(px + 14 + wave * 2, gY - 121);
        ctx.lineTo(px + 1, gY - 118); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px + 1, gY - 118, 12, 4);
        ctx.fillStyle = color;       ctx.fillRect(px + 1, gY - 114, 12, 4);

        ctx.globalAlpha = 1;
    }
    function drawSchoolKid(x, y, phase, shirtColor) {
        const swing = Math.sin(phase) * 3;
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x - 2 + swing, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 2 - swing, y); ctx.stroke();
        ctx.fillStyle = shirtColor; ctx.fillRect(x - 3, y - 18, 6, 9);
        ctx.strokeStyle = '#2a1810';
        ctx.beginPath(); ctx.moveTo(x - 3, y - 16); ctx.lineTo(x - 6, y - 10 - swing * 0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 3, y - 16); ctx.lineTo(x + 6, y - 10 + swing * 0.5); ctx.stroke();
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(x, y - 21, 3, 0, Math.PI * 2); ctx.fill();
    }

    function landmarkCMR(px, gY, color, collected) {
        // CMR NATIONAL · PU years (2013-2015) · exam-pressure cooker
        const a = collected ? 0.55 : 0.92;
        const t = state.elapsedMs;
        ctx.globalAlpha = a;

        // TUITION CENTER billboard
        const bx = px - 230, by = gY - 78;
        ctx.fillStyle = '#3a2418'; ctx.fillRect(bx - 1, by, 2, 78);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bx - 32, by - 4, 64, 26);
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(bx - 32, by - 4, 64, 6);
        ctx.fillStyle = '#5a3a22';
        ctx.font = '7px monospace';
        ctx.textAlign = 'start'; ctx.textBaseline = 'top';
        ctx.fillText('TUITION', bx - 28, by + 2);
        ctx.fillText('CTR  →',  bx - 28, by + 11);
        ctx.textBaseline = 'alphabetic';

        // STACKED BOOKS
        const stack = [
            { x: px - 170, w: 22, h: 4, c: '#a86434' },
            { x: px - 168, w: 18, h: 4, c: '#5e7a8a' },
            { x: px - 172, w: 24, h: 5, c: '#7a4a26' },
        ];
        let sy = gY;
        for (const b of stack) {
            ctx.fillStyle = b.c; ctx.fillRect(b.x, sy - b.h, b.w, b.h);
            ctx.fillStyle = '#2a1808'; ctx.fillRect(b.x, sy - b.h, b.w, 1);
            sy -= b.h;
        }

        // GRAPH PAPER scattered
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 195, gY - 2, 10, 2);
        ctx.fillRect(px - 142, gY - 3, 9, 3);
        ctx.strokeStyle = '#5e7a8a'; ctx.lineWidth = 0.4;
        ctx.strokeRect(px - 195, gY - 2, 10, 2);
        ctx.strokeRect(px - 142, gY - 3, 9, 3);

        // COFFEE CUP with steam
        ctx.fillStyle = '#d4a653'; ctx.fillRect(px - 110, gY - 7, 7, 7);
        ctx.fillStyle = '#2a1808'; ctx.fillRect(px - 109, gY - 6, 5, 2);
        ctx.fillStyle = 'rgba(233, 216, 176, 0.5)';
        const steamX = px - 106 + Math.sin(t / 400) * 1.5;
        ctx.fillRect(steamX, gY - 14, 1, 5);

        // STUDY DESK lamp through window
        ctx.fillStyle = '#1a1208'; ctx.fillRect(px - 80, gY - 26, 24, 20);
        ctx.fillStyle = '#d4a653'; ctx.fillRect(px - 78, gY - 24, 20, 16);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 76, gY - 11, 16, 3);
        ctx.fillStyle = '#2a1808'; ctx.fillRect(px - 72, gY - 22, 2, 11);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 75, gY - 24, 8, 3);

        // FOREGROUND NPC · student with heavy bag, walking
        const walkBob = Math.sin(t / 250) * 0.6;
        const wx = px - 130;
        ctx.fillStyle = '#2a1808'; ctx.fillRect(wx - 2, gY - 18 + walkBob, 4, 10);
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(wx, gY - 20 + walkBob, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(wx + 1, gY - 14 + walkBob, 5, 6);
        ctx.fillStyle = '#2a1808';
        ctx.fillRect(wx - 2, gY - 8 + walkBob, 1.5, 8);
        ctx.fillRect(wx + 0.5, gY - 8 + walkBob, 1.5, 8);

        // HEART · multi-storey classroom block
        ctx.fillStyle = '#2a2018'; ctx.fillRect(px - 42, gY - 124, 84, 124);
        ctx.fillStyle = '#5e7a8a';
        ctx.fillRect(px - 44, gY - 128, 88, 8);
        ctx.fillRect(px - 44, gY - 90, 88, 1);
        ctx.fillRect(px - 44, gY - 60, 88, 1);
        ctx.fillRect(px - 44, gY - 30, 88, 1);

        const litMap = { '0_1': 0.0, '1_3': 0.4, '2_0': 0.8, '2_4': 1.2, '3_2': 1.6 };
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 5; c++) {
                const wxw = px - 36 + c * 16;
                const wyw = gY - 116 + r * 30;
                const key = r + '_' + c;
                if (litMap[key] !== undefined) {
                    drawWindowSilhouette(wxw, wyw, 10, 14, t / 1000 + litMap[key]);
                } else {
                    ctx.fillStyle = '#0a0604';
                    ctx.fillRect(wxw, wyw, 10, 14);
                }
            }
        }

        // entrance · clinical
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(px - 9, gY - 20, 18, 20);
        ctx.fillStyle = '#0a0604'; ctx.fillRect(px - 7, gY - 18, 14, 18);
        // CMR signboard
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 16, gY - 28, 32, 6);
        ctx.fillStyle = '#5a3a22'; ctx.font = '6px monospace';
        ctx.fillText('CMR PU', px - 13, gY - 23);

        ctx.globalAlpha = 1;
    }
    function drawWindowSilhouette(wx, wy, w, h, phase) {
        ctx.fillStyle = '#d4a653'; ctx.fillRect(wx, wy, w, h);
        ctx.fillStyle = 'rgba(94, 122, 138, 0.35)'; ctx.fillRect(wx, wy, w, h);
        const bob = Math.sin(phase * 2.0) * 0.5;
        ctx.fillStyle = '#1a1208';
        ctx.fillRect(wx + 1, wy + h - 6 + bob, w - 2, 6);
        ctx.beginPath();
        ctx.arc(wx + w / 2, wy + h - 8 + bob, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(wx + w / 2, wy); ctx.lineTo(wx + w / 2, wy + h);
        ctx.moveTo(wx, wy + h / 2); ctx.lineTo(wx + w, wy + h / 2);
        ctx.stroke();
    }

    function landmarkDSCE(px, gY, color, collected) {
        // DSCE · mech-eng campus, approach props + tower + hostel + NPCs
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        const t = state.elapsedMs;

        // Parked bicycles
        drawBicycle(px - 180, gY, color);
        drawBicycle(px - 158, gY, '#8a5230');
        drawBicycle(px - 136, gY, color);

        // Stack of notebooks
        ctx.fillStyle = '#3a2418'; ctx.fillRect(px - 110, gY - 6, 22, 4);
        ctx.fillStyle = color;     ctx.fillRect(px - 108, gY - 10, 22, 4);
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(px - 112, gY - 14, 22, 4);
        ctx.fillStyle = '#0a0604';
        ctx.fillRect(px - 110, gY - 9, 22, 1);
        ctx.fillRect(px - 108, gY - 13, 22, 1);

        // Drafting board + compass
        ctx.fillStyle = '#1a1410'; ctx.fillRect(px - 80, gY - 50, 36, 46);
        ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 70, gY); ctx.lineTo(px - 64, gY - 50);
        ctx.moveTo(px - 52, gY); ctx.lineTo(px - 58, gY - 50);
        ctx.stroke();
        drawDraftingCompass(px - 62, gY - 28);

        // Engineering drawing
        ctx.fillStyle = '#e8d8b8'; ctx.fillRect(px - 36, gY - 38, 28, 22);
        ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 0.6;
        ctx.strokeRect(px - 32, gY - 34, 12, 12);
        ctx.beginPath();
        ctx.moveTo(px - 32, gY - 36); ctx.lineTo(px - 20, gY - 36);
        ctx.moveTo(px - 18, gY - 34); ctx.lineTo(px - 12, gY - 30);
        ctx.moveTo(px - 32, gY - 20); ctx.lineTo(px - 14, gY - 20);
        ctx.stroke();
        ctx.fillStyle = '#1a1006'; ctx.fillRect(px - 30, gY - 26, 2, 2);

        // Canteen sign
        ctx.fillStyle = '#3a2418'; ctx.fillRect(px + 70, gY - 40, 3, 40);
        ctx.fillStyle = color;     ctx.fillRect(px + 60, gY - 50, 28, 14);
        ctx.fillStyle = '#0a0604'; ctx.font = 'bold 7px "Cinzel", serif';
        ctx.textAlign = 'center'; ctx.fillText('CANTEEN', px + 74, gY - 41);
        ctx.textAlign = 'start';

        // Hostel block silhouette behind tower
        ctx.fillStyle = '#15100a';
        ctx.fillRect(px + 30, gY - 90, 50, 90);
        ctx.fillStyle = '#2a1e12';
        for (let r = 0; r < 5; r++)
            for (let c = 0; c < 4; c++)
                ctx.fillRect(px + 34 + c * 11, gY - 84 + r * 16, 6, 8);

        // Wings + central tower
        ctx.fillStyle = '#1f1810';
        ctx.fillRect(px - 56, gY - 64, 112, 64);
        ctx.fillRect(px - 18, gY - 110, 36, 110);
        ctx.fillStyle = color;
        ctx.fillRect(px - 20, gY - 115, 40, 8);
        ctx.beginPath(); ctx.arc(px, gY - 115, 14, Math.PI, 2 * Math.PI); ctx.fill();
        ctx.fillRect(px - 1, gY - 134, 2, 6);
        ctx.beginPath(); ctx.arc(px, gY - 134, 2, 0, Math.PI * 2); ctx.fill();

        // Gear logo · rotating
        const gearA = t * 0.0008;
        ctx.save();
        ctx.translate(px, gY - 88);
        ctx.rotate(gearA);
        ctx.fillStyle = color;
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            ctx.fillRect(Math.cos(ang) * 8 - 1.5, Math.sin(ang) * 8 - 1.5, 3, 3);
        }
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f1810';
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Window grid
        ctx.fillStyle = '#080604';
        for (let i = 0; i < 5; i++) ctx.fillRect(px - 14 + i * 8, gY - 80, 5, 8);
        for (let i = 0; i < 5; i++) ctx.fillRect(px - 14 + i * 8, gY - 60, 5, 8);
        for (let i = 0; i < 6; i++) ctx.fillRect(px - 50 + i * 16, gY - 50, 8, 8);

        // Flag · gentle wave
        const wave = Math.sin(t * 0.004) * 2;
        ctx.fillStyle = '#3a2418'; ctx.fillRect(px - 30, gY - 140, 2, 30);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(px - 28, gY - 140);
        ctx.lineTo(px - 14 + wave, gY - 136);
        ctx.lineTo(px - 28, gY - 130);
        ctx.fill();

        // NPCs · 3 walkers with different phases + cyclist
        const w1x = px - 100 + ((t * 0.025) % 220);
        drawWalkingStudent(w1x, gY, t * 0.008, 1.0);
        const w2x = px + 120 - ((t * 0.020) % 220);
        drawWalkingStudent(w2x, gY, t * 0.007 + Math.PI, 0.88);
        const w3x = px - 60 + ((t * 0.015) % 180);
        drawWalkingStudent(w3x, gY, t * 0.006, 1.12);

        const cyx = px - 200 + ((t * 0.045) % 420);
        drawBicycle(cyx, gY, color);
        ctx.fillStyle = '#e8c498';
        ctx.beginPath(); ctx.arc(cyx + 4, gY - 22, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a3a5a';
        ctx.fillRect(cyx + 2, gY - 19, 6, 9);

        ctx.globalAlpha = 1;
    }
    function drawBicycle(x, y, color) {
        ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y - 5, 5, 0, Math.PI * 2);
        ctx.arc(x + 14, y - 5, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y - 5); ctx.lineTo(x + 7, y - 11);
        ctx.lineTo(x + 14, y - 5);
        ctx.moveTo(x + 7, y - 11); ctx.lineTo(x + 12, y - 14);
        ctx.moveTo(x + 14, y - 5); ctx.lineTo(x + 16, y - 14);
        ctx.lineTo(x + 13, y - 15);
        ctx.stroke();
    }
    function drawWalkingStudent(x, y, phase, scale) {
        const h = 22 * scale;
        const legSwing = Math.sin(phase) * 3;
        ctx.fillStyle = '#e8c498';
        ctx.beginPath(); ctx.arc(x, y - h, 3 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(x - 3 * scale, y - h + 3, 6 * scale, 9 * scale);
        ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y - h + 12 * scale); ctx.lineTo(x - legSwing, y);
        ctx.moveTo(x, y - h + 12 * scale); ctx.lineTo(x + legSwing, y);
        ctx.stroke();
    }
    function drawDraftingCompass(x, y) {
        ctx.fillStyle = '#c47540';
        ctx.beginPath(); ctx.arc(x, y - 14, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c47540'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y - 14); ctx.lineTo(x - 8, y + 6);
        ctx.moveTo(x, y - 14); ctx.lineTo(x + 8, y + 6);
        ctx.stroke();
        ctx.fillStyle = '#1a1006'; ctx.fillRect(x + 7, y + 4, 2, 4);
    }

    function landmarkFever104(px, gY, color, collected) {
        // FEVER 104 FM · radio internship · studio booth + antenna + props
        const a = collected ? 0.55 : 0.92;
        const t = state.elapsedMs;
        ctx.globalAlpha = a;

        // STUDIO BUILDING
        ctx.fillStyle = '#1a0f0a'; ctx.fillRect(px - 70, gY - 60, 140, 60);
        ctx.fillStyle = '#2a1810'; ctx.fillRect(px - 70, gY - 66, 140, 6);

        // DJ BOOTH window
        const boothX = px - 56, boothY = gY - 52;
        ctx.fillStyle = `rgba(255, 140, 80, ${a * 0.55})`;
        ctx.fillRect(boothX, boothY, 38, 28);
        ctx.fillStyle = color; ctx.fillRect(boothX - 1, boothY - 2, 40, 2);
        drawDJSilhouette(boothX + 19, boothY + 18, t * 0.004);

        // MIXING CONSOLE window
        const conX = px + 18, conY = gY - 52;
        ctx.fillStyle = `rgba(255, 140, 80, ${a * 0.45})`;
        ctx.fillRect(conX, conY, 38, 28);
        ctx.fillStyle = '#0a0604'; ctx.fillRect(conX + 3, conY + 18, 32, 6);
        for (let i = 0; i < 5; i++) {
            const sx = conX + 6 + i * 6;
            const slide = Math.sin(t * 0.003 + i) * 2;
            ctx.fillStyle = color;
            ctx.fillRect(sx, conY + 14 + slide, 2, 8);
        }

        // MICROPHONE
        const micX = px - 92, micBaseY = gY;
        ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(micX, micBaseY); ctx.lineTo(micX, micBaseY - 28); ctx.stroke();
        ctx.fillStyle = '#3a2a20'; ctx.fillRect(micX - 5, micBaseY - 1, 10, 2);
        ctx.fillStyle = '#1a1010';
        ctx.beginPath(); ctx.ellipse(micX, micBaseY - 32, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(micX - 3, micBaseY - 34, 6, 1);

        // ON AIR sign
        drawOnAirSign(px, gY - 30, t * 0.003);

        // 104 FM marquee
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        const scroll = (t * 0.05) % 40;
        ctx.fillStyle = `rgba(255, 200, 160, ${a * 0.7})`;
        ctx.fillText('· 104 FM · FEVER · 104 FM ·', px - scroll, gY - 9);

        // FLOATING MUSIC NOTES drift up from booth
        for (let i = 0; i < 5; i++) {
            const drift = (t * 0.04 + i * 80) % 200;
            const nx = px - 40 + i * 22 + Math.sin(t * 0.002 + i) * 6;
            const ny = gY - 60 - drift;
            const noteAlpha = a * Math.max(0, 1 - drift / 200);
            drawMusicNote(nx, ny, 1 + i * 0.05, noteAlpha);
        }

        // ANTENNA LATTICE
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        const baseY = gY - 66;
        const tipY = gY - 180;
        const baseHW = 14, tipHW = 3;
        ctx.beginPath();
        ctx.moveTo(px - baseHW, baseY); ctx.lineTo(px - tipHW, tipY);
        ctx.moveTo(px + baseHW, baseY); ctx.lineTo(px + tipHW, tipY);
        ctx.stroke();
        for (let i = 0; i < 7; i++) {
            const k = i / 7;
            const y = baseY + (tipY - baseY) * k;
            const hw = baseHW + (tipHW - baseHW) * k;
            ctx.beginPath(); ctx.moveTo(px - hw, y); ctx.lineTo(px + hw, y); ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
            const y1 = baseY + i * 16, y2 = y1 + 16;
            const hw1 = baseHW - i * 1.8, hw2 = baseHW - (i + 1) * 1.8;
            ctx.beginPath();
            ctx.moveTo(px - hw1, y1); ctx.lineTo(px + hw2, y2);
            ctx.moveTo(px + hw1, y1); ctx.lineTo(px - hw2, y2);
            ctx.stroke();
        }

        // GLOWING BEACON
        const beacon = 0.5 + Math.sin(t * 0.008) * 0.5;
        ctx.fillStyle = `rgba(255, 60, 50, ${beacon * 0.35})`;
        ctx.beginPath(); ctx.arc(px, tipY - 4, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, 80, 60, ${beacon})`;
        ctx.beginPath(); ctx.arc(px, tipY - 4, 3, 0, Math.PI * 2); ctx.fill();

        ctx.globalAlpha = 1; ctx.textAlign = 'start';
    }
    function drawMusicNote(x, y, scale, alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffb070';
        ctx.font = `${Math.round(16 * scale)}px serif`;
        ctx.textAlign = 'center';
        const glyph = (Math.floor(x + y) % 2) ? '♪' : '♫';
        ctx.fillText(glyph, x, y);
        ctx.restore();
    }
    function drawDJSilhouette(x, y, phase) {
        const nod = Math.sin(phase) * 1.2;
        ctx.save();
        ctx.fillStyle = '#0a0604';
        ctx.fillRect(x - 10, y + 6, 20, 6);
        ctx.beginPath(); ctx.arc(x, y + nod, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#b84c32'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y + nod - 1, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.fillStyle = '#b84c32';
        ctx.fillRect(x - 8, y + nod - 1, 2, 4);
        ctx.fillRect(x + 6, y + nod - 1, 2, 4);
        ctx.restore();
    }
    function drawOnAirSign(x, y, blinkPhase) {
        const on = Math.sin(blinkPhase) > -0.3;
        ctx.save();
        ctx.fillStyle = '#2a1810'; ctx.fillRect(x - 26, y - 6, 52, 14);
        ctx.fillStyle = on ? '#b84c32' : '#3a1810'; ctx.fillRect(x - 24, y - 4, 48, 10);
        if (on) { ctx.fillStyle = 'rgba(255, 80, 50, 0.25)'; ctx.fillRect(x - 30, y - 8, 60, 18); }
        ctx.fillStyle = on ? '#0a0604' : '#1a0e08';
        ctx.font = 'bold 10px "Cinzel", serif'; ctx.textAlign = 'center';
        ctx.fillText('ON AIR', x, y + 4);
        ctx.restore();
    }

    function landmarkSakha(px, gY, color, collected) {
        // SAKHA GLOBAL · first job (Jul 2019 - Sep 2022)
        const a = collected ? 0.55 : 0.92;
        const t = state.elapsedMs / 1000;
        ctx.globalAlpha = a;

        // Maruti Alto parked
        drawAlto(px - 110, gY - 2, '#d9c9a0');

        // Coffee with steam
        drawCoffeeWithSteam(px - 60, gY - 4, t);

        // Walking figure toward entrance
        const walkPhase = Math.sin(t * 4) * 1.2;
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(px - 28, gY - 18, 5, 12);
        ctx.beginPath(); ctx.arc(px - 25.5, gY - 22, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(px - 29, gY - 6 + Math.abs(walkPhase) * 0.5, 2, 6);
        ctx.fillRect(px - 24, gY - 6 + Math.abs(-walkPhase) * 0.5, 2, 6);

        // Office building
        ctx.fillStyle = '#1a1610'; ctx.fillRect(px - 36, gY - 110, 72, 110);
        ctx.fillStyle = '#2a2218'; ctx.fillRect(px - 38, gY - 114, 76, 5);
        ctx.fillStyle = color; ctx.fillRect(px - 38, gY - 117, 76, 4);

        // Parking lot
        ctx.fillStyle = '#0c0a08'; ctx.fillRect(px - 130, gY - 1, 220, 6);
        ctx.fillStyle = '#8a8270';
        for (let i = 0; i < 5; i++) ctx.fillRect(px - 120 + i * 50, gY + 1, 14, 1);

        // Entrance
        ctx.fillStyle = '#08060a'; ctx.fillRect(px - 7, gY - 22, 14, 22);
        ctx.fillStyle = color;
        ctx.globalAlpha = a * 0.7; ctx.fillRect(px - 8, gY - 24, 16, 2);
        ctx.globalAlpha = a;

        // SAKHA GLOBAL plate
        ctx.fillStyle = color; ctx.fillRect(px - 30, gY - 38, 60, 8);
        ctx.fillStyle = '#1a1610';
        ctx.font = 'bold 6px "Cinzel", serif'; ctx.textAlign = 'center';
        ctx.fillText('SAKHA GLOBAL', px, gY - 32);
        ctx.textAlign = 'start';

        // Windows · 4x5 with desk silhouettes
        const litPattern = [[1,0,1,1,0],[1,1,0,1,1],[0,1,1,0,1],[1,0,1,1,0]];
        const deskPattern = [[1,0,0,1,0],[1,1,0,0,1],[0,1,1,0,1],[0,0,1,0,0]];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 5; c++) {
                const wx = px - 30 + c * 12;
                const wy = gY - 100 + r * 16;
                const phase = t * 3 + r * 1.7 + c * 0.9;
                drawOfficeWindow(wx, wy, 9, 11, phase, litPattern[r][c], deskPattern[r][c]);
            }
        }

        ctx.globalAlpha = 1;
    }
    function drawAlto(x, y, bodyColor) {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - 14, y - 6, 28, 6);
        ctx.beginPath();
        ctx.moveTo(x - 10, y - 6);
        ctx.lineTo(x - 7, y - 13);
        ctx.lineTo(x + 8, y - 13);
        ctx.lineTo(x + 11, y - 6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a1812';
        ctx.fillRect(x - 6, y - 12, 6, 5);
        ctx.fillRect(x + 1, y - 12, 6, 5);
        ctx.fillStyle = '#0a0806';
        ctx.beginPath(); ctx.arc(x - 8, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 8, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c9a151'; ctx.fillRect(x + 12, y - 4, 2, 2);
    }
    function drawOfficeWindow(wx, wy, w, h, phase, lit, hasDesk) {
        ctx.fillStyle = '#08060a'; ctx.fillRect(wx, wy, w, h);
        if (!lit) return;
        const flicker = 0.85 + Math.sin(phase * 4) * 0.08;
        const prevAlpha = ctx.globalAlpha;
        ctx.fillStyle = '#c9a151';
        ctx.globalAlpha = prevAlpha * flicker;
        ctx.fillRect(wx + 1, wy + 1, w - 2, h - 2);
        ctx.globalAlpha = prevAlpha;
        if (hasDesk) {
            ctx.fillStyle = '#1a1208';
            ctx.fillRect(wx + 1, wy + h - 4, w - 2, 2);
            ctx.fillRect(wx + 2, wy + h - 7, 3, 3);
            const bob = Math.sin(phase) * 0.6;
            ctx.fillRect(wx + 5, wy + h - 6 + bob, 3, 2);
            ctx.beginPath();
            ctx.arc(wx + 6.5, wy + h - 7 + bob, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    function drawCoffeeWithSteam(x, y, t) {
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 3, y - 6, 6, 5);
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + 4, y - 3.5, 1.5, -Math.PI/2, Math.PI/2); ctx.stroke();
        ctx.fillStyle = '#3a2410'; ctx.fillRect(x - 2, y - 6, 4, 1);
        const prevAlpha = ctx.globalAlpha;
        ctx.strokeStyle = '#d8c89a';
        ctx.globalAlpha = prevAlpha * 0.55; ctx.lineWidth = 0.8;
        for (let s = 0; s < 3; s++) {
            ctx.beginPath();
            for (let py = 0; py < 10; py++) {
                const sx = x - 1 + s + Math.sin(t * 3 + py * 0.6 + s) * 1.2;
                const sy = y - 8 - py;
                if (py === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = prevAlpha;
    }

    function landmarkScripbox(px, gY, color, collected) {
        // SCRIPBOX · modern AI-era work (Sep 2022-present)
        const a = collected ? 0.55 : 0.92;
        const phase = state.elapsedMs / 1000;
        const cursorOn = Math.floor(state.elapsedMs / 500) % 2 === 0;
        ctx.globalAlpha = a;

        // Neural net low-left
        drawNeuralNet(px - 180, gY - 60, 1.0, phase);
        // MCP diagram mid-left
        drawMcpDiagram(px - 110, gY - 130, 1.0);

        // Floating code fragments
        ctx.fillStyle = '#7fffd4';
        ctx.globalAlpha = a * 0.6;
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.textAlign = 'start';
        const frags = ['$ git commit', 'git push origin', 'PR #4271 merged', '> mcp.connect()'];
        frags.forEach((txt, i) => {
            const drift = (phase * 6 + i * 30) % 90;
            ctx.fillText(txt, px - 220 + i * 18, gY - 20 - drift);
        });
        ctx.globalAlpha = a;

        // Multi-monitor desk approach-zone
        ctx.fillStyle = '#0a0e12';
        ctx.fillRect(px - 260, gY - 18, 60, 4);
        ctx.fillRect(px - 256, gY - 14, 4, 14);
        ctx.fillRect(px - 208, gY - 14, 4, 14);
        ctx.fillStyle = '#1a2230';
        ctx.fillRect(px - 252, gY - 38, 14, 20);
        ctx.fillRect(px - 236, gY - 40, 16, 22);
        ctx.fillRect(px - 218, gY - 38, 14, 20);
        ctx.fillStyle = '#7fffd4';
        ctx.globalAlpha = a * (0.5 + 0.2 * Math.sin(phase * 3));
        ctx.fillRect(px - 250, gY - 36, 10, 16);
        ctx.fillRect(px - 234, gY - 38, 12, 18);
        ctx.fillRect(px - 216, gY - 36, 10, 16);
        ctx.globalAlpha = a;

        // Tapered glass tower (taller)
        ctx.fillStyle = '#0e1218';
        ctx.beginPath();
        ctx.moveTo(px - 34, gY); ctx.lineTo(px - 26, gY - 175);
        ctx.lineTo(px + 26, gY - 175); ctx.lineTo(px + 34, gY); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(px - 26, gY - 175, 52, 3);

        // Rooftop antenna + dish
        ctx.fillRect(px - 1, gY - 196, 2, 21);
        ctx.fillStyle = '#c8e6d8';
        ctx.beginPath(); ctx.arc(px + 14, gY - 178, 5, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + 13, gY - 178, 2, 4);
        if (cursorOn) {
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(px - 2, gY - 198, 3, 3);
        }

        // Code-lit windows · 4 floors × 2
        for (let floor = 0; floor < 4; floor++) {
            const wy = gY - 160 + floor * 36;
            drawCodeWindow(px - 18, wy, 14, 22, phase + floor * 0.7);
            drawCodeWindow(px + 4,  wy, 14, 22, phase + floor * 1.1);
        }
        if (cursorOn) {
            ctx.fillStyle = '#7fffd4';
            ctx.fillRect(px - 11, gY - 152, 1, 6);
            ctx.fillRect(px + 13, gY - 80, 1, 6);
        }

        // SCRIPBOX sign
        ctx.fillStyle = color;
        ctx.globalAlpha = a * 0.85;
        ctx.font = 'bold 7px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCRIPBOX', px, gY - 10);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'start';
    }
    function drawNeuralNet(x, y, scale, phase) {
        const nodes = [[0,20],[18,0],[18,40],[36,12],[36,32],[54,22]];
        ctx.strokeStyle = '#7fffd4'; ctx.lineWidth = 0.5;
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = prevAlpha * (0.4 + 0.2 * Math.sin(phase * 2));
        const edges = [[0,1],[0,2],[1,3],[2,3],[2,4],[1,4],[3,5],[4,5]];
        edges.forEach(([a,b]) => {
            ctx.beginPath();
            ctx.moveTo(x + nodes[a][0]*scale, y + nodes[a][1]*scale);
            ctx.lineTo(x + nodes[b][0]*scale, y + nodes[b][1]*scale);
            ctx.stroke();
        });
        ctx.globalAlpha = prevAlpha * 0.85;
        ctx.fillStyle = '#7a9a8a';
        nodes.forEach(n => {
            ctx.beginPath();
            ctx.arc(x + n[0]*scale, y + n[1]*scale, 2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = prevAlpha;
    }
    function drawCodeWindow(wx, wy, w, h, phase) {
        ctx.fillStyle = '#050a08'; ctx.fillRect(wx, wy, w, h);
        const glow = 0.55 + 0.25 * Math.sin(phase * 1.6);
        ctx.fillStyle = `rgba(127, 255, 212, ${glow * 0.35})`;
        ctx.fillRect(wx + 1, wy + 1, w - 2, h - 2);
        ctx.fillStyle = '#7fffd4';
        for (let i = 0; i < 3; i++) {
            const lineY = wy + 3 + ((i * 6 + phase * 4) % (h - 4));
            const lineW = 4 + ((i * 3 + Math.floor(phase * 2)) % 7);
            ctx.fillRect(wx + 2, lineY, lineW, 1);
        }
        if (((wx + wy) % 3) === 0) {
            ctx.fillStyle = '#0a0e12';
            ctx.beginPath();
            ctx.arc(wx + w / 2, wy + h - 4, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(wx + w / 2 - 4, wy + h - 2, 8, 2);
        }
    }
    function drawMcpDiagram(x, y, scale) {
        const boxes = [['MCP', 0], ['SRV', 22], ['TLS', 44]];
        boxes.forEach(([label, bx]) => {
            ctx.strokeStyle = '#7a9a8a'; ctx.lineWidth = 0.8;
            ctx.fillStyle = 'rgba(122, 154, 138, 0.15)';
            ctx.strokeRect(x + bx * scale, y, 16 * scale, 10 * scale);
            ctx.fillRect(x + bx * scale, y, 16 * scale, 10 * scale);
            ctx.fillStyle = '#c8e6d8';
            ctx.font = '5px "JetBrains Mono", monospace';
            ctx.fillText(label, x + bx * scale + 3, y + 7 * scale);
        });
        ctx.strokeStyle = '#7fffd4';
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 5); ctx.lineTo(x + 22, y + 5);
        ctx.moveTo(x + 38, y + 5); ctx.lineTo(x + 44, y + 5);
        ctx.stroke();
    }

    function landmarkVWGT(px, gY, color, collected) {
        // THE GT · VW Virtus GT delivery (Nov 16, 2025)
        const a = collected ? 0.55 : 0.95;
        ctx.globalAlpha = a;
        const t = state.elapsedMs / 1000;
        const shake = Math.sin(t * 14) * 0.4;

        // Highway road slab receding
        ctx.fillStyle = '#1a1a1f';
        ctx.beginPath();
        ctx.moveTo(px - 160, gY);
        ctx.lineTo(px + 160, gY);
        ctx.lineTo(px + 60, gY - 28);
        ctx.lineTo(px - 60, gY - 28);
        ctx.closePath(); ctx.fill();

        // Receding gold lane dashes
        ctx.fillStyle = '#d4a653';
        for (let i = 0; i < 5; i++) {
            const k = i / 5;
            const y = gY - k * 28;
            const w = 18 - k * 14;
            ctx.globalAlpha = a * (1 - k * 0.5);
            ctx.fillRect(px - w / 2, y - 1.5, w, 3);
        }
        ctx.globalAlpha = a;

        // Checkered flag bunting
        drawCheckeredFlag(px - 60, gY - 34, 120, 4);

        // Showroom in distance
        drawShowroom(px - 110, gY - 30);

        // Delivery balloon
        drawDeliveryBalloon(px - 92, gY - 56, t);

        // THE GT sedan with engine vibration
        drawVwSedan(px + 10, gY - 1 + shake, 1.0);

        // Owner with arm raised in victory
        ctx.fillStyle = '#f0d9b5';
        ctx.beginPath(); ctx.arc(px + 56, gY - 28, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(px + 54, gY - 25, 5, 10);
        ctx.fillStyle = '#1d3a5c';
        ctx.fillRect(px + 54, gY - 15, 2, 9);
        ctx.fillRect(px + 57, gY - 15, 2, 9);
        ctx.strokeStyle = '#f0d9b5'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px + 58, gY - 23); ctx.lineTo(px + 64, gY - 34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 55, gY - 23); ctx.lineTo(px + 52, gY - 17); ctx.stroke();

        // Salesperson silhouette in showroom window
        ctx.fillStyle = '#3a2418';
        ctx.fillRect(px - 96, gY - 44, 3, 8);
        ctx.beginPath(); ctx.arc(px - 94.5, gY - 46, 2, 0, Math.PI * 2); ctx.fill();

        // Headlight glint sparkle
        const glint = (Math.sin(t * 6) + 1) * 0.5;
        ctx.globalAlpha = a * glint;
        ctx.fillStyle = '#fffbe6';
        ctx.beginPath(); ctx.arc(px + 40, gY - 14, 2.4, 0, Math.PI * 2); ctx.fill();

        ctx.globalAlpha = 1;
    }
    function drawVwSedan(x, y, scale) {
        const s = scale;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(x, y + 1, 40 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1d3a5c';
        ctx.beginPath();
        ctx.moveTo(x - 38 * s, y - 6 * s);
        ctx.lineTo(x - 34 * s, y - 13 * s);
        ctx.lineTo(x - 18 * s, y - 18 * s);
        ctx.lineTo(x + 10 * s, y - 20 * s);
        ctx.lineTo(x + 22 * s, y - 17 * s);
        ctx.lineTo(x + 32 * s, y - 13 * s);
        ctx.lineTo(x + 38 * s, y - 6 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0a1420';
        ctx.beginPath();
        ctx.moveTo(x - 14 * s, y - 17 * s);
        ctx.lineTo(x + 8 * s, y - 19 * s);
        ctx.lineTo(x + 18 * s, y - 16 * s);
        ctx.lineTo(x - 10 * s, y - 14 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d4a653';
        ctx.fillRect(x - 36 * s, y - 8 * s, 72 * s, 1.5 * s);
        ctx.fillStyle = '#1d3a5c';
        ctx.fillRect(x + 34 * s, y - 14 * s, 6 * s, 2 * s);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${7 * s}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('01', x + 14 * s, y - 10 * s);
        ctx.textAlign = 'start';
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(x - 24 * s, y - 9 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe4a0';
        ctx.fillRect(x + 36 * s, y - 12 * s, 3 * s, 2 * s);
        ctx.fillStyle = '#a4332e';
        ctx.fillRect(x - 39 * s, y - 11 * s, 2 * s, 2 * s);
        ctx.fillStyle = '#0a0a0c';
        ctx.beginPath(); ctx.arc(x - 22 * s, y - 3 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 22 * s, y - 3 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c0c4cc';
        ctx.beginPath(); ctx.arc(x - 22 * s, y - 3 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 22 * s, y - 3 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(x - 22 * s, y - 3 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 22 * s, y - 3 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
    }
    function drawShowroom(x, y) {
        ctx.fillStyle = '#1a0e0a'; ctx.fillRect(x - 26, y - 22, 52, 22);
        ctx.fillStyle = '#040608'; ctx.fillRect(x - 22, y - 18, 44, 16);
        ctx.fillStyle = '#a4332e'; ctx.fillRect(x - 28, y - 26, 56, 5);
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(x, y - 32, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a0e0a';
        ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('VW', x, y - 30);
        ctx.textAlign = 'start';
        ctx.fillStyle = '#d4a653'; ctx.fillRect(x - 28, y - 23, 56, 1);
    }
    function drawDeliveryBalloon(x, y, phase) {
        const bob = Math.sin(phase * 1.8) * 3;
        const by = y + bob;
        ctx.strokeStyle = '#888'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, by); ctx.stroke();
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(x, by - 6, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff4c2';
        ctx.beginPath(); ctx.arc(x - 2, by - 8, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a4832e';
        ctx.beginPath(); ctx.moveTo(x - 1.5, by); ctx.lineTo(x + 1.5, by); ctx.lineTo(x, by + 2); ctx.closePath(); ctx.fill();
    }
    function drawCheckeredFlag(x, y, w, h) {
        const cells = Math.floor(w / 4);
        for (let c = 0; c < cells; c++) for (let r = 0; r < (h / 2); r++) {
            ctx.fillStyle = (r + c) & 1 ? '#0a0604' : '#f5f2e8';
            ctx.fillRect(x + c * 4, y + r * 2, 4, 2);
        }
    }

    function landmarkNow(px, gY, color, collected) {
        // NOW · present moment, AI-driven, looking forward (2026-present)
        const a = collected ? 0.6 : 1;
        const t = state.elapsedMs * 0.001;
        ctx.globalAlpha = a;

        // Horizon sun about to rise
        const sunY = gY - 140, sunX = px + 90;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
        sunGrad.addColorStop(0, 'rgba(255,228,170,0.85)');
        sunGrad.addColorStop(0.4, 'rgba(230,194,133,0.4)');
        sunGrad.addColorStop(1, 'rgba(230,194,133,0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(sunX - 70, sunY - 70, 140, 140);
        ctx.fillStyle = '#ffe4aa';
        ctx.beginPath(); ctx.arc(sunX, sunY, 9, 0, Math.PI * 2); ctx.fill();

        // Growing tree silhouette
        ctx.fillStyle = 'rgba(40,30,20,0.55)';
        ctx.fillRect(px + 60, gY - 26, 2, 26);
        ctx.beginPath();
        ctx.arc(px + 61, gY - 32, 9 + Math.sin(t * 1.3) * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Modern home-office building
        drawModernHouse(px, gY);

        // Dev silhouette at desk
        drawDevAtDesk(px - 18, gY - 64, 36, 22, t);

        // Future-self figure receding right
        drawDistantFigure(px + 95, gY - 4, 0.55, 0.35 + Math.sin(t * 0.6) * 0.05);

        // Floating tokens drift up
        const tokens = ['AI', 'MCP', 'ANTHROPIC', 'CLAUDE', 'CODE'];
        for (let i = 0; i < tokens.length; i++) {
            const phase = (t * 0.18 + i * 0.2) % 1;
            const tx = px - 40 + ((i * 53) % 110) + Math.sin(t * 0.7 + i) * 4;
            const ty = gY - 30 - phase * 90;
            const alpha = (1 - phase) * 0.85 * a;
            drawFloatingToken(tx, ty, tokens[i], phase, alpha);
        }

        // NOW typography
        ctx.globalAlpha = a;
        ctx.fillStyle = '#3a2a1c';
        ctx.font = '600 9px ui-serif, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('NOW', px, gY - 42);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
    }
    function drawFloatingToken(x, y, text, phase, alpha) {
        const w = 4 + text.length * 4.2, h = 9;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#f3e0b8';
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.strokeStyle = 'rgba(120,90,50,0.6)'; ctx.lineWidth = 0.5;
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = '#3a2a1c';
        ctx.font = '600 6px ui-sans-serif, system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 0.5);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = 1;
    }
    function drawModernHouse(x, y) {
        ctx.fillStyle = '#d9b890'; ctx.fillRect(x - 28, y - 70, 56, 70);
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 28, y - 8, 56, 8);
        ctx.fillStyle = '#2a1c12'; ctx.fillRect(x - 30, y - 74, 60, 5);
        const wg = ctx.createLinearGradient(x - 22, y - 68, x - 22, y - 46);
        wg.addColorStop(0, '#fff3c4'); wg.addColorStop(1, '#e6c285');
        ctx.fillStyle = wg;
        ctx.fillRect(x - 22, y - 68, 44, 26);
        ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x - 1, y - 68, 1.2, 26);
        ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x + 14, y - 38, 8, 10);
        ctx.fillStyle = '#ffe9b0'; ctx.fillRect(x + 15, y - 37, 6, 8);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 6, y - 22, 12, 22);
        ctx.fillStyle = '#e6c285'; ctx.fillRect(x + 3, y - 14, 1.5, 2);
        ctx.fillStyle = '#1a2a3a';
        ctx.fillRect(x - 24, y - 78, 22, 4);
        ctx.fillRect(x - 1,  y - 78, 22, 4);
        ctx.strokeStyle = '#3a5a7a'; ctx.lineWidth = 0.4;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 24 + i * 5, y - 78); ctx.lineTo(x - 24 + i * 5, y - 74); ctx.stroke(); }
        ctx.strokeStyle = '#2a1c12'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x + 22, y - 78); ctx.lineTo(x + 22, y - 92); ctx.stroke();
        ctx.fillStyle = '#e6c285'; ctx.beginPath(); ctx.arc(x + 22, y - 93, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    function drawDevAtDesk(wx, wy, w, h, phase) {
        const bob = Math.sin(phase * 2.4) * 0.6;
        ctx.fillStyle = '#2a1c12'; ctx.fillRect(wx + 2, wy + h - 5, w - 4, 1.5);
        ctx.fillStyle = 'rgba(180,220,255,0.85)';
        ctx.fillRect(wx + 4,  wy + 6, 9, 7);
        ctx.fillRect(wx + 15, wy + 5, 11, 8);
        ctx.fillStyle = '#1a1208';
        ctx.fillRect(wx + 12, wy + 12 + bob, 12, 8);
        ctx.beginPath();
        ctx.arc(wx + 18, wy + 9 + bob, 3, 0, Math.PI * 2); ctx.fill();
    }
    function drawDistantFigure(x, y, scale, alpha) {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#2a1c12';
        ctx.fillRect(x - 2 * scale, y - 14 * scale, 4 * scale, 12 * scale);
        ctx.beginPath();
        ctx.arc(x, y - 17 * scale, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
        const hg = ctx.createRadialGradient(x, y - 10 * scale, 1, x, y - 10 * scale, 14 * scale);
        hg.addColorStop(0, 'rgba(255,228,170,0.18)');
        hg.addColorStop(1, 'rgba(255,228,170,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(x - 14 * scale, y - 24 * scale, 28 * scale, 28 * scale);
        ctx.globalAlpha = prevAlpha;
    }
    const LANDMARK_FN = {
        itics:    landmarkITICS,
        cmr:      landmarkCMR,
        college:  landmarkDSCE,
        fever104: landmarkFever104,
        sakha:    landmarkSakha,
        scripbox: landmarkScripbox,
        vwgt:     landmarkVWGT,
        now:      landmarkNow,
    };

    /** draw all visible chapter landmarks · per-chapter custom architecture */
    function drawChapters(W, horizonY, groundY, cameraX) {
        ctx.textBaseline = 'bottom';
        for (let i = 0; i < CHAPTERS.length; i++) {
            const ch = CHAPTERS[i];
            const px = ch.x - cameraX;
            if (px < -200 || px > W + 200) continue;
            const collected = state.collected.has(ch.id);

            // pulsing aura under uncollected chapters
            if (!collected) {
                const pulse = 0.5 + Math.sin(state.elapsedMs * 0.004 + i) * 0.25;
                const ag = ctx.createRadialGradient(px, groundY, 6, px, groundY, 80);
                ag.addColorStop(0, `rgba(${hexR(ch.color)},${hexG(ch.color)},${hexB(ch.color)},${pulse * 0.5})`);
                ag.addColorStop(1, `rgba(${hexR(ch.color)},${hexG(ch.color)},${hexB(ch.color)},0)`);
                ctx.fillStyle = ag;
                ctx.fillRect(px - 80, groundY - 40, 160, 60);
            }

            // chapter-specific architecture · drawn by the per-id LANDMARK_FN
            (LANDMARK_FN[ch.id] || landmarkITICS)(px, groundY, ch.color, collected);

            // chapter label below the landmark · engraved serif
            ctx.font = 'bold 11px "Cinzel", serif';
            ctx.fillStyle = collected ? 'rgba(233,216,176,0.5)' : 'rgba(233,216,176,0.95)';
            ctx.textAlign = 'center';
            ctx.fillText(ch.label, px, groundY + 28);
            // period stamp · italic IM Fell English below
            ctx.font = 'italic 10px "IM Fell English", serif';
            ctx.fillStyle = collected ? 'rgba(201,181,140,0.4)' : 'rgba(201,181,140,0.75)';
            ctx.fillText(ch.period, px, groundY + 44);
        }
        ctx.textAlign = 'start';
    }

    // ── procedural player · stick-figure character + per-vehicle drawers ──
    //   Each drawer takes (cx, groundY) where cx/groundY are the feet-anchor.
    //   Walk/Run animate via state.walkPhase; vehicles animate via state.wheelPhase.
    //   Colors stay in the sepia/brass palette to match the RDR world tint.

    const SKIN  = '#c8a482';
    const COAT  = '#5a3a22';       // dark-brown coat
    const SHIRT = '#a86434';       // burnt-sienna shirt
    const PANT  = '#2a1810';       // near-black trousers
    const HAT   = '#1c0e06';       // cowboy-hat black
    const METAL = '#8a6d4a';       // brass-tinged metal
    const TIRE  = '#0e0805';       // tire black

    /** draw a stick figure standing/walking · feet anchored at (cx, footY).
     *  phase: walking cycle radians. amp: stride amplitude in radians.
     *  lean: forward body lean radians. bob: vertical body bob (centered on 0).
     *
     *  Naturalness rules applied:
     *   - foot LIFTS only on its forward-swing half (Math.max(0, sin(phase))) ·
     *     stance leg stays planted instead of floating pendulum-style.
     *   - bob oscillates around 0 (negative dips at leg-crossings, positive at
     *     mid-stance) · upstream callers pass -cos(2*phase)*1.5.
     *   - leg has a KNEE midpoint that bends forward on the swing leg,
     *     killing the canonical "stiff stick figure" silhouette.
     *   - arms swing CONTRALATERALLY without the +lean bias that previously
     *     pushed both arms permanently forward. */
    function drawWalker(cx, footY, phase, amp, lean, bob) {
        ctx.save();
        const torsoH = 22;
        const legH   = 22;
        const armL   = 16;
        const hipX   = cx;
        const hipY   = footY - legH + bob;
        // forward lean: pivot the upper body around the hip
        const cosL = Math.cos(lean), sinL = Math.sin(lean);
        const torsoTop = { x: hipX + sinL * torsoH, y: hipY - cosL * torsoH };
        const headR    = 7;
        const headY    = torsoTop.y - headR - 1;
        const headX    = torsoTop.x + sinL * (headR + 1);

        // legs · L/R 180° out of phase
        const legAngL = Math.sin(phase) * amp;
        const legAngR = Math.sin(phase + Math.PI) * amp;
        // foot lift is asymmetric: only happens on forward swing (positive sin)
        const liftL = Math.max(0, Math.sin(phase))            * 5;
        const liftR = Math.max(0, Math.sin(phase + Math.PI))  * 5;
        const footLX = hipX + Math.sin(legAngL) * legH;
        const footLY = hipY + Math.cos(legAngL) * legH - liftL;
        const footRX = hipX + Math.sin(legAngR) * legH;
        const footRY = hipY + Math.cos(legAngR) * legH - liftR;
        // knee = midpoint with forward bend during swing only
        const kneeLX = hipX + (footLX - hipX) * 0.5 + Math.max(0, Math.sin(phase))           * 4;
        const kneeLY = hipY + (footLY - hipY) * 0.5;
        const kneeRX = hipX + (footRX - hipX) * 0.5 + Math.max(0, Math.sin(phase + Math.PI)) * 4;
        const kneeRY = hipY + (footRY - hipY) * 0.5;

        // arms swing opposite to legs · NO lean bias (shoulder already pivots
        // with torso lean via sinL above)
        const armAngL = Math.sin(phase + Math.PI) * amp * 0.7;
        const armAngR = Math.sin(phase)            * amp * 0.7;
        const shoulder = { x: hipX + sinL * (torsoH - 4), y: hipY - cosL * (torsoH - 4) };
        const handLX = shoulder.x + Math.sin(armAngL) * armL;
        const handLY = shoulder.y + Math.cos(armAngL) * armL;
        const handRX = shoulder.x + Math.sin(armAngR) * armL;
        const handRY = shoulder.y + Math.cos(armAngR) * armL;

        ctx.lineCap = 'round';
        // back leg first (hip → knee → foot) so front leg overlaps
        ctx.strokeStyle = PANT;  ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeRX, kneeRY); ctx.lineTo(footRX, footRY); ctx.stroke();
        // back arm
        ctx.strokeStyle = COAT;  ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(handRX, handRY); ctx.stroke();
        // torso (shirt under coat)
        ctx.strokeStyle = SHIRT; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(torsoTop.x, torsoTop.y); ctx.stroke();
        ctx.strokeStyle = COAT;  ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(hipX, hipY - 2); ctx.lineTo(torsoTop.x, torsoTop.y); ctx.stroke();
        // front leg (with knee bend)
        ctx.strokeStyle = PANT;  ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeLX, kneeLY); ctx.lineTo(footLX, footLY); ctx.stroke();
        // front arm
        ctx.strokeStyle = COAT;  ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(handLX, handLY); ctx.stroke();
        // head
        ctx.fillStyle = SKIN;
        ctx.beginPath(); ctx.arc(headX, headY, headR, 0, Math.PI * 2); ctx.fill();
        // cowboy hat (brim + crown)
        ctx.fillStyle = HAT;
        ctx.beginPath();
        ctx.ellipse(headX + sinL * 2, headY - headR + 1, headR + 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(headX - 4 + sinL * 3, headY - headR - 5, 8, 4);
        ctx.restore();
    }

    /** spinning wheel · centered at (x, y), radius r, rotation theta.
     *  Drawn as: rim + 4 spokes + hub. The spokes are the motion cue. */
    function drawWheel(x, y, r, theta) {
        // tire
        ctx.fillStyle = TIRE;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        // rim inner ring
        ctx.strokeStyle = METAL; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r - 2.5, 0, Math.PI * 2); ctx.stroke();
        // spokes — 4 lines through center, rotated by theta
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(theta);
        ctx.strokeStyle = METAL; ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(-r + 3, 0); ctx.lineTo(r - 3, 0);
            ctx.stroke();
        }
        ctx.restore();
        // hub
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    }

    /** rider sitting on a saddle · simplified upper body, legs angled to pedals/footpegs */
    function drawRider(cx, seatY, pedalPhase, footSpread, withHelmet) {
        const torsoH = 18;
        const torsoTop = { x: cx, y: seatY - torsoH };
        const headR = 6.5;
        ctx.lineCap = 'round';
        // torso
        ctx.strokeStyle = COAT; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(cx, seatY); ctx.lineTo(torsoTop.x, torsoTop.y); ctx.stroke();
        // arms forward to handlebar
        ctx.strokeStyle = COAT; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(torsoTop.x, torsoTop.y + 2); ctx.lineTo(cx + 16, seatY - 4); ctx.stroke();
        // legs · alternate phase (pedaling)
        const lLY = seatY + 4 + Math.sin(pedalPhase) * footSpread;
        const lLX = cx - 6 + Math.cos(pedalPhase) * 2;
        const rLY = seatY + 4 + Math.sin(pedalPhase + Math.PI) * footSpread;
        const rLX = cx - 6 + Math.cos(pedalPhase + Math.PI) * 2;
        ctx.strokeStyle = PANT; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, seatY); ctx.lineTo(lLX, lLY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, seatY); ctx.lineTo(rLX, rLY); ctx.stroke();
        // head
        ctx.fillStyle = SKIN;
        ctx.beginPath(); ctx.arc(torsoTop.x, torsoTop.y - headR, headR, 0, Math.PI * 2); ctx.fill();
        if (withHelmet) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(torsoTop.x, torsoTop.y - headR - 1, headR + 1.5, Math.PI, 2 * Math.PI);
            ctx.fill();
            // visor
            ctx.fillStyle = 'rgba(120,180,220,0.7)';
            ctx.fillRect(torsoTop.x - headR, torsoTop.y - headR - 2, headR * 2, 2);
        } else {
            // bandana / cowboy hat
            ctx.fillStyle = HAT;
            ctx.beginPath();
            ctx.ellipse(torsoTop.x, torsoTop.y - headR * 2, headR + 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /** bicycle · two wheels + frame triangle + handlebars · rider sits on saddle */
    function drawCycle(cx, footY) {
        const wheelR = 12;
        const wheelY = footY - wheelR;
        const wLx = cx - 14, wRx = cx + 14;
        // frame
        ctx.strokeStyle = METAL; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(wLx + 2, wheelY);        // rear hub
        ctx.lineTo(cx - 2, wheelY - 12);    // seat tube top
        ctx.lineTo(wRx - 4, wheelY - 2);    // down tube to fork
        ctx.lineTo(cx + 2, wheelY - 14);    // top tube up to handlebar
        ctx.moveTo(wRx - 4, wheelY - 2);    // fork to front wheel
        ctx.lineTo(wRx, wheelY);
        ctx.stroke();
        // wheels (spinning)
        drawWheel(wLx, wheelY, wheelR, state.wheelPhase);
        drawWheel(wRx, wheelY, wheelR, state.wheelPhase);
        // rider on top
        drawRider(cx - 2, wheelY - 13, state.wheelPhase * 1.4, 4, false);
    }

    /** motorbike · larger wheels + engine box + exhaust + leaning rider w/helmet */
    function drawBike(cx, footY) {
        const wheelR = 14;
        const wheelY = footY - wheelR;
        const wLx = cx - 18, wRx = cx + 18;
        // engine block
        ctx.fillStyle = METAL;
        ctx.fillRect(cx - 12, wheelY - 10, 24, 12);
        ctx.fillStyle = COAT;
        ctx.fillRect(cx - 10, wheelY - 8, 20, 8);
        // exhaust pipe
        ctx.strokeStyle = METAL; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx + 8, wheelY - 4); ctx.lineTo(wRx + 4, wheelY - 1); ctx.stroke();
        // seat
        ctx.fillStyle = HAT;
        ctx.fillRect(cx - 8, wheelY - 14, 16, 4);
        // handlebar
        ctx.strokeStyle = METAL; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(cx + 6, wheelY - 14); ctx.lineTo(cx + 14, wheelY - 22); ctx.stroke();
        // wheels (spinning)
        drawWheel(wLx, wheelY, wheelR, state.wheelPhase);
        drawWheel(wRx, wheelY, wheelR, state.wheelPhase);
        // rider w/ helmet, slight forward lean
        drawRider(cx, wheelY - 14, state.wheelPhase * 0.6, 2, true);
    }

    /** car · body silhouette + 2 wheels + window with driver hint · used for alto & vw.
     *  bodyColor distinguishes the two; vw also gets a spoiler+stripe. */
    /** Car drawer · shape-aware. 'hatch' (Maruti Alto) = short, tall greenhouse,
     *  near-vertical rear, no separate trunk. 'sedan' (VW Virtus GT) = longer
     *  body, distinct 3-box silhouette with raked rear glass + separate trunk
     *  lid, lower roof. */
    function drawCar(cx, footY, opts) {
        const { bodyColor, accent, isGT, shape } = opts;

        if (shape === 'hatch') {
            // ── HATCHBACK (Alto): short, tall, blocky rear ─────────
            const wheelR  = 10;
            const wheelY  = footY - wheelR;
            const wLx     = cx - 16, wRx = cx + 16;   // shorter wheelbase
            const carTop  = wheelY - 22;
            const roofTop = carTop - 14;              // tall roof
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.moveTo(cx - 24, wheelY);              // rear bottom
            ctx.lineTo(cx - 24, carTop + 3);          // rear face (near-vertical)
            ctx.lineTo(cx - 22, roofTop + 2);         // up rear glass (steep)
            ctx.quadraticCurveTo(cx - 20, roofTop,  cx - 14, roofTop);
            ctx.lineTo(cx + 10, roofTop);
            ctx.quadraticCurveTo(cx + 16, roofTop, cx + 20, carTop + 2);  // windshield rake
            ctx.lineTo(cx + 24, carTop + 4);          // hood front
            ctx.quadraticCurveTo(cx + 28, carTop + 6, cx + 28, wheelY);
            ctx.closePath();
            ctx.fill();
            // windows · 2 distinct panes (rear hatch + front)
            ctx.fillStyle = 'rgba(140,180,210,0.55)';
            ctx.beginPath();
            ctx.moveTo(cx - 19, carTop);  ctx.lineTo(cx - 17, roofTop + 3);
            ctx.lineTo(cx - 3,  roofTop + 3); ctx.lineTo(cx - 3, carTop);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 1, carTop); ctx.lineTo(cx + 1, roofTop + 3);
            ctx.lineTo(cx + 13, roofTop + 3); ctx.lineTo(cx + 18, carTop);
            ctx.closePath(); ctx.fill();
            // driver head
            ctx.fillStyle = HAT;
            ctx.beginPath(); ctx.arc(cx + 6, roofTop + 7, 3.5, 0, Math.PI * 2); ctx.fill();
            // bumper stripe
            ctx.strokeStyle = accent; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(cx - 22, wheelY - 3); ctx.lineTo(cx + 26, wheelY - 3); ctx.stroke();
            // wheels
            drawWheel(wLx, wheelY, wheelR, state.wheelPhase);
            drawWheel(wRx, wheelY, wheelR, state.wheelPhase);
            return;
        }

        // ── SEDAN (VW Virtus GT): long, low, 3-box w/ raked C-pillar ──
        const wheelR  = 11;
        const wheelY  = footY - wheelR;
        const wLx     = cx - 26, wRx = cx + 26;   // longer wheelbase
        const carTop  = wheelY - 19;
        const roofTop = carTop - 11;              // lower roof
        const rearEnd = cx - 40;
        const frontEnd= cx + 42;
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(rearEnd, wheelY);
        ctx.lineTo(rearEnd, carTop + 5);                  // rear bumper face
        ctx.quadraticCurveTo(rearEnd + 3, carTop, rearEnd + 9, carTop - 1);   // trunk lid lift
        ctx.lineTo(cx - 14, carTop - 1);                  // trunk top deck
        ctx.lineTo(cx - 6,  roofTop);                      // rear glass (raked)
        ctx.lineTo(cx + 14, roofTop);                      // roof
        ctx.lineTo(cx + 24, carTop);                       // windshield rake
        ctx.lineTo(cx + 34, carTop + 1);                   // hood
        ctx.quadraticCurveTo(frontEnd, carTop + 4, frontEnd, wheelY);
        ctx.closePath();
        ctx.fill();
        // windows · 2 panes split at B-pillar
        ctx.fillStyle = 'rgba(140,180,210,0.55)';
        ctx.beginPath();
        ctx.moveTo(cx - 12, carTop - 1); ctx.lineTo(cx - 5, roofTop + 1);
        ctx.lineTo(cx + 4, roofTop + 1); ctx.lineTo(cx + 4, carTop - 1);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 8, carTop - 1); ctx.lineTo(cx + 8, roofTop + 1);
        ctx.lineTo(cx + 14, roofTop + 1); ctx.lineTo(cx + 22, carTop - 1);
        ctx.closePath(); ctx.fill();
        // driver head
        ctx.fillStyle = HAT;
        ctx.beginPath(); ctx.arc(cx + 12, roofTop + 6, 4, 0, Math.PI * 2); ctx.fill();
        // bumper accent
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(rearEnd + 2, wheelY - 4); ctx.lineTo(frontEnd - 2, wheelY - 4); ctx.stroke();
        // GT bits: rear spoiler + go-faster stripe + grille bar
        if (isGT) {
            ctx.fillStyle = '#1a0d08';
            ctx.fillRect(rearEnd, carTop, 4, 7);                // spoiler stalk
            ctx.fillRect(rearEnd - 2, carTop - 2, 7, 3);        // spoiler wing
            ctx.fillStyle = '#f0d590';
            ctx.fillRect(rearEnd + 4, wheelY - 10, frontEnd - rearEnd - 10, 1.5); // stripe
            ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(frontEnd - 4, carTop + 6); ctx.lineTo(frontEnd, carTop + 8); ctx.stroke();
        }
        // wheels
        drawWheel(wLx, wheelY, wheelR, state.wheelPhase);
        drawWheel(wRx, wheelY, wheelR, state.wheelPhase);
        // headlight glow (dusk only)
        const progress = Math.min(1, state.playerX / 6500);
        if (progress > 0.55) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const hg = ctx.createRadialGradient(frontEnd, wheelY - 6, 0, frontEnd, wheelY - 6, 44);
            hg.addColorStop(0, 'rgba(255,220,150,0.8)');
            hg.addColorStop(1, 'rgba(255,220,150,0)');
            ctx.fillStyle = hg;
            ctx.fillRect(cx, wheelY - 44, 100, 60);
            ctx.restore();
        }
    }

    /** the player · procedural drawing per vehicle. Walking/running uses
     *  drawWalker; wheeled vehicles use drawCycle/drawBike/drawCar with
     *  spinning wheels driven by state.wheelPhase. */
    function drawPlayer(W, groundY) {
        const cx = W * 0.32;
        // small body bob for organic feel · bigger when walking, tiny when riding
        const moving = state.keys.right || state.touchHold || state.keys.left;
        // bob now oscillates around 0: -cos(2*phase)*1.5 dips negative at
        // leg-crossings (mid-stride) and goes positive at full-extension
        // mid-stance, which matches real walking gait. Vehicles use a tiny
        // engine-idle bob from bobT instead.
        const bob = (state.vehicle === 'walk' || state.vehicle === 'run')
            ? (moving ? -Math.cos(state.walkPhase * 2) * 1.5 : 0)
            : Math.sin(state.bobT * 0.003) * 0.8;

        // shadow under feet · scales with vertical lift to sell motion
        const shadowR = state.vehicle === 'walk' || state.vehicle === 'run' ? 18 :
                        state.vehicle === 'cycle' ? 22 :
                        state.vehicle === 'bike' ? 26 : 36;
        const shadowScale = 1 - bob / 24;
        ctx.fillStyle = `rgba(0,0,0,${0.38 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(cx, groundY + 4, shadowR * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // dispatch to the per-vehicle drawer · walk/run keep the procedural
        // stick figure (reads great at small scale), but wheeled vehicles
        // render as LARGE colorful emoji glyphs (Apple Color Emoji / Noto)
        // so the motorbike, hatchback, sedan, race-car are instantly
        // recognizable. Procedural bike at ~30px was too abstract to read.
        switch (state.vehicle) {
            case 'walk':
                drawWalker(cx, groundY, state.walkPhase, moving ? 0.6 : 0.0, 0.06, bob);
                break;
            case 'run':
                drawWalker(cx, groundY, state.walkPhase, moving ? 0.7 : 0.0, 0.22, bob);
                break;
            default:
                drawVehicleEmoji(cx, groundY, VEHICLES[state.vehicle].icon, bob);
                break;
        }
    }

    /** Wheeled-vehicle drawer · renders the large emoji glyph from
     *  VEHICLES[state.vehicle].icon at 64px. Apple/Noto Color Emoji draws
     *  🚴 🏍️ 🚗 🏎️ facing LEFT by default, but the player moves rightward
     *  in our world. We mirror via ctx.scale(-1, 1) so the vehicle faces
     *  forward (right). When the player is actively backing up via
     *  ArrowLeft, we DON'T flip — they face left naturally.
     *  A tiny engine-idle horizontal jitter sells motion. */
    function drawVehicleEmoji(cx, footY, glyph, bob) {
        ctx.save();
        const movingRight = state.keys.right || state.touchHold;
        const movingLeft  = state.keys.left && !movingRight;
        const facingRight = !movingLeft;   // default forward unless explicitly back
        const jitter = (movingRight || movingLeft) ? (Math.sin(state.bobT * 0.05) * 0.6) : 0;
        ctx.translate(cx + jitter, footY + 8 + bob);
        if (facingRight) ctx.scale(-1, 1);
        ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(glyph, 0, 0);
        ctx.restore();
    }

    // hex → rgb component helpers · cheap, avoids string parsing per call
    function hexR(h) { return parseInt(h.slice(1, 3), 16); }
    function hexG(h) { return parseInt(h.slice(3, 5), 16); }
    function hexB(h) { return parseInt(h.slice(5, 7), 16); }

    // ── main loop ────────────────────────────────────────────────────
    let lastT = performance.now();
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(48, now - lastT);
        lastT = now;

        const W = window.innerWidth;
        const H = window.innerHeight;
        const horizonY = H * HORIZON_PCT;
        const groundY  = H * GROUND_PCT;

        if (state.running && !state.ended) {
            state.elapsedMs += dt;
            state.bobT += dt;

            // INPUT-DRIVEN forward/back motion · NO auto-walk.
            // Walking/movement only fires while a key or touch is held.
            // dir: +1 forward, -0.6 back, 0 stationary
            const movingForward = state.keys.right || state.touchHold;
            const movingBack    = state.keys.left;
            let dir = 0;
            if (movingForward) dir = +1;
            else if (movingBack) dir = -0.6;        // back is slower (half-step)

            const v = VEHICLES[state.vehicle];
            state.playerX += v.speed * (dt / 1000) * dir;
            // CLAMP to non-negative · walking left from spawn previously let
            // playerX go negative (HUD showed "-12 m", camera entered
            // pre-world space). Now the start of the journey is a hard wall.
            if (state.playerX < 0) state.playerX = 0;

            // walking leg-phase only advances when actually walking/running
            if ((state.vehicle === 'walk' || state.vehicle === 'run') && dir !== 0) {
                const cycleRate = state.vehicle === 'run' ? 0.014 : 0.008;
                state.prevWalkPhase = state.walkPhase;
                state.walkPhase += dt * cycleRate * Math.abs(dir);
                // step detection: phase crossed a multiple of π between frames
                const prevK = Math.floor(state.prevWalkPhase / Math.PI);
                const curK  = Math.floor(state.walkPhase     / Math.PI);
                if (curK > prevK) sfxStep();
            }
            // wheel-phase ALWAYS advances · vehicles never look frozen.
            // Base idle drift = 0.0005 (sloth-slow), motion adds proportional spin.
            const moveBoost = Math.abs(dir) * (v.speed / 60);
            state.wheelPhase += dt * (0.0005 + 0.012 * moveBoost);

            // vehicle progression · LATCHED to highest rank ever reached.
            // Previously the if-chain re-evaluated every frame, so walking
            // back below a threshold downgraded the vehicle AND re-fired
            // the letterbox/glitch effects · letterbox spam on back-and-
            // forth motion. Now: vehicle only upgrades; never downgrades.
            const RANK = { walk: 0, run: 1, cycle: 2, bike: 3, alto: 4, vw: 5 };
            let want;
            if      (state.collected.has('vwgt'))             want = 'vw';
            else if (state.playerX >= VEH_THRESH.alto)         want = 'alto';
            else if (state.playerX >= VEH_THRESH.bike)         want = 'bike';
            else if (state.playerX >= VEH_THRESH.cycle)        want = 'cycle';
            else if (state.playerX >= VEH_THRESH.run)          want = 'run';
            else                                                want = 'walk';
            if (RANK[want] > RANK[state.vehicle]) {
                state.vehicle = want;
                updateVehicleCard();
                triggerLetterbox(800);
                sfxUpgrade();
                shake(6, 260);
                // fire the per-vehicle achievement (run/cycle/bike each have one)
                const v = VEHICLES[want];
                if (v.achId && !state.achievements.has(v.achId)) {
                    state.achievements.add(v.achId);
                    showAchievement({ icon: v.icon, achTitle: v.achTitle, achSub: v.achSub }, { kind: 'event' });
                }
            }

            // chapter collection · player passes within range of chapter x
            for (let i = 0; i < CHAPTERS.length; i++) {
                const ch = CHAPTERS[i];
                if (state.collected.has(ch.id)) continue;
                if (state.playerX >= ch.x - 80 && state.playerX <= ch.x + 80) {
                    state.collected.add(ch.id);
                    updateProgress(i);
                    showAchievement(ch, { kind: 'event' });
                    updateMission(i);
                    setTimeout(() => updateMission(pickNextObjective()), 1400);
                    triggerLetterbox(1100);
                    sfxCollect();
                    shake(10, 380);
                    // 28 particles radiating from the landmark · color-matched
                    burstParticles(W * 0.32 + 20, groundY - 36, ch.color, 28);
                }
            }

            // HUD score
            if ($scoreDist) $scoreDist.textContent = Math.round(state.playerX) + ' m';
            if ($scoreChap) $scoreChap.textContent = state.collected.size + ' / ' + CHAPTERS.length;
            if ($scoreTime) {
                const s = Math.floor(state.elapsedMs / 1000);
                $scoreTime.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            }

            // end · past the last chapter
            if (state.collected.size >= CHAPTERS.length && state.playerX > CHAPTERS[CHAPTERS.length - 1].x + 150) {
                state.ended = true;
                if ($end) $end.hidden = false;
            }
        }

        // camera · player anchored at 32% from left
        const cameraX = state.playerX - W * 0.32;

        // life-progress 0..1 · drives the time-of-day sky gradient.
        // World ends at the last chapter + 150. Clamp so we don't NaN.
        const worldEnd = CHAPTERS[CHAPTERS.length - 1].x + 150;
        const progress = Math.max(0, Math.min(1, state.playerX / worldEnd));

        // particles update (gravity, drag, fade)
        updateParticles(dt);

        // screen-shake decay
        if (state.shake.t > 0) {
            state.shake.t -= dt;
            if (state.shake.t < 0) { state.shake.t = 0; state.shake.amp = 0; }
        }

        // ── RENDER ──
        ctx.fillStyle = '#1f1610';
        ctx.fillRect(0, 0, W, H);

        // apply shake translate for the duration of world rendering only
        // (HUD overlays are DOM and unaffected, which is correct — Pogo
        // shakes the playfield, not the chrome).
        ctx.save();
        if (state.shake.amp > 0) {
            const k = state.shake.amp * (state.shake.t / 380);  // linear decay
            ctx.translate((Math.random() - 0.5) * k * 2, (Math.random() - 0.5) * k * 2);
        }
        drawSky(W, H, horizonY, progress);
        drawDistHills(W, horizonY, cameraX);
        drawGround(W, H, horizonY, groundY, cameraX);
        drawMidProps(W, horizonY, groundY, cameraX);
        drawChapters(W, horizonY, groundY, cameraX);
        drawParticles();
        drawPlayer(W, groundY);
        ctx.restore();
    }
    requestAnimationFrame(frame);

    // debug
    window.__journey = { state, CHAPTERS };
})();
