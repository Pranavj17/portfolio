/**
 * the journey · glitch-terminal side-scroller (game)
 * ─────────────────────────────────────────────────────────────────
 * Five chapters laid out in a 4500px world. Walk with ←/→, jump with
 * ↑ or space, smash Z for a manual glitch burst, R restarts.
 *
 * Render model
 *   - Canvas 960×540 drawn 1:1 in JS, scaled by CSS to fill the wrap.
 *   - EVERYTHING is rendered as ASCII glyphs on canvas — buildings,
 *     ground, player, loot, billboards — using ctx.fillText. Native
 *     shapes would betray the "terminal jacked into something" vibe.
 *   - "Trippy" comes from chromatic aberration on titles (3 fillText
 *     calls with RGB sub-pixel offsets + lighter composite), random
 *     char corruption, scanlines (CSS overlay), and screen-wide jitter
 *     bursts on chapter entry & manual Z trigger.
 *
 * Coordinate system: x in world coords (0..4500). cameraX subtracts
 * to give screen x. Player physics is classic platformer: vy += g,
 * y clamps at GROUND_Y, jump only when onGround.
 */

(() => {
    'use strict';

    // ── canvas + constants ────────────────────────────────────────────
    const canvas = document.getElementById('stage');
    const ctx    = canvas.getContext('2d', { alpha: false });

    const W = 960, H = 540;
    const WORLD_W   = 4500;
    const GROUND_Y  = 432;     // top of the floor row · player feet rest here
    const GRAVITY   = 0.55;
    const JUMP_VY   = -11.5;
    const WALK_VX   = 3.8;
    const RUN_VX    = 5.4;     // shift to run

    const CHAR_W = 10;         // approximate monospace glyph width @ 18px
    const CHAR_H = 18;
    const FONT   = '18px "IBM Plex Mono", ui-monospace, monospace';
    const FONT_SM = '14px "IBM Plex Mono", ui-monospace, monospace';
    const FONT_LG = '24px "IBM Plex Mono", ui-monospace, monospace';

    // palette · phosphor base + chapter accents
    const PAL = {
        bg:       '#0a0e0a',
        fg:       '#c8d3bf',
        fgBright: '#e8f0dd',
        green:    '#6dffa6',
        pink:     '#ff3b8a',
        cyan:     '#5ad8ff',
        purple:   '#b48cff',
        gold:     '#ffd47a',
        red:      '#ff5e5e',
        dim:      'rgba(200, 211, 191, 0.35)',
        ground:   'rgba(109, 255, 166, 0.55)',
        groundDim:'rgba(109, 255, 166, 0.18)',
        star:     'rgba(232, 240, 221, 0.7)',
        starDim:  'rgba(232, 240, 221, 0.3)',
    };

    // garbage glyphs for corruption · drawn from box, geometric, math blocks
    const GARBAGE = '@#$%&░▒▓█▀▄▌▐■□▲▼◆◇▣▤▥▦▧▨▩◊◙║╬╳╋╇╈╉╊'.split('');

    // ── sprites (multi-line ASCII strings) ────────────────────────────
    const SPRITE_STAND  = ['  o  ',
                            ' /|\\ ',
                            ' / \\ '];
    const SPRITE_WALK_A = ['  o  ',
                            ' /|\\ ',
                            ' /|  '];
    const SPRITE_WALK_B = ['  o  ',
                            ' /|\\ ',
                            '  |\\ '];
    const SPRITE_JUMP   = ['  o  ',
                            ' \\|/ ',
                            ' / \\ '];
    const PLAYER_W = 5 * CHAR_W;
    const PLAYER_H = 3 * CHAR_H;

    // buildings · each is a string[] · drawn line by line
    const BLD_DSCE = [
        '┌─────────────────┐',
        '│    D.S.C.E.     │',
        '│ ─────────────── │',
        '│  ▢  ▢  ▢  ▢  ▢  │',
        '│  ▢  ▢  ▢  ▢  ▢  │',
        '│  ▢  ▢  ▢  ▢  ▢  │',
        '└──┬───────────┬──┘',
    ];

    const BLD_RADIO = [
        '         ▲',
        '       █████',
        '      ▐█████▌',
        '       █████',
        '         │',
        '         │  ))) ))',
        '     ┌───┴───┐  ))',
        '     │ON  AIR│ )',
        '     │ 104   │',
        '     │ F M   │',
        '     │ ▓▓▓▓▓ │',
        '     └───┬───┘',
    ];

    const BLD_SAKHA = [
        '┌──────────────────────┐',
        '│     SAKHA  GLOBAL    │',
        '│ ──────────────────── │',
        '│  ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢   │',
        '│  ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢   │',
        '│  ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢   │',
        '│  ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢   │',
        '└────────┬─────────────┘',
    ];

    const BLD_SCRIPBOX = [
        '┌──────────────────────────────┐',
        '│       S C R I P B O X        │',
        '│ ──────────────────────────── │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '└──────────────┬───────────────┘',
    ];

    const BLD_FLAG = [
        '   ╔═══════╗',
        '   ║  NOW  ║',
        '   ║  ───  ║',
        '   ║  ✓✓✓  ║',
        '   ╚═══╤═══╝',
        '       │',
        '       │',
        '       │',
    ];

    // loot sprites (1-line each · positioned hovering)
    const LOOT_DIPLOMA = '╣═══╠';     // rolled-up diploma
    const LOOT_MIC     = '((|))';     // microphone w/ pop filter
    const LOOT_ELIXIR  = '◈';         // elixir gem
    const LOOT_BADGE   = '[✦]';       // catalog badge
    const LOOT_TROPHY  = '▲';         // trophy peak

    // ── zone definitions ──────────────────────────────────────────────
    /** @type {Array<{id:string, label:string, center:number, color:string,
     *   bld:string[], bldY:number, loot:{x:number,y:number,sprite:string,label:string},
     *   billboard:string[], badge:string }>} */
    const ZONES = [
        {
            id: 'college', label: 'chapter 1 · college', center: 350, color: PAL.green,
            bld: BLD_DSCE, bldY: 268,
            loot: { x: 350, y: 360, sprite: LOOT_DIPLOMA, label: 'mech-engg diploma' },
            badge: 'D.S.C.E · 2015–2019',
            billboard: [
                '> 2015 – 2019 · dayananda sagar coe',
                '> mechanical engineering · cgpa 7.75',
                '> tools you wouldn\'t expect: calipers, autocad,',
                '  thermodynamics · zero lines of production code',
                '> ...but the world needs software.',
            ],
        },
        {
            id: 'fever104', label: 'chapter 2 · fever 104 fm', center: 1250, color: PAL.pink,
            bld: BLD_RADIO, bldY: 200,
            loot: { x: 1250, y: 360, sprite: LOOT_MIC, label: 'on-air microphone' },
            badge: '📻  FEVER 104 FM · mar–may 2019',
            billboard: [
                '> mar – may 2019 · 3-month intern stint',
                '> show producer · afternoon show · bengaluru',
                '> took celebrity interviews on-air',
                '> wrote ad scripts · gave voice-overs for promos',
                '> went out as OB jock at live events',
                '> the creative detour before software ate everything',
            ],
        },
        {
            id: 'sakha', label: 'chapter 3 · sakha global', center: 2200, color: PAL.purple,
            bld: BLD_SAKHA, bldY: 250,
            loot: { x: 2200, y: 360, sprite: LOOT_ELIXIR, label: 'elixir drop' },
            badge: 'SAKHA GLOBAL · jul 2019 – sep 2022',
            billboard: [
                '> jul 2019 – sep 2022 · senior dev · elixir',
                '> payment processing · 99.99 % SLA',
                '> built form-builder DSL · low-code engine',
                '> 3 years · zero major incidents',
            ],
        },
        {
            id: 'scripbox', label: 'chapter 4 · scripbox', center: 3150, color: PAL.cyan,
            bld: BLD_SCRIPBOX, bldY: 232,
            loot: { x: 3150, y: 360, sprite: LOOT_BADGE, label: 'anthropic mcp badge' },
            badge: 'SCRIPBOX · sep 2022 – present',
            billboard: [
                '> sep 2022 – present · senior eng · ai infra',
                '> mcp-server-graylog · official anthropic catalog',
                '> openclaw gateway · 8 skills · 10+ eng-hrs/wk saved',
                '> memory mcp · postgres-backed claude desktop',
                '> k8s migration · 11 services · zero downtime',
            ],
        },
        {
            id: 'now', label: 'chapter 5 · now', center: 4150, color: PAL.gold,
            bld: BLD_FLAG, bldY: 288,
            loot: { x: 4150, y: 360, sprite: LOOT_TROPHY, label: 'open to next role' },
            badge: 'NOW · 2026 · bangalore',
            billboard: [
                '> 2026 · bangalore · 6+ years',
                '> open to senior eng / staff roles',
                '> ai infrastructure · mcp tooling · agent ops',
                '> pranavjagadish.com · github.com/Pranavj17',
            ],
        },
    ];

    // ── game state ────────────────────────────────────────────────────
    const state = {
        running:   false,
        ended:     false,
        player: {
            x: 120, y: GROUND_Y - PLAYER_H, vx: 0, vy: 0,
            onGround: true, facing: 1, walkPhase: 0,
        },
        cameraX:   0,
        loot:      0,                       // count collected
        collected: new Set(),               // zone ids collected
        revealed:  new Set(),               // zone ids whose billboard typed out
        revealT:   new Map(),               // zone id -> elapsed reveal time
        zone:      0,                       // index of nearest zone
        glitchT:   0,                       // remaining ms of full-screen glitch
        shimmerT:  0,                       // remaining ms of chapter-entry shimmer
        glitchCol: PAL.green,
        t:         0,                       // total elapsed ms
        keys:      Object.create(null),
        fpsAccum:  0,
        fpsFrames: 0,
        fps:       0,
        stars:     [],
    };

    // pre-generate parallax stars (3 layers · slow/med/fast)
    for (let i = 0; i < 90; i++) {
        state.stars.push({
            x:       Math.random() * WORLD_W,
            y:       4 + Math.random() * 240,
            layer:   1 + Math.floor(Math.random() * 3),  // 1,2,3
            twinkle: Math.random() * Math.PI * 2,
            char:    Math.random() < 0.65 ? '.' : (Math.random() < 0.6 ? '·' : '✦'),
        });
    }

    // ── HUD bindings ──────────────────────────────────────────────────
    const hudChapter = document.getElementById('hud-chapter');
    const hudLoot    = document.getElementById('hud-loot');
    const hudFps     = document.getElementById('hud-fps');
    const overlayStart = document.getElementById('overlay-start');
    const overlayEnd   = document.getElementById('overlay-end');
    const btnStart   = document.getElementById('btn-start');
    const btnReplay  = document.getElementById('btn-replay');
    const endLoot    = document.getElementById('end-loot');
    const endTitle   = document.getElementById('end-title');
    const endSub     = document.getElementById('end-sub');

    // ── input ─────────────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
        // arrow keys · WASD · space all map to game actions
        const k = e.key.toLowerCase();
        state.keys[k] = true;
        if (k === ' ' || k === 'arrowup' || k === 'w') {
            e.preventDefault();
            tryJump();
        }
        if (k === 'z') triggerGlitch(280, '#ff3b8a');
        if (k === 'r') restart();
    });
    window.addEventListener('keyup', (e) => {
        state.keys[e.key.toLowerCase()] = false;
    });

    btnStart.addEventListener('click', startGame);
    btnReplay.addEventListener('click', restart);

    function tryJump() {
        if (state.running && state.player.onGround) {
            state.player.vy = JUMP_VY;
            state.player.onGround = false;
            triggerGlitch(80, PAL.green);
        }
    }

    function startGame() {
        overlayStart.hidden = true;
        state.running = true;
        state.ended   = false;
    }

    function restart() {
        Object.assign(state.player, {
            x: 120, y: GROUND_Y - PLAYER_H, vx: 0, vy: 0,
            onGround: true, facing: 1, walkPhase: 0,
        });
        state.cameraX  = 0;
        state.loot     = 0;
        state.collected.clear();
        state.revealed.clear();
        state.revealT.clear();
        state.zone     = 0;
        state.glitchT  = 0;
        state.shimmerT = 0;
        state.ended    = false;
        state.running  = true;
        overlayStart.hidden = true;
        overlayEnd.hidden   = true;
        triggerGlitch(400, PAL.cyan);
    }

    function triggerGlitch(ms, color) {
        state.glitchT = Math.max(state.glitchT, ms);
        state.glitchCol = color || PAL.green;
    }

    // ── update step ───────────────────────────────────────────────────
    function update(dt) {
        if (!state.running || state.ended) return;
        state.t += dt;
        // f = 1.0 at 60fps · scales velocity/gravity so a 120hz monitor doesn't
        // make the player walk twice as fast as a 60hz one. JUMP_VY is an
        // instantaneous impulse (set, not added) so it stays unscaled.
        const f = dt / 16.67;

        const p = state.player;
        const speed = (state.keys['shift']) ? RUN_VX : WALK_VX;

        // horizontal movement
        let dx = 0;
        if (state.keys['arrowleft']  || state.keys['a']) dx -= 1;
        if (state.keys['arrowright'] || state.keys['d']) dx += 1;
        p.vx = dx * speed;
        if (dx !== 0) p.facing = dx;

        p.x += p.vx * f;
        if (p.x < 0) p.x = 0;
        if (p.x > WORLD_W - PLAYER_W) p.x = WORLD_W - PLAYER_W;

        // vertical · gravity + jump
        p.vy += GRAVITY * f;
        p.y  += p.vy * f;
        if (p.y >= GROUND_Y - PLAYER_H) {
            p.y = GROUND_Y - PLAYER_H;
            p.vy = 0;
            p.onGround = true;
        }

        // walk anim phase advances when moving on the ground
        if (Math.abs(p.vx) > 0.1 && p.onGround) {
            p.walkPhase = (p.walkPhase + Math.abs(p.vx) * 0.08 * f) % 4;
        }

        // camera follow · lookahead by facing direction
        const playerCx = p.x + PLAYER_W / 2;
        const targetCam = playerCx - W / 2 + p.facing * 80;
        state.cameraX += (targetCam - state.cameraX) * 0.12;
        state.cameraX = Math.max(0, Math.min(WORLD_W - W, state.cameraX));

        // zone detection + collect + reveal billboard
        let nearest = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < ZONES.length; i++) {
            const z = ZONES[i];
            const d = Math.abs(playerCx - z.center);
            if (d < nearestDist) { nearest = i; nearestDist = d; }

            // collect loot if player overlaps with loot box (within 50px)
            if (!state.collected.has(z.id)) {
                const lx = z.loot.x, ly = z.loot.y;
                if (Math.abs(playerCx - lx) < 36 && Math.abs((p.y + PLAYER_H / 2) - ly) < 60) {
                    state.collected.add(z.id);
                    state.loot++;
                    triggerGlitch(220, z.color);
                }
            }

            // reveal billboard when within 260px
            if (d < 260) {
                const elapsed = state.revealT.get(z.id) || 0;
                state.revealT.set(z.id, elapsed + dt);
                if (elapsed > 50) state.revealed.add(z.id);
            }
        }

        // chapter-entry shimmer
        if (nearest !== state.zone) {
            state.zone = nearest;
            state.shimmerT = 380;
            triggerGlitch(160, ZONES[nearest].color);
        }

        // tick down timers
        state.glitchT  = Math.max(0, state.glitchT  - dt);
        state.shimmerT = Math.max(0, state.shimmerT - dt);

        // end-state: all loot + standing in the last zone
        if (state.loot >= ZONES.length && state.zone === ZONES.length - 1 && !state.ended) {
            state.ended = true;
            endTitle.textContent = 'thanks for playing.';
            endSub.textContent   = 'you walked through 6 years · 5 chapters · all 5 loot collected.';
            endLoot.textContent  = `loot · ${state.loot} / ${ZONES.length}`;
            overlayEnd.hidden = false;
            triggerGlitch(600, PAL.gold);
        }

        // HUD
        const z = ZONES[state.zone];
        hudChapter.textContent = `ch.${state.zone + 1}/${ZONES.length} · ${z.id}`;
        hudLoot.textContent    = `${state.loot} / ${ZONES.length}`;
        if (state.fpsFrames > 0) hudFps.textContent = state.fps.toFixed(0);
    }

    // ── rendering helpers ─────────────────────────────────────────────

    /** chromatic-aberration text · 3 fillTexts with sub-pixel offsets,
     *  blended additively. `intensity` is the offset in px. */
    function fillTitleRGB(text, x, y, intensity = 2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = PAL.cyan;
        ctx.fillText(text, x - intensity, y);
        ctx.fillStyle = PAL.pink;
        ctx.fillText(text, x + intensity, y);
        ctx.fillStyle = PAL.fgBright;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    /** corrupt some characters in a string with low probability */
    function corrupt(text, rate) {
        if (rate <= 0) return text;
        let out = '';
        for (let i = 0; i < text.length; i++) {
            if (Math.random() < rate) {
                out += GARBAGE[(Math.random() * GARBAGE.length) | 0];
            } else {
                out += text[i];
            }
        }
        return out;
    }

    function drawMultiLine(lines, x, y, color, lineH = CHAR_H) {
        ctx.fillStyle = color;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, y + i * lineH);
        }
    }

    // ── render ────────────────────────────────────────────────────────
    function draw() {
        // clear
        ctx.fillStyle = PAL.bg;
        ctx.fillRect(0, 0, W, H);

        // chapter color glow (very subtle background tint)
        const z = ZONES[state.zone];
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = z.color;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // parallax stars (3 layers · slowest = layer 1)
        ctx.font = FONT_SM;
        for (let i = 0; i < state.stars.length; i++) {
            const s = state.stars[i];
            const parallax = state.cameraX / (s.layer * 2);
            let sx = s.x - parallax;
            // wrap
            sx = ((sx % WORLD_W) + WORLD_W) % WORLD_W;
            sx -= state.cameraX * (1 / s.layer);
            // visible only on screen
            if (sx < -20 || sx > W + 20) continue;
            const twinkle = (Math.sin(state.t * 0.003 + s.twinkle) + 1) / 2;
            ctx.fillStyle = twinkle > 0.5 ? PAL.star : PAL.starDim;
            ctx.fillText(s.char, sx, s.y);
        }

        // horizon line + decorative bar
        ctx.fillStyle = PAL.dim;
        ctx.font = FONT_SM;
        ctx.fillText('─'.repeat(140), -8 - (state.cameraX * 0.4) % CHAR_W, 280);

        // ground line + foreground tufts (scrolls with camera)
        ctx.font = FONT;
        ctx.fillStyle = PAL.ground;
        const groundOffset = -(state.cameraX % CHAR_W);
        ctx.fillText('═'.repeat(110), groundOffset, GROUND_Y);
        // sparse grass / circuitry tufts below
        ctx.fillStyle = PAL.groundDim;
        const tuftOffset = -(state.cameraX * 1.1 % (CHAR_W * 6));
        for (let i = 0; i < 22; i++) {
            const c = i % 3 === 0 ? '┴' : (i % 3 === 1 ? '·' : '╨');
            ctx.fillText(c, tuftOffset + i * CHAR_W * 6, GROUND_Y + CHAR_H + 2);
        }

        // ── world objects (buildings, billboards, loot) ──
        // draw all zones · only ones near camera are visible
        for (let i = 0; i < ZONES.length; i++) {
            drawZone(ZONES[i], i);
        }

        // ── player ──
        drawPlayer();

        // ── chapter title banner (top center) ──
        drawTopBanner(z);

        // ── full-screen glitch displacement ──
        if (state.glitchT > 0) drawGlitchOverlay();

        // ── chapter-entry shimmer ──
        if (state.shimmerT > 0) drawShimmer(z.color);
    }

    function drawZone(z, idx) {
        const sx = z.center - state.cameraX;
        // cull if entirely off-screen
        if (sx < -400 || sx > W + 400) return;

        // building · centered horizontally above the ground
        ctx.font = FONT;
        const bldW = z.bld[0].length * CHAR_W;
        const bldX = sx - bldW / 2;
        const bldColor = (state.zone === idx) ? z.color : PAL.dim;
        drawMultiLine(z.bld, bldX, z.bldY, bldColor);

        // loot · only if not collected · hovers up/down + spins per frame
        if (!state.collected.has(z.id)) {
            const lx = z.loot.x - state.cameraX;
            const hover = Math.sin(state.t * 0.005 + idx) * 6;
            const ly = z.loot.y + hover;
            ctx.font = FONT_LG;
            const spinPhase = Math.floor(state.t * 0.008 + idx) & 3;
            const sprite = (spinPhase < 2) ? z.loot.sprite : `<${z.loot.sprite}>`;
            // RGB-split the loot for emphasis
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = PAL.cyan;
            ctx.fillText(sprite, lx - 1, ly);
            ctx.fillStyle = PAL.pink;
            ctx.fillText(sprite, lx + 1, ly);
            ctx.fillStyle = z.color;
            ctx.fillText(sprite, lx, ly);
            ctx.restore();
        }

        // billboard: only show fully when revealed AND nearest
        const isNear = state.zone === idx;
        if (state.revealed.has(z.id) && isNear) {
            drawBillboard(z, sx);
        } else if (isNear) {
            // hint marker when player approaches
            ctx.font = FONT_SM;
            ctx.fillStyle = PAL.fg;
            const blink = (Math.floor(state.t * 0.004) & 1) ? '▼' : '▽';
            ctx.fillText(blink + '  walk here  ' + blink, sx - 70, z.bldY - 28);
        }
    }

    function drawBillboard(z, sx) {
        // typed-out reveal · reveal speed 36 chars/sec, all lines parallel
        const elapsedSec = (state.revealT.get(z.id) || 0) / 1000;
        ctx.font = FONT_SM;
        const startY = 28;
        const lineH  = 18;
        const boxW   = Math.max(...z.billboard.map((s) => s.length)) * (CHAR_W * 0.78);

        // panel border
        const padX = 8, padY = 6;
        const panelX = Math.max(8, Math.min(W - boxW - 16, sx - boxW / 2));
        const panelY = startY;
        const panelH = z.billboard.length * lineH + padY * 2 + 6;
        ctx.fillStyle = 'rgba(10,14,10,0.78)';
        ctx.fillRect(panelX - padX, panelY - padY, boxW + padX * 2 + 8, panelH);
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX - padX + 0.5, panelY - padY + 0.5, boxW + padX * 2 + 7, panelH - 1);

        // header
        ctx.fillStyle = z.color;
        ctx.fillText('[' + z.badge + ']', panelX, panelY);

        // body lines
        for (let i = 0; i < z.billboard.length; i++) {
            const lineDelay = 0.08 + i * 0.32;
            const lineT = Math.max(0, elapsedSec - lineDelay);
            const reveal = Math.min(z.billboard[i].length, Math.floor(lineT * 38));
            const shown = z.billboard[i].slice(0, reveal);
            const corrupted = corrupt(shown, 0.012);
            ctx.fillStyle = PAL.fg;
            ctx.fillText(corrupted, panelX, panelY + 22 + i * lineH);
        }

        // blink cursor on last typing line
        const totalChars = z.billboard.reduce((s, l) => s + l.length, 0);
        if (Math.floor(state.t * 0.005) & 1) {
            // find first not-yet-fully-typed line
            for (let i = 0; i < z.billboard.length; i++) {
                const lineDelay = 0.08 + i * 0.32;
                const lineT = Math.max(0, elapsedSec - lineDelay);
                const reveal = Math.min(z.billboard[i].length, Math.floor(lineT * 38));
                if (reveal < z.billboard[i].length) {
                    ctx.fillStyle = z.color;
                    ctx.fillText('▌', panelX + reveal * CHAR_W * 0.6, panelY + 22 + i * lineH);
                    break;
                }
            }
        }
    }

    function drawPlayer() {
        const p = state.player;
        const sx = p.x - state.cameraX;
        const sy = p.y;
        let sprite;
        if (!p.onGround) sprite = SPRITE_JUMP;
        else if (Math.abs(p.vx) > 0.1) {
            const phase = Math.floor(p.walkPhase);
            sprite = (phase & 1) ? SPRITE_WALK_A : SPRITE_WALK_B;
        } else sprite = SPRITE_STAND;

        ctx.font = FONT;
        // shadow underneath (squish when in air)
        ctx.save();
        const airH = (GROUND_Y - PLAYER_H) - p.y;
        const shadowW = Math.max(8, 28 - airH * 0.2);
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0.1, 0.35 - airH * 0.003)})`;
        ctx.fillText('─'.repeat(Math.ceil(shadowW / CHAR_W)), sx, GROUND_Y + 4);
        ctx.restore();

        // RGB-split player when running fast or just jumped
        const drift = !p.onGround ? 1 : (Math.abs(p.vx) > 4 ? 1 : 0);
        if (drift > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = PAL.cyan;
            drawMultiLine(sprite, sx - drift, sy);
            ctx.fillStyle = PAL.pink;
            drawMultiLine(sprite, sx + drift, sy);
            ctx.restore();
        }
        ctx.fillStyle = PAL.green;
        drawMultiLine(sprite, sx, sy);
    }

    function drawTopBanner(z) {
        ctx.font = FONT;
        const text = z.label.toUpperCase();
        const tw = text.length * CHAR_W;
        const x  = (W - tw) / 2;
        const y  = 26;
        // glitched title (corrupt + RGB split)
        const corrupted = corrupt(text, 0.02);
        fillTitleRGB(corrupted, x, y, 2.5);

        // year ticker right below
        ctx.font = FONT_SM;
        ctx.fillStyle = PAL.dim;
        const periodMap = {
            college: '2015 — 2019',
            fever104: 'mar — may 2019',
            sakha:   'jul 2019 — sep 2022',
            scripbox:'sep 2022 — 2026',
            now:     '2026 — present',
        };
        const period = periodMap[z.id] || '';
        if (period) {
            const pw = period.length * (CHAR_W * 0.6);
            ctx.fillText(period, (W - pw) / 2, y + 22);
        }

        // pixel-ruler underline · ticks for each chapter
        ctx.fillStyle = PAL.groundDim;
        ctx.font = FONT;
        const ruler = '┄'.repeat(80);
        ctx.fillText(ruler, 30, y + 38);
        // chapter dots
        for (let i = 0; i < ZONES.length; i++) {
            const dx = 30 + (i / (ZONES.length - 1)) * (80 * CHAR_W - CHAR_W * 2);
            const filled = i <= state.zone;
            ctx.fillStyle = filled ? ZONES[i].color : PAL.dim;
            ctx.fillText(filled ? '●' : '○', dx, y + 38);
        }
    }

    function drawGlitchOverlay() {
        // displace horizontal bands of the screen by random pixels
        const intensity = state.glitchT / 280;
        ctx.save();
        const bands = 10;
        for (let i = 0; i < bands; i++) {
            const bandH = H / bands;
            const offset = (Math.random() - 0.5) * 24 * intensity;
            const y = i * bandH;
            // copy that horizontal strip back onto itself, shifted
            ctx.drawImage(canvas, 0, y, W, bandH, offset, y, W, bandH);
        }
        // color flash
        ctx.fillStyle = state.glitchCol;
        ctx.globalAlpha = 0.07 * intensity;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    function drawShimmer(color) {
        const intensity = state.shimmerT / 380;
        // a horizontal strip moving up from the bottom
        const y = H - (1 - intensity) * H;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.12 * intensity;
        ctx.fillRect(0, y, W, 6);
        ctx.globalAlpha = 0.05 * intensity;
        ctx.fillRect(0, y - 16, W, 2);
        ctx.restore();
    }

    // ── main loop ─────────────────────────────────────────────────────
    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min(48, now - lastT);
        lastT = now;
        // fps
        state.fpsAccum += dt;
        state.fpsFrames++;
        if (state.fpsAccum > 500) {
            state.fps = (state.fpsFrames * 1000) / state.fpsAccum;
            state.fpsAccum = 0;
            state.fpsFrames = 0;
        }
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }

    // initial paint so the canvas isn't blank behind the start overlay
    draw();
    hudChapter.textContent = 'ch.1/5 · press start';
    hudLoot.textContent    = '0 / 5';

    requestAnimationFrame(frame);

    // expose for debugging
    window.__journey = { state, ZONES, restart, triggerGlitch };
})();
