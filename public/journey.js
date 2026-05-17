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
        bike:  { speed: 200, icon: '🏍',  label: 'MOTORBIKE',   sub: 'commute to 104 FM',             achId: 'on-bike',   achTitle: 'TWO WHEELS, ENGINE', achSub: 'commute · radio days' },
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
        bobT:         0,
        // INPUT · key-driven walking · player only moves when an input is
        // held. No auto-walk.
        keys: { right: false, left: false },
        touchHold: false,
    };

    // auto-start after splash (3.4s matches CSS splashFadeOut)
    setTimeout(() => { state.running = true; }, 3400);

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

    function showAchievement(ch) {
        if (!$achStack) return;
        // Only ONE achievement card visible at a time · clear any existing
        // before adding the new one (was previously accumulating on rapid taps)
        while ($achStack.firstChild) $achStack.removeChild($achStack.firstChild);
        const el = document.createElement('div');
        el.className = 'achievement';
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
        if (ch) showAchievement(ch);
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
        ctx.fillRect(sunX - sunSize, sunY - sunSize, sunSize * 2, sunSize * 2);
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
        // a few horizontal ruts running across
        ctx.strokeStyle = 'rgba(20,12,6,0.35)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const y = groundY + 12 + i * 14;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }

    // ── per-chapter custom landmark drawers · each chapter gets its own
    //    distinct silhouette so the world reads as a sequence of PLACES,
    //    not 8 copies of the same archway with different emoji on top.
    function landmarkITICS(px, gY, color, collected) {
        // small primary-school building · classroom with a pitched roof
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px - 40, gY - 56, 80, 56);                       // walls
        ctx.fillStyle = color;
        // pitched roof
        ctx.beginPath();
        ctx.moveTo(px - 46, gY - 56); ctx.lineTo(px, gY - 86); ctx.lineTo(px + 46, gY - 56); ctx.closePath();
        ctx.fill();
        // door + windows
        ctx.fillStyle = '#1a0e08';
        ctx.fillRect(px - 8, gY - 30, 16, 30);                        // door
        ctx.fillRect(px - 30, gY - 44, 12, 12);
        ctx.fillRect(px + 18, gY - 44, 12, 12);
        // little flag on top
        ctx.fillStyle = color;
        ctx.fillRect(px - 1, gY - 100, 2, 14);
        ctx.fillStyle = '#e6c285';
        ctx.beginPath(); ctx.moveTo(px + 1, gY - 100); ctx.lineTo(px + 12, gY - 95); ctx.lineTo(px + 1, gY - 90); ctx.fill();
        ctx.globalAlpha = 1;
    }
    function landmarkCMR(px, gY, color, collected) {
        // CMR · taller multi-storey school
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#2a2018';
        ctx.fillRect(px - 36, gY - 100, 72, 100);                     // walls
        ctx.fillStyle = color;
        ctx.fillRect(px - 38, gY - 104, 76, 8);                       // crown band
        // 3 rows of windows
        ctx.fillStyle = '#0a0604';
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                ctx.fillRect(px - 30 + c * 16, gY - 90 + r * 22, 8, 12);
            }
        }
        ctx.fillStyle = color;
        ctx.fillRect(px - 8, gY - 18, 16, 18);                        // entrance frame
        ctx.fillStyle = '#0a0604';
        ctx.fillRect(px - 6, gY - 16, 12, 16);
        ctx.globalAlpha = 1;
    }
    function landmarkDSCE(px, gY, color, collected) {
        // DSCE · engineering campus, central tower with side wings
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#1f1810';
        ctx.fillRect(px - 56, gY - 64, 112, 64);                      // wings
        ctx.fillRect(px - 18, gY - 110, 36, 110);                     // central tower
        ctx.fillStyle = color;
        ctx.fillRect(px - 20, gY - 115, 40, 8);                       // tower crown
        // dome on the tower
        ctx.beginPath(); ctx.arc(px, gY - 115, 14, Math.PI, 2 * Math.PI); ctx.fill();
        // window grid
        ctx.fillStyle = '#080604';
        for (let i = 0; i < 5; i++) ctx.fillRect(px - 14 + i * 8, gY - 80, 5, 8);
        for (let i = 0; i < 5; i++) ctx.fillRect(px - 14 + i * 8, gY - 60, 5, 8);
        for (let i = 0; i < 6; i++) ctx.fillRect(px - 50 + i * 16, gY - 50, 8, 8);
        ctx.globalAlpha = 1;
    }
    function landmarkFever104(px, gY, color, collected) {
        // FM tower · tall lattice mast with ON-AIR sign at base
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        // base shed with ON AIR sign
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(px - 30, gY - 36, 60, 36);
        ctx.fillStyle = color;
        ctx.fillRect(px - 26, gY - 30, 52, 14);                       // ON AIR plate
        ctx.fillStyle = '#0a0604';
        ctx.font = 'bold 10px "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.fillText('ON AIR', px, gY - 19);
        // lattice mast going up · 4 sections
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        const baseY = gY - 36;
        const tipY = gY - 150;
        const baseHW = 14, tipHW = 3;
        ctx.beginPath();
        ctx.moveTo(px - baseHW, baseY); ctx.lineTo(px - tipHW, tipY);
        ctx.moveTo(px + baseHW, baseY); ctx.lineTo(px + tipHW, tipY);
        ctx.stroke();
        // cross-bracing
        for (let i = 0; i < 6; i++) {
            const t = i / 6;
            const y = baseY + (tipY - baseY) * t;
            const hw = baseHW + (tipHW - baseHW) * t;
            ctx.beginPath(); ctx.moveTo(px - hw, y); ctx.lineTo(px + hw, y); ctx.stroke();
        }
        // pulsing red beacon at the tip
        const beacon = 0.5 + Math.sin(state.elapsedMs * 0.008) * 0.5;
        ctx.fillStyle = `rgba(255, 60, 50, ${beacon})`;
        ctx.beginPath(); ctx.arc(px, tipY - 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
    function landmarkSakha(px, gY, color, collected) {
        // SAKHA · mid-rise office tower with window grid
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#1a1610';
        ctx.fillRect(px - 32, gY - 120, 64, 120);
        ctx.fillStyle = color;
        ctx.fillRect(px - 34, gY - 124, 68, 6);                       // crown
        // 6×4 window grid · some windows lit (gold), most dark
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 4; c++) {
                const lit = ((r * 7 + c * 3) % 5) < 2;
                ctx.fillStyle = lit ? color : '#08060a';
                ctx.fillRect(px - 26 + c * 14, gY - 108 + r * 16, 8, 10);
            }
        }
        ctx.globalAlpha = 1;
    }
    function landmarkScripbox(px, gY, color, collected) {
        // Scripbox · modern glass tower with rooftop antenna + accent
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        // tapered glass tower
        ctx.fillStyle = '#0e1218';
        ctx.beginPath();
        ctx.moveTo(px - 30, gY); ctx.lineTo(px - 24, gY - 140);
        ctx.lineTo(px + 24, gY - 140); ctx.lineTo(px + 30, gY); ctx.closePath();
        ctx.fill();
        // glass reflections
        ctx.fillStyle = color;
        ctx.globalAlpha = a * 0.4;
        for (let i = 0; i < 7; i++) {
            const y = gY - 24 - i * 18;
            ctx.fillRect(px - 22 + i, y - 4, 2, 2);
            ctx.fillRect(px + 18 - i, y - 4, 2, 2);
        }
        ctx.globalAlpha = a;
        // rooftop antenna
        ctx.fillStyle = color;
        ctx.fillRect(px - 1, gY - 156, 2, 16);
        // accent strip
        ctx.fillRect(px - 24, gY - 140, 48, 3);
        ctx.globalAlpha = 1;
    }
    function landmarkVWGT(px, gY, color, collected) {
        // VW GT showroom · glass-front building with the car silhouette inside
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        // showroom
        ctx.fillStyle = '#1a0e0a';
        ctx.fillRect(px - 56, gY - 70, 112, 70);
        ctx.fillStyle = color;
        ctx.fillRect(px - 58, gY - 74, 116, 8);                       // banner above
        // glass front
        ctx.fillStyle = '#040608';
        ctx.fillRect(px - 50, gY - 60, 100, 50);
        // car silhouette inside · a stylized hatchback profile
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(px - 32, gY - 14);
        ctx.lineTo(px - 22, gY - 32);
        ctx.lineTo(px - 6, gY - 38);
        ctx.lineTo(px + 8, gY - 38);
        ctx.lineTo(px + 22, gY - 32);
        ctx.lineTo(px + 32, gY - 14);
        ctx.closePath();
        ctx.fill();
        // wheels
        ctx.fillStyle = '#0a0604';
        ctx.beginPath(); ctx.arc(px - 18, gY - 12, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 18, gY - 12, 5, 0, Math.PI * 2); ctx.fill();
        // showroom sign · "GT"
        ctx.fillStyle = '#0a0604';
        ctx.font = 'bold 12px "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.fillText('VW · GT', px, gY - 66);
        ctx.globalAlpha = 1;
    }
    function landmarkNow(px, gY, color, collected) {
        // NOW · monument obelisk + checkered flag at the top
        const a = collected ? 0.55 : 0.92;
        ctx.globalAlpha = a;
        // pedestal
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(px - 20, gY - 14, 40, 14);
        // obelisk
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(px - 12, gY - 14); ctx.lineTo(px - 8, gY - 96);
        ctx.lineTo(px + 8, gY - 96); ctx.lineTo(px + 12, gY - 14);
        ctx.closePath();
        ctx.fill();
        // pyramid cap
        ctx.fillStyle = '#e6c285';
        ctx.beginPath();
        ctx.moveTo(px - 8, gY - 96); ctx.lineTo(px, gY - 112); ctx.lineTo(px + 8, gY - 96); ctx.closePath();
        ctx.fill();
        // checkered flag
        ctx.fillStyle = '#0a0604';
        ctx.fillRect(px, gY - 130, 1.5, 22);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
            ctx.fillStyle = (r + c) & 1 ? '#0a0604' : '#e6c285';
            ctx.fillRect(px + 2 + c * 4, gY - 130 + r * 4, 4, 4);
        }
        ctx.globalAlpha = 1;
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

    /** the player · big emoji that swaps based on vehicle. Bobs while walking */
    function drawPlayer(W, groundY) {
        const cx = W * 0.32;
        const v = VEHICLES[state.vehicle];
        const bob = state.vehicle === 'walk'
            ? Math.abs(Math.sin(state.walkPhase)) * 4
            : Math.sin(state.bobT * 0.006) * 1.5;
        const cy = groundY - 36 + bob;

        // shadow under feet
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx, groundY + 4, 30, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // emoji
        ctx.font = '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(v.icon, cx, cy);
        ctx.textAlign = 'start';
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

            // walking leg-phase only advances when actually walking
            if (state.vehicle === 'walk' && dir !== 0) {
                state.walkPhase += dt * 0.008 * Math.abs(dir);
            }

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
                // fire the per-vehicle achievement (run/cycle/bike each have one)
                const v = VEHICLES[want];
                if (v.achId && !state.achievements.has(v.achId)) {
                    state.achievements.add(v.achId);
                    showAchievement({ icon: v.icon, achTitle: v.achTitle, achSub: v.achSub });
                }
            }

            // chapter collection · player passes within range of chapter x
            for (let i = 0; i < CHAPTERS.length; i++) {
                const ch = CHAPTERS[i];
                if (state.collected.has(ch.id)) continue;
                if (state.playerX >= ch.x - 80 && state.playerX <= ch.x + 80) {
                    state.collected.add(ch.id);
                    updateProgress(i);
                    showAchievement(ch);
                    updateMission(i);
                    setTimeout(() => updateMission(pickNextObjective()), 1400);
                    triggerLetterbox(1100);
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

        // ── RENDER ──
        ctx.fillStyle = '#1f1610';
        ctx.fillRect(0, 0, W, H);
        drawSky(W, H, horizonY, progress);
        drawDistHills(W, horizonY, cameraX);
        drawGround(W, H, horizonY, groundY, cameraX);
        drawMidProps(W, horizonY, groundY, cameraX);
        drawChapters(W, horizonY, groundY, cameraX);
        drawPlayer(W, groundY);
    }
    requestAnimationFrame(frame);

    // debug
    window.__journey = { state, CHAPTERS };
})();
