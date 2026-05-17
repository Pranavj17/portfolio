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

    // base speeds (walking). Vehicles multiply these.
    const WALK_VZ = 1.8;          // forward speed (world units per 16.67ms)
    const BACK_VZ = 1.0;          // back speed
    const STRAFE_VX = 2.4;        // strafe speed
    // vehicle speed multipliers · upgrade as the story progresses
    const VEHICLE_SPEED = {
        walk:  1.00,              // initial · walking with backpack
        cycle: 1.30,              // college + fever 104 era · bicycle
        alto:  1.60,              // sakha + scripbox era · maruti alto
        vw:    2.20,              // post-nov 2025 · vw virtus GT
    };
    // z-thresholds for vehicle transitions
    const CYCLE_START_Z = 180;    // hop on bicycle right after the start area
    const ALTO_START_Z  = 800;    // mount Alto as you exit the Fever 104 zone
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

    // ── per-chapter atmosphere · sky · ground texture · drift particle ──
    // Each zone gets its own "place" so the player feels like they walked
    // somewhere, not just past a different building. Sky is a 2-stop gradient
    // from horizon-up. Drift particles float across the scene with a slight
    // parallax. Ground texture is the decoration drawn on the floor row.
    const ATMOSPHERE = {
        college: {
            skyTop:    '#0a0e0a',  // pre-dawn campus
            skyHorizon:'#1a2418',
            ambient:   '#6dffa6',
            driftChars: ['✎', '∫', '∑', '∂', '·'],     // pencils + calculus
            driftRate:  0.55,
            ground:    ['┄', '·', ' ', ' '],            // dashed campus path
        },
        fever104: {
            skyTop:    '#0e0808',  // city night
            skyHorizon:'#2a0a18',
            ambient:   '#ff3b8a',
            driftChars: [')', '⌒', '~', '·'],          // sound waves
            driftRate:  0.85,
            ground:    ['═', ' ', '─', ' '],            // city street paint
        },
        sakha: {
            skyTop:    '#08080e',  // commute morning
            skyHorizon:'#181a28',
            ambient:   '#b48cff',
            driftChars: ['/', '*', '%', '{', '}', '·'], // code crumbs
            driftRate:  0.65,
            ground:    ['─', ' ', ' ', ' '],            // highway lane
        },
        scripbox: {
            skyTop:    '#070b10',  // overcast tech office
            skyHorizon:'#0e1828',
            ambient:   '#5ad8ff',
            driftChars: ['[', ']', '✦', '·', '∴'],     // mcp brackets
            driftRate:  0.7,
            ground:    ['┼', ' ', '·', ' '],            // enterprise grid mesh
        },
        vwgt: {
            skyTop:    '#0d0707',  // headlit dusk
            skyHorizon:'#3a0a0a',
            ambient:   '#ff5e5e',
            driftChars: ['•', '·', '⌁', '/'],          // exhaust / speed flecks
            driftRate:  1.05,
            ground:    ['═', '═', ' ', '═'],            // checkered race hint
        },
        now: {
            skyTop:    '#0e0e08',  // morning light
            skyHorizon:'#28200e',
            ambient:   '#ffd47a',
            driftChars: ['★', '·', '✦', '✧'],          // celebratory sparkle
            driftRate:  0.55,
            ground:    ['─', '·', '─', ' '],            // clean horizon road
        },
    };

    // pre-generate a pool of drift particles · each holds (x, y, z, char, layer)
    // and gets re-randomised when it falls off-screen so we get a continuous stream
    const DRIFT_POOL_SIZE = 36;
    const driftPool = [];
    for (let i = 0; i < DRIFT_POOL_SIZE; i++) {
        driftPool.push({
            x: (Math.random() - 0.5) * 480,
            y: 60 + Math.random() * 180,
            z: Math.random() * 1200,
            wob: Math.random() * Math.PI * 2,     // wobble seed
            speed: 0.5 + Math.random() * 0.6,     // forward drift speed (z-direction)
            char: '·',                            // assigned per-frame from current zone
        });
    }

    // ── Web Audio sound effects · all synth, no asset loading ────────────
    // AudioContext is lazy-init'd on first user gesture (browsers block
    // unrequested audio). Each sfx is a few oscillators + gain envelopes;
    // total audio code ≈ 60 LOC, zero deps.
    let audioCtx = null;
    let audioMuted = false;
    function ensureAudio() {
        if (audioCtx) return audioCtx;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AC();
        } catch (e) { audioCtx = null; }
        return audioCtx;
    }
    /** single oscillator blip with decay envelope */
    function blip(freq, dur, type, gain) {
        if (audioMuted) return;
        const ac = ensureAudio();
        if (!ac) return;
        const t0 = ac.currentTime;
        const osc = ac.createOscillator();
        const env = ac.createGain();
        osc.type = type || 'triangle';
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t0 + dur);
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(env);
        env.connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    }
    /** multi-freq chord (parallel oscillators) for collect / vehicle change */
    function chord(freqs, dur, type, gain) {
        if (!Array.isArray(freqs)) return;
        for (const f of freqs) blip(f, dur, type || 'sine', gain || 0.06);
    }
    /** noise burst (random samples → buffer) for glitch / impact */
    function noise(dur, gain) {
        if (audioMuted) return;
        const ac = ensureAudio();
        if (!ac) return;
        const t0 = ac.currentTime;
        const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ac.createBufferSource();
        const env = ac.createGain();
        src.buffer = buf;
        env.gain.setValueAtTime(gain || 0.08, t0);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(env);
        env.connect(ac.destination);
        src.start(t0);
    }
    /** named sound effects · called at game events */
    function sfx(name) {
        switch (name) {
            case 'footstep': blip(220, 0.04, 'sine',     0.04); break;
            case 'jump':     blip(330, 0.10, 'triangle', 0.12); blip(660, 0.08, 'triangle', 0.06); break;
            case 'land':     blip(160, 0.06, 'sine',     0.07); break;
            case 'collect':  chord([523.25, 659.25, 783.99, 1046.5], 0.32, 'sine', 0.06); break;
            case 'vehicle':  chord([261.63, 329.63, 392, 523.25], 0.55, 'triangle', 0.05); break;
            case 'chapter':  chord([392, 493.88, 587.33], 0.28, 'sine', 0.05); break;
            case 'glitch':   noise(0.18, 0.08); blip(80, 0.16, 'sawtooth', 0.06); break;
            case 'achieve':  chord([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.6, 'sine', 0.04); break;
        }
    }

    // ── motion-particle ring buffer · dust/exhaust spawned behind the player ──
    // sx/sy are SCREEN coords (relative to canvas). The pool is a circular buffer:
    // when full, new particles overwrite the oldest. Each holds an `age` and a
    // `life`; age >= life ⇒ slot is free.
    const MOTION_POOL_SIZE = 28;
    const motionPool = [];
    for (let i = 0; i < MOTION_POOL_SIZE; i++) {
        motionPool.push({ sx: 0, sy: 0, vx: 0, vy: 0, age: 9999, life: 1, char: '·', color: '#fff' });
    }
    let motionHead = 0;
    function emitMotionParticle(sx, sy, vx, vy, life, char, color) {
        const p = motionPool[motionHead];
        p.sx = sx; p.sy = sy; p.vx = vx; p.vy = vy;
        p.age = 0; p.life = life; p.char = char; p.color = color;
        motionHead = (motionHead + 1) % MOTION_POOL_SIZE;
    }

    // ── sprites ───────────────────────────────────────────────────────
    // player · back view · stick figure with a backpack on the right shoulder.
    // The ▢ has carried since college days. Walk/jump variants drive the
    // animation. Strafing peeks the head to the side.
    const P_STAND  = [' o ', '/|\\▢', '/ \\'];
    const P_WALK_A = [' o ', '/|\\▢', '/ |'];
    const P_WALK_B = [' o ', '/|\\▢', '| \\'];
    const P_JUMP   = [' o ', '\\|/▢', '/ \\'];
    const P_LEFT   = ['<o ', '/|\\▢', '/ \\'];
    const P_RIGHT  = [' o>', '/|\\▢', '/ \\'];

    // Bicycle · third-person back view · the college / intern-era ride.
    // Two-frame wheel animation (●═● / ○═○) sells motion.
    const V_CYCLE_A = [
        '  o',
        ' /|\\▢',
        '  ╧',
        ' ●═●',
    ];
    const V_CYCLE_B = [
        '  o',
        ' /|\\▢',
        '  ╧',
        ' ○═○',
    ];

    // Maruti Alto · third-person back view · the daily-driver from the Sakha
    // years. Small hatchback silhouette. Driver head pokes out the top.
    const V_ALTO_A = [
        '  o',           // head
        ' ╔═╧═╗',        // roof + neck
        ' ║▓▓▓║',        // rear window
        '╔╩═══╩╗',       // body shoulder
        '║ ALTO║',
        '╚○═══○╝',       // wheels (frame A · wheels visible)
    ];
    const V_ALTO_B = [
        '  o',
        ' ╔═╧═╗',
        ' ║▓▓▓║',
        '╔╩═══╩╗',
        '║ ALTO║',
        '╚●═══●╝',       // frame B · wheels filled (spin animation)
    ];

    // Volkswagen Virtus GT · third-person back view · the upgrade after nov 2025.
    // Wider, lower, longer than the Alto. GT badge visible.
    const V_VW_A = [
        '   o',
        '  ╔═╧═╗',
        '  ║▓▓▓║',
        ' ╔╩═══╩╗',
        ' ║ VW ·║',
        ' ║  GT ║',
        '╔╩═════╩╗',
        '║VIRTUS │',
        '╚═○═══○═╝',
    ];
    const V_VW_B = [
        '   o',
        '  ╔═╧═╗',
        '  ║▓▓▓║',
        ' ╔╩═══╩╗',
        ' ║ VW ·║',
        ' ║  GT ║',
        '╔╩═════╩╗',
        '║VIRTUS │',
        '╚═●═══●═╝',
    ];

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
            vehicle: 'walk',                 // 'walk' | 'cycle' | 'alto' | 'vw'
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
        kbHintAlpha: 1,
        kbHintSeen:  false,
        lastEmitT:   0,
        // screen shake · mag drops to 0 over shakeT ms, then resets
        shakeMag:    0,
        shakeT:      0,
        // achievement popup queue · each {title, sub, age, life}
        achievements: new Set(),
        achievementQueue: [],
        // session timer (for the HUD time readout · feels like a real game)
        elapsedMs:   0,
    };

    /** trigger a brief camera shake · used on impacts. magnitude in px,
     *  duration in ms. Stronger requests override weaker ones. */
    function triggerShake(mag, ms) {
        if (mag > state.shakeMag) state.shakeMag = mag;
        if (ms  > state.shakeT)   state.shakeT   = ms;
    }

    /** spawn a radial burst of motion particles · used on loot pickup */
    function collectBurst(sx, sy, color) {
        const N = 14;
        for (let i = 0; i < N; i++) {
            const a = (Math.PI * 2) * (i / N);
            const s = 1.4 + Math.random() * 1.6;
            emitMotionParticle(sx, sy, Math.cos(a) * s, Math.sin(a) * s, 620, '✦', color + 'dd');
        }
    }

    // ── achievements · triggered on state changes, queued for popup ──
    const ACHIEVEMENTS = [
        { id: 'first-steps',  test: (s) => s.player.z > 50,                                    title: 'FIRST STEPS',        sub: 'walking with that backpack' },
        { id: 'on-cycle',     test: (s) => s.player.vehicle === 'cycle',                        title: 'ON TWO WHEELS',      sub: 'college bicycle unlocked' },
        { id: 'fever-104',    test: (s) => s.collected.has('fever104'),                         title: 'ON AIR · 104 FM',    sub: '3-month producer stint' },
        { id: 'first-job',    test: (s) => s.player.vehicle === 'alto',                         title: 'FIRST JOB · ALTO',   sub: 'maruti alto · jul 2019' },
        { id: 'mcp-catalog',  test: (s) => s.collected.has('scripbox'),                         title: 'ANTHROPIC CATALOG',  sub: 'mcp-server-graylog · PR #2913' },
        { id: 'got-the-gt',   test: (s) => s.player.vehicle === 'vw',                           title: 'GOT THE GT',         sub: 'vw virtus gt · nov 16, 2025' },
        { id: 'journey-end',  test: (s) => s.loot >= 6 && s.zone === 5,                          title: 'JOURNEY COMPLETE',   sub: '6 chapters · 11 years' },
    ];
    function checkAchievements() {
        for (const a of ACHIEVEMENTS) {
            if (state.achievements.has(a.id)) continue;
            if (a.test(state)) {
                state.achievements.add(a.id);
                state.achievementQueue.push({ title: a.title, sub: a.sub, age: 0, life: 3200 });
                sfx('achieve');
                triggerShake(2, 200);
            }
        }
    }

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
        // first time the user touches a direction key · hide the hint
        if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)) {
            state.kbHintSeen = true;
        }
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
            state.kbHintSeen = true;
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
            sfx('jump');
        }
    }
    function startGame() {
        // smoothly dismiss the overlay rather than hiding instantly · gives
        // the staggered reveal animations time to land + fades the splash out.
        if (overlayStart && !overlayStart.hidden) {
            overlayStart.classList.add('is-dismissing');
            setTimeout(() => { if (overlayStart) overlayStart.hidden = true; }, 720);
        }
        state.running = true;
        state.ended   = false;
        // on touch devices, skip the keyboard-hint overlay · the player will
        // auto-walk forward, so showing "tap ▲" would be wrong + confusing.
        const isTouchDevice = (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        if (isTouchDevice) {
            state.kbHintSeen  = true;
            state.kbHintAlpha = 0;
        }
    }

    // Auto-start timer · the splash overlay holds for ~3s so visitors can
    // absorb the title + chapter roster, then dismisses on its own. No
    // INSERT COIN button required.
    setTimeout(startGame, 3000);
    function restart() {
        const p = state.player;
        p.x = 0; p.y = 0; p.z = PLAYER_BASE_Z; p.vy = 0; p.lane = 1;
        p.onGround = true; p.walkPhase = 0; p.facing = 0;
        p.vehicle = 'walk';
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

    // Z key (or its touch button) plays the glitch sound too · wrap the
    // existing keydown handler's glitch trigger to also fire sfx.
    const _origTriggerGlitch = triggerGlitch;
    window.addEventListener('keydown', (e) => {
        if (e.key && e.key.toLowerCase() === 'z') sfx('glitch');
    });

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
        const speedMult = VEHICLE_SPEED[p.vehicle] || 1.0;

        // forward / back · speed scales with current vehicle
        // On touch devices, the player AUTO-WALKS forward (no d-pad to hold).
        // Desktop keyboard users still get full manual control.
        let vz = 0;
        const isTouchDevice = (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        const wantsForward = state.keys['arrowup'] || state.keys['w'] || isTouchDevice;
        if (wantsForward)                              { vz += WALK_VZ; p.forwardActive = true; }
        else                                            { p.forwardActive = false; }
        if (state.keys['arrowdown'] || state.keys['s']) vz -= BACK_VZ;
        p.z += vz * f * speedMult;
        if (p.z < -40) p.z = -40;
        if (p.z > WORLD_END_Z) p.z = WORLD_END_Z;

        // strafe · cars also handle quicker than legs
        if (state.keys['arrowleft']  || state.keys['a']) p.x -= STRAFE_VX * f * speedMult;
        if (state.keys['arrowright'] || state.keys['d']) p.x += STRAFE_VX * f * speedMult;
        p.x = Math.max(LANE_X[0] - 30, Math.min(LANE_X[2] + 30, p.x));

        // vehicle-state transition · drives sprite + speed.
        //   - VW Virtus once you've collected the keys (chapter 5 loot)
        //   - Alto from z=800 onward (entering Sakha era)
        //   - Bicycle from z=180 onward (college + fever 104 era · the
        //     intermediate engineering-student ride)
        //   - Walking only in the start area before the bicycle kicks in
        const prevVehicle = p.vehicle;
        if      (state.collected.has('vwgt'))  p.vehicle = 'vw';
        else if (p.z >= ALTO_START_Z)          p.vehicle = 'alto';
        else if (p.z >= CYCLE_START_Z)         p.vehicle = 'cycle';
        else                                    p.vehicle = 'walk';
        if (prevVehicle !== p.vehicle) {
            // fire a small glitch + shimmer on vehicle change · feels like a level-up
            const upgradeColor = {
                vw:    PAL.red,
                alto:  PAL.gold,
                cycle: PAL.cyan,
                walk:  PAL.green,
            }[p.vehicle];
            triggerGlitch(220, upgradeColor);
            state.shimmerT = 320;
            sfx('vehicle');
            triggerShake(3.5, 260);
        }

        // facing animation hint for the back-view sprite (eyes peek left/right)
        if      (state.keys['arrowleft']  || state.keys['a']) p.facing = -1;
        else if (state.keys['arrowright'] || state.keys['d']) p.facing = +1;
        else                                                   p.facing = 0;

        // jump · detect airborne → grounded transition for landing sfx + shake
        const wasAirborne = !p.onGround;
        p.vy += GRAVITY * f;
        p.y  -= p.vy * f;     // y is "world up", subtract because vy>0 means falling
        if (p.y <= GROUND_Y) {
            p.y = GROUND_Y; p.vy = 0; p.onGround = true;
            if (wasAirborne) { sfx('land'); triggerShake(1.6, 120); }
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
                    sfx('collect');
                    triggerShake(4, 260);
                    // radial particle burst at player's screen position
                    const playerSx = W / 2 + p.x * 0.2;
                    const playerSy = H - 70 - 40;   // upper-body height
                    collectBurst(playerSx, playerSy, z.color);
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
            sfx('chapter');
            triggerShake(2.5, 220);
        }

        state.glitchT  = Math.max(0, state.glitchT  - dt);
        state.shimmerT = Math.max(0, state.shimmerT - dt);
        state.elapsedMs += dt;

        // shake decay · linear taper over remaining duration
        if (state.shakeT > 0) {
            state.shakeT = Math.max(0, state.shakeT - dt);
            if (state.shakeT === 0) state.shakeMag = 0;
        }

        // age achievement popups; drop expired ones
        for (let i = 0; i < state.achievementQueue.length; i++) state.achievementQueue[i].age += dt;
        state.achievementQueue = state.achievementQueue.filter((a) => a.age < a.life);

        // check for new achievements based on current state
        checkAchievements();

        // footstep tick · on every walk-phase half-cycle change (when walking)
        if (p.vehicle === 'walk' && p.onGround && p.forwardActive) {
            const phase = Math.floor(p.walkPhase * 2);
            if (phase !== (p._lastFoot | 0)) {
                p._lastFoot = phase;
                sfx('footstep');
            }
        }

        // fade the keyboard hint after first input
        if (state.kbHintSeen) state.kbHintAlpha = Math.max(0, state.kbHintAlpha - dt * 0.0025);

        // emit motion particles · dust if walking/cycling, exhaust if driving
        // throttle to ~30Hz so we don't blow the pool
        const movingForward = state.keys['arrowup'] || state.keys['w'];
        const movingBack    = state.keys['arrowdown'] || state.keys['s'];
        const movingSide    = state.keys['arrowleft'] || state.keys['a'] || state.keys['arrowright'] || state.keys['d'];
        const moving = movingForward || movingBack || movingSide;
        if (moving && state.t - state.lastEmitT > 34) {
            state.lastEmitT = state.t;
            // screen position of the player (matches drawPlayer)
            const groundSy = H - 70;
            const playerSx = W / 2 + p.x * 0.2;
            // exhaust direction: BEHIND the player. Forward motion = puffs go down-screen.
            const dirY = movingForward ? 1 : (movingBack ? -1 : 0);
            const dirX = movingSide ? (state.keys['arrowleft'] || state.keys['a'] ? 1 : -1) : 0;
            // type/colour by vehicle
            const isCar = (p.vehicle === 'alto' || p.vehicle === 'vw');
            const isBike = p.vehicle === 'cycle';
            if (isCar) {
                // exhaust · two puffs from "tailpipes" (left and right of car)
                const ex = (p.vehicle === 'vw') ? '◌' : '·';
                const ec = (p.vehicle === 'vw') ? PAL.red : PAL.gold;
                emitMotionParticle(playerSx - 16, groundSy + 8, dirX * 1.2 - 0.3, dirY * 2.2 + Math.random() * 0.6, 420, ex, ec + 'cc');
                emitMotionParticle(playerSx + 16, groundSy + 8, dirX * 1.2 + 0.3, dirY * 2.2 + Math.random() * 0.6, 420, ex, ec + 'cc');
            } else if (isBike) {
                // bicycle · light dust under wheels
                emitMotionParticle(playerSx + (Math.random()-0.5)*16, groundSy + 14, dirX * 0.8, dirY * 1.4 + Math.random() * 0.5, 300, '·', PAL.cyan + 'aa');
            } else {
                // walking · footstep puffs
                const side = (Math.floor(p.walkPhase * 2) & 1) ? -8 : 8;
                emitMotionParticle(playerSx + side, groundSy + 16, dirX * 0.5, dirY * 1.0 + Math.random() * 0.4, 360, '.', PAL.fg + 'aa');
            }
        }

        // update all live motion particles
        for (let i = 0; i < motionPool.length; i++) {
            const mp = motionPool[i];
            if (mp.age >= mp.life) continue;
            mp.age += dt;
            mp.sx += mp.vx * f;
            mp.sy += mp.vy * f;
        }

        // end-state: collected everything AND reached zone 5
        if (state.loot >= ZONES.length && state.zone === ZONES.length - 1 && !state.ended) {
            state.ended = true;
            // leave end-title as the HTML default ("GAME COMPLETE") — it fits
            // the VT323 width without wrapping. JS only updates the dynamic
            // bits: the subhead and the loot cell. Stat cells render their
            // values directly from state.loot / ZONES.length below.
            endSub.textContent  = `you walked through 11 years · ${ZONES.length} chapters · all ${ZONES.length} loot collected.`;
            endLoot.textContent = `${String(state.loot).padStart(2,'0')} / ${String(ZONES.length).padStart(2,'0')}`;
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
        const z = ZONES[state.zone];
        const atm = ATMOSPHERE[z.id] || ATMOSPHERE.college;

        // begin a screen-shake-transformed frame · random jitter per axis
        const shakeAmp = state.shakeMag * (state.shakeT > 0 ? state.shakeT / 280 : 0);
        const shakeX = shakeAmp ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
        const shakeY = shakeAmp ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
        ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

        // per-chapter sky atmosphere · two-stop gradient, top-down
        const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
        skyGrad.addColorStop(0, atm.skyTop);
        skyGrad.addColorStop(1, atm.skyHorizon);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, HORIZON);
        // ground side fades back to base bg below horizon
        const grdGrad = ctx.createLinearGradient(0, HORIZON, 0, H);
        grdGrad.addColorStop(0, atm.skyHorizon);
        grdGrad.addColorStop(0.45, PAL.bg);
        grdGrad.addColorStop(1, PAL.bg);
        ctx.fillStyle = grdGrad;
        ctx.fillRect(0, HORIZON, W, H - HORIZON);

        // stars (still visible but dimmer at brighter chapters)
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

        // drift particles · context-appropriate symbols floating across scene
        drawDriftParticles(atm);

        // perspective ground grid · horizontal lines + lane markers
        drawGroundGrid();

        // per-chapter ground decoration (replaces the old generic tick marks)
        drawGroundTexture(atm);

        // horizon line — tinted to match current chapter ambient
        ctx.fillStyle = atm.ambient + '44';   // ~26% alpha hex suffix
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

        // motion particles · drawn BEHIND the player so they look like a wake
        drawMotionParticles();

        // player (fixed screen position, back view)
        drawPlayer();

        // first-play keyboard hint near the player · fades after first input
        if (state.kbHintAlpha > 0.02) drawKbHint();

        // chapter title banner (always on top, big, glitched)
        drawTopBanner(z);

        // billboard for the current zone
        if (state.revealed.has(z.id)) drawBillboard(z);

        // chapter-entry shimmer
        if (state.shimmerT > 0) drawShimmer(z.color);

        // in-canvas HUD chrome · corner brackets + vehicle pill + speed bar
        drawCanvasChrome(z);

        // full-screen glitch displacement (drawn last so it affects everything)
        if (state.glitchT > 0) drawGlitchOverlay();

        // achievement popups · drawn OUTSIDE the shake transform so they
        // stay stable above a shaking world (system-UI convention)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (state.achievementQueue.length > 0) drawAchievements();
        // (session timer removed · "▶ 00:01" readout was terminal-debug aesthetic)
    }

    function drawAchievements() {
        const cardW = 256;
        const cardH = 52;
        const stackX = W - cardW - 16;
        let stackY = 88;
        for (let i = 0; i < state.achievementQueue.length; i++) {
            const a = state.achievementQueue[i];
            const t = a.age / a.life;
            // animate: 0–0.08 slide-in from right, 0.08–0.88 hold, 0.88–1.0 slide-out
            let dx = 0, alpha = 1;
            if (t < 0.08)       { dx = (1 - t / 0.08) * (cardW + 30); alpha = t / 0.08; }
            else if (t > 0.88)  { dx = ((t - 0.88) / 0.12) * (cardW + 30); alpha = 1 - (t - 0.88) / 0.12; }
            ctx.save();
            ctx.globalAlpha = alpha;
            // card bg with vehicle-gold accent for achievement
            const grad = ctx.createLinearGradient(stackX, stackY, stackX, stackY + cardH);
            grad.addColorStop(0, 'rgba(20,16,8,0.94)');
            grad.addColorStop(1, 'rgba(10,8,4,0.96)');
            ctx.fillStyle = grad;
            ctx.fillRect(stackX + dx, stackY, cardW, cardH);
            ctx.strokeStyle = PAL.gold;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(stackX + dx + 0.5, stackY + 0.5, cardW - 1, cardH - 1);
            // corner brackets
            ctx.fillStyle = PAL.gold;
            ctx.font = `11px ${FONT}`;
            ctx.fillText('┌', stackX + dx + 2,         stackY + 12);
            ctx.fillText('┐', stackX + dx + cardW - 9, stackY + 12);
            ctx.fillText('└', stackX + dx + 2,         stackY + cardH - 2);
            ctx.fillText('┘', stackX + dx + cardW - 9, stackY + cardH - 2);
            // ✦ sparkle icon
            ctx.fillStyle = PAL.gold;
            ctx.font = `28px ${FONT}`;
            ctx.fillText('✦', stackX + dx + 14, stackY + 34);
            // tag + title + sub
            ctx.fillStyle = PAL.gold;
            ctx.font = `9px ${FONT}`;
            ctx.fillText('▸ ACHIEVEMENT UNLOCKED', stackX + dx + 56, stackY + 14);
            ctx.fillStyle = PAL.fgBright;
            ctx.font = `16px 'VT323', ${FONT}`;
            ctx.fillText(a.title, stackX + dx + 56, stackY + 30);
            ctx.fillStyle = 'rgba(200,211,191,0.7)';
            ctx.font = `10px ${FONT}`;
            ctx.fillText(a.sub, stackX + dx + 56, stackY + 44);
            ctx.restore();
            stackY += cardH + 8;
        }
    }

    function drawHudClock() {
        // session timer top-right · feels like a real game's run timer
        const mm = Math.floor(state.elapsedMs / 60000);
        const ss = Math.floor((state.elapsedMs % 60000) / 1000);
        const txt = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        ctx.font = `11px 'VT323', ${FONT}`;
        ctx.fillStyle = 'rgba(200,211,191,0.55)';
        ctx.fillText('▶ ' + txt, W - 64, 18);
    }

    /** Consolidated HUD chrome · ONE top progress bar (with chapter ticks
     *  + current position marker + loot indicators), ONE bottom vehicle
     *  card (with icon, name, period, and segmented speed bar). No corner
     *  text. No distance readout. Everything is visual + minimal. */
    function drawCanvasChrome(z) {
        const p = state.player;
        const zones = ZONES;
        const atm = ATMOSPHERE[z.id] || ATMOSPHERE.college;

        // ── top: world-progress strip ────────────────────────────────
        // Horizontal bar showing player position across the whole world,
        // chapter markers + filled section before the player + collected
        // dots above each chapter marker.
        const stripY = 74;
        const stripPadX = 80;
        const stripW = W - 2 * stripPadX;
        const stripH = 4;

        // background rail
        ctx.fillStyle = 'rgba(200,211,191,0.10)';
        ctx.fillRect(stripPadX, stripY, stripW, stripH);

        // filled-to-current
        const totalLen = zones[zones.length - 1].z - zones[0].z + 400;
        const playerPct = Math.max(0, Math.min(1, (p.z - zones[0].z + 200) / totalLen));
        ctx.fillStyle = z.color + 'cc';
        ctx.fillRect(stripPadX, stripY, stripW * playerPct, stripH);

        // chapter markers · vertical ticks + filled dot if collected
        for (let i = 0; i < zones.length; i++) {
            const zn = zones[i];
            const t = (zn.z - zones[0].z + 200) / totalLen;
            const x = stripPadX + t * stripW;
            const collected = state.collected.has(zn.id);
            const current = (i === state.zone);

            // tick
            ctx.fillStyle = (i <= state.zone) ? zn.color : 'rgba(200,211,191,0.25)';
            ctx.fillRect(x - 1, stripY - 4, 2, stripH + 8);

            // collected indicator (filled diamond above)
            if (collected) {
                ctx.fillStyle = zn.color;
                ctx.font = `12px ${FONT}`;
                ctx.fillText('◆', x - 4, stripY - 8);
            } else if (current) {
                // current chapter pulses
                const pulse = (Math.sin(state.t * 0.005) + 1) / 2;
                ctx.fillStyle = `rgba(232,240,221,${0.4 + 0.5 * pulse})`;
                ctx.font = `12px ${FONT}`;
                ctx.fillText('◇', x - 4, stripY - 8);
            }
        }

        // player position marker (bright vertical caret)
        const playerX = stripPadX + stripW * playerPct;
        ctx.fillStyle = PAL.fgBright;
        ctx.font = `14px ${FONT}`;
        ctx.fillText('▼', playerX - 5, stripY - 4);

        // (terminal-style "// route" + "loot N/6" captions removed · the
        //  strip visually shows progress; text labels were debug aesthetic)

        // ── bottom: vehicle card (single focal element) ──────────────
        const vehicleInfo = {
            walk:  { label: 'ON FOOT',          sub: 'with backpack',     color: PAL.green,  icon: '▢' },
            cycle: { label: 'BICYCLE',          sub: 'college days',      color: PAL.cyan,   icon: '◯─◯' },
            alto:  { label: 'MARUTI ALTO',      sub: 'commute · 2019–25', color: PAL.gold,   icon: '◖═◗' },
            vw:    { label: 'VW VIRTUS GT',     sub: '1.5 TSI · turbo',   color: PAL.red,    icon: '◣◤◢◥' },
        }[p.vehicle] || { label: 'ON FOOT', sub: '', color: PAL.green, icon: '▢' };

        const cardW = 280;
        const cardH = 48;
        const cardX = (W - cardW) / 2;
        // sit well above the bottom so the mobile touch d-pad/JUMP buttons
        // (which overlay the canvas's bottom ~100px) don't collide with us.
        const cardY = H - cardH - 96;

        // card background · gradient + border in vehicle color
        ctx.save();
        const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
        cardGrad.addColorStop(0, 'rgba(20,28,22,0.82)');
        cardGrad.addColorStop(1, 'rgba(8,12,10,0.92)');
        ctx.fillStyle = cardGrad;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = vehicleInfo.color + 'aa';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);

        // inset bracket marks at corners (decorative)
        ctx.fillStyle = vehicleInfo.color;
        ctx.font = `11px ${FONT}`;
        ctx.fillText('┌',  cardX + 2,           cardY + 11);
        ctx.fillText('┐',  cardX + cardW - 10,  cardY + 11);
        ctx.fillText('└',  cardX + 2,           cardY + cardH - 2);
        ctx.fillText('┘',  cardX + cardW - 10,  cardY + cardH - 2);
        ctx.restore();

        // vehicle icon (left side of card · large)
        ctx.fillStyle = vehicleInfo.color;
        ctx.font = `20px ${FONT}`;
        ctx.fillText(vehicleInfo.icon, cardX + 14, cardY + 22);

        // vehicle label + sublabel
        ctx.fillStyle = PAL.fgBright;
        ctx.font = `15px 'VT323', ${FONT}`;
        ctx.fillText(vehicleInfo.label, cardX + 92, cardY + 20);
        ctx.fillStyle = 'rgba(200,211,191,0.55)';
        ctx.font = `10px ${FONT}`;
        ctx.fillText(vehicleInfo.sub, cardX + 92, cardY + 32);

        // segmented speed bar at bottom of card · 8 cells, fills with motion
        const moving = (state.keys['arrowup'] || state.keys['w']) ? 1
                     : (state.keys['arrowdown'] || state.keys['s']) ? 0.5 : 0;
        const speedMult = VEHICLE_SPEED[p.vehicle] || 1;
        const speedFill = moving * speedMult / 2.2;
        const cells = 12;
        const cellW = 12;
        const cellGap = 2;
        const barX = cardX + 92;
        const barY = cardY + cardH - 8;
        for (let i = 0; i < cells; i++) {
            const filled = i / cells < speedFill;
            ctx.fillStyle = filled ? vehicleInfo.color + 'dd' : 'rgba(200,211,191,0.12)';
            ctx.fillRect(barX + i * (cellW + cellGap), barY, cellW, 3);
        }

        // tiny SPEED label
        ctx.fillStyle = 'rgba(200,211,191,0.4)';
        ctx.font = `9px ${FONT}`;
        ctx.fillText('SPEED', cardX + cardW - 50, barY + 3);

        // chapter pill: just the zone name in display type — no "CH.N · " prefix
        // (terminal-breadcrumb style). Now reads as a place-name not a path.
        const chapLabel = z.id.toUpperCase();
        const pillX = cardX + 4;
        const pillY = cardY - 18;
        ctx.fillStyle = z.color;
        ctx.font = `14px 'VT323', ${FONT}`;
        ctx.fillText(chapLabel, pillX, pillY + 12);
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
        // generic ground tick marks removed · per-chapter ground texture
        // (drawGroundTexture) replaces them with context-appropriate glyphs.
    }

    /** per-chapter ground texture · chars from ATMOSPHERE[zone].ground
     *  scroll toward the camera, giving the road its own character. */
    function drawGroundTexture(atm) {
        const tickSpacing = 90;
        const playerZi = state.player.z;
        for (let i = 0; i < 14; i++) {
            const wz = state.camera.z + 30 + i * tickSpacing - (playerZi % tickSpacing);
            const p = project(0, 0, wz);
            if (!p) continue;
            const ch = atm.ground[i % atm.ground.length];
            if (ch === ' ') continue;
            const fontPx = Math.max(6, Math.min(34, 22 * p.scale));
            ctx.font = `${fontPx}px ${FONT}`;
            const a = Math.min(0.65, p.scale * 0.9);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = atm.ambient;
            // center the char on the road
            const cw = fontPx * 0.6;
            ctx.fillText(ch, p.sx - cw / 2, p.sy);
            ctx.restore();
        }
    }

    /** drift particles · float across the scene with light wobble.
     *  When a particle gets too close to the camera, respawn it far ahead
     *  so we always have a continuous stream of atmospheric debris. */
    function drawDriftParticles(atm) {
        for (let i = 0; i < driftPool.length; i++) {
            const d = driftPool[i];
            // respawn if too close to camera
            if (d.z - state.camera.z < NEAR_Z + 5) {
                d.z = state.camera.z + 1100 + Math.random() * 400;
                d.x = (Math.random() - 0.5) * 480;
                d.y = 60 + Math.random() * 180;
                d.char = atm.driftChars[(Math.random() * atm.driftChars.length) | 0];
                continue;
            }
            // first-time char assignment
            if (!d.char || d.char === '·') {
                d.char = atm.driftChars[(Math.random() * atm.driftChars.length) | 0];
            }
            // light wobble adds life
            const wobX = Math.sin(state.t * 0.0011 + d.wob) * 9;
            const wobY = Math.cos(state.t * 0.0007 + d.wob) * 4;
            const p = project(d.x + wobX, d.y + wobY, d.z);
            if (!p) continue;
            const fontPx = Math.max(5, Math.min(20, 16 * p.scale));
            ctx.font = `${fontPx}px ${FONT}`;
            ctx.save();
            ctx.globalAlpha = Math.min(0.55, p.scale * 0.85);
            ctx.fillStyle = atm.ambient;
            ctx.fillText(d.char, p.sx, p.sy);
            ctx.restore();
        }
    }

    /** render the live motion particles · fade out by age/life ratio */
    function drawMotionParticles() {
        ctx.font = `15px ${FONT}`;
        for (let i = 0; i < motionPool.length; i++) {
            const mp = motionPool[i];
            if (mp.age >= mp.life) continue;
            const t = mp.age / mp.life;     // 0..1 lifetime
            const alpha = (1 - t) * 0.85;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = mp.color;
            ctx.fillText(mp.char, mp.sx, mp.sy);
            ctx.restore();
        }
    }

    /** transient keyboard-controls hint that fades after first input.
     *  On mobile, points AT the ▲ button on the d-pad (bottom-left) so the
     *  player knows which button is "forward". On desktop, shows the
     *  keyboard equivalents centered. */
    function drawKbHint() {
        const isMobileLike = (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        const hint = isMobileLike ? 'AUTO-WALKING · ENJOY THE RIDE' : 'PRESS  ↑  TO WALK FORWARD';
        const hintW = hint.length * 8.4;
        let sx, sy, arrowX, arrowY;

        if (isMobileLike) {
            // anchor above the ▲ button which lives bottom-left of canvas.
            // The d-pad is at viewport bottom-left at left:14px / bottom:18px
            // with grid-row 1 = ▲. The button center in viewport is roughly
            // (14 + 54 + 54/2, viewport_height - 18 - 54*2 - 6 - 54/2).
            // Translate to canvas coords (canvas stretches to viewport).
            const vw = window.innerWidth  || 390;
            const vh = window.innerHeight || 844;
            // ▲ button center in viewport
            const btnVpX = 14 + 54 + 54 / 2;
            const btnVpY = vh - 18 - 54 * 2 - 6 - 54 / 2;
            // map to canvas
            const btnCnvX = (btnVpX / vw) * W;
            const btnCnvY = (btnVpY / vh) * H;
            sx = btnCnvX - hintW / 2;
            sy = btnCnvY - 70;
            arrowX = btnCnvX;
            arrowY = sy + 22;
        } else {
            // desktop · centered above the player area
            sx = (W - hintW) / 2;
            sy = H - 220;
            arrowX = W / 2;
            arrowY = sy + 22;
        }

        ctx.save();
        // gentle breathing pulse on the hint itself (not the button) · CSS
        // handles the button pulse separately so it works while paused
        const pulse = 0.85 + 0.15 * Math.sin(state.t * 0.005);
        ctx.globalAlpha = state.kbHintAlpha * pulse;
        // background plate so it stays readable over busy scenes
        ctx.fillStyle = 'rgba(10,14,10,0.78)';
        ctx.fillRect(sx - 12, sy - 14, hintW + 24, 20);
        ctx.strokeStyle = PAL.accent || PAL.green;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - 12 + 0.5, sy - 14 + 0.5, hintW + 23, 19);
        ctx.font = `13px 'VT323', ${FONT}`;
        ctx.fillStyle = PAL.fgBright;
        ctx.fillText(hint, sx, sy);
        // arrow pointing at the actual button (mobile) or down (desktop)
        ctx.fillStyle = PAL.green;
        ctx.font = `18px ${FONT}`;
        ctx.fillText('▼', arrowX - 6, arrowY);
        ctx.restore();
    }

    function drawPlayer() {
        const p = state.player;
        // player anchored near bottom-center of screen
        const groundSy = H - 70;
        const bob = (Math.abs(p.walkPhase % 1 - 0.5) - 0.25) * 4;
        const jumpLift = Math.max(0, (GROUND_Y - p.y));
        const baseY = groundSy + bob - jumpLift * 4;
        const sx = W / 2 + p.x * 0.2;

        // pick the right sprite based on vehicle + motion state
        let sprite, fontPx, color, shadowW;
        if (p.vehicle === 'vw') {
            sprite = (Math.floor(state.t * 0.012) & 1) ? V_VW_A : V_VW_B;
            fontPx = 26;
            color  = PAL.red;       // gt red
            shadowW = 64;
        } else if (p.vehicle === 'alto') {
            sprite = (Math.floor(state.t * 0.014) & 1) ? V_ALTO_A : V_ALTO_B;
            fontPx = 24;
            color  = PAL.gold;      // sundae yellow stand-in
            shadowW = 52;
        } else if (p.vehicle === 'cycle') {
            sprite = (Math.floor(state.t * 0.018) & 1) ? V_CYCLE_A : V_CYCLE_B;
            fontPx = 26;
            color  = PAL.cyan;      // chrome blue · the college-bicycle stand-in
            shadowW = 38;
        } else {
            // walking · stick figure with backpack
            if (!p.onGround) sprite = P_JUMP;
            else if (p.facing < 0) sprite = P_LEFT;
            else if (p.facing > 0) sprite = P_RIGHT;
            else if (p.forwardActive || state.keys['arrowdown']) {
                sprite = (Math.floor(p.walkPhase * 2) & 1) ? P_WALK_A : P_WALK_B;
            } else {
                sprite = P_STAND;
            }
            fontPx = 28;
            color  = PAL.green;
            shadowW = 44;
        }

        // shadow underneath · scales with vehicle width
        ctx.save();
        const shadowAlpha = (p.vehicle === 'walk')
            ? Math.max(0.18, 0.4 - jumpLift * 0.03)
            : 0.35;
        ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
        ctx.fillRect(sx - shadowW / 2, groundSy + 6, shadowW, 4);
        ctx.restore();

        // chromatic-aberration drift when moving fast or airborne. Vehicles
        // always show a little drift since they're "always moving fast".
        let drift = 0;
        if (!p.onGround)               drift = 2;
        else if (p.vehicle === 'vw')   drift = p.forwardActive ? 2 : 1;
        else if (p.vehicle === 'alto') drift = p.forwardActive ? 1.5 : 0.5;
        else if (p.vehicle === 'cycle')drift = p.forwardActive ? 1.2 : 0.3;
        else if (p.forwardActive)      drift = 1;

        drawSprite(sprite, sx, baseY, fontPx, color, drift);
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
