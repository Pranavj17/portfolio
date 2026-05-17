/**
 * the journey · 2D side-scroller (canvas) · RDR-flavoured western chronicle
 * ─────────────────────────────────────────────────────────────────────────
 * Side-on 2D · player auto-walks right · world scrolls left · 8 chapters
 * laid out along a sepia-toned horizon. Walking IS the feature: every
 * stride is visible, the character is the unmistakable subject of every
 * frame, and the parallax layers move at different speeds for depth.
 *
 * No framework. No Three.js. Plain canvas 2D drawing primitives + emoji.
 * Total payload ~12KB.
 */

(() => {
    'use strict';

    const canvas = document.getElementById('stage');
    const ctx    = canvas.getContext('2d', { alpha: false });

    // viewport-fitting canvas · re-sized on resize, keeps DPR for crispness
    function fitCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width  = Math.round(window.innerWidth  * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        canvas.style.width  = '100%';
        canvas.style.height = '100%';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas, { passive: true });

    // ── chapter data ─────────────────────────────────────────────────
    const CHAPTERS = [
        { id: 'itics',    label: 'ITICS',           period: 'until 2013',           x:  600, color: '#a8b87a', icon: '🏫', achId: 'school-1',     achTitle: 'ITICS',                  achSub: 'where it began' },
        { id: 'cmr',      label: 'CMR NATIONAL',    period: '2013 — 2015',          x: 1500, color: '#5e7a8a', icon: '📐', achId: 'school-2',     achTitle: 'CMR NATIONAL',           achSub: 'pre-university · 2013–2015' },
        { id: 'college',  label: 'D.S.C.E.',        period: '2015 — 2019',          x: 2500, color: '#c47540', icon: '🎓', achId: 'first-steps',  achTitle: 'D.S.C.E.',               achSub: 'mechanical engineering · 2015–2019' },
        { id: 'fever104', label: 'FEVER 104 FM',    period: 'mar — may 2019',       x: 3500, color: '#b84c32', icon: '📻', achId: 'fever-104',    achTitle: 'ON AIR · 104 FM',        achSub: '3-month producer stint' },
        { id: 'sakha',    label: 'SAKHA GLOBAL',    period: 'jul 2019 — sep 2022',  x: 4500, color: '#c9a151', icon: '💼', achId: 'first-job',    achTitle: 'FIRST JOB · ALTO',       achSub: 'maruti alto · jul 2019' },
        { id: 'scripbox', label: 'SCRIPBOX',        period: 'sep 2022 — present',   x: 5500, color: '#7a9a8a', icon: '🤖', achId: 'mcp-catalog',  achTitle: 'ANTHROPIC CATALOG',      achSub: 'mcp-server-graylog · PR #2913' },
        { id: 'vwgt',     label: 'THE GT',           period: 'nov 16, 2025',         x: 6600, color: '#a4332e', icon: '🏎️', achId: 'got-the-gt',   achTitle: 'GOT THE GT',             achSub: 'vw virtus gt · nov 16, 2025' },
        { id: 'now',      label: 'NOW',              period: '2026 — present',       x: 7700, color: '#e6c285', icon: '🏁', achId: 'journey-end',  achTitle: 'END OF THE TRAIL',       achSub: '8 chapters · 13 years' },
    ];

    const VEHICLES = {
        walk:  { speed: 60,  icon: '🚶', label: 'ON FOOT',     sub: 'school years' },
        cycle: { speed: 90,  icon: '🚴', label: 'BICYCLE',     sub: 'engineering days' },
        alto:  { speed: 140, icon: '🚗', label: 'MARUTI ALTO', sub: 'first job · 2019' },
        vw:    { speed: 200, icon: '🏎️', label: 'VW VIRTUS GT', sub: '1.5 TSI · turbo' },
    };
    // x-thresholds for vehicle upgrades
    const VEH_THRESH = { cycle: 2200, alto: 4200 };

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
        walkPhase:    0,            // for leg-swing animation
        pauseT:       0,            // tap-to-slow remainder
        bobT:         0,
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
        const el = document.createElement('div');
        el.className = 'achievement';
        el.innerHTML = `
            <span class="a-icon">${ch.icon}</span>
            <div class="a-text">
                <span class="a-title">${ch.achTitle}</span>
                <span class="a-sub">${ch.achSub}</span>
            </div>`;
        $achStack.appendChild(el);
        setTimeout(() => el.remove(), 2900);
    }

    function triggerLetterbox(ms) {
        document.body.classList.add('cinematic');
        setTimeout(() => document.body.classList.remove('cinematic'), ms || 1100);
    }

    // ── tap-to-pause interaction ─────────────────────────────────────
    let tapHintSeen = false;
    canvas.addEventListener('pointerdown', (e) => {
        if (e.target !== canvas) return;
        state.pauseT = Math.max(state.pauseT, 700);
        const nextIdx = pickNextObjective();
        const ch = CHAPTERS[nextIdx];
        if (ch) showAchievement(ch);
        if (!tapHintSeen && $tapHint) {
            tapHintSeen = true;
            $tapHint.classList.add('faded');
        }
    });

    // initial HUD paint
    updateProgress(0);
    updateVehicleCard();
    updateMission(0);

    // ── rendering helpers ────────────────────────────────────────────

    /** sky · vertical sepia gradient ending at horizon */
    function drawSky(W, H, horizonY) {
        const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
        grad.addColorStop(0, '#2a1810');
        grad.addColorStop(0.55, '#5a3a22');
        grad.addColorStop(1, '#a87544');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, horizonY);

        // sun · low, near the horizon
        const sunX = W * 0.78;
        const sunY = horizonY - 38;
        const sg = ctx.createRadialGradient(sunX, sunY, 3, sunX, sunY, 60);
        sg.addColorStop(0, 'rgba(255, 220, 160, 0.95)');
        sg.addColorStop(0.4, 'rgba(255, 180, 100, 0.6)');
        sg.addColorStop(1, 'rgba(255, 140, 70, 0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sunX - 60, sunY - 60, 120, 120);
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

    /** chapter buildings · drawn from the chapter data array */
    function drawChapters(W, horizonY, groundY, cameraX) {
        ctx.textBaseline = 'bottom';
        for (let i = 0; i < CHAPTERS.length; i++) {
            const ch = CHAPTERS[i];
            const px = ch.x - cameraX;
            if (px < -160 || px > W + 160) continue;
            const collected = state.collected.has(ch.id);

            // arch · two short pillars + a beam
            const archColor = collected ? '#5a3a1a' : ch.color;
            ctx.fillStyle = archColor;
            ctx.globalAlpha = collected ? 0.55 : 0.85;
            ctx.fillRect(px - 36, groundY - 64, 6, 64);
            ctx.fillRect(px + 30, groundY - 64, 6, 64);
            ctx.fillRect(px - 38, groundY - 70, 76, 8);
            ctx.globalAlpha = 1;

            // chapter icon (big emoji at the arch top)
            ctx.font = '54px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif';
            ctx.textAlign = 'center';
            ctx.fillText(ch.icon, px, groundY - 80);

            // pulsing aura under uncollected chapters
            if (!collected) {
                const pulse = 0.5 + Math.sin(state.elapsedMs * 0.004 + i) * 0.25;
                const ag = ctx.createRadialGradient(px, groundY, 6, px, groundY, 60);
                ag.addColorStop(0, `rgba(${hexR(ch.color)},${hexG(ch.color)},${hexB(ch.color)},${pulse * 0.55})`);
                ag.addColorStop(1, `rgba(${hexR(ch.color)},${hexG(ch.color)},${hexB(ch.color)},0)`);
                ctx.fillStyle = ag;
                ctx.fillRect(px - 60, groundY - 30, 120, 50);
            }

            // chapter label below the arch in engraved serif
            ctx.font = 'bold 11px "Cinzel", serif';
            ctx.fillStyle = collected ? 'rgba(233,216,176,0.5)' : 'rgba(233,216,176,0.92)';
            ctx.textAlign = 'center';
            ctx.fillText(ch.label, px, groundY + 28);
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
            let pauseScale = 1;
            if (state.pauseT > 0) {
                state.pauseT = Math.max(0, state.pauseT - dt);
                pauseScale = 0.35;
            }

            // forward motion · pixels per second
            const v = VEHICLES[state.vehicle];
            state.playerX += v.speed * (dt / 1000) * pauseScale;

            // walking leg-phase advance
            if (state.vehicle === 'walk') {
                state.walkPhase += dt * 0.008 * pauseScale;
            }

            // vehicle progression by x
            let want;
            if      (state.collected.has('vwgt'))                  want = 'vw';
            else if (state.playerX >= VEH_THRESH.alto)              want = 'alto';
            else if (state.playerX >= VEH_THRESH.cycle)             want = 'cycle';
            else                                                    want = 'walk';
            if (want !== state.vehicle) {
                state.vehicle = want;
                updateVehicleCard();
                triggerLetterbox(800);
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

        // ── RENDER ──
        ctx.fillStyle = '#1f1610';
        ctx.fillRect(0, 0, W, H);
        drawSky(W, H, horizonY);
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
