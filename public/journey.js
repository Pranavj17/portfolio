/**
 * the journey · 3D-perspective glitch-terminal walker
 * ─────────────────────────────────────────────────────────────────
 * Third-person camera behind a player walking forward INTO the scene.
 * Walk with ↑ (or W), strafe with ←/→, step back with ↓, jump with
 * space, smash Z for a manual glitch burst, R restarts.
 *
 * Render model
 *   - Canvas 960×540 drawn 1:1, scaled by CSS to fit the wrap.
 *   - All world objects have (worldX, worldY, worldZ). We project to
 *     screen using simple perspective:
 *         dz    = worldZ - camera.z
 *         scale = FOCAL / dz
 *         sx    = W/2 + (worldX - camera.x) * scale
 *         sy    = HORIZON - (worldY - camera.eyeY) * scale
 *     Then ctx.font is sized = BASE_FONT_PX × scale, so the same ASCII
 *     line renders microscopic in the distance and chunky up close.
 *     Sorted far-to-near (painter's algorithm); no z-buffer needed.
 *   - The player sprite is anchored at a FIXED screen position near
 *     bottom-center. Forward motion translates camera (and player) z+,
 *     so the world appears to flow toward us.
 *
 * Coords convention
 *   +X right, +Y up, +Z into the screen.
 *   Ground plane at y=0. Eye height ~ 60. Player at z increases as
 *   you walk forward, station z values are at 200, 600, 1100, 1700, 2400.
 */

(() => {
    'use strict';

    // ── canvas + constants ────────────────────────────────────────────
    const canvas = document.getElementById('stage');
    const ctx    = canvas.getContext('2d', { alpha: false });

    const W = 960, H = 540;
    const HORIZON = 250;          // y of horizon line (where vanishing point sits)
    const FOCAL   = 380;          // higher = less perspective distortion
    const EYE_Y   = 60;           // camera eye height above ground
    const NEAR_Z  = 8;            // near clip plane

    const GROUND_Y    = 0;        // world y of the floor
    const PLAYER_BASE_Z = 0;      // player starts at z=0
    const WORLD_END_Z = 3100;     // game-over zone end (past the last station)
    const LANE_X = [-90, 0, 90];  // 3 lanes the player can occupy

    const WALK_VZ = 1.8;          // forward speed (world units per 16.67ms)
    const BACK_VZ = 1.0;          // back speed
    const STRAFE_VX = 2.4;        // strafe speed
    const GRAVITY = 0.55;
    const JUMP_VY = -11.5;

    const FONT = 'IBM Plex Mono, ui-monospace, monospace';
    const BASE_FONT_PX = 22;      // size at which scale=1.0

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
        dim:      'rgba(200,211,191,0.35)',
        grid:     'rgba(109,255,166,0.42)',
        gridFar:  'rgba(109,255,166,0.12)',
        star:     'rgba(232,240,221,0.7)',
        starDim:  'rgba(232,240,221,0.3)',
    };

    const GARBAGE = '@#$%&░▒▓█▀▄▌▐■□▲▼◆◇▣◊╳╋╇'.split('');

    // ── sprites ───────────────────────────────────────────────────────
    // player · back view · 3 lines. Walk/jump variants for animation
    const P_STAND = [' o ', '/|\\', '/ \\'];
    const P_WALK_A = [' o ', '/|\\', '/ |'];
    const P_WALK_B = [' o ', '/|\\', '| \\'];
    const P_JUMP   = [' o ', '\\|/', '/ \\'];
    const P_LEFT   = ['<o ', '/|\\', '/ \\'];
    const P_RIGHT  = [' o>', '/|\\', '/ \\'];

    // chapter buildings (taller buildings convey scale)
    const BLD_DSCE = [
        '┌─────────────────┐',
        '│   D.S.C.E       │',
        '│ ─────────────── │',
        '│  ▢  ▢  ▢  ▢  ▢  │',
        '│  ▢  ▢  ▢  ▢  ▢  │',
        '│  ▢  ▢  ▢  ▢  ▢  │',
        '│  ▢  ▢  ▢  ▢  ▢  │',
        '└──┬───────────┬──┘',
    ];
    const BLD_RADIO = [
        '       ▲',
        '     █████',
        '    ▐█████▌',
        '     █████',
        '       │',
        '   ┌───┴───┐  ))))',
        '   │ON  AIR│   )))',
        '   │ 104   │    ))',
        '   │ F M   │     )',
        '   │ ▓▓▓▓▓ │',
        '   └───┬───┘',
    ];
    const BLD_SAKHA = [
        '┌──────────────────┐',
        '│  SAKHA  GLOBAL   │',
        '│ ──────────────── │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '└────────┬─────────┘',
    ];
    const BLD_SCRIPBOX = [
        '┌──────────────────────┐',
        '│    S C R I P B O X   │',
        '│ ──────────────────── │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '│ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢  │',
        '└──────────┬───────────┘',
    ];
    const BLD_FLAG = [
        '╔═════════╗',
        '║   NOW   ║',
        '║  ─────  ║',
        '║   ✓✓✓   ║',
        '║   2026  ║',
        '╚═════╤═══╝',
        '      │',
        '      │',
    ];

    // VW Virtus GT · parked on the path (chapter 5 · personal-life beat)
    const BLD_VWGT = [
        '       ┌─────────────────┐',
        '      ╱  ░░░░░░░░░░░░░░  ╲',
        '   ┌─╯ ░ ░  VW ▒ GT ░  ░ ╰─┐',
        '   │ ░░░░  VIRTUS  ░░░░░  │',
        '   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │',
        '   └─◯─────────────────◯─┘',
        '     ◯                 ◯  ',
    ];

    const LOOT_DIPLOMA = '═╣◇╠═';
    const LOOT_MIC     = '((|))';
    const LOOT_ELIXIR  = '◈';
    const LOOT_BADGE   = '[✦]';
    const LOOT_KEYS    = '⊙─┑';     // car keys
    const LOOT_TROPHY  = '▲';

    // ── zone definitions ──────────────────────────────────────────────
    /** Each zone owns a building at (X, Z) and a loot floating in the
     *  player's lane between the buildings. Billboard text reveals when
     *  the player gets close. */
    const ZONES = [
        {
            id: 'college', label: 'chapter 1 · D.S.C.E.', z: 200, color: PAL.green,
            buildings: [
                { sprite: BLD_DSCE, x: -180, z: 220 },
                { sprite: BLD_DSCE, x:  180, z: 220 },
            ],
            loot: { x: 0, y: 60, z: 200, sprite: LOOT_DIPLOMA, label: 'mech-engg diploma' },
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
            id: 'fever104', label: 'chapter 2 · fever 104 fm', z: 700, color: PAL.pink,
            buildings: [
                { sprite: BLD_RADIO, x: -150, z: 720 },
                { sprite: BLD_RADIO, x:  150, z: 720 },
            ],
            loot: { x: 0, y: 60, z: 700, sprite: LOOT_MIC, label: 'on-air microphone' },
            badge: 'FEVER 104 FM · mar–may 2019',
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
            id: 'sakha', label: 'chapter 3 · sakha global', z: 1200, color: PAL.purple,
            buildings: [
                { sprite: BLD_SAKHA, x: -190, z: 1220 },
                { sprite: BLD_SAKHA, x:  190, z: 1220 },
            ],
            loot: { x: 0, y: 60, z: 1200, sprite: LOOT_ELIXIR, label: 'elixir drop' },
            badge: 'SAKHA GLOBAL · jul 2019 – sep 2022',
            billboard: [
                '> jul 2019 – sep 2022 · senior dev · elixir',
                '> payment processing · 99.99 % SLA',
                '> built form-builder DSL · low-code engine',
                '> 3 years · zero major incidents',
            ],
        },
        {
            id: 'scripbox', label: 'chapter 4 · scripbox', z: 1800, color: PAL.cyan,
            buildings: [
                { sprite: BLD_SCRIPBOX, x: -210, z: 1820 },
                { sprite: BLD_SCRIPBOX, x:  210, z: 1820 },
            ],
            loot: { x: 0, y: 60, z: 1800, sprite: LOOT_BADGE, label: 'anthropic mcp badge' },
            badge: 'SCRIPBOX · sep 2022 – present',
            billboard: [
                '> sep 2022 – present · senior eng · ai infra',
                '> mcp-server-graylog · official anthropic catalog',
                '> openclaw gateway · 8 skills · 10+ hrs/wk saved',
                '> memory mcp · postgres-backed claude desktop',
                '> k8s migration · 11 services · zero downtime',
            ],
        },
        {
            id: 'vwgt', label: 'chapter 5 · the GT', z: 2300, color: PAL.red,
            buildings: [
                // car parked sideways on the right shoulder of the path
                { sprite: BLD_VWGT, x: 120, z: 2320 },
            ],
            loot: { x: 0, y: 60, z: 2300, sprite: LOOT_KEYS, label: 'volkswagen keys' },
            badge: 'VW VIRTUS GT · nov 16, 2025',
            billboard: [
                '> nov 16, 2025 · first car · bangalore',
                '> volkswagen virtus GT · 1.5 TSI EVO · turbo petrol',
                '> 7-speed DSG · sundae red metallic',
                '> finally · life happens outside the keyboard too',
            ],
        },
        {
            id: 'now', label: 'chapter 6 · now', z: 2900, color: PAL.gold,
            buildings: [
                { sprite: BLD_FLAG, x: 0, z: 2920 },
            ],
            loot: { x: 0, y: 60, z: 2900, sprite: LOOT_TROPHY, label: 'open to next role' },
            badge: 'NOW · 2026 · bangalore',
            billboard: [
                '> 2026 · bangalore · 6+ years',
                '> open to senior eng / staff roles',
                '> ai infrastructure · mcp tooling · agent ops',
                '> pranavjagadish.com · github.com/Pranavj17',
            ],
        },
    ];

    // ── state ─────────────────────────────────────────────────────────
    const state = {
        running:    false,
        ended:      false,
        player: {
            x: 0, y: 0, z: PLAYER_BASE_Z,
            vy: 0, lane: 1,                  // 0=left, 1=center, 2=right
            onGround: true,
            walkPhase: 0,
            facing: 0,                       // -1, 0, +1 for left/forward/right body lean
            forwardActive: false,            // true if any forward key held
        },
        camera: { x: 0, z: -120, eyeY: EYE_Y },
        loot:       0,
        collected:  new Set(),
        revealed:   new Set(),
        revealT:    new Map(),
        zone:       0,
        glitchT:    0,
        shimmerT:   0,
        glitchCol:  PAL.green,
        t:          0,
        keys:       Object.create(null),
        fpsAccum:   0, fpsFrames: 0, fps: 0,
        stars:      [],
    };

    // sky stars · world-space, parallax-cheap (very far Z)
    for (let i = 0; i < 80; i++) {
        state.stars.push({
            x: (Math.random() - 0.5) * 1400,
            y: 80 + Math.random() * 200,
            z: 4000 + Math.random() * 2000,
            char: Math.random() < 0.6 ? '·' : (Math.random() < 0.6 ? '.' : '✦'),
            twinkle: Math.random() * Math.PI * 2,
        });
    }

    // ── HUD bindings ──────────────────────────────────────────────────
    const hudChapter   = document.getElementById('hud-chapter');
    const hudLoot      = document.getElementById('hud-loot');
    const hudFps       = document.getElementById('hud-fps');
    const overlayStart = document.getElementById('overlay-start');
    const overlayEnd   = document.getElementById('overlay-end');
    const btnStart     = document.getElementById('btn-start');
    const btnReplay    = document.getElementById('btn-replay');
    const endLoot      = document.getElementById('end-loot');
    const endTitle     = document.getElementById('end-title');
    const endSub       = document.getElementById('end-sub');

    // ── input ─────────────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        state.keys[k] = true;
        if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
        if (k === ' ' || k === 'w') tryJump();
        if (k === 'z') triggerGlitch(280, PAL.pink);
        if (k === 'r') restart();
    });
    window.addEventListener('keyup', (e) => {
        state.keys[e.key.toLowerCase()] = false;
    });
    btnStart.addEventListener('click', startGame);
    btnReplay.addEventListener('click', restart);

    // ── touch / mobile controls ─────────────────────────────────────
    // Each .tbtn carries a data-key matching the same key strings the
    // keyboard listener writes to state.keys. pointerdown/up toggles the
    // key state so the existing update() loop sees the input. Jump and
    // glitch are one-shot — they fire on press only.
    const tbtns = document.querySelectorAll('.touch-controls .tbtn');
    tbtns.forEach((b) => {
        const k = b.dataset.key;
        const press = (e) => {
            e.preventDefault();
            b.classList.add('is-pressed');
            // start the game on first touch if the start overlay is still up
            if (!state.running && !overlayStart.hidden) startGame();
            if (k === ' ')        { tryJump();                 return; }
            if (k === 'z')        { triggerGlitch(280, PAL.pink); return; }
            state.keys[k] = true;
        };
        const release = (e) => {
            e.preventDefault();
            b.classList.remove('is-pressed');
            if (k === ' ' || k === 'z') return;
            state.keys[k] = false;
        };
        // pointer events handle mouse + touch + pen uniformly
        b.addEventListener('pointerdown',   press);
        b.addEventListener('pointerup',     release);
        b.addEventListener('pointercancel', release);
        b.addEventListener('pointerleave',  release);
        // explicit touch handlers for older mobile browsers that ignore
        // pointer events on canvas-overlay buttons
        b.addEventListener('touchstart', press,  { passive: false });
        b.addEventListener('touchend',   release, { passive: false });
    });

    function tryJump() {
        if (state.running && state.player.onGround) {
            state.player.vy = JUMP_VY;
            state.player.onGround = false;
            triggerGlitch(70, PAL.green);
        }
    }
    function startGame() {
        overlayStart.hidden = true;
        state.running = true;
        state.ended   = false;
    }
    function restart() {
        const p = state.player;
        p.x = 0; p.y = 0; p.z = PLAYER_BASE_Z; p.vy = 0; p.lane = 1;
        p.onGround = true; p.walkPhase = 0; p.facing = 0;
        state.camera.x = 0; state.camera.z = p.z - 120;
        state.loot = 0;
        state.collected.clear();
        state.revealed.clear();
        state.revealT.clear();
        state.zone = 0;
        state.glitchT = 0; state.shimmerT = 0;
        state.ended = false; state.running = true;
        overlayStart.hidden = true;
        overlayEnd.hidden = true;
        triggerGlitch(380, PAL.cyan);
    }
    function triggerGlitch(ms, color) {
        state.glitchT = Math.max(state.glitchT, ms);
        state.glitchCol = color || PAL.green;
    }

    // ── projection ────────────────────────────────────────────────────
    /** project (wx, wy, wz) to (sx, sy, scale) · returns null if behind cam */
    function project(wx, wy, wz) {
        const dz = wz - state.camera.z;
        if (dz <= NEAR_Z) return null;
        const scale = FOCAL / dz;
        return {
            sx: W / 2 + (wx - state.camera.x) * scale,
            sy: HORIZON - (wy - 0) * scale + (state.camera.eyeY * scale),
            scale,
            dz,
        };
    }

    // ── update ────────────────────────────────────────────────────────
    function update(dt) {
        if (!state.running || state.ended) return;
        state.t += dt;
        const f = dt / 16.67;   // 60fps reference

        const p = state.player;

        // forward / back
        let vz = 0;
        if (state.keys['arrowup']   || state.keys['w']) { vz += WALK_VZ; p.forwardActive = true; }
        else                                            { p.forwardActive = false; }
        if (state.keys['arrowdown'] || state.keys['s']) vz -= BACK_VZ;
        p.z += vz * f;
        if (p.z < -40) p.z = -40;
        if (p.z > WORLD_END_Z) p.z = WORLD_END_Z;

        // strafe (smooth · move toward target lane)
        if (state.keys['arrowleft']  || state.keys['a']) p.x -= STRAFE_VX * f;
        if (state.keys['arrowright'] || state.keys['d']) p.x += STRAFE_VX * f;
        p.x = Math.max(LANE_X[0] - 30, Math.min(LANE_X[2] + 30, p.x));

        // facing animation hint for the back-view sprite (eyes peek left/right)
        if      (state.keys['arrowleft']  || state.keys['a']) p.facing = -1;
        else if (state.keys['arrowright'] || state.keys['d']) p.facing = +1;
        else                                                   p.facing = 0;

        // jump
        p.vy += GRAVITY * f;
        p.y  -= p.vy * f;     // y is "world up", subtract because vy>0 means falling
        if (p.y <= GROUND_Y) {
            p.y = GROUND_Y; p.vy = 0; p.onGround = true;
        }

        // walk animation phase
        if ((vz !== 0 || Math.abs(state.keys['arrowleft'] - state.keys['arrowright']) > 0) && p.onGround) {
            p.walkPhase = (p.walkPhase + 0.16 * f) % 2;
        }

        // camera follows player from behind, slight lookahead
        state.camera.x += ((p.x * 0.4) - state.camera.x) * 0.10 * f;
        state.camera.z += ((p.z - 130) - state.camera.z) * 0.16 * f;

        // zone detection · find current chapter
        let nearestI = 0, nearestDist = Infinity;
        for (let i = 0; i < ZONES.length; i++) {
            const z = ZONES[i];
            const d = Math.abs(p.z - z.z);
            if (d < nearestDist) { nearestDist = d; nearestI = i; }

            // collect loot if player overlaps (proximity in 3D)
            if (!state.collected.has(z.id)) {
                const lx = z.loot.x, ly = z.loot.y, lz = z.loot.z;
                const dx = p.x - lx, dy = (p.y + 30) - ly, dz = p.z - lz;
                const dist = Math.sqrt(dx*dx + dy*dy*0.3 + dz*dz);
                if (dist < 80) {
                    state.collected.add(z.id);
                    state.loot++;
                    triggerGlitch(220, z.color);
                }
            }

            // reveal billboard when within 200 in Z and roughly any x
            if (d < 220) {
                const elapsed = state.revealT.get(z.id) || 0;
                state.revealT.set(z.id, elapsed + dt);
                if (elapsed > 50) state.revealed.add(z.id);
            }
        }

        if (nearestI !== state.zone) {
            state.zone = nearestI;
            state.shimmerT = 380;
            triggerGlitch(160, ZONES[nearestI].color);
        }

        state.glitchT  = Math.max(0, state.glitchT  - dt);
        state.shimmerT = Math.max(0, state.shimmerT - dt);

        // end-state: collected everything AND reached zone 5
        if (state.loot >= ZONES.length && state.zone === ZONES.length - 1 && !state.ended) {
            state.ended = true;
            endTitle.textContent = 'thanks for playing.';
            endSub.textContent   = `you walked through 11 years · ${ZONES.length} chapters · all ${ZONES.length} loot collected.`;
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

    function corrupt(text, rate) {
        if (rate <= 0) return text;
        let out = '';
        for (let i = 0; i < text.length; i++) {
            if (Math.random() < rate) out += GARBAGE[(Math.random() * GARBAGE.length) | 0];
            else                       out += text[i];
        }
        return out;
    }

    function fillTitleRGB(text, x, y, intensity) {
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

    /** draw an ASCII sprite (multi-line string[]) anchored at screen (sx, sy)
     *  with line height scaled. The sprite is rendered with its center at sx
     *  and its BOTTOM at sy (so it "stands" on the ground). */
    function drawSprite(sprite, sx, sy, fontPx, color, rgbSplit = 0) {
        const ch_w = fontPx * 0.6;   // approx monospace char width
        const ln_h = fontPx * 1.05;
        ctx.font = `${fontPx}px ${FONT}`;
        const totalH = sprite.length * ln_h;
        const baseY = sy - totalH + ln_h;

        if (rgbSplit > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = PAL.cyan;
            for (let i = 0; i < sprite.length; i++) {
                const lineW = sprite[i].length * ch_w;
                ctx.fillText(sprite[i], sx - lineW / 2 - rgbSplit, baseY + i * ln_h);
            }
            ctx.fillStyle = PAL.pink;
            for (let i = 0; i < sprite.length; i++) {
                const lineW = sprite[i].length * ch_w;
                ctx.fillText(sprite[i], sx - lineW / 2 + rgbSplit, baseY + i * ln_h);
            }
            ctx.restore();
        }

        ctx.fillStyle = color;
        for (let i = 0; i < sprite.length; i++) {
            const lineW = sprite[i].length * ch_w;
            ctx.fillText(sprite[i], sx - lineW / 2, baseY + i * ln_h);
        }
    }

    // ── render ────────────────────────────────────────────────────────
    function draw() {
        // clear
        ctx.fillStyle = PAL.bg;
        ctx.fillRect(0, 0, W, H);

        // sky tint based on current chapter color (subtle)
        const z = ZONES[state.zone];
        ctx.save();
        ctx.globalAlpha = 0.05;
        const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
        skyGrad.addColorStop(0, z.color);
        skyGrad.addColorStop(1, PAL.bg);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, HORIZON);
        ctx.restore();

        // stars (project from far away, twinkle)
        for (let i = 0; i < state.stars.length; i++) {
            const s = state.stars[i];
            const p = project(s.x, s.y, s.z);
            if (!p) continue;
            const fontPx = Math.max(6, Math.min(14, 14 * p.scale));
            ctx.font = `${fontPx}px ${FONT}`;
            const twinkle = (Math.sin(state.t * 0.003 + s.twinkle) + 1) / 2;
            ctx.fillStyle = twinkle > 0.5 ? PAL.star : PAL.starDim;
            ctx.fillText(s.char, p.sx, p.sy);
        }

        // perspective ground grid · horizontal lines + lane markers
        drawGroundGrid();

        // horizon line
        ctx.fillStyle = PAL.dim;
        ctx.font = `12px ${FONT}`;
        ctx.fillText('─'.repeat(120), 0, HORIZON);

        // ── collect every drawable into a list, sort far→near ──
        const drawables = [];
        for (let i = 0; i < ZONES.length; i++) {
            const zo = ZONES[i];
            for (const b of zo.buildings) {
                drawables.push({ kind: 'bld', x: b.x, y: 0, z: b.z, sprite: b.sprite, color: zo.color });
            }
            if (!state.collected.has(zo.id)) {
                const hover = Math.sin(state.t * 0.005 + i) * 8;
                drawables.push({ kind: 'loot', x: zo.loot.x, y: zo.loot.y + hover, z: zo.loot.z,
                                 sprite: zo.loot.sprite, color: zo.color });
            }
        }
        // sort by Z descending (farthest first)
        drawables.sort((a, b) => b.z - a.z);

        for (const d of drawables) {
            const p = project(d.x, d.y, d.z);
            if (!p) continue;
            const fontPx = Math.max(4, Math.min(56, BASE_FONT_PX * p.scale));
            if (d.kind === 'bld') {
                const isCurrent = (Math.abs(d.z - ZONES[state.zone].z) < 100);
                const color = isCurrent ? d.color : PAL.dim;
                drawSprite(d.sprite, p.sx, p.sy, fontPx, color, 0);
            } else if (d.kind === 'loot') {
                drawSprite([d.sprite], p.sx, p.sy, fontPx * 1.4, d.color, Math.max(1, p.scale * 1.6));
            }
        }

        // player (fixed screen position, back view)
        drawPlayer();

        // chapter title banner (always on top, big, glitched)
        drawTopBanner(z);

        // billboard for the current zone
        if (state.revealed.has(z.id)) drawBillboard(z);

        // chapter-entry shimmer
        if (state.shimmerT > 0) drawShimmer(z.color);

        // full-screen glitch displacement
        if (state.glitchT > 0) drawGlitchOverlay();
    }

    function drawGroundGrid() {
        // horizontal lines at increasing Z, fading with depth
        const Zs = [20, 60, 130, 230, 360, 540, 780, 1100, 1500, 2000, 2600];
        ctx.lineWidth = 1;
        for (const dz of Zs) {
            const wz = state.camera.z + dz;
            const p0 = project(-2000, 0, wz);
            const p1 = project( 2000, 0, wz);
            if (!p0 || !p1) continue;
            const alpha = Math.max(0.05, Math.min(0.55, 1 - dz / 1200));
            ctx.strokeStyle = `rgba(109,255,166,${alpha * 0.55})`;
            ctx.beginPath();
            ctx.moveTo(p0.sx, p0.sy);
            ctx.lineTo(p1.sx, p1.sy);
            ctx.stroke();
        }
        // lane vertical lines: from near to far, scrolling with player
        // they're spaced every 60 world units in x, but visually only ~6 are visible
        const playerZ = state.camera.z;
        for (let i = -6; i <= 6; i++) {
            const lx = i * 60;
            const pNear = project(lx, 0, playerZ + 20);
            const pFar  = project(lx, 0, playerZ + 2400);
            if (!pNear || !pFar) continue;
            ctx.strokeStyle = (i === 0) ? 'rgba(109,255,166,0.35)' : 'rgba(109,255,166,0.18)';
            ctx.beginPath();
            ctx.moveTo(pNear.sx, pNear.sy);
            ctx.lineTo(pFar.sx, pFar.sy);
            ctx.stroke();
        }
        // moving ground tick marks (sense of speed)
        const tickSpacing = 80;
        const playerZi = state.player.z;
        for (let i = 0; i < 12; i++) {
            const wz = state.camera.z + 30 + i * tickSpacing - (playerZi % tickSpacing);
            const p = project(0, 0, wz);
            if (!p) continue;
            const sz = Math.max(2, 12 * p.scale);
            ctx.fillStyle = `rgba(109,255,166,${Math.min(0.6, p.scale * 0.9)})`;
            ctx.fillRect(p.sx - sz / 2, p.sy - 2, sz, 2);
        }
    }

    function drawPlayer() {
        const p = state.player;
        // player anchored near bottom-center of screen
        const groundSy = H - 70;
        // slight bob when walking
        const bob = (Math.abs(p.walkPhase % 1 - 0.5) - 0.25) * 4;
        // jump lifts the sprite up
        const jumpLift = Math.max(0, (GROUND_Y - p.y));     // p.y is 0 on ground
        const baseY = groundSy + bob - jumpLift * 4;
        // strafe shifts sprite horizontally a bit (responsive feel)
        const sx = W / 2 + p.x * 0.2;

        let sprite;
        if (!p.onGround) sprite = P_JUMP;
        else if (p.facing < 0) sprite = P_LEFT;
        else if (p.facing > 0) sprite = P_RIGHT;
        else if (p.forwardActive || state.keys['arrowdown']) {
            sprite = (Math.floor(p.walkPhase * 2) & 1) ? P_WALK_A : P_WALK_B;
        } else {
            sprite = P_STAND;
        }

        const fontPx = 28;
        // shadow underneath
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0.18, 0.4 - jumpLift * 0.03)})`;
        ctx.fillRect(sx - 22, groundSy + 6, 44, 4);
        ctx.restore();
        // RGB-split player when moving fast or airborne
        const drift = !p.onGround ? 2 : (p.forwardActive ? 1 : 0);
        drawSprite(sprite, sx, baseY, fontPx, PAL.green, drift);
    }

    function drawTopBanner(z) {
        // title is fixed at the top, big, with chromatic aberration
        const text = z.label.toUpperCase();
        const fontPx = 22;
        ctx.font = `${fontPx}px ${FONT}`;
        const ch_w = fontPx * 0.6;
        const tw = text.length * ch_w;
        const x = (W - tw) / 2;
        const y = 28;
        const corrupted = corrupt(text, 0.022);
        fillTitleRGB(corrupted, x, y, 2.6);

        // year ticker below
        const periodMap = {
            college:  '2015 — 2019',
            fever104: 'mar — may 2019',
            sakha:    'jul 2019 — sep 2022',
            scripbox: 'sep 2022 — present',
            vwgt:     'nov 16, 2025',
            now:      '2026 — present',
        };
        const period = periodMap[z.id] || '';
        if (period) {
            ctx.font = `14px ${FONT}`;
            ctx.fillStyle = PAL.dim;
            const pw = period.length * 8;
            ctx.fillText(period, (W - pw) / 2, y + 20);
        }

        // chapter dots
        ctx.font = `18px ${FONT}`;
        const ruler = '┄'.repeat(40);
        ctx.fillStyle = 'rgba(109,255,166,0.18)';
        const rulerW = 40 * 10;
        ctx.fillText(ruler, (W - rulerW) / 2, y + 44);
        for (let i = 0; i < ZONES.length; i++) {
            const t = i / (ZONES.length - 1);
            const dx = (W - rulerW) / 2 + t * (rulerW - 10);
            const filled = i <= state.zone;
            ctx.fillStyle = filled ? ZONES[i].color : PAL.dim;
            ctx.fillText(filled ? '●' : '○', dx, y + 44);
        }
    }

    function drawBillboard(z) {
        // billboard floats below the title, wider on bigger screens
        const elapsedSec = (state.revealT.get(z.id) || 0) / 1000;
        const lines = z.billboard;
        const lineH = 16;
        ctx.font = `13px ${FONT}`;
        const maxLineLen = Math.max(...lines.map((l) => l.length));
        const boxW = Math.min(W - 60, maxLineLen * 8 + 28);
        const boxH = lines.length * lineH + 30;
        const boxX = (W - boxW) / 2;
        const boxY = 82;

        ctx.save();
        ctx.fillStyle = 'rgba(10,14,10,0.82)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
        // corner ticks (terminal panel look)
        ctx.fillStyle = z.color;
        ctx.fillText('┌', boxX - 1, boxY + 11);
        ctx.fillText('┐', boxX + boxW - 9, boxY + 11);
        ctx.fillText('└', boxX - 1, boxY + boxH - 2);
        ctx.fillText('┘', boxX + boxW - 9, boxY + boxH - 2);
        ctx.restore();

        // header (chapter badge)
        ctx.fillStyle = z.color;
        ctx.fillText('[' + z.badge + ']', boxX + 10, boxY + 16);

        // body lines (type out)
        for (let i = 0; i < lines.length; i++) {
            const lineDelay = 0.08 + i * 0.28;
            const lineT = Math.max(0, elapsedSec - lineDelay);
            const reveal = Math.min(lines[i].length, Math.floor(lineT * 42));
            const shown = lines[i].slice(0, reveal);
            const corrupted = corrupt(shown, 0.012);
            ctx.fillStyle = PAL.fg;
            ctx.fillText(corrupted, boxX + 10, boxY + 16 + (i + 1) * lineH);
            // cursor on the line currently typing
            if (reveal < lines[i].length && (Math.floor(state.t * 0.005) & 1)) {
                ctx.fillStyle = z.color;
                ctx.fillText('▌', boxX + 10 + reveal * 7.4, boxY + 16 + (i + 1) * lineH);
            }
        }
    }

    function drawGlitchOverlay() {
        const intensity = state.glitchT / 280;
        ctx.save();
        const bands = 12;
        for (let i = 0; i < bands; i++) {
            const bandH = H / bands;
            const offset = (Math.random() - 0.5) * 28 * intensity;
            const y = i * bandH;
            ctx.drawImage(canvas, 0, y, W, bandH, offset, y, W, bandH);
        }
        ctx.fillStyle = state.glitchCol;
        ctx.globalAlpha = 0.06 * intensity;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    function drawShimmer(color) {
        const intensity = state.shimmerT / 380;
        const y = HORIZON - 1 + (1 - intensity) * 10;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.18 * intensity;
        ctx.fillRect(0, y, W, 2);
        ctx.globalAlpha = 0.06 * intensity;
        ctx.fillRect(0, y - 18, W, 1);
        ctx.restore();
    }

    // ── main loop ─────────────────────────────────────────────────────
    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min(48, now - lastT);
        lastT = now;
        state.fpsAccum += dt; state.fpsFrames++;
        if (state.fpsAccum > 500) {
            state.fps = (state.fpsFrames * 1000) / state.fpsAccum;
            state.fpsAccum = 0; state.fpsFrames = 0;
        }
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }

    draw();
    hudChapter.textContent = 'ch.1/5 · press start';
    hudLoot.textContent    = '0 / 5';
    requestAnimationFrame(frame);

    // expose for debugging
    window.__journey = { state, ZONES, restart, triggerGlitch, project };
})();
