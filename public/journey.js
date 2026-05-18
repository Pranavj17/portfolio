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

    // ── CHAPTER LORE · shown when a progress-strip dot is clicked ──
    // 2-3 sentences setting the era. Pulled from JOURNEY_LORE.md.
    const CHAPTER_LORE = {
        itics:    "2004–2013. Crazy peaceful school life.",
        cmr:      "2013–2015. After 10 years of school with the same friends — new entry to the world, dealing with new folks.",
        college:  "2015–2019. Did multiple things — interned at BOSCH, ABB, and also Fever.",
        fever104: "2018–2019. Made creative friends, edited videos, recorded calls, even did prank calls on air.",
        sakha:    "2019–2022. Started as a frontend developer.",
        scripbox: "2022–now. Became full-stack with infra and AI.",
        vwgt:     "Nov 16, 2025. Got the VW Virtus GT — 1.5 TSI turbo.",
        now:      "2026–present. AI infra, MCP tooling, Anthropic goal active.",
    };

    // ── BEATS · clickable story vignettes in the world ──
    // Each beat: {ch, id, dx, dy, w, h, title, lore}
    //   dx = offset from chapter.x   (world x)
    //   dy = offset from groundY     (negative = above ground)
    //   w, h = hit-box dimensions    (centered on dx, dy)
    //   title = short label shown in lore card header
    //   lore = the actual autobiographical sentence(s)
    // Hit-test: click point in world coords falls inside the beat's box.
    const BEATS = [
        // ── ITICS (primary school, until 2013) ──
        { ch:'itics', id:'exam-anxiety',    dx:-380, dy:-18, w:48, h:48, title:'Exam anxiety',     lore:'Drank water and actually studied — the last 3 days before the exam.' },
        { ch:'itics', id:'trips',           dx:-340, dy:-15, w:48, h:48, title:'School trips',     lore:'Bus trips to school, school trips by train to nearby places in Karnataka.' },
        { ch:'itics', id:'chit-chat',       dx:-300, dy:-18, w:48, h:48, title:'Chit-chat',        lore:'Casual timepass with friends.', chatter:['lunch?','maths sucks','wanna swap?','recess soon'] },
        { ch:'itics', id:'assembly-stage',  dx:-260, dy:-22, w:54, h:60, title:'Morning assembly', lore:'Every day at 8:30 AM. Lined up, sang, marched in.' },
        { ch:'itics', id:'football-match',  dx:-380, dy:-80, w:64, h:48, title:'Football match',   lore:'Intra and inter-school competitions. Played striker.', chatter:['PASS!','on me!','GOAL!','foul!','shoot!'] },
        { ch:'itics', id:'sports-day',      dx:-340, dy:-80, w:64, h:48, title:'Sports day',       lore:'Great fun. Won.' },
        { ch:'itics', id:'cricket-match',   dx:-300, dy:-80, w:64, h:48, title:'Cricket match',    lore:'Played district level for Karnataka.', chatter:['HOWZAT!','SIX!','caught!','no-ball','run!'] },
        { ch:'itics', id:'cultural-dance',  dx:-260, dy:-80, w:64, h:48, title:'Cultural dance',   lore:'Did it as part of school activity.', chatter:['together!','and... go','one more','smile!'] },

        // ── CMR NATIONAL (PU, 2013–2015) ──
        { ch:'cmr', id:'tuition-rush',      dx:-380, dy:-13, w:44, h:40, title:'Tuition rush',     lore:'Went for IIT JEE.', chatter:['fast!','late again','physics first','JEE in 8 months'] },
        { ch:'cmr', id:'mock-test',         dx:-340, dy:-24, w:44, h:40, title:'Mock test',        lore:'Didn\'t study.' },
        { ch:'cmr', id:'study-lamp',        dx:-300, dy:-22, w:44, h:48, title:'Study lamp',       lore:'Had room lights. Late nights.' },
        { ch:'cmr', id:'pu-graduation',     dx:-260, dy:-8,  w:44, h:32, title:'PU graduation',    lore:'Fun.' },
        { ch:'cmr', id:'group-study',       dx:-540, dy:-12, w:54, h:44, title:'Group study',      lore:'Did do it during exam times.', chatter:['ch 12 done?','ya','this one?','ugh','5 more chapters'] },
        { ch:'cmr', id:'movie-night',       dx:-490, dy:-30, w:54, h:60, title:'Movie night',      lore:'Watched Bahubali with girlfriend.', chatter:['bahubali wild','best fight','one more sat?','popcorn?'] },
        { ch:'cmr', id:'cricket-weekend',   dx:-440, dy:-10, w:54, h:40, title:'Cricket weekend',  lore:'Yes — every weekend at the ITI pavilion.' },
        { ch:'cmr', id:'first-crush',       dx:-390, dy:-20, w:48, h:40, title:'First crush',      lore:'Yes — at tuition.' },

        // ── D.S.C.E. (mech eng, 2015–2019) ──
        { ch:'college', id:'hostel-room',   dx:-380, dy:-30, w:48, h:64, title:'Hostel room',      lore:'Didn\'t go to hostel. Travelled every day — walking to 3 bus changes to college walk.', chatter:['zzz...','light off','4am bro','let me sleep'] },
        { ch:'college', id:'fest-stage',    dx:-340, dy:-25, w:54, h:54, title:'Fest stage',       lore:'Great fun. Did a dance in the fest.', chatter:['LETS GOOO','encore!','one more!','hands up!'] },
        { ch:'college', id:'group-ride',    dx:-300, dy:-12, w:54, h:36, title:'Group ride',       lore:'Yes — every day, triples.', chatter:['race u to mess!','too late','wait up','catch me'] },
        { ch:'college', id:'convocation',   dx:-260, dy:-30, w:54, h:64, title:'Convocation',      lore:'Attended with parents.' },

        // ── FEVER 104 FM (Mar–May 2019) ──
        { ch:'fever104', id:'headphones',   dx:-380, dy:-15, w:36, h:36, title:'Headphones',       lore:'Did.' },
        { ch:'fever104', id:'script-binder',dx:-340, dy:-5,  w:36, h:24, title:'Script binder',    lore:'Did.' },
        { ch:'fever104', id:'sound-engineer',dx:-300,dy:-10, w:36, h:28, title:'Sound engineer',   lore:'Did.' },
        { ch:'fever104', id:'trainee-cert', dx:-260, dy:-5,  w:36, h:28, title:'Trainee cert',     lore:'Did.' },

        // ── SAKHA GLOBAL (first job, Jul 2019 – Sep 2022) ──
        { ch:'sakha', id:'interview-day',   dx:-380, dy:-25, w:48, h:48, title:'Interview day',    lore:'Crazy feeling — first interview cracked, after 5 failed attempts.' },
        { ch:'sakha', id:'first-day-badge', dx:-340, dy:-22, w:32, h:40, title:'First day badge',  lore:'Liked it.' },
        { ch:'sakha', id:'team-lunch',      dx:-300, dy:-20, w:48, h:40, title:'Team lunch',       lore:'Lunches with the team.' },
        { ch:'sakha', id:'first-paycheck',  dx:-260, dy:-8,  w:48, h:32, title:'First paycheck',   lore:'Bought a watch and a saree — for dad and mum.' },
        { ch:'sakha', id:'wfh-covid',       dx:-540, dy:-30, w:60, h:56, title:'WFH · COVID',      lore:'Changed my life. Got bored eventually.' },
        { ch:'sakha', id:'office-standup',  dx:-490, dy:-25, w:48, h:48, title:'Office standup',   lore:'New experience.', chatter:['blockers?','shipping today','merge ready','done by EOD'] },
        { ch:'sakha', id:'late-night-coding',dx:-440,dy:-20, w:54, h:48, title:'Late-night coding',lore:'Yes — was passionate.', chatter:['one more bug','just one more','sleep at 3','it works!'] },
        { ch:'sakha', id:'team-outing',     dx:-390, dy:-22, w:54, h:44, title:'Team outing',      lore:'Yes — did.', chatter:['to the team!','CHEERS','one more round?','great work'] },

        // ── SCRIPBOX (AI/MCP era, Sep 2022 – present) ──
        { ch:'scripbox', id:'onboarding',     dx:-380, dy:-15, w:48, h:36, title:'Onboarding',       lore:'Great fun. Met a lot of friends.' },
        { ch:'scripbox', id:'pr-review',      dx:-340, dy:-15, w:36, h:36, title:'PR review',        lore:'Did.', chatter:['lgtm','hmm wait','edge case?','good catch'] },
        { ch:'scripbox', id:'anthropic-catalog',dx:-300,dy:-30,w:48, h:48, title:'Anthropic catalog',lore:'Was excited. Did show off after.' },
        { ch:'scripbox', id:'whiteboard',     dx:-260, dy:-30, w:54, h:48, title:'Whiteboard',       lore:'Gave knowledge transfer on things I learn — with my peers.', chatter:['MCP → SRV','see?','questions?','any blockers?'] },
        { ch:'scripbox', id:'claude-code',    dx:-540, dy:-25, w:54, h:48, title:'Claude Code',      lore:'Best AI skill I\'ve learnt as of now — for me.', chatter:['> claude','thinking...','done','one more pass'] },
        { ch:'scripbox', id:'anthropic-talk', dx:-490, dy:-25, w:54, h:48, title:'Anthropic talk',   lore:'Success.' },
        { ch:'scripbox', id:'coffee-setup',   dx:-440, dy:-15, w:64, h:36, title:'Coffee setup',     lore:'Timepass.' },
        { ch:'scripbox', id:'bangalore-traffic',dx:-390,dy:-15,w:54, h:40, title:'Bangalore traffic',lore:'Okay sometimes.' },

        // ── THE GT (Nov 16 2025) ──
        { ch:'vwgt', id:'test-drive',       dx:-380, dy:-12, w:54, h:32, title:'Test drive',       lore:'Yes.' },
        { ch:'vwgt', id:'documents-signing',dx:-340, dy:-12, w:36, h:28, title:'Documents',        lore:'Yes.' },
        { ch:'vwgt', id:'keys-handover',    dx:-300, dy:-20, w:40, h:40, title:'Keys handover',    lore:'Yes.', chatter:['congrats!','thanks!','enjoy!','drive safe'] },
        { ch:'vwgt', id:'first-drive-out',  dx:-260, dy:-15, w:48, h:36, title:'First drive out',  lore:'Yes.', chatter:['VROOM','finally','home wait','GT!'] },

        // ── NOW (2026 – present) ──
        { ch:'now', id:'morning-routine',   dx:-380, dy:-25, w:48, h:56, title:'Morning routine',  lore:'Coffee, phone, sunrise. The new day.' },
        { ch:'now', id:'code-flow',         dx:-340, dy:-20, w:48, h:48, title:'Code flow',        lore:'Multi-monitor flow state.' },
        { ch:'now', id:'anthropic-goal',    dx:-300, dy:-20, w:48, h:52, title:'Anthropic goal',   lore:'AI Engineer. The north star.' },
        { ch:'now', id:'forward-horizon',   dx:-260, dy:-10, w:48, h:32, title:'Forward horizon',  lore:'Walking confidently toward what\'s next.' },
    ];

    // ── CONTACT URLs · used in end-card CTA ──
    // Placeholders (https://...) are detected and the button is hidden.
    // User-fillable in JOURNEY_LORE.md.
    const CONTACT_URLS = {
        resume:   "https://...",
        github:   "https://github.com/Pranavj17",
        linkedin: "https://www.linkedin.com/in/...",
        email:    "mailto:...",
    };

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
        // INTERACTIVITY (Phase A · Plan v1)
        paused:          false,    // P key / pause button toggles
        activeLore:      null,     // the BEATS entry currently shown in lore card
        loreShownAt:     0,        // state.elapsedMs when active lore card opened
        glideTargetX:    null,     // when set, lerp playerX toward this on each frame
        discoveredBeats: new Set(),// beats the user has clicked through
        lastMissionIdx:  -1,       // change-detection for mission-text DOM updates
        // END-OF-JOURNEY CINEMATIC · VW GT accelerates off-screen with tire smoke
        endingCinematic: false,    // active during the 3.5s pre-end sequence
        cinematicT:      0,        // ms elapsed since cinematic started
        lockedCameraX:   null,     // when non-null, camera uses this instead of player-derived
        tireSmoke:       [],       // [{x,y,vx,vy,life,size}] · screen-coord particles
    };

    // auto-start after splash (3.4s matches CSS splashFadeOut)
    setTimeout(() => {
        state.running = true;
        // After splash, attempt to restore prior session. If found, show
        // a "Welcome back" peek card with stats. The restoreState() call
        // happens BELOW (synchronously at boot) — this just announces it.
        if (state.playerX > 0 && state.collected.size > 0) {
            const next = pickNextObjective();
            const ch = CHAPTERS[next];
            const totalBeats = BEATS.length;
            const found = state.discoveredBeats.size;
            showAchievement({
                icon: '↻',
                achTitle: 'WELCOME BACK',
                achSub: `${state.collected.size}/${CHAPTERS.length} chapters · ${found}/${totalBeats} beats discovered`,
            }, { kind: 'peek' });
        }
    }, 3400);

    // Attempt to restore prior session BEFORE rendering starts. If localStorage
    // has a snapshot, state.playerX + collected + achievements + discoveredBeats
    // are populated. Otherwise state stays default (playerX=0, empty sets).
    restoreState();

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
    function sfxRev() {
        // engine rev for end-game cinematic · rising sawtooth + tire-screech noise
        sfx({ freq: 80,  type: 'sawtooth', dur: 2.5,  vol: 0.18, sweep: 240 });
        // short screech via square pulse at start
        setTimeout(() => sfx({ freq: 600, type: 'square', dur: 0.18, vol: 0.08, sweep: 1200 }), 60);
        setTimeout(() => sfx({ freq: 500, type: 'square', dur: 0.14, vol: 0.06, sweep: 900 }), 200);
    }

    // ── PER-CHAPTER AMBIENT AUDIO · 8 cross-fading voices ────────────
    // One persistent voice per chapter, gain follows player proximity.
    // Lazy-booted on first user gesture (autoplay-safe).
    let chapterAudio = null;
    function chapterAudioBoot() {
        if (chapterAudio) return;
        const ac = initAudio(); if (!ac) return;
        if (ac.state === 'suspended') ac.resume().catch(() => {});
        const master = ac.createGain();
        master.gain.value = 1;
        master.connect(ac.destination);
        const noiseBuf = (() => {
            const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            return b;
        })();
        const noise = () => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; };
        const bp = (f, q) => { const x = ac.createBiquadFilter(); x.type = 'bandpass'; x.frequency.value = f; x.Q.value = q; return x; };
        const lp = (f) => { const x = ac.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = f; return x; };
        const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
        const g = (v) => { const n = ac.createGain(); n.gain.value = v; return n; };
        const ping = (lane, type, freq, dur, vol) => {
            if (lane.gain.gain.value < 0.001) return;
            const t = ac.currentTime, o = ac.createOscillator(), e = ac.createGain();
            o.type = type; o.frequency.setValueAtTime(freq, t);
            e.gain.setValueAtTime(0, t);
            e.gain.linearRampToValueAtTime(vol, t + 0.01);
            e.gain.exponentialRampToValueAtTime(0.001, t + dur);
            o.connect(e).connect(lane.gain);
            o.start(t); o.stop(t + dur + 0.05);
        };
        const noisePulse = (lane, dur, vol, freq, q) => {
            if (lane.gain.gain.value < 0.001) return;
            const t = ac.currentTime, s = ac.createBufferSource(), f = bp(freq, q), e = ac.createGain();
            s.buffer = noiseBuf; s.start(t); s.stop(t + dur + 0.02);
            e.gain.setValueAtTime(0, t);
            e.gain.linearRampToValueAtTime(vol, t + 0.005);
            e.gain.exponentialRampToValueAtTime(0.001, t + dur);
            s.connect(f).connect(e).connect(lane.gain);
        };
        const lanes = [];
        const rand = (a, b) => a + Math.random() * (b - a);
        const mk = (id, cap, build) => {
            const ch = CHAPTERS.find(c => c.id === id); if (!ch) return;
            const lane = { id, x: ch.x, cap, gain: g(0) };
            lane.gain.connect(master);
            build(lane);
            lanes.push(lane);
        };
        const every = (ms, fn) => setInterval(fn, ms);
        // ITICS · bandpass noise + bell every 8s
        mk('itics', 0.06, (lane) => {
            const n = noise(), f = bp(1200, 0.8), atten = g(0.12);
            n.connect(f).connect(atten).connect(lane.gain);
            every(8000, () => ping(lane, 'triangle', 880, 1.2, 0.05));
        });
        // CMR · pencil scratch + clock tick
        mk('cmr', 0.06, (lane) => {
            every(1500, () => noisePulse(lane, 0.18, 0.10, 3200, 4));
            every(1000, () => ping(lane, 'sine', 800, 0.04, 0.06));
        });
        // DSCE · hostel chatter LFO'd + cycle bell every 10s
        mk('college', 0.06, (lane) => {
            const n = noise(), f = bp(700, 1.2), atten = g(0.14);
            const lfo = osc('sine', 0.3), lfoG = g(220);
            lfo.connect(lfoG).connect(f.frequency);
            n.connect(f).connect(atten).connect(lane.gain);
            every(10000, () => {
                ping(lane, 'triangle', 1760, 0.25, 0.07);
                setTimeout(() => ping(lane, 'triangle', 1320, 0.35, 0.06), 90);
            });
        });
        // FEVER 104 · radio static + random pentatonic notes
        mk('fever104', 0.06, (lane) => {
            const n = noise(), f = bp(2400, 0.6), atten = g(0.18);
            n.connect(f).connect(atten).connect(lane.gain);
            const penta = [392, 440, 523, 587, 698];
            every(2200, () => ping(lane, 'sine', penta[(Math.random() * penta.length) | 0], 0.4, 0.04));
        });
        // SAKHA · keystrokes + low-pass murmur
        mk('sakha', 0.06, (lane) => {
            const n = noise(), f = lp(350), atten = g(0.08);
            n.connect(f).connect(atten).connect(lane.gain);
            const tick = () => { noisePulse(lane, 0.025, 0.12, 4000, 6); setTimeout(tick, rand(30, 180)); };
            tick();
        });
        // SCRIPBOX · faster keys + cursor tick + AI pad
        mk('scripbox', 0.06, (lane) => {
            const tick = () => { noisePulse(lane, 0.022, 0.14, 4500, 6); setTimeout(tick, rand(25, 120)); };
            tick();
            every(500, () => ping(lane, 'square', 1500, 0.015, 0.05));
            const p1 = osc('triangle', 110), p2 = osc('triangle', 164.81), pg = g(0.05);
            p1.connect(pg); p2.connect(pg); pg.connect(lane.gain);
        });
        // VWGT · engine idle hum
        mk('vwgt', 0.06, (lane) => {
            const o = osc('sawtooth', 80), f = lp(220), atten = g(0.10);
            o.connect(f).connect(atten).connect(lane.gain);
        });
        // NOW · minor-third pad + breathing LFO
        mk('now', 0.06, (lane) => {
            const a1 = osc('sine', 220), b1 = osc('sine', 277.18), c1 = osc('sine', 329.63);
            const pad = g(0.10);
            a1.connect(pad); b1.connect(pad); c1.connect(pad);
            const lfo2 = osc('sine', 0.08), lfoG2 = g(0.06);
            lfo2.connect(lfoG2).connect(pad.gain);
            pad.connect(lane.gain);
        });
        chapterAudio = { ac, master, lanes };
    }
    function chapterAudioTick() {
        if (!chapterAudio) return;
        for (const lane of chapterAudio.lanes) {
            const d = Math.abs(state.playerX - lane.x);
            const prox = d >= 400 ? 0 : 1 - d / 400;
            const target = prox * lane.cap;
            lane.gain.gain.setTargetAtTime(target, chapterAudio.ac.currentTime, 0.12);
        }
    }
    // Boot ambient audio on first user gesture
    window.addEventListener('touchstart', chapterAudioBoot, { passive: true, once: false });
    window.addEventListener('pointerdown', chapterAudioBoot, { passive: true, once: false });

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

    // build progress dots once · each dot is CLICKABLE to fast-travel
    const dots = [];
    if ($progress) {
        CHAPTERS.forEach((ch, idx) => {
            const d = document.createElement('span');
            d.className = 'dot';
            d.setAttribute('role', 'button');
            d.setAttribute('aria-label', `Travel to ${ch.label}`);
            d.title = ch.label;
            d.style.cursor = 'pointer';
            d.addEventListener('click', (e) => {
                e.stopPropagation();
                // Set glide target — frame() lerps playerX toward this.
                // Don't auto-collect; viewer still has to walk last ~80px.
                state.glideTargetX = ch.x - 80;
                // Dismiss any open lore card so glide isn't blocked by pause.
                if (state.activeLore) dismissLoreCard();
                state.paused = false;
                // Show a peek card for the destination chapter so viewer
                // knows where they're going.
                showAchievement(ch, { kind: 'peek' });
            });
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

    // ── HIT-TEST · convert client (px) → world (px) and find beat under cursor.
    //   Returns the topmost beat whose bounding box contains the click, or null.
    //   Camera math (inverse of drawChapters): worldX = clientX + cameraX
    //   Beat box (world coords): [chx + dx - w/2, chx + dx + w/2] × [groundY + dy - h/2, groundY + dy + h/2]
    function hitTestBeat(clientX, clientY) {
        const H = window.innerHeight;
        const groundY = H * GROUND_PCT;
        const W = window.innerWidth;
        const cameraX = state.playerX - W * 0.32;
        const worldX = clientX + cameraX;
        let best = null, bestDist = Infinity;
        for (const b of BEATS) {
            const ch = CHAPTERS.find(c => c.id === b.ch);
            if (!ch) continue;
            const bx = ch.x + b.dx;
            const by = groundY + b.dy;
            if (worldX >= bx - b.w / 2 && worldX <= bx + b.w / 2 &&
                clientY >= by - b.h / 2 && clientY <= by + b.h / 2) {
                // Prefer the beat whose CENTER is closest to the click
                const d = Math.hypot(worldX - bx, clientY - by);
                if (d < bestDist) { bestDist = d; best = b; }
            }
        }
        return best;
    }

    // ── LORE CARD · canvas-drawn slide-up modal showing beat story ──
    //   Pauses the world, ducks ambient audio. Auto-dismisses after 8s OR on
    //   next click. Card scales to content (1-3 sentences). Color stripe on
    //   the left matches the chapter color.
    function openLoreCard(beat) {
        if (!beat) return;
        state.activeLore = beat;
        state.loreShownAt = state.elapsedMs;
        state.paused = true;
        state.discoveredBeats.add(beat.ch + ':' + beat.id);
        // Duck chapter ambient
        if (chapterAudio && chapterAudio.master) {
            chapterAudio.master.gain.setTargetAtTime(0.4, chapterAudio.ac.currentTime, 0.12);
        }
        // Save progress (extends Phase A4)
        saveState();
    }
    function dismissLoreCard() {
        state.activeLore = null;
        state.paused = false;
        if (chapterAudio && chapterAudio.master) {
            chapterAudio.master.gain.setTargetAtTime(1.0, chapterAudio.ac.currentTime, 0.12);
        }
    }
    // ── CHATTER · ambient speech bubbles above active beats ──
    // Each beat with a `chatter` array rotates through its lines, one
    // visible at a time. Bubble appears above the beat with a tail,
    // fades in/out, gentle bob. Cycle = 2800ms per line (fade 200ms
    // each side, hold 2400ms middle).
    function drawChatter(W, H, groundY, cameraX) {
        if (state.paused) return;     // freeze chatter when paused/lore-open
        const tNow = state.elapsedMs;
        const CYCLE = 2800;
        ctx.save();
        ctx.lineCap = 'butt';
        for (const beat of BEATS) {
            if (!beat.chatter || beat.chatter.length === 0) continue;
            const ch = CHAPTERS.find(c => c.id === beat.ch);
            if (!ch) continue;
            // World→screen
            const worldX = ch.x + beat.dx;
            const screenX = worldX - cameraX;
            if (screenX < -100 || screenX > W + 100) continue;
            const screenY = groundY + beat.dy;
            // Stagger each beat's cycle phase by its dx so multiple beats
            // aren't all showing line 0 at the same moment
            const beatPhase = (beat.dx * 7 + ch.x) % CYCLE;
            const phase = ((tNow + beatPhase) % CYCLE) / CYCLE;   // 0..1
            const idx = Math.floor((tNow + beatPhase) / CYCLE) % beat.chatter.length;
            const line = beat.chatter[idx];
            // Fade curve: 0..0.07 fade in, 0.07..0.93 hold, 0.93..1 fade out
            let alpha = 1;
            if      (phase < 0.07) alpha = phase / 0.07;
            else if (phase > 0.93) alpha = (1 - phase) / 0.07;
            if (alpha <= 0.02) continue;
            // Bob: gentle 1-2px sinusoidal lift
            const bob = Math.sin(tNow * 0.003 + beat.dx * 0.01) * 1.4;
            // Bubble dimensions · auto-sized to text
            ctx.font = 'bold 10px "Cinzel", "IM Fell English", serif';
            const padX = 6, padY = 4;
            const textW = ctx.measureText(line).width;
            const bubW = textW + padX * 2;
            const bubH = 16;
            // Bubble position · centered horizontally above beat
            const bx = screenX - bubW / 2;
            const by = screenY - beat.h / 2 - bubH - 6 + bob;
            // Parchment background
            ctx.globalAlpha = alpha * 0.95;
            ctx.fillStyle = '#f0e2b8';
            ctx.fillRect(bx, by, bubW, bubH);
            // Brass border
            ctx.strokeStyle = '#7a5a30';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(bx + 0.5, by + 0.5, bubW - 1, bubH - 1);
            // Tail · small triangle pointing down to beat
            ctx.fillStyle = '#f0e2b8';
            ctx.beginPath();
            ctx.moveTo(screenX - 3, by + bubH - 0.5);
            ctx.lineTo(screenX, by + bubH + 3);
            ctx.lineTo(screenX + 3, by + bubH - 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7a5a30';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(screenX - 3, by + bubH - 0.5);
            ctx.lineTo(screenX, by + bubH + 3);
            ctx.lineTo(screenX + 3, by + bubH - 0.5);
            ctx.stroke();
            // Text
            ctx.fillStyle = '#3a2418';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(line, screenX, by + bubH / 2 + 0.5);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawLoreCard() {
        if (!state.activeLore) return;
        const beat = state.activeLore;
        const chapter = CHAPTERS.find(c => c.id === beat.ch);
        const W = window.innerWidth;
        const H = window.innerHeight;
        // Auto-dismiss after 8 seconds
        if (state.elapsedMs - state.loreShownAt > 8000) {
            dismissLoreCard();
            return;
        }
        // Slide-up animation: 0..300ms = anim, 300+ = settled
        const t = state.elapsedMs - state.loreShownAt;
        const animT = Math.min(1, t / 300);
        const ease = 1 - Math.pow(1 - animT, 3);   // ease-out cubic
        // Card geometry — bottom-center, slides up from below viewport
        const cardW = Math.min(560, W * 0.86);
        const cardH = 140;
        const cardX = (W - cardW) / 2;
        const cardYTarget = H - cardH - 60;
        const cardY = H + (cardYTarget - H) * ease;
        // Backdrop dim
        ctx.save();
        ctx.fillStyle = `rgba(8, 6, 4, ${0.45 * ease})`;
        ctx.fillRect(0, 0, W, H);
        // Card body · parchment with chapter color stripe on left
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.fillStyle = chapter ? chapter.color : '#5a3a22';
        ctx.fillRect(cardX, cardY, 6, cardH);
        // Brass border
        ctx.strokeStyle = '#5a3a22';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);
        // Title
        ctx.fillStyle = '#3a2418';
        ctx.font = 'bold 16px "Cinzel", "IM Fell English", serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(beat.title.toUpperCase(), cardX + 22, cardY + 18);
        // Period stamp (chapter context)
        ctx.fillStyle = '#7a5a30';
        ctx.font = 'italic 11px "IM Fell English", serif';
        ctx.fillText(chapter ? chapter.period.toLowerCase() : '', cardX + 22, cardY + 40);
        // Body lore · wraps if too long
        ctx.fillStyle = '#2a1810';
        ctx.font = '14px "IM Fell English", serif';
        const words = (beat.lore || '').split(' ');
        const maxW = cardW - 44;
        let line = '', lineY = cardY + 64;
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            const w = ctx.measureText(test).width;
            if (w > maxW && line) {
                ctx.fillText(line, cardX + 22, lineY);
                line = word;
                lineY += 18;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, cardX + 22, lineY);
        // Dismiss hint
        ctx.fillStyle = 'rgba(58, 36, 24, 0.55)';
        ctx.font = 'italic 10px "IM Fell English", serif';
        ctx.textAlign = 'right';
        ctx.fillText('click anywhere to dismiss', cardX + cardW - 16, cardY + cardH - 16);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    // ── PERSISTENCE · localStorage save/restore for cross-session continuity ──
    const SAVE_KEY = 'journey_v1';
    function saveState() {
        try {
            const snap = {
                playerX:         state.playerX,
                vehicle:         state.vehicle,
                collected:       [...state.collected],
                achievements:    [...state.achievements],
                discoveredBeats: [...state.discoveredBeats],
                savedAt:         Date.now(),
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
        } catch (_) { /* localStorage unavailable; fail silently */ }
    }
    function restoreState() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return false;
            const snap = JSON.parse(raw);
            if (!snap || typeof snap.playerX !== 'number') return false;
            state.playerX      = snap.playerX;
            state.vehicle      = snap.vehicle || 'walk';
            state.collected    = new Set(snap.collected || []);
            state.achievements = new Set(snap.achievements || []);
            state.discoveredBeats = new Set(snap.discoveredBeats || []);
            return true;
        } catch (_) { return false; }
    }
    function clearSavedState() {
        try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    }
    window.addEventListener('keydown', (e) => {
        chapterAudioBoot();   // lazy-init ambient audio on first gesture
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
        } else if (k === 'p' || k === 'P') {
            // Pause toggle. If a lore card is open, P dismisses it
            // (since lore-card already pauses the world).
            if (e.repeat) { e.preventDefault(); return; }
            e.preventDefault();
            if (state.activeLore) dismissLoreCard();
            else state.paused = !state.paused;
        } else if (k === 'Escape') {
            // ESC dismisses lore card (without pause toggle)
            if (state.activeLore) { e.preventDefault(); dismissLoreCard(); }
        }
    });
    window.addEventListener('keyup', (e) => {
        const k = e.key;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') state.keys.right = false;
        if (k === 'ArrowLeft'  || k === 'a' || k === 'A') state.keys.left  = false;
    });
    canvas.addEventListener('pointerdown', (e) => {
        if (e.target !== canvas) return;
        // If a lore card is open, ANY click dismisses it (don't start a walk).
        if (state.activeLore) {
            e.preventDefault();
            dismissLoreCard();
            return;
        }
        // Otherwise, check if click landed on a story beat. If yes, open lore.
        const hit = hitTestBeat(e.clientX, e.clientY);
        if (hit) {
            e.preventDefault();
            openLoreCard(hit);
            return;
        }
        // Empty-space tap → existing hold-to-walk behavior
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

    // wire end-card "start fresh" button if present
    const $endRestart = document.getElementById('end-restart');
    if ($endRestart) {
        $endRestart.addEventListener('click', (e) => {
            e.preventDefault();
            clearSavedState();
            location.reload();
        });
    }

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
    // Per-chapter sky palette · school years brighter daylight, working
    // years warmer dusk. Interpolates by playerX between adjacent chapter
    // anchors. Blended with the global skyAt(progress) so the time-of-day
    // arc still reads, but each chapter has its own mood.
    const CHAPTER_SKY = [
        { x:  500, top:'#6f8ea8', mid:'#c4a878', low:'#e8c98a' }, // itics · bright morning
        { x: 1200, top:'#5a7388', mid:'#a89878', low:'#d4b888' }, // cmr · cool clinical noon
        { x: 2000, top:'#7a9aaa', mid:'#d4a070', low:'#e8b070' }, // college · bright afternoon
        { x: 2800, top:'#4a3020', mid:'#a85a30', low:'#d87040' }, // fever104 · warm pre-dusk
        { x: 3600, top:'#3a2a1a', mid:'#9a6028', low:'#d89048' }, // sakha · golden hour
        { x: 4400, top:'#2e2a2a', mid:'#7a6a5a', low:'#a88060' }, // scripbox · soft cool dusk
        { x: 5300, top:'#241218', mid:'#6a2a26', low:'#a4332e' }, // vwgt · twilight triumph
        { x: 6200, top:'#1a1418', mid:'#7a5a3a', low:'#e6c285' }, // now · dawn of next
    ];
    function skyAtChapter(playerX) {
        if (playerX <= CHAPTER_SKY[0].x) return CHAPTER_SKY[0];
        const last = CHAPTER_SKY[CHAPTER_SKY.length - 1];
        if (playerX >= last.x) return last;
        for (let i = 0; i < CHAPTER_SKY.length - 1; i++) {
            const a = CHAPTER_SKY[i], b = CHAPTER_SKY[i + 1];
            if (playerX <= b.x) {
                const t = (playerX - a.x) / (b.x - a.x);
                const e = t * t * (3 - 2 * t);                  // smoothstep
                return { top: lerpHex(a.top, b.top, e), mid: lerpHex(a.mid, b.mid, e), low: lerpHex(a.low, b.low, e) };
            }
        }
        return last;
    }
    function drawSky(W, H, horizonY, progress) {
        // === UNIFIED PLAYER-DRIVEN DAY/NIGHT CYCLE ===
        // The sun (and moon) move as the character moves. Every 1500px walked
        // = ONE full day/night cycle. World is ~6200px → ~4 cycles across
        // the journey. The chapter mood tint is BASE; day/night OVERLAYS
        // on top. Walking faster makes time pass faster — your literal pace
        // becomes your perceived passage of time.
        //
        //   cyc 0.00 dawn (warm horizon glow, sun about to rise on RIGHT)
        //   cyc 0.05-0.45 day (sun arcing right→left across sky)
        //   cyc 0.45-0.55 dusk (sun setting, warm horizon)
        //   cyc 0.55-0.95 night (moon arcing, stars twinkling)
        //   cyc 0.95-1.00 pre-dawn (night fading, warm glow rising)
        //
        // Sun and moon arc from RIGHT horizon (rising) → top center (noon
        // /midnight) → LEFT horizon (setting). The horizontal motion is
        // proportional to subCyc, so as player walks rightward, sun appears
        // to fall behind westward — physically accurate.
        const CYCLE_LEN = 1500;
        const cyc = ((state.playerX % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN / CYCLE_LEN;
        const isNight = cyc >= 0.5;
        const subCyc  = isNight ? (cyc - 0.5) * 2 : cyc * 2;  // 0..1 within current half

        // --- 1. Base chapter-tint sky (mood per life-phase) ---
        const cBlend = skyAtChapter(state.playerX);
        const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
        grad.addColorStop(0,    cBlend.top);
        grad.addColorStop(0.55, cBlend.mid);
        grad.addColorStop(1,    cBlend.low);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, horizonY);

        // --- 2. Night-strength curve: 0 in day, 1 in night, smooth at edges ---
        let nightStrength;
        if      (cyc < 0.05) nightStrength = 1 - cyc * 20;          // pre-dawn fade-out
        else if (cyc < 0.45) nightStrength = 0;                     // full day
        else if (cyc < 0.55) nightStrength = (cyc - 0.45) * 10;     // dusk fade-in
        else if (cyc < 0.95) nightStrength = 1;                     // full night
        else                  nightStrength = 1 - (cyc - 0.95) * 20; // dawn fade-out

        // --- 3. Night sky overlay · deep blue, gets denser at zenith ---
        if (nightStrength > 0) {
            const nightG = ctx.createLinearGradient(0, 0, 0, horizonY);
            nightG.addColorStop(0,    `rgba(8, 14, 36, ${0.82 * nightStrength})`);
            nightG.addColorStop(0.55, `rgba(20, 28, 56, ${0.68 * nightStrength})`);
            nightG.addColorStop(1,    `rgba(48, 40, 60, ${0.48 * nightStrength})`);
            ctx.fillStyle = nightG;
            ctx.fillRect(0, 0, W, horizonY);
        }

        // --- 4. Dawn/dusk warm horizon band (sun/moon at horizon) ---
        const horizonGlow = Math.max(0, 1 - Math.abs(subCyc - 0.5) * 2.5);
        if (horizonGlow > 0) {
            const warmG = ctx.createLinearGradient(0, horizonY - 100, 0, horizonY);
            const a1 = 0.45 * horizonGlow;
            const a2 = 0.30 * horizonGlow;
            warmG.addColorStop(0,   `rgba(255, 130, 60, 0)`);
            warmG.addColorStop(0.5, `rgba(255, 140, 70, ${a1})`);
            warmG.addColorStop(1,   `rgba(255, 100, 50, ${a2})`);
            ctx.fillStyle = warmG;
            ctx.fillRect(0, horizonY - 100, W, 100);
        }

        // --- 5. Stars (visible at night, twinkling) ---
        if (nightStrength > 0.5) {
            const starAlpha = (nightStrength - 0.5) * 2;
            const starSeed = [13, 47, 81, 109, 131, 167, 191, 223, 257, 281, 311, 337, 367, 401, 419, 433, 463, 491, 521, 557];
            for (let i = 0; i < 20; i++) {
                const sx = (starSeed[i] * 13 + Math.floor(state.playerX * 0.05)) % W;
                const sy = (starSeed[i] * 7) % (horizonY - 20);
                const twinkle = 0.5 + 0.5 * Math.sin(state.elapsedMs * 0.003 + i * 1.3);
                ctx.fillStyle = `rgba(233, 216, 176, ${0.8 * starAlpha * twinkle})`;
                ctx.beginPath(); ctx.arc(sx, sy, 0.9 + twinkle * 0.4, 0, Math.PI * 2); ctx.fill();
            }
        }

        // --- 6. Celestial body (sun OR moon) arcs right → top → left ---
        // arcAngle: 0 at horizon-right, π/2 at zenith, π at horizon-left
        const arcAngle = subCyc * Math.PI;
        const celestialX = W * (1 - subCyc);
        const celestialY = horizonY - Math.sin(arcAngle) * 140;

        if (!isNight) {
            // SUN · warm radial glow + bright core. Color shifts toward
            // orange at horizon (dawn/dusk), bright yellow at zenith.
            const sunWarmth = 1 - Math.sin(arcAngle);   // 1 at horizon, 0 at zenith
            const coreR = 220 + sunWarmth * 35;
            const coreG = 200 + sunWarmth * -20;
            const coreB = 120 - sunWarmth * 40;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const sg = ctx.createRadialGradient(celestialX, celestialY, 3, celestialX, celestialY, 90);
            sg.addColorStop(0,   `rgba(${coreR}, ${coreG}, ${coreB}, 1)`);
            sg.addColorStop(0.4, `rgba(${coreR - 60}, ${coreG - 80}, ${coreB - 50}, 0.5)`);
            sg.addColorStop(1,   `rgba(0, 0, 0, 0)`);
            ctx.fillStyle = sg;
            ctx.fillRect(0, 0, W, horizonY);
            ctx.restore();
            // Sun core (solid disc)
            ctx.fillStyle = `rgb(${coreR}, ${Math.max(0, coreG)}, ${Math.max(0, coreB)})`;
            ctx.beginPath(); ctx.arc(celestialX, celestialY, 16, 0, Math.PI * 2); ctx.fill();
        } else {
            // MOON · cool pale glow + crescent shadow
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const mg = ctx.createRadialGradient(celestialX, celestialY, 3, celestialX, celestialY, 60);
            mg.addColorStop(0,   'rgba(220, 230, 240, 0.6)');
            mg.addColorStop(0.4, 'rgba(180, 200, 230, 0.2)');
            mg.addColorStop(1,   'rgba(0, 0, 0, 0)');
            ctx.fillStyle = mg;
            ctx.fillRect(0, 0, W, horizonY);
            ctx.restore();
            // Moon disc
            ctx.fillStyle = 'rgba(232, 236, 244, 0.96)';
            ctx.beginPath(); ctx.arc(celestialX, celestialY, 12, 0, Math.PI * 2); ctx.fill();
            // Crescent shadow (offset darker circle)
            ctx.fillStyle = 'rgba(15, 20, 40, 0.85)';
            ctx.beginPath(); ctx.arc(celestialX + 3.5, celestialY - 1, 11, 0, Math.PI * 2); ctx.fill();
        }
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

    /** Holiday/trip vignettes scattered between chapters · 0.45 parallax.
     *  Beach, mountain, hill-station, airplane, road-trip, temple, hike-peak. */
    function drawHolidayProps(W, horizonY, groundY, cameraX) {
        const offset = -(cameraX * 0.45);
        const t = state.elapsedMs;
        const spots = [
            { x: 900, kind: 'beach' }, { x: 1600, kind: 'mountain' },
            { x: 2400, kind: 'hillstation' }, { x: 3200, kind: 'airplane' },
            { x: 4000, kind: 'roadtrip' }, { x: 4800, kind: 'temple' },
            { x: 5700, kind: 'hikepeak' },
        ];
        for (let i = 0; i < spots.length; i++) {
            const s = spots[i];
            const px = s.x + offset;
            if (px < -200 || px > W + 200) continue;
            const gY = groundY - 4;
            ctx.globalAlpha = 0.78;
            if (s.kind === 'beach') {
                ctx.fillStyle = '#d4a653';
                ctx.beginPath(); ctx.moveTo(px - 60, gY); ctx.lineTo(px - 20, gY - 14); ctx.lineTo(px + 50, gY); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(90,130,150,0.55)'; ctx.fillRect(px + 20, gY - 4, 90, 5);
                const shipX = px + 70 + Math.sin(t * 0.0004) * 6;
                ctx.fillStyle = '#3a2818'; ctx.fillRect(shipX, gY - 8, 14, 3); ctx.fillRect(shipX + 5, gY - 13, 2, 5);
                ctx.fillStyle = '#a4332e';
                ctx.beginPath(); ctx.moveTo(px - 30, gY - 14); ctx.lineTo(px - 18, gY - 32); ctx.lineTo(px - 6, gY - 14); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 26, gY - 22, 4, 8); ctx.fillRect(px - 14, gY - 22, 4, 8);
                ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 18.5, gY - 32, 1, 18);
                const bob = Math.sin(t * 0.004) * 1.2;
                ctx.fillStyle = '#2a1810'; ctx.fillRect(px + 38, gY - 8 + bob, 2, 6);
                ctx.beginPath(); ctx.arc(px + 39, gY - 10 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
            } else if (s.kind === 'mountain') {
                ctx.fillStyle = '#5a3a22';
                ctx.beginPath(); ctx.moveTo(px - 70, gY); ctx.lineTo(px - 30, gY - 50); ctx.lineTo(px + 10, gY); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#7a4a26';
                ctx.beginPath(); ctx.moveTo(px - 40, gY); ctx.lineTo(px, gY - 38); ctx.lineTo(px + 40, gY); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#a86434';
                ctx.beginPath(); ctx.moveTo(px + 10, gY); ctx.lineTo(px + 40, gY - 28); ctx.lineTo(px + 70, gY); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#e9d8b0';
                ctx.beginPath(); ctx.moveTo(px - 36, gY - 42); ctx.lineTo(px - 30, gY - 50); ctx.lineTo(px - 24, gY - 42); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#a4332e';
                ctx.beginPath(); ctx.moveTo(px + 18, gY); ctx.lineTo(px + 24, gY - 8); ctx.lineTo(px + 30, gY); ctx.closePath(); ctx.fill();
                for (let k = 0; k < 4; k++) {
                    const phaseSm = (t * 0.0008 + k * 0.25) % 1;
                    const sy = gY - phaseSm * 28;
                    const sx = px + 14 + Math.sin(phaseSm * 6) * 3;
                    ctx.fillStyle = `rgba(200,180,160,${0.5 * (1 - phaseSm)})`;
                    ctx.beginPath(); ctx.arc(sx, sy, 1.6 + phaseSm * 2, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = '#d4a653'; ctx.fillRect(px + 12, gY - 2, 4, 2);
            } else if (s.kind === 'hillstation') {
                ctx.fillStyle = '#5a3a22';
                ctx.beginPath();
                ctx.moveTo(px - 70, gY);
                ctx.quadraticCurveTo(px - 40, gY - 22, px - 10, gY);
                ctx.quadraticCurveTo(px + 20, gY - 28, px + 50, gY);
                ctx.lineTo(px + 50, gY); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#3a2818';
                for (let k = 0; k < 5; k++) {
                    const tx = px - 50 + k * 22;
                    const ty = gY - 6 - (k % 2) * 4;
                    ctx.beginPath(); ctx.moveTo(tx - 3, ty); ctx.lineTo(tx, ty - 10); ctx.lineTo(tx + 3, ty); ctx.closePath(); ctx.fill();
                }
                ctx.fillStyle = '#5a3a22'; ctx.fillRect(px + 32, gY - 18, 1.4, 18);
                ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px + 28, gY - 22, 14, 6);
                ctx.fillStyle = '#3a2818'; ctx.font = '4px serif'; ctx.fillText('VIEW', px + 29, gY - 17);
                ctx.fillStyle = '#2a1810'; ctx.fillRect(px + 4, gY - 10, 2, 10);
                ctx.beginPath(); ctx.arc(px + 5, gY - 12, 1.8, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(px + 6, gY - 11, 4, 2.5);
                const flash = (t % 2000) < 80 ? 0.9 : 0;
                if (flash) { ctx.fillStyle = `rgba(255,250,200,${flash})`; ctx.beginPath(); ctx.arc(px + 10, gY - 10, 3, 0, Math.PI * 2); ctx.fill(); }
            } else if (s.kind === 'airplane') {
                ctx.fillStyle = '#3a2818'; ctx.fillRect(px - 30, gY - 50, 60, 50);
                ctx.fillStyle = '#7a9ab4';
                ctx.beginPath(); ctx.ellipse(px, gY - 28, 22, 18, 0, 0, Math.PI * 2); ctx.fill();
                const cd = (t * 0.01) % 40;
                ctx.fillStyle = 'rgba(233,216,176,0.7)';
                ctx.beginPath(); ctx.arc(px - 12 + cd * 0.4, gY - 32, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(px + 4 + cd * 0.3, gY - 24, 4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#5a3a22';
                ctx.beginPath(); ctx.moveTo(px + 8, gY - 22); ctx.lineTo(px + 20, gY - 18); ctx.lineTo(px + 8, gY - 18); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#a86434'; ctx.fillRect(px - 10, gY - 10, 20, 10);
                ctx.fillStyle = '#3a2818'; ctx.fillRect(px - 2, gY - 14, 4, 4); ctx.fillRect(px - 10, gY - 5, 20, 0.8);
            } else if (s.kind === 'roadtrip') {
                ctx.strokeStyle = '#3a2818'; ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(px - 60, gY);
                ctx.quadraticCurveTo(px - 20, gY - 18, px + 10, gY - 28);
                ctx.quadraticCurveTo(px + 40, gY - 36, px + 60, gY - 42);
                ctx.stroke();
                ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 1;
                ctx.setLineDash([4, 5]); ctx.lineDashOffset = -(t * 0.04);
                ctx.beginPath();
                ctx.moveTo(px - 60, gY);
                ctx.quadraticCurveTo(px - 20, gY - 18, px + 10, gY - 28);
                ctx.quadraticCurveTo(px + 40, gY - 36, px + 60, gY - 42);
                ctx.stroke(); ctx.setLineDash([]);
                ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 50, gY - 22, 16, 14);
                ctx.fillStyle = '#a4332e'; ctx.fillRect(px - 50, gY - 26, 16, 4);
                ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 46, gY - 18, 3, 4);
                ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 4, gY - 12, 6, 8);
                ctx.fillStyle = '#3a2818'; ctx.font = '4px serif'; ctx.fillText('500', px - 3, gY - 6);
            } else if (s.kind === 'temple') {
                let prevC = '#a86434';
                for (let k = 0; k < 5; k++) {
                    const w = 60 - k * 9;
                    ctx.fillStyle = prevC;
                    ctx.fillRect(px - w / 2, gY - 8 - k * 8, w, 8);
                    prevC = prevC === '#a86434' ? '#7a4a26' : '#a86434';
                }
                ctx.fillStyle = '#d4a653';
                ctx.beginPath(); ctx.arc(px, gY - 52, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(px - 0.5, gY - 58, 1, 6);
                const flagColors = ['#a4332e', '#d4a653', '#5e7a8a', '#e9d8b0', '#7a4a26'];
                ctx.strokeStyle = '#3a2818'; ctx.lineWidth = 0.6;
                ctx.beginPath(); ctx.moveTo(px - 50, gY - 30);
                for (let k = 0; k <= 10; k++) {
                    const fx = px - 50 + k * 10;
                    const sag = Math.sin(k * 0.5 + t * 0.003) * 1.5 + 4;
                    ctx.lineTo(fx, gY - 30 + sag);
                }
                ctx.stroke();
                for (let k = 0; k < 10; k++) {
                    const fx = px - 45 + k * 10;
                    const sag = Math.sin(k * 0.5 + t * 0.003) * 1.5 + 4;
                    ctx.fillStyle = flagColors[k % 5];
                    ctx.fillRect(fx - 1.5, gY - 30 + sag, 3, 4);
                }
            } else if (s.kind === 'hikepeak') {
                ctx.fillStyle = '#3a2818';
                ctx.beginPath();
                ctx.moveTo(px - 70, gY); ctx.lineTo(px - 30, gY - 28); ctx.lineTo(px - 10, gY - 18);
                ctx.lineTo(px + 5, gY - 48); ctx.lineTo(px + 25, gY - 22); ctx.lineTo(px + 70, gY);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#e9d8b0';
                ctx.beginPath();
                ctx.moveTo(px - 2, gY - 42); ctx.lineTo(px + 5, gY - 48); ctx.lineTo(px + 12, gY - 42);
                ctx.lineTo(px + 8, gY - 38); ctx.lineTo(px, gY - 38); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#5a3a22'; ctx.fillRect(px + 4.5, gY - 60, 1, 12);
                const wave = Math.sin(t * 0.006) * 2;
                ctx.fillStyle = '#a4332e';
                ctx.beginPath(); ctx.moveTo(px + 5.5, gY - 60); ctx.lineTo(px + 14 + wave, gY - 57);
                ctx.lineTo(px + 5.5, gY - 54); ctx.closePath(); ctx.fill();
                const vb = Math.sin(t * 0.005) * 0.6;
                ctx.fillStyle = '#2a1810'; ctx.fillRect(px + 3, gY - 46 + vb, 1.6, 6);
                ctx.beginPath(); ctx.arc(px + 3.8, gY - 48 + vb, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px + 3.8, gY - 46 + vb); ctx.lineTo(px + 1, gY - 50 + vb);
                ctx.moveTo(px + 3.8, gY - 46 + vb); ctx.lineTo(px + 6.5, gY - 50 + vb);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
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

        // === STORY BEATS · drop into school story (-380 → -260) ===
        // BEAT 1 · EXAM ANXIETY · tiny figure with paper + wobbling head
        const wobble = Math.sin(t * 0.006) * 0.8;
        const ex = px - 380;
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(ex - 1.5, gY - 8, 1.5, 8);
        ctx.fillRect(ex + 0.5, gY - 8, 1.5, 8);
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(ex - 2, gY - 14, 5, 6);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(ex + wobble, gY - 17, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(ex - 1 + wobble, gY - 17.5, 0.6, 0.6);
        ctx.fillRect(ex + 0.5 + wobble, gY - 17.5, 0.6, 0.6);
        ctx.fillRect(ex - 0.5 + wobble, gY - 15.5, 1.2, 0.5);
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(ex + 3, gY - 26, 14, 18);
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.4;
        ctx.strokeRect(ex + 3, gY - 26, 14, 18);
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(ex + 5, gY - 22, 10, 0.5);
        ctx.fillRect(ex + 5, gY - 19, 10, 0.5);
        ctx.fillRect(ex + 5, gY - 16, 6, 0.5);
        ctx.fillStyle = '#a4332e';
        ctx.fillRect(ex + 13, gY - 24, 3, 0.8); ctx.fillRect(ex + 14, gY - 25.5, 0.8, 3);
        ctx.fillRect(ex + 5, gY - 13, 3, 0.8);  ctx.fillRect(ex + 6, gY - 14.5, 0.8, 3);
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex + 2, gY - 13); ctx.lineTo(ex + 5, gY - 18); ctx.stroke();

        // BEAT 2 · TRIPS · backpack with sleeping bag + camera
        const tx = px - 340;
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(tx, gY - 18, 16, 18);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(tx + 2, gY - 14, 12, 3);
        ctx.fillRect(tx + 2, gY - 8, 12, 2);
        ctx.fillStyle = '#a86434';
        ctx.fillRect(tx - 1, gY - 22, 18, 5);
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(tx - 1, gY - 22, 18, 0.8);
        ctx.fillRect(tx + 4, gY - 22, 0.8, 5);
        ctx.fillRect(tx + 11, gY - 22, 0.8, 5);
        ctx.fillStyle = '#2a1810'; ctx.fillRect(tx + 20, gY - 7, 9, 6);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(tx + 22, gY - 9, 5, 2);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(tx + 24.5, gY - 4, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(tx + 27, gY - 6, 0.8, 0.8);

        // BEAT 3 · CHIT-CHAT · two kids facing each other, speech bubble + nod
        const cmx = px - 300;
        const nod = Math.sin(t * 0.005) * 0.6;
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(cmx - 1.5, gY - 8, 1.5, 8); ctx.fillRect(cmx + 0.5, gY - 8, 1.5, 8);
        ctx.fillStyle = color; ctx.fillRect(cmx - 2, gY - 14, 5, 6);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(cmx, gY - 17 + nod, 2.3, 0, Math.PI * 2); ctx.fill();
        const nod2 = Math.sin(t * 0.005 + Math.PI) * 0.6;
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(cmx + 14.5, gY - 8, 1.5, 8); ctx.fillRect(cmx + 16.5, gY - 8, 1.5, 8);
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(cmx + 14, gY - 14, 5, 6);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(cmx + 16, gY - 17 + nod2, 2.3, 0, Math.PI * 2); ctx.fill();
        const bbx = cmx + 4, bby = gY - 28;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath();
        ctx.moveTo(bbx + 2, bby);
        ctx.lineTo(bbx + 8, bby); ctx.quadraticCurveTo(bbx + 10, bby, bbx + 10, bby + 2);
        ctx.lineTo(bbx + 10, bby + 5); ctx.quadraticCurveTo(bbx + 10, bby + 7, bbx + 8, bby + 7);
        ctx.lineTo(bbx + 5, bby + 7); ctx.lineTo(bbx + 3, bby + 10); ctx.lineTo(bbx + 4, bby + 7);
        ctx.lineTo(bbx + 2, bby + 7); ctx.quadraticCurveTo(bbx, bby + 7, bbx, bby + 5);
        ctx.lineTo(bbx, bby + 2); ctx.quadraticCurveTo(bbx, bby, bbx + 2, bby);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3a22';
        ctx.font = '6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('...', bbx + 5, bby + 4);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

        // BEAT 4 · SCHOOL ASSEMBLY STAGE · platform + mic + figure with certificate
        const stx = px - 260;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(stx - 15, gY - 12, 30, 12);
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(stx - 15, gY - 12, 30, 2);
        ctx.fillStyle = '#3a2418';
        ctx.fillRect(stx - 5, gY - 10, 0.6, 10);
        ctx.fillRect(stx + 5, gY - 10, 0.6, 10);
        ctx.fillStyle = '#2a1810'; ctx.fillRect(stx - 10, gY - 22, 0.8, 10);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(stx - 9.6, gY - 23, 1.6, 0, Math.PI * 2); ctx.fill();
        const fx = stx + 5;
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(fx - 1.5, gY - 20, 1.5, 8);
        ctx.fillRect(fx + 0.5, gY - 20, 1.5, 8);
        ctx.fillStyle = color; ctx.fillRect(fx - 2, gY - 26, 5, 6);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(fx, gY - 29, 2.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(fx - 2, gY - 24); ctx.lineTo(fx - 3, gY - 34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx + 2, gY - 24); ctx.lineTo(fx + 3, gY - 34); ctx.stroke();
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(fx - 5, gY - 37, 10, 5);
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.4;
        ctx.strokeRect(fx - 5, gY - 37, 10, 5);
        ctx.fillStyle = '#a4332e';
        ctx.beginPath(); ctx.arc(fx + 3, gY - 34.5, 0.8, 0, Math.PI * 2); ctx.fill();

        // === EXPANDED BEAT OVERLAYS (additive — bigger + cachier) ===
        // EXAM+ · ticking wall clock + sweat drop + open-mouth gasp
        const clockX = ex + 28, clockY = gY - 32;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(clockX, clockY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.arc(clockX, clockY, 6, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            ctx.fillStyle = '#2a1810';
            ctx.fillRect(clockX + Math.cos(ang) * 5 - 0.3, clockY + Math.sin(ang) * 5 - 0.3, 0.6, 0.6);
        }
        const minA = (t * 0.004) % (Math.PI * 2);
        const hrA  = (t * 0.0006) % (Math.PI * 2);
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(hrA - Math.PI/2) * 3, clockY + Math.sin(hrA - Math.PI/2) * 3); ctx.stroke();
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(minA - Math.PI/2) * 4.5, clockY + Math.sin(minA - Math.PI/2) * 4.5); ctx.stroke();
        const sweatY = (t * 0.04) % 6;
        ctx.fillStyle = '#7fc4d4';
        ctx.beginPath(); ctx.arc(ex - 3 + wobble, gY - 14 + sweatY, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(ex - 0.6 + wobble, gY - 15.2, 1.3, 0.9);

        // TRIPS+ · sunglasses on backpack + straw hat + photo album + palm tree
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(tx + 2, gY - 12, 3, 1.5); ctx.fillRect(tx + 10, gY - 12, 3, 1.5);
        ctx.fillRect(tx + 5, gY - 11.5, 5, 0.5);
        ctx.fillStyle = '#7a4a26';
        ctx.fillRect(tx + 2, gY - 26, 12, 1.5);
        ctx.beginPath(); ctx.arc(tx + 8, gY - 27, 3.5, Math.PI, 2*Math.PI); ctx.fill();
        ctx.fillStyle = '#a4332e';
        ctx.fillRect(tx + 5, gY - 26.5, 6, 0.8);
        ctx.fillRect(tx + 14, gY - 16, 5, 7);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(tx + 15, gY - 15, 3, 2);
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(tx + 34, gY - 24, 1.5, 24);
        for (let i = 0; i < 5; i++) {
            const ang = -Math.PI/2 + (i - 2) * 0.5 + Math.sin(t * 0.002 + i) * 0.06;
            ctx.lineWidth = 1.4; ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(tx + 34.7, gY - 24);
            ctx.lineTo(tx + 34.7 + Math.cos(ang) * 7, gY - 24 + Math.sin(ang) * 7);
            ctx.stroke();
        }

        // CHIT-CHAT+ · animated mouth bobs + second speech bubble + lunchbox
        const mouth1 = (Math.sin(t * 0.014) + 1) * 0.5;
        const mouth2 = (Math.sin(t * 0.014 + Math.PI) + 1) * 0.5;
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(cmx - 0.7, gY - 16 + nod, 1.4, 0.4 + mouth1 * 0.8);
        ctx.fillRect(cmx + 15.3, gY - 16 + nod2, 1.4, 0.4 + mouth2 * 0.8);
        const bb2x = cmx + 18, bb2y = gY - 30;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath();
        ctx.moveTo(bb2x, bb2y);
        ctx.lineTo(bb2x + 10, bb2y);
        ctx.quadraticCurveTo(bb2x + 12, bb2y, bb2x + 12, bb2y + 2);
        ctx.lineTo(bb2x + 12, bb2y + 6);
        ctx.quadraticCurveTo(bb2x + 12, bb2y + 8, bb2x + 10, bb2y + 8);
        ctx.lineTo(bb2x + 4, bb2y + 8); ctx.lineTo(bb2x + 2, bb2y + 11); ctx.lineTo(bb2x + 3, bb2y + 8);
        ctx.quadraticCurveTo(bb2x, bb2y + 8, bb2x, bb2y + 6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3a22'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
        ctx.fillText('!!', bb2x + 6, bb2y + 5);
        ctx.textAlign = 'start';
        ctx.fillStyle = '#a4332e'; ctx.fillRect(cmx + 5, gY - 6, 7, 5);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(cmx + 6, gY - 5, 5, 1);
        ctx.fillStyle = '#2a1810'; ctx.fillRect(cmx + 8, gY - 7, 1, 1);

        // STAGE+ · red velvet curtains + spotlight + applause audience
        const curtTop = gY - 50, curtBot = gY - 10;
        ctx.fillStyle = '#7a1f1a';
        ctx.fillRect(stx - 22, curtTop, 7, curtBot - curtTop);
        ctx.fillRect(stx + 15, curtTop, 7, curtBot - curtTop);
        ctx.fillStyle = '#a4332e';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(stx - 21 + i * 1.6, curtTop, 0.6, curtBot - curtTop);
            ctx.fillRect(stx + 16 + i * 1.6, curtTop, 0.6, curtBot - curtTop);
        }
        ctx.fillStyle = '#d4a653';
        ctx.fillRect(stx - 22, curtTop - 1.5, 44, 1.8);
        const conGrad = ctx.createLinearGradient(fx, gY - 60, fx, gY - 22);
        conGrad.addColorStop(0, 'rgba(233,216,176,0.45)');
        conGrad.addColorStop(1, 'rgba(233,216,176,0)');
        ctx.fillStyle = conGrad;
        ctx.beginPath();
        ctx.moveTo(fx - 1, gY - 60); ctx.lineTo(fx + 1, gY - 60);
        ctx.lineTo(fx + 9, gY - 22); ctx.lineTo(fx - 9, gY - 22); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 4; i++) {
            const hx2 = stx - 14 + i * 9;
            const clap = Math.abs(Math.sin(t * 0.012 + i)) * 1.5;
            ctx.fillStyle = '#1a0e08';
            ctx.fillRect(hx2 - 2.5, gY - 6, 5, 6);
            ctx.beginPath(); ctx.arc(hx2, gY - 8, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(hx2 - 3 - clap, gY - 6, 1.2, 1.2);
            ctx.fillRect(hx2 + 2 + clap, gY - 6, 1.2, 1.2);
        }

        // === SKY-TIER BEATS · football/race/cricket/cultural-dance ===
        // FOOTBALL MATCH · two 3-kid teams, stick goalposts, sliding defender
        const fmx = px - 380, fmy = gY - 80;
        ctx.fillStyle = 'rgba(42,24,16,0.22)';
        for (let i = 0; i < 14; i++) ctx.fillRect(fmx - 30 + i * 4.5, fmy - 14, 2.5, 4);
        ctx.strokeStyle = '#e9d8b0'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(fmx - 32, fmy); ctx.lineTo(fmx - 32, fmy - 9); ctx.lineTo(fmx - 24, fmy - 9); ctx.lineTo(fmx - 24, fmy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fmx + 24, fmy); ctx.lineTo(fmx + 24, fmy - 9); ctx.lineTo(fmx + 32, fmy - 9); ctx.lineTo(fmx + 32, fmy); ctx.stroke();
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(fmx - 34, fmy + 0.5); ctx.lineTo(fmx + 34, fmy + 0.5); ctx.stroke();
        const teamA = [{x: fmx - 18, c: color}, {x: fmx - 10, c: color}, {x: fmx - 2, c: color}];
        const teamB = [{x: fmx + 4, c: '#a4332e'}, {x: fmx + 12, c: '#a4332e'}, {x: fmx + 20, c: '#a4332e'}];
        teamA.concat(teamB).forEach((k, i) => {
            const s = Math.sin(t * 0.012 + i * 0.7) * 2.4;
            ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(k.x, fmy - 6); ctx.lineTo(k.x - 1.5 + s, fmy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(k.x, fmy - 6); ctx.lineTo(k.x + 1.5 - s, fmy); ctx.stroke();
            ctx.fillStyle = k.c; ctx.fillRect(k.x - 1.5, fmy - 11, 3, 5);
            ctx.fillStyle = '#a86434';
            ctx.beginPath(); ctx.arc(k.x, fmy - 13, 1.5, 0, Math.PI * 2); ctx.fill();
        });
        const slideX = fmx + 1 + Math.sin(t * 0.003) * 1.5;
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(slideX - 4, fmy - 1.5, 7, 2);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(slideX + 4, fmy - 1, 1.4, 0, Math.PI * 2); ctx.fill();
        const ballArc = Math.abs(Math.sin(t * 0.0035));
        const bX = fmx - 8 + ballArc * 16, bY = fmy - 6 - Math.sin(t * 0.0035 * Math.PI) * 5;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(bX, bY, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1810'; ctx.fillRect(bX - 0.4, bY - 0.4, 0.8, 0.8);

        // SPORTS DAY · 100m race · 4 runners crossing red ribbon
        const sdx = px - 340, sdy = gY - 80;
        ctx.fillStyle = 'rgba(42,24,16,0.28)';
        for (let i = 0; i < 8; i++) {
            const ax = sdx - 28 + i * 8;
            const ay = sdy - 13 + Math.abs(Math.sin(t * 0.008 + i)) * 1.5;
            ctx.beginPath(); ctx.arc(ax, ay, 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(ax - 1.5, ay + 1, 3, 4);
        }
        ctx.strokeStyle = '#7a4a26'; ctx.lineWidth = 0.3;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath(); ctx.moveTo(sdx - 32, sdy - 3 + i * 1.5); ctx.lineTo(sdx + 26, sdy - 3 + i * 1.5); ctx.stroke();
        }
        const ribFl = Math.sin(t * 0.006) * 0.6;
        ctx.strokeStyle = '#a4332e'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(sdx + 18, sdy - 8); ctx.lineTo(sdx + 18 + ribFl, sdy + 4); ctx.stroke();
        for (let i = 0; i < 4; i++) {
            const rx = sdx - 8 + i * 6 + Math.sin(t * 0.01 + i * 0.5) * 0.4;
            const ry = sdy - 2 + i * 1.5;
            const stride = Math.sin(t * 0.018 + i * 1.1) * 2.5;
            ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(rx, ry - 5); ctx.lineTo(rx - 2 + stride, ry); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx, ry - 5); ctx.lineTo(rx + 2 - stride, ry); ctx.stroke();
            ctx.fillStyle = i % 2 ? color : '#a4332e'; ctx.fillRect(rx - 1.5, ry - 10, 3, 5);
            ctx.beginPath(); ctx.moveTo(rx - 1.5, ry - 8); ctx.lineTo(rx - 4 - stride * 0.6, ry - 5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx + 1.5, ry - 8); ctx.lineTo(rx + 4 + stride * 0.6, ry - 5); ctx.stroke();
            ctx.fillStyle = '#a86434';
            ctx.beginPath(); ctx.arc(rx, ry - 12, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#2a1810'; ctx.fillRect(sdx - 32, sdy - 8, 1, 6);
        ctx.fillRect(sdx - 33, sdy - 8, 3, 1);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(sdx - 33, sdy - 13, 3, 5);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(sdx - 31.5, sdy - 15, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(sdx - 28, sdy - 8, 0.9, 0, Math.PI * 2); ctx.fill();

        // CRICKET MATCH · batsman + bowler + stumps + fielders
        const ckx = px - 300, cky = gY - 80;
        ctx.fillStyle = '#c9b27a'; ctx.fillRect(ckx - 18, cky - 1, 38, 2.5);
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.3;
        ctx.strokeRect(ckx - 18, cky - 1, 38, 2.5);
        ctx.strokeStyle = '#e9d8b0'; ctx.lineWidth = 0.7;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.moveTo(ckx + 18 + i * 1.5, cky - 10); ctx.lineTo(ckx + 18 + i * 1.5, cky - 1); ctx.stroke();
        }
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(ckx + 17.5, cky - 10.5, 2, 0.5);
        ctx.fillRect(ckx + 19.5, cky - 10.5, 2, 0.5);
        const bsx = ckx + 12;
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bsx, cky - 6); ctx.lineTo(bsx - 2, cky); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bsx, cky - 6); ctx.lineTo(bsx + 2, cky); ctx.stroke();
        ctx.fillStyle = color; ctx.fillRect(bsx - 2, cky - 12, 4, 6);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(bsx, cky - 14, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#7a4a26'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(bsx - 1, cky - 11); ctx.lineTo(bsx - 6, cky - 18); ctx.stroke();
        ctx.fillStyle = '#a86434'; ctx.fillRect(bsx - 7, cky - 20, 2.5, 5);
        const bwx = ckx - 16;
        const armAng = Math.sin(t * 0.005) * 0.4 - Math.PI / 2 - 0.6;
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bwx, cky - 6); ctx.lineTo(bwx - 2, cky); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bwx, cky - 6); ctx.lineTo(bwx + 2, cky); ctx.stroke();
        ctx.fillStyle = '#a4332e'; ctx.fillRect(bwx - 2, cky - 12, 4, 6);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(bwx, cky - 14, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bwx + 1, cky - 11);
        ctx.lineTo(bwx + 1 + Math.cos(armAng) * 5, cky - 11 + Math.sin(armAng) * 5); ctx.stroke();
        const ckBallX = bwx + 4 + ((t * 0.05) % 24);
        ctx.fillStyle = '#a4332e';
        ctx.beginPath(); ctx.arc(ckBallX, cky - 3 - Math.sin((ckBallX - bwx) * 0.2) * 1.2, 1.1, 0, Math.PI * 2); ctx.fill();
        [{x: ckx + 26}, {x: ckx - 26}].forEach(f => {
            ctx.fillStyle = '#5a3a22'; ctx.fillRect(f.x - 1.5, cky - 11, 3, 5);
            ctx.fillStyle = '#a86434';
            ctx.beginPath(); ctx.arc(f.x, cky - 13, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(f.x, cky - 6); ctx.lineTo(f.x - 1.5, cky); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(f.x, cky - 6); ctx.lineTo(f.x + 1.5, cky); ctx.stroke();
        });

        // ANNUAL DAY CULTURAL · 5 dancers in costume + conductor + audience
        const adx = px - 260, ady = gY - 80;
        ctx.fillStyle = 'rgba(26,14,8,0.55)';
        for (let i = 0; i < 7; i++) {
            const hx3 = adx - 22 + i * 6;
            ctx.beginPath(); ctx.arc(hx3, ady + 5, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(hx3 - 2, ady + 6, 4, 3);
        }
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(adx - 24, ady - 2, 48, 4);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(adx - 24, ady - 2, 48, 1);
        ctx.fillRect(adx - 24, ady + 1.5, 48, 0.5);
        ctx.fillStyle = 'rgba(122,31,26,0.55)'; ctx.fillRect(adx - 24, ady - 22, 48, 20);
        for (let i = 0; i < 5; i++) {
            const dx2 = adx - 18 + i * 9;
            const dSway = Math.sin(t * 0.006 + i * 0.9) * 1.5;
            const armUp = Math.sin(t * 0.006 + i * 0.9 + Math.PI / 4) * 0.4;
            ctx.fillStyle = i % 2 ? '#a4332e' : '#d4a653';
            ctx.beginPath();
            ctx.moveTo(dx2 - 3, ady - 2); ctx.lineTo(dx2 + 3, ady - 2);
            ctx.lineTo(dx2 + 4, ady - 8); ctx.lineTo(dx2 - 4, ady - 8); ctx.closePath(); ctx.fill();
            ctx.fillStyle = i % 2 ? '#d4a653' : color;
            ctx.fillRect(dx2 - 2, ady - 13, 4, 5);
            ctx.fillStyle = '#a86434';
            ctx.beginPath(); ctx.arc(dx2 + dSway * 0.3, ady - 15.5, 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#a86434'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(dx2 - 1.5, ady - 12);
            ctx.lineTo(dx2 - 4, ady - 18 + armUp); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(dx2 + 1.5, ady - 12);
            ctx.lineTo(dx2 + 4, ady - 18 - armUp); ctx.stroke();
            ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.moveTo(dx2 - 1, ady - 2); ctx.lineTo(dx2 - 1.5 + dSway * 0.3, ady + 1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(dx2 + 1, ady - 2); ctx.lineTo(dx2 + 1.5 - dSway * 0.3, ady + 1); ctx.stroke();
        }
        const tcx2 = adx - 28;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(tcx2 - 2, ady - 10, 4, 8);
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(tcx2, ady - 13, 1.7, 0, Math.PI * 2); ctx.fill();
        const baton = Math.sin(t * 0.01) * 0.5 - Math.PI / 3;
        ctx.strokeStyle = '#a86434'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(tcx2 + 1, ady - 10);
        ctx.lineTo(tcx2 + 1 + Math.cos(baton) * 6, ady - 10 + Math.sin(baton) * 6); ctx.stroke();
        ctx.strokeStyle = '#e9d8b0'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(tcx2 + 1 + Math.cos(baton) * 6, ady - 10 + Math.sin(baton) * 6);
        ctx.lineTo(tcx2 + 1 + Math.cos(baton) * 10, ady - 10 + Math.sin(baton) * 10); ctx.stroke();

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

        // (CMR-local day/night cycle removed — replaced by the unified
        // player-driven cycle in drawSky which covers the entire world.
        // The PU grind now blends with every other chapter's celestial
        // arc rather than being an isolated effect.)

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

        // === STORY BEATS · drop into PU pressure-cooker (-380 → -260) ===
        // BEAT 1 · TUITION RUSH · 3 students hurrying right
        const trX = px - 380;
        for (let i = 0; i < 3; i++) {
            const sxR = trX + i * 9;
            const phaseR = t / 220 + i * 0.7;
            const bobR = Math.sin(phaseR) * 0.7;
            const strideR = Math.sin(phaseR) * 1.4;
            ctx.fillStyle = '#2a2018';
            ctx.fillRect(sxR - 1.2, gY - 11 + bobR, 2.4, 6);
            ctx.beginPath();
            ctx.arc(sxR, gY - 13 + bobR, 1.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5e7a8a';
            ctx.fillRect(sxR - 1.8, gY - 9 + bobR, 1.2, 2.5);
            ctx.fillStyle = '#2a2018';
            ctx.fillRect(sxR - 1, gY - 5 + bobR, 0.8, 5 - Math.abs(strideR));
            ctx.fillRect(sxR + 0.2, gY - 5 + bobR, 0.8, 5 - Math.abs(strideR * 0.6));
        }

        // BEAT 2 · MOCK TEST RESULTS · notice board
        const nbX = px - 340, nbY = gY - 24;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(nbX - 0.5, gY - 14, 1, 14);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(nbX - 16, nbY, 32, 18);
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(nbX - 16, nbY, 32, 3);
        ctx.fillStyle = '#5a3a22'; ctx.font = '4px monospace';
        ctx.fillText('RANKS', nbX - 14, nbY + 2.5);
        for (let r = 0; r < 4; r++) {
            const ry = nbY + 5 + r * 3.2;
            if (r === 0) { ctx.fillStyle = '#a4332e'; ctx.fillRect(nbX - 15, ry - 0.5, 30, 3); }
            ctx.fillStyle = r === 0 ? '#e9d8b0' : '#5a3a22';
            ctx.fillRect(nbX - 14, ry + 0.8, 18, 0.7);
            ctx.fillRect(nbX + 6, ry + 0.8, 6, 0.7);
        }

        // BEAT 3 · LATE NIGHT STUDY · table with lamp glow + notebook + mug
        const lsX = px - 300;
        const flicker = 0.75 + Math.sin(t / 180) * 0.12 + Math.sin(t / 73) * 0.05;
        const lgrad = ctx.createRadialGradient(lsX, gY - 14, 0, lsX, gY - 14, 22);
        lgrad.addColorStop(0, `rgba(212, 166, 83, ${0.55 * flicker})`);
        lgrad.addColorStop(1, 'rgba(212, 166, 83, 0)');
        ctx.fillStyle = lgrad;
        ctx.fillRect(lsX - 22, gY - 36, 44, 36);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(lsX - 12, gY - 6, 24, 2);
        ctx.fillRect(lsX - 11, gY - 4, 1.5, 4); ctx.fillRect(lsX + 9.5, gY - 4, 1.5, 4);
        ctx.fillStyle = '#2a2018'; ctx.fillRect(lsX + 5, gY - 18, 1, 12);
        ctx.fillStyle = '#5e7a8a';
        ctx.beginPath();
        ctx.moveTo(lsX + 2, gY - 18); ctx.lineTo(lsX + 9, gY - 18);
        ctx.lineTo(lsX + 7, gY - 13); ctx.lineTo(lsX + 4, gY - 13); ctx.fill();
        ctx.fillStyle = `rgba(233, 216, 176, ${flicker})`;
        ctx.fillRect(lsX + 4.5, gY - 13, 2, 1);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(lsX - 9, gY - 7, 10, 1);
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(lsX - 8, gY - 6.5); ctx.lineTo(lsX - 2, gY - 6.5);
        ctx.moveTo(lsX - 8, gY - 6.2); ctx.lineTo(lsX - 3, gY - 6.2); ctx.stroke();
        ctx.fillStyle = '#d4a653'; ctx.fillRect(lsX + 2, gY - 9, 3, 3);
        ctx.fillStyle = '#2a1808'; ctx.fillRect(lsX + 2.5, gY - 8.5, 2, 1);

        // BEAT 4 · PU GRADUATION CERTIFICATE · scroll with red ribbon + mortarboard
        const gcX = px - 260;
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(gcX - 8, gY - 4, 16, 3);
        ctx.fillStyle = '#d4c090';
        ctx.fillRect(gcX - 8, gY - 4, 16, 0.6);
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(gcX - 9, gY - 4.5, 1.5, 4); ctx.fillRect(gcX + 7.5, gY - 4.5, 1.5, 4);
        ctx.fillStyle = '#a4332e';
        ctx.fillRect(gcX - 0.8, gY - 4.5, 1.6, 4);
        ctx.fillRect(gcX - 2, gY - 1.5, 1.5, 1.5);
        ctx.fillRect(gcX + 0.5, gY - 1.5, 1.5, 1.5);
        ctx.fillStyle = '#2a2018'; ctx.fillRect(gcX + 4, gY - 9, 5, 3);
        ctx.beginPath();
        ctx.moveTo(gcX + 1, gY - 10); ctx.lineTo(gcX + 12, gY - 10);
        ctx.lineTo(gcX + 11, gY - 8.5); ctx.lineTo(gcX + 2, gY - 8.5); ctx.fill();
        ctx.fillStyle = '#d4a653'; ctx.fillRect(gcX + 8, gY - 9.5, 0.6, 3);
        ctx.beginPath();
        ctx.arc(gcX + 8.3, gY - 6.2, 1.1, 0, Math.PI * 2); ctx.fill();

        // === SOCIAL/JOY BEATS · group study + movie + cricket + crush ===
        // GROUP STUDY · 4 friends at round table, one asleep, lamp glow
        const gsX = px - 540;
        ctx.fillStyle = '#7a4a26';
        ctx.beginPath(); ctx.ellipse(gsX, gY - 8, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(gsX - 1, gY - 8, 2, 8);
        const gsFlick = 0.7 + Math.sin(t / 200) * 0.1;
        const gsGrad = ctx.createRadialGradient(gsX, gY - 10, 0, gsX, gY - 10, 18);
        gsGrad.addColorStop(0, `rgba(212, 166, 83, ${0.4 * gsFlick})`);
        gsGrad.addColorStop(1, 'rgba(212, 166, 83, 0)');
        ctx.fillStyle = gsGrad; ctx.fillRect(gsX - 20, gY - 26, 40, 22);
        const friends = [
            { dx: 0,   dy: -18, asleep: false, point: false },
            { dx: 14,  dy: -14, asleep: false, point: true },
            { dx: 0,   dy: -10, asleep: true,  point: false },
            { dx: -14, dy: -14, asleep: false, point: false },
        ];
        for (let i = 0; i < friends.length; i++) {
            const f = friends[i];
            const fx = gsX + f.dx, fy = gY + f.dy;
            const yawn = (i === 0) ? Math.sin(t / 600) * 0.6 : 0;
            ctx.fillStyle = '#2a2018';
            if (f.asleep) {
                ctx.beginPath(); ctx.ellipse(fx, gY - 9, 2.2, 1.3, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#5e7a8a'; ctx.fillRect(fx - 2.5, gY - 8, 5, 2);
            } else {
                ctx.beginPath(); ctx.arc(fx, fy + yawn, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = i % 2 ? '#5e7a8a' : '#a4332e';
                ctx.fillRect(fx - 1.8, fy + 1.4 + yawn, 3.6, 3.5);
                if (f.point) {
                    ctx.strokeStyle = '#e9d8b0'; ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(fx - 1, fy + 3); ctx.lineTo(fx - 5, fy + 5); ctx.stroke();
                }
            }
        }
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(gsX - 8, gY - 9, 5, 1.4);
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(gsX + 3, gY - 9, 5, 1.4);
        const pageT = (Math.sin(t / 700) + 1) * 0.5;
        ctx.fillStyle = `rgba(233, 216, 176, ${0.6 + pageT * 0.3})`;
        ctx.fillRect(gsX - 8 + pageT * 4, gY - 9.5, 0.6, 1.5);
        ctx.fillStyle = '#a4332e'; ctx.fillRect(gsX - 14, gY - 10, 2, 2);
        ctx.fillStyle = '#d4a653'; ctx.fillRect(gsX + 11, gY - 10, 2, 2);
        ctx.fillStyle = `rgba(233, 216, 176, ${0.5 + Math.sin(t / 500) * 0.3})`;
        ctx.font = '5px monospace';
        ctx.fillText('z', gsX + 3, gY - 12 + Math.sin(t / 400) * 0.8);
        ctx.fillText('Z', gsX + 5, gY - 16 + Math.sin(t / 400 + 0.5) * 0.8);

        // MOVIE NIGHT · cinema with marquee + 4 teens walking in
        const mvX = px - 490;
        ctx.fillStyle = '#2a2018'; ctx.fillRect(mvX - 22, gY - 38, 44, 38);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(mvX - 24, gY - 42, 48, 6);
        const neonOn = (Math.floor(t / 350) % 2) === 0;
        for (let bN = 0; bN < 7; bN++) {
            const bxN = mvX - 22 + bN * 7.5;
            ctx.fillStyle = neonOn
                ? `rgba(255, 107, 157, ${0.7 + Math.sin(t / 200 + bN) * 0.25})`
                : 'rgba(212, 166, 83, 0.4)';
            ctx.fillRect(bxN, gY - 43, 1.8, 1.8);
        }
        ctx.fillStyle = '#a4332e'; ctx.fillRect(mvX - 18, gY - 34, 16, 22);
        ctx.fillStyle = '#d4a653'; ctx.fillRect(mvX - 17, gY - 26, 14, 2);
        ctx.fillStyle = '#2a2018'; ctx.fillRect(mvX - 17, gY - 22, 14, 1);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(mvX - 16, gY - 18, 4, 4);
        ctx.fillRect(mvX - 10, gY - 18, 4, 4);
        ctx.fillStyle = '#d4a653'; ctx.fillRect(mvX + 4, gY - 18, 16, 10);
        ctx.fillStyle = '#2a1808'; ctx.fillRect(mvX + 6, gY - 16, 12, 1);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(mvX + 4, gY - 8, 16, 1.5);
        ctx.fillStyle = `rgba(212, 166, 83, ${neonOn ? 0.45 : 0.2})`;
        ctx.fillRect(mvX - 4, gY - 14, 8, 14);
        for (let p = 0; p < 4; p++) {
            const txM = mvX - 36 + p * 4;
            const bobM = Math.sin(t / 240 + p * 0.6) * 0.5;
            ctx.fillStyle = '#2a2018';
            ctx.beginPath(); ctx.arc(txM, gY - 13 + bobM, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = ['#5e7a8a', '#a4332e', '#7a4a26', '#5e7a8a'][p];
            ctx.fillRect(txM - 1.3, gY - 11 + bobM, 2.6, 4);
            ctx.fillStyle = '#2a2018';
            ctx.fillRect(txM - 1.2, gY - 7 + bobM, 1, 4);
            ctx.fillRect(txM + 0.3, gY - 7 + bobM, 1, 4);
        }
        ctx.fillStyle = '#a4332e'; ctx.fillRect(mvX - 30, gY - 10, 3, 4);
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(mvX - 29.5, gY - 10.5, 0.7, 0, Math.PI * 2);
        ctx.arc(mvX - 28.5, gY - 11, 0.7, 0, Math.PI * 2);
        ctx.arc(mvX - 27.5, gY - 10.5, 0.7, 0, Math.PI * 2); ctx.fill();

        // CRICKET WEEKEND · bowler + batsman + 2 fielders + stumps
        const ckX = px - 440;
        ctx.fillStyle = '#3a4a28'; ctx.fillRect(ckX - 30, gY - 1, 60, 1);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(ckX - 30, gY - 14, 60, 5);
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(ckX - 30, gY - 14, 60, 0.6);
        const bowlCycle = (t % 2400) / 2400;
        const ballX = ckX - 18 + bowlCycle * 30;
        const ballY = gY - 7 - Math.sin(bowlCycle * Math.PI) * 6;
        const armPhase = bowlCycle * Math.PI * 2;
        const bowlerX = ckX - 22;
        ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.arc(bowlerX, gY - 13, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bowlerX - 1.5, gY - 11, 3, 5);
        ctx.fillStyle = '#2a2018';
        ctx.fillRect(bowlerX - 1.2, gY - 6, 1, 6); ctx.fillRect(bowlerX + 0.3, gY - 6, 1, 6);
        ctx.strokeStyle = '#e9d8b0'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bowlerX, gY - 10);
        ctx.lineTo(bowlerX + Math.cos(armPhase) * 3.5, gY - 10 + Math.sin(armPhase) * 3.5);
        ctx.stroke();
        if (bowlCycle > 0.15) {
            ctx.fillStyle = '#a4332e';
            ctx.beginPath(); ctx.arc(ballX, ballY, 1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(ckX + 10, gY - 8, 0.6, 8);
        ctx.fillRect(ckX + 12, gY - 8, 0.6, 8);
        ctx.fillRect(ckX + 14, gY - 8, 0.6, 8);
        ctx.fillRect(ckX + 10, gY - 8.5, 5, 0.4);
        const batsmanX = ckX + 17;
        const batSwing = Math.sin(bowlCycle * Math.PI * 2 - 0.6) * 0.8;
        ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.arc(batsmanX, gY - 13, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(batsmanX - 1.5, gY - 11, 3, 5);
        ctx.fillStyle = '#2a2018';
        ctx.fillRect(batsmanX - 1.2, gY - 6, 1, 6); ctx.fillRect(batsmanX + 0.3, gY - 6, 1, 6);
        ctx.strokeStyle = '#7a4a26'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(batsmanX + 1.5, gY - 8);
        ctx.lineTo(batsmanX + 4 + batSwing, gY - 2 + Math.abs(batSwing)); ctx.stroke();
        for (let fld = 0; fld < 2; fld++) {
            const fxC = ckX + 24 + fld * 5;
            const fyC = gY - 10 + fld * 1;
            ctx.fillStyle = '#2a2018';
            ctx.beginPath(); ctx.arc(fxC, fyC - 2, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#a4332e'; ctx.fillRect(fxC - 1, fyC, 2, 3);
            ctx.fillStyle = '#2a2018';
            ctx.fillRect(fxC - 0.8, fyC + 3, 0.7, 3);
            ctx.fillRect(fxC + 0.1, fyC + 3, 0.7, 3);
        }

        // FIRST CRUSH · park bench + 2 teens + butterflies + sparkles
        const cbX = px - 390;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(cbX - 14, gY - 5, 28, 1.5);
        ctx.fillRect(cbX - 14, gY - 11, 28, 1.2);
        ctx.fillRect(cbX - 13, gY - 11, 0.6, 6);
        ctx.fillRect(cbX + 12, gY - 11, 0.6, 6);
        ctx.fillStyle = '#7a4a26';
        ctx.fillRect(cbX - 14, gY - 5, 0.8, 5); ctx.fillRect(cbX + 13, gY - 5, 0.8, 5);
        const blush = 0.4 + Math.sin(t / 700) * 0.35;
        ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.arc(cbX - 5, gY - 14, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, 107, 157, ${blush * 0.7})`;
        ctx.fillRect(cbX - 6.5, gY - 13.5, 0.9, 0.9);
        ctx.fillRect(cbX - 4, gY - 13.5, 0.9, 0.9);
        ctx.fillStyle = '#5e7a8a'; ctx.fillRect(cbX - 7, gY - 12, 4, 7);
        ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.arc(cbX + 5, gY - 14, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, 107, 157, ${blush * 0.7})`;
        ctx.fillRect(cbX + 3.6, gY - 13.5, 0.9, 0.9);
        ctx.fillRect(cbX + 6.1, gY - 13.5, 0.9, 0.9);
        ctx.fillStyle = '#a4332e'; ctx.fillRect(cbX + 3, gY - 12, 4, 7);
        for (let bf = 0; bf < 6; bf++) {
            const phaseBF = t / 600 + bf * 1.1;
            const bxF = cbX + Math.sin(phaseBF) * 14 + (bf - 3) * 3;
            const byF = gY - 22 - bf * 2 + Math.cos(phaseBF * 1.4) * 2;
            const flap = Math.abs(Math.sin(t / 90 + bf));
            ctx.fillStyle = bf % 2 ? '#ff6b9d' : '#d4a653';
            ctx.beginPath();
            ctx.ellipse(bxF - 0.8, byF, 0.9, 0.4 + flap * 1.1, 0, 0, Math.PI * 2);
            ctx.ellipse(bxF + 0.8, byF, 0.9, 0.4 + flap * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2a2018'; ctx.fillRect(bxF - 0.15, byF - 0.4, 0.3, 1);
        }
        for (let sp = 0; sp < 4; sp++) {
            const sFade = 0.4 + Math.sin(t / 400 + sp * 1.3) * 0.4;
            const sxP = cbX - 6 + sp * 4;
            const syP = gY - 28 + Math.sin(t / 500 + sp) * 1.2;
            ctx.fillStyle = `rgba(255, 107, 157, ${sFade})`;
            if (sp % 2) {
                ctx.fillRect(sxP - 0.6, syP, 0.7, 0.7);
                ctx.fillRect(sxP + 0.2, syP, 0.7, 0.7);
                ctx.fillRect(sxP - 0.3, syP + 0.6, 0.9, 0.5);
            } else {
                ctx.fillRect(sxP - 0.3, syP - 1, 0.6, 2);
                ctx.fillRect(sxP - 1, syP - 0.3, 2, 0.6);
            }
        }

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

        // EXAM-DAY WALL CLOCK · in window 2_0 (lit, top-left of bank)
        const clkX = px - 36 + 0 * 16 + 5;
        const clkY = gY - 116 + 2 * 30 + 7;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(clkX, clkY, 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(clkX, clkY, 4.2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#2a2018';
        ctx.fillRect(clkX - 0.3, clkY - 4, 0.6, 1);
        ctx.fillRect(clkX + 3, clkY - 0.3, 1, 0.6);
        ctx.fillRect(clkX - 0.3, clkY + 3, 0.6, 1);
        ctx.fillRect(clkX - 4, clkY - 0.3, 1, 0.6);
        // 10:55 hands · exam-anxious time
        ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(clkX, clkY);
        ctx.lineTo(clkX + Math.cos(-Math.PI / 2 - 1.13) * 2.2,
                   clkY + Math.sin(-Math.PI / 2 - 1.13) * 2.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(clkX, clkY);
        ctx.lineTo(clkX + Math.cos(-Math.PI / 2 - 0.52) * 3.2,
                   clkY + Math.sin(-Math.PI / 2 - 0.52) * 3.2); ctx.stroke();
        // second hand · 1Hz jerk
        const sec = Math.floor(t / 1000) % 60;
        const sa = -Math.PI / 2 + (sec / 60) * Math.PI * 2;
        ctx.strokeStyle = '#a4332e'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(clkX, clkY);
        ctx.lineTo(clkX + Math.cos(sa) * 3.6, clkY + Math.sin(sa) * 3.6); ctx.stroke();

        // SWEAT/TENSION LINES around hunched student in window 3_2
        const sxw = px - 36 + 2 * 16 + 5;
        const syw = gY - 116 + 3 * 30 + 6;
        ctx.strokeStyle = '#a4332e'; ctx.lineWidth = 0.5;
        const pulseT = 0.6 + Math.sin(t / 220) * 0.4;
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = a * pulseT;
        ctx.beginPath();
        ctx.moveTo(sxw - 4, syw - 3); ctx.lineTo(sxw - 6, syw - 6);
        ctx.moveTo(sxw + 4, syw - 3); ctx.lineTo(sxw + 6, syw - 6);
        ctx.moveTo(sxw, syw - 5);     ctx.lineTo(sxw, syw - 8);
        ctx.stroke();
        ctx.globalAlpha = prevAlpha;

        // STORM CLOUD · mental-pressure scar over top-right corner
        const cbreath = Math.sin(t / 900) * 1.2;
        ctx.fillStyle = 'rgba(42, 32, 24, 0.78)';
        ctx.beginPath();
        ctx.arc(px + 38 + cbreath, gY - 132, 6, 0, Math.PI * 2);
        ctx.arc(px + 46, gY - 134, 5, 0, Math.PI * 2);
        ctx.arc(px + 52 - cbreath, gY - 131, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a4332e'; ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(px + 44, gY - 126); ctx.lineTo(px + 42, gY - 122);
        ctx.lineTo(px + 45, gY - 122); ctx.lineTo(px + 43, gY - 118);
        ctx.stroke();

        // EXAM PAPER · folded sheet on path with red correction marks
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(px - 158, gY - 4, 12, 4);
        ctx.fillStyle = '#d4c090'; ctx.fillRect(px - 158, gY - 4, 12, 1);
        ctx.fillStyle = '#a4332e'; ctx.font = '5px monospace';
        ctx.fillText('+', px - 156, gY - 1);
        ctx.fillText('+', px - 152, gY - 1);
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(px - 156, gY - 3, 3, 0.5);
        ctx.fillRect(px - 156, gY - 2, 4, 0.5);

        // EXAM IN SESSION sign on wooden stake
        const stkX = px + 22;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(stkX, gY - 14, 1, 14);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(stkX - 14, gY - 22, 28, 9);
        ctx.strokeStyle = '#a4332e'; ctx.lineWidth = 0.5;
        ctx.strokeRect(stkX - 14, gY - 22, 28, 9);
        ctx.fillStyle = '#a4332e'; ctx.font = '5px monospace';
        ctx.fillText('EXAM IN', stkX - 12, gY - 17);
        ctx.fillText('SESSION', stkX - 12, gY - 14);

        // SECOND TUITION BILLBOARD · right side, balances the left one
        const b2x = px + 210, b2y = gY - 72;
        ctx.fillStyle = '#3a2418'; ctx.fillRect(b2x - 1, b2y, 2, 72);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(b2x - 34, b2y - 4, 68, 28);
        ctx.fillStyle = '#a4332e'; ctx.fillRect(b2x - 34, b2y - 4, 68, 6);
        ctx.fillStyle = '#e9d8b0'; ctx.font = '6px monospace';
        ctx.fillText('CET PREP', b2x - 30, b2y + 1);
        ctx.fillStyle = '#5a3a22';
        ctx.fillText('PHYSICS', b2x - 30, b2y + 10);
        ctx.fillText('JEE 2014', b2x - 30, b2y + 18);

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

        // === STORY BEATS · drop into college years (-380 → -260) ===
        // BEAT 1 · HOSTEL ROOM · bunk + lit laptop + poster
        const hx = px - 380;
        ctx.fillStyle = '#1f1810';
        ctx.fillRect(hx - 18, gY - 34, 22, 34);
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(hx - 17, gY - 32, 20, 3);
        ctx.fillRect(hx - 17, gY - 18, 20, 3);
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(hx - 16, gY - 30, 6, 2); ctx.fillRect(hx - 16, gY - 16, 6, 2);
        ctx.fillStyle = color;
        ctx.fillRect(hx - 15, gY - 48, 10, 10);
        ctx.fillStyle = '#1f1810';
        ctx.fillRect(hx - 13, gY - 45, 6, 1); ctx.fillRect(hx - 13, gY - 42, 4, 1);
        ctx.fillStyle = '#3a2418';
        ctx.fillRect(hx + 6, gY - 10, 20, 2);
        ctx.fillRect(hx + 8, gY - 10, 2, 10); ctx.fillRect(hx + 22, gY - 10, 2, 10);
        ctx.fillStyle = '#1f1810';
        ctx.fillRect(hx + 10, gY - 12, 14, 2);
        ctx.fillRect(hx + 10, gY - 22, 14, 10);
        const lg2 = ctx.createRadialGradient(hx + 17, gY - 17, 0, hx + 17, gY - 17, 10);
        lg2.addColorStop(0, '#7fffd4'); lg2.addColorStop(1, 'rgba(127,255,212,0)');
        ctx.fillStyle = lg2; ctx.fillRect(hx + 4, gY - 28, 26, 18);
        ctx.fillStyle = '#7fffd4';
        ctx.fillRect(hx + 11, gY - 21, 12, 8);

        // BEAT 2 · FEST STAGE · DJ booth + speakers + bouncing bars + crowd
        const sxF = px - 340;
        ctx.fillStyle = '#1f1810';
        ctx.fillRect(sxF - 14, gY - 18, 28, 18);
        ctx.fillRect(sxF - 22, gY - 28, 6, 28); ctx.fillRect(sxF + 16, gY - 28, 6, 28);
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(sxF - 19, gY - 20, 2, 0, Math.PI * 2);
        ctx.arc(sxF + 19, gY - 20, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) {
            const bh = 4 + Math.abs(Math.sin(t * 0.012 + i * 0.9)) * 12;
            ctx.fillRect(sxF - 10 + i * 5, gY - 16 - bh, 3, bh);
        }
        ctx.fillStyle = '#1f1810';
        for (let i = 0; i < 3; i++) {
            const cxp = sxF - 6 + i * 7;
            ctx.fillRect(cxp - 2, gY - 8, 4, 8);
            ctx.beginPath(); ctx.arc(cxp, gY - 10, 2.2, 0, Math.PI * 2); ctx.fill();
        }

        // BEAT 3 · GROUP RIDE · 3 cyclists pedaling together
        const grx = px - 300;
        for (let i = 0; i < 3; i++) {
            const bobC = Math.sin(t * 0.012 + i * 1.1) * 1.2;
            drawBicycle(grx + i * 16, gY + bobC, i === 1 ? '#d4a653' : color);
            ctx.fillStyle = '#e8c498';
            ctx.beginPath(); ctx.arc(grx + i * 16 + 4, gY - 22 + bobC, 2.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = i === 1 ? color : '#2a3a5a';
            ctx.fillRect(grx + i * 16 + 2, gY - 19 + bobC, 6, 8);
        }

        // BEAT 4 · CONVOCATION · airborne cap + scroll + falling letters
        const vxC = px - 260;
        const capY = gY - 40 - Math.abs(Math.sin(t * 0.003)) * 24;
        const capR = Math.sin(t * 0.004) * 0.25;
        ctx.save(); ctx.translate(vxC, capY); ctx.rotate(capR);
        ctx.fillStyle = '#1f1810';
        ctx.fillRect(-8, -1, 16, 3);
        ctx.beginPath();
        ctx.moveTo(-5, 1); ctx.lineTo(5, 1); ctx.lineTo(3, 5); ctx.lineTo(-3, 5); ctx.fill();
        ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(8, 6); ctx.stroke();
        ctx.fillStyle = '#d4a653'; ctx.fillRect(7, 5, 2, 3);
        ctx.restore();
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(vxC - 8, gY - 4, 16, 4);
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(vxC - 8, gY - 4, 2, 4); ctx.fillRect(vxC + 6, gY - 4, 2, 4);
        ctx.strokeStyle = '#c47540'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(vxC - 2, gY - 2); ctx.lineTo(vxC + 2, gY - 2); ctx.stroke();
        const letters = ['D', 'S', 'C', 'E'];
        const conf = ['#c47540', '#d4a653', '#7fffd4', '#e9d8b0'];
        for (let i = 0; i < 4; i++) {
            const fall = ((t * 0.05 + i * 90) % 80);
            const cxp = vxC - 14 + i * 8 + Math.sin(t * 0.003 + i) * 3;
            const cyp = gY - 60 + fall;
            const rot = (t * 0.005 + i) % (Math.PI * 2);
            ctx.save(); ctx.translate(cxp, cyp); ctx.rotate(rot);
            ctx.fillStyle = conf[i]; ctx.fillRect(-2, -2, 4, 4);
            ctx.fillStyle = '#1f1810'; ctx.font = 'bold 4px monospace';
            ctx.textAlign = 'center'; ctx.fillText(letters[i], 0, 1.5);
            ctx.restore();
        }
        ctx.textAlign = 'start';

        // === EXPANDED BEAT OVERLAYS (additive — bigger + cachier) ===
        // HOSTEL+ · 3 wall posters + study table with lamp glow + sleeping bunkmate
        ctx.fillStyle = '#d4a653'; ctx.fillRect(hx - 14, gY - 56, 4, 6);
        ctx.fillStyle = color;     ctx.fillRect(hx - 9, gY - 56, 4, 6);
        ctx.fillStyle = '#7fffd4'; ctx.fillRect(hx - 4, gY - 56, 4, 6);
        ctx.strokeStyle = '#0a0604'; ctx.lineWidth = 0.4;
        ctx.strokeRect(hx - 14, gY - 56, 4, 6);
        ctx.strokeRect(hx - 9, gY - 56, 4, 6);
        ctx.strokeRect(hx - 4, gY - 56, 4, 6);
        ctx.fillStyle = '#3a2418';
        ctx.fillRect(hx - 16, gY - 14, 12, 1.5);
        ctx.fillRect(hx - 15, gY - 14, 1, 14); ctx.fillRect(hx - 6, gY - 14, 1, 14);
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath();
        ctx.moveTo(hx - 14, gY - 14); ctx.lineTo(hx - 10, gY - 16); ctx.lineTo(hx - 6, gY - 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a2418'; ctx.fillRect(hx - 8, gY - 22, 0.8, 8);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(hx - 10, gY - 22); ctx.lineTo(hx - 6, gY - 22); ctx.lineTo(hx - 7, gY - 26); ctx.lineTo(hx - 9, gY - 26); ctx.closePath(); ctx.fill();
        const lampGlow = ctx.createRadialGradient(hx - 8, gY - 22, 0, hx - 8, gY - 22, 9);
        lampGlow.addColorStop(0, 'rgba(212,166,83,0.5)'); lampGlow.addColorStop(1, 'rgba(212,166,83,0)');
        ctx.fillStyle = lampGlow; ctx.fillRect(hx - 17, gY - 30, 16, 18);
        ctx.fillStyle = '#7a1f1a'; ctx.fillRect(hx - 14, gY - 36, 14, 4);
        ctx.beginPath(); ctx.arc(hx - 11, gY - 36, 2.6, Math.PI, 2 * Math.PI); ctx.fill();
        const zBob = Math.sin(t * 0.003) * 1;
        ctx.fillStyle = '#e9d8b0'; ctx.font = 'bold 5px monospace';
        ctx.fillText('z', hx - 6, gY - 38 + zBob);
        ctx.fillText('Z', hx - 3, gY - 42 + zBob);

        // FEST+ · laser beams + glowing speaker grills + falling confetti
        for (let i = 0; i < 4; i++) {
            const lp = (Math.sin(t * 0.008 + i * 1.3) + 1) * 0.5;
            ctx.strokeStyle = `rgba(212,166,83,${0.25 + lp * 0.55})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(sxF - 19, gY - 20);
            ctx.lineTo(sxF - 19 + (i - 1.5) * 9, gY - 38 - lp * 6);
            ctx.stroke();
            ctx.strokeStyle = `rgba(127,255,212,${0.2 + (1 - lp) * 0.5})`;
            ctx.beginPath();
            ctx.moveTo(sxF + 19, gY - 20);
            ctx.lineTo(sxF + 19 - (i - 1.5) * 9, gY - 38 - (1 - lp) * 6);
            ctx.stroke();
        }
        const grillG = ctx.createRadialGradient(sxF - 19, gY - 20, 0, sxF - 19, gY - 20, 6);
        grillG.addColorStop(0, 'rgba(212,166,83,0.7)'); grillG.addColorStop(1, 'rgba(212,166,83,0)');
        ctx.fillStyle = grillG; ctx.fillRect(sxF - 26, gY - 27, 14, 14);
        const grillG2 = ctx.createRadialGradient(sxF + 19, gY - 20, 0, sxF + 19, gY - 20, 6);
        grillG2.addColorStop(0, 'rgba(212,166,83,0.7)'); grillG2.addColorStop(1, 'rgba(212,166,83,0)');
        ctx.fillStyle = grillG2; ctx.fillRect(sxF + 12, gY - 27, 14, 14);
        const confC = ['#d4a653', '#7fffd4', '#c47540', '#e9d8b0'];
        for (let i = 0; i < 10; i++) {
            const cf = ((t * 0.04 + i * 30) % 60);
            const cfx = sxF - 18 + i * 4 + Math.sin(t * 0.003 + i) * 2;
            const cfy = gY - 50 + cf;
            ctx.fillStyle = confC[i % 4];
            ctx.fillRect(cfx, cfy, 1.5, 1.5);
        }

        // GROUP RIDE+ · varied helmets + dust trail
        const helmets = ['#a4332e', '#d4a653', '#7fffd4'];
        for (let i = 0; i < 3; i++) {
            const bobC2 = Math.sin(t * 0.012 + i * 1.1) * 1.2;
            ctx.fillStyle = helmets[i];
            ctx.beginPath();
            ctx.arc(grx + i * 16 + 4, gY - 24 + bobC2, 2.8, Math.PI, 2 * Math.PI);
            ctx.fill();
            ctx.fillRect(grx + i * 16 + 1.2, gY - 24 + bobC2, 5.6, 0.8);
        }
        const dustPuff = (Math.sin(t * 0.01) + 1) * 0.5;
        ctx.fillStyle = `rgba(196,117,64,${0.25 + dustPuff * 0.3})`;
        for (let i = 0; i < 5; i++) {
            const dx = grx - 4 - i * 4;
            const dr = 2 + Math.sin(t * 0.004 + i) * 0.6 - i * 0.25;
            if (dr > 0.4) { ctx.beginPath(); ctx.arc(dx, gY - 4, dr, 0, Math.PI * 2); ctx.fill(); }
        }

        // CONVOCATION+ · parents watching + 4 floating balloons
        ctx.fillStyle = '#1f1810';
        for (let i = 0; i < 2; i++) {
            const pxw = vxC - 22 + i * 6;
            ctx.fillRect(pxw - 2, gY - 12, 4, 12);
            ctx.beginPath(); ctx.arc(pxw, gY - 14, 2, 0, Math.PI * 2); ctx.fill();
        }
        const balC = ['#a4332e', color, '#d4a653', '#7fffd4'];
        for (let i = 0; i < 4; i++) {
            const bob = Math.sin(t * 0.003 + i * 0.7) * 2;
            const balx = vxC + 18 + i * 6;
            const baly = gY - 50 + bob - i * 1.5;
            ctx.fillStyle = balC[i];
            ctx.beginPath(); ctx.arc(balx, baly, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 0.4;
            ctx.beginPath(); ctx.moveTo(balx, baly + 2.5); ctx.lineTo(balx - 0.5, baly + 10); ctx.stroke();
        }

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

        // PODCAST BOOTH window · user did voice recordings + podcasts here
        const podX = px - 14, podY = gY - 52;
        ctx.fillStyle = `rgba(255, 140, 80, ${a * 0.5})`;
        ctx.fillRect(podX, podY, 28, 28);
        ctx.fillStyle = color; ctx.fillRect(podX - 1, podY - 2, 30, 2);

        // LARGE BROADCAST MIC + POP FILTER inside booth
        const bmX = podX + 14, bmY = podY + 22;
        ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(bmX, podY + 28); ctx.lineTo(bmX, bmY - 8); ctx.stroke();
        ctx.fillStyle = '#1a1010';
        ctx.beginPath(); ctx.ellipse(bmX, bmY - 12, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9d8b0';
        for (let i = -3; i <= 3; i++) ctx.fillRect(bmX - 4, bmY - 15 + i * 2, 8, 1);
        // pop filter (foam screen)
        ctx.strokeStyle = `rgba(233, 216, 176, ${a * 0.85})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bmX - 6, bmY - 11, 3.5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(233, 216, 176, ${a * 0.4})`;
        ctx.beginPath(); ctx.moveTo(bmX - 4, bmY - 11); ctx.lineTo(bmX, bmY - 11); ctx.stroke();

        // REC indicator · pulsing red dot + "REC" label
        const recPulse = (Math.sin(t * 0.006) + 1) * 0.5;
        ctx.fillStyle = `rgba(255, 60, 50, ${0.4 + recPulse * 0.6})`;
        ctx.beginPath(); ctx.arc(podX + 5, podY + 5, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, 200, 160, ${a * 0.85})`;
        ctx.font = 'bold 5px monospace'; ctx.textAlign = 'left';
        ctx.fillText('REC', podX + 9, podY + 7);

        // WAVEFORM · scrolls in mixing-console top half
        ctx.strokeStyle = `rgba(255, 176, 112, ${a * 0.9})`; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 32; i++) {
            const wx = conX + 3 + i;
            const phaseW = t * 0.005 + i * 0.45;
            const stableNoise = Math.sin(i * 12.9898) * 0.5;
            const amp = (Math.sin(phaseW) + Math.sin(phaseW * 2.3) * 0.5 + stableNoise) * 3.5;
            const wy = conY + 7 + amp;
            if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();

        // PLAYBACK METERS · 4 vertical bars audio-level style
        const metX = conX + 26, metY = conY + 18;
        for (let i = 0; i < 4; i++) {
            const lvl = (Math.sin(t * 0.004 + i * 1.3) + 1) * 0.5 * 5 + 1;
            ctx.fillStyle = '#0a0604'; ctx.fillRect(metX + i * 2.5, metY - 6, 1.5, 6);
            const hue = lvl > 4 ? color : '#ffb070';
            ctx.fillStyle = hue;
            ctx.fillRect(metX + i * 2.5, metY - lvl, 1.5, lvl);
        }

        // "PODCAST" sign on facade
        ctx.fillStyle = '#2a1810'; ctx.fillRect(px - 28, gY - 20, 56, 9);
        ctx.fillStyle = color;
        ctx.font = 'bold 7px "Cinzel", monospace'; ctx.textAlign = 'center';
        ctx.fillText('PODCAST', px, gY - 13);

        // MICROPHONE (foreground, outside studio)
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

        // === STORY BEATS · drop into radio internship (-380 → -260) ===
        const beatY = gY;
        // BEAT 1 · HEADPHONES on stand
        const hpX = px - 380;
        ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hpX, beatY); ctx.lineTo(hpX, beatY - 14); ctx.stroke();
        ctx.fillStyle = '#3a2a20'; ctx.fillRect(hpX - 4, beatY - 1, 8, 2);
        ctx.strokeStyle = '#1a0f0a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(hpX, beatY - 18, 9, Math.PI, Math.PI * 2); ctx.stroke();
        const hpPulse = 0.55 + Math.sin(t * 0.005) * 0.25;
        ctx.fillStyle = '#1a0f0a';
        ctx.fillRect(hpX - 12, beatY - 19, 5, 8); ctx.fillRect(hpX + 7, beatY - 19, 5, 8);
        ctx.fillStyle = `rgba(184, 76, 50, ${a * hpPulse})`;
        ctx.fillRect(hpX - 11, beatY - 17, 3, 4); ctx.fillRect(hpX + 8, beatY - 17, 3, 4);

        // BEAT 2 · SCRIPT BINDER + pen
        const sbX = px - 340;
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(sbX - 14, beatY - 4, 28, 5);
        ctx.fillStyle = '#d8c79e'; ctx.fillRect(sbX - 14, beatY - 4, 28, 1);
        ctx.strokeStyle = 'rgba(58, 42, 32, 0.55)'; ctx.lineWidth = 0.5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sbX - 12, beatY - 3 + i); ctx.lineTo(sbX + 12, beatY - 3 + i); ctx.stroke(); }
        ctx.fillStyle = color;
        ctx.fillRect(sbX - 9, beatY - 3, 6, 0.8); ctx.fillRect(sbX + 1, beatY - 1, 8, 0.8);
        ctx.strokeStyle = '#1a0f0a'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(sbX - 8, beatY - 5); ctx.lineTo(sbX + 10, beatY - 1); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(sbX + 10.5, beatY - 0.7, 1.2, 0, Math.PI * 2); ctx.fill();

        // BEAT 3 · SOUND ENGINEER at console
        const seX = px - 300;
        const seNod = Math.sin(t * 0.0035) * 1.0;
        ctx.fillStyle = '#1a0f0a'; ctx.fillRect(seX + 4, beatY - 12, 14, 6);
        ctx.fillStyle = '#3a2a20'; ctx.fillRect(seX + 4, beatY - 12, 14, 1.5);
        for (let i = 0; i < 4; i++) {
            const slide = Math.sin(t * 0.004 + i * 1.3) * 0.8;
            ctx.fillStyle = i === 1 ? color : '#ffb070';
            ctx.fillRect(seX + 6 + i * 3, beatY - 11 + slide, 1, 3);
        }
        ctx.fillStyle = '#0a0604';
        ctx.beginPath(); ctx.moveTo(seX - 4, beatY); ctx.lineTo(seX - 6, beatY - 9); ctx.lineTo(seX + 3, beatY - 9); ctx.lineTo(seX + 1, beatY); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(seX - 1, beatY - 12 + seNod, 3.2, 0, Math.PI * 2); ctx.fill();

        // BEAT 4 · TRAINEE CERTIFICATE + badge
        const cX = px - 260;
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(cX - 14, beatY - 4, 22, 4);
        ctx.fillStyle = '#d8c79e'; ctx.fillRect(cX - 14, beatY - 4, 22, 1);
        ctx.fillStyle = '#1a0f0a';
        ctx.beginPath(); ctx.arc(cX - 14, beatY - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cX + 8, beatY - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cX - 4, beatY - 5); ctx.lineTo(cX - 4, beatY + 1); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(cX - 4, beatY - 5); ctx.lineTo(cX - 7, beatY - 8); ctx.lineTo(cX - 1, beatY - 7); ctx.closePath(); ctx.fill();
        const sealPulse = collected ? 1 : 0.7 + Math.sin(t * 0.004) * 0.3;
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(cX + 2, beatY - 2, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, 220, 140, ${a * sealPulse * 0.6})`;
        ctx.beginPath(); ctx.arc(cX + 2, beatY - 2, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(cX + 14, beatY - 8, 4, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        ctx.fillStyle = '#1a0f0a'; ctx.fillRect(cX + 11, beatY - 5, 8, 6);
        ctx.fillStyle = color; ctx.fillRect(cX + 11, beatY - 5, 8, 1.2);
        ctx.fillStyle = '#d4a653'; ctx.fillRect(cX + 12.5, beatY - 2.5, 5, 0.8);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(cX + 12.5, beatY - 1.2, 5, 0.8);

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
        const tMs = state.elapsedMs;
        ctx.globalAlpha = a;

        // === STORY BEATS · drop into first-job arc (-380 → -260) ===
        // BEAT 1 · INTERVIEW DAY · nervous figure + desk + light cone
        const ix = px - 380;
        ctx.fillStyle = 'rgba(201,161,81,0.18)';
        ctx.beginPath(); ctx.moveTo(ix + 18, gY - 56); ctx.lineTo(ix + 4, gY - 6); ctx.lineTo(ix + 32, gY - 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c9a151'; ctx.fillRect(ix + 16, gY - 58, 4, 3);
        ctx.fillStyle = '#1a1610'; ctx.fillRect(ix + 22, gY - 16, 18, 2); ctx.fillRect(ix + 24, gY - 14, 2, 14); ctx.fillRect(ix + 36, gY - 14, 2, 14);
        ctx.fillRect(ix + 6, gY - 14, 10, 2); ctx.fillRect(ix + 6, gY - 14, 2, 14);
        const nodI = Math.sin(tMs / 480) * 1.2;
        ctx.fillStyle = '#1a1610';
        ctx.fillRect(ix + 8, gY - 12, 6, 6);
        ctx.beginPath(); ctx.arc(ix + 11, gY - 16 + nodI, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(ix + 13, gY - 11, 4, 5);
        ctx.fillStyle = '#1a1610'; ctx.fillRect(ix + 14, gY - 10, 2, 1); ctx.fillRect(ix + 14, gY - 8, 2, 1);

        // BEAT 2 · FIRST DAY BADGE · lanyard on stake swinging
        const bxBadge = px - 340;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(bxBadge + 10, gY - 22, 1.5, 22);
        const swing = Math.sin(tMs / 600) * 0.35;
        ctx.save();
        ctx.translate(bxBadge + 11, gY - 20);
        ctx.rotate(swing);
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3, 8); ctx.moveTo(0, 0); ctx.lineTo(3, 8); ctx.stroke();
        ctx.fillStyle = '#c9a151'; ctx.fillRect(-5, 8, 10, 8);
        ctx.fillStyle = '#1a1610';
        ctx.font = '2.4px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('SAKHA', 0, 11.5);
        ctx.fillText('EMP01', 0, 14.5);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(-1, 7.5, 2, 1);
        ctx.restore();
        ctx.textAlign = 'start';

        // BEAT 3 · TEAM LUNCH · table + 2 colleagues + laptop
        const lx = px - 300;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(lx, gY - 10, 36, 2);
        ctx.fillRect(lx + 2, gY - 8, 2, 8); ctx.fillRect(lx + 32, gY - 8, 2, 8);
        ctx.fillStyle = '#c9a151'; ctx.fillRect(lx + 4, gY - 14, 6, 4);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(lx + 12, gY - 13, 5, 3);
        ctx.fillStyle = '#1a1610'; ctx.fillRect(lx + 20, gY - 14, 10, 1);
        ctx.fillRect(lx + 21, gY - 19, 8, 5);
        ctx.fillStyle = '#3a5a8a'; ctx.fillRect(lx + 22, gY - 18, 6, 3);
        ctx.fillStyle = '#1a1610';
        const lean = Math.sin(tMs / 900) * 0.8;
        ctx.beginPath(); ctx.arc(lx + 8, gY - 22 + lean, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(lx + 28, gY - 22 - lean, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(lx + 5, gY - 19, 6, 5); ctx.fillRect(lx + 25, gY - 19, 6, 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(lx + 7, gY - 15); ctx.quadraticCurveTo(lx + 6 + Math.sin(tMs/300), gY - 18, lx + 8, gY - 21); ctx.stroke();

        // BEAT 4 · FIRST PAYCHECK + ALTO KEYS
        const kx = px - 260;
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(kx, gY - 5, 22, 8);
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.5;
        ctx.strokeRect(kx + 0.5, gY - 4.5, 21, 7);
        ctx.beginPath(); ctx.moveTo(kx, gY - 5); ctx.lineTo(kx + 11, gY - 1); ctx.lineTo(kx + 22, gY - 5); ctx.stroke();
        ctx.fillStyle = '#1a1610'; ctx.font = '2.6px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('FIRST PAY', kx + 11, gY + 1);
        ctx.textAlign = 'start';
        const glint = (Math.sin(tMs / 250) + 1) * 0.5;
        ctx.strokeStyle = '#c0c4cc'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(kx + 28, gY - 2, 2.2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#c0c4cc'; ctx.fillRect(kx + 29, gY - 1, 6, 1.5);
        ctx.fillRect(kx + 33, gY, 1, 1); ctx.fillRect(kx + 34, gY - 0.5, 1, 1);
        ctx.fillStyle = `rgba(255,255,255,${0.4 + glint * 0.6})`;
        ctx.fillRect(kx + 30, gY - 0.5, 1.5, 0.5);
        ctx.fillStyle = '#1a1610'; ctx.fillRect(kx + 26, gY - 6, 5, 4);
        ctx.fillStyle = '#c9a151'; ctx.fillRect(kx + 27.5, gY - 5, 2, 1.5);

        // === EXPANDED BEAT OVERLAYS (additive — bigger + cachier) ===
        // INTERVIEW+ · interviewer silhouette + framed cert + wall clock at 10:00
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(ix + 26, gY - 24, 5, 8);
        ctx.beginPath(); ctx.arc(ix + 28.5, gY - 26, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1610';
        ctx.fillRect(ix + 25.5, gY - 22, 7, 6);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(ix + 4, gY - 44, 12, 9);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(ix + 5, gY - 43, 10, 7);
        ctx.fillStyle = '#c9a151';
        ctx.fillRect(ix + 6, gY - 41, 8, 0.6); ctx.fillRect(ix + 6, gY - 39, 8, 0.4);
        ctx.beginPath(); ctx.arc(ix + 13, gY - 38, 0.9, 0, Math.PI * 2); ctx.fill();
        const wcX = ix + 36, wcY = gY - 42;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(wcX, wcY, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(wcX, wcY, 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#1a1610'; ctx.font = '2.4px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('10', wcX, wcY - 1.5);
        ctx.textAlign = 'start';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(wcX, wcY);
        ctx.lineTo(wcX + Math.cos(-2 * Math.PI / 3) * 2.4, wcY + Math.sin(-2 * Math.PI / 3) * 2.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wcX, wcY); ctx.lineTo(wcX, wcY - 3.4); ctx.stroke();
        const secA = (tMs / 1000) % (Math.PI * 2);
        ctx.strokeStyle = '#a4332e'; ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(wcX, wcY);
        ctx.lineTo(wcX + Math.cos(secA - Math.PI/2) * 3.6, wcY + Math.sin(secA - Math.PI/2) * 3.6); ctx.stroke();

        // BADGE+ · WELCOME balloon + DAY 1 sticker
        const balBob = Math.sin(tMs / 700) * 1.4;
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(bxBadge + 10.5, gY - 22);
        ctx.lineTo(bxBadge + 14, gY - 34 + balBob);
        ctx.stroke();
        ctx.fillStyle = '#a4332e';
        ctx.beginPath(); ctx.arc(bxBadge + 14, gY - 36 + balBob, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9d8b0'; ctx.font = 'bold 2.4px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('WELCOME', bxBadge + 14, gY - 35.4 + balBob);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(bxBadge + 13, gY - 37 + balBob, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c9a151';
        ctx.beginPath(); ctx.arc(bxBadge + 10.5, gY - 12, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1610';
        ctx.fillText('DAY1', bxBadge + 10.5, gY - 11.3);
        ctx.textAlign = 'start';

        // LUNCH+ · pizza box + sandwich + 3rd colleague
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(lx - 8, gY - 10, 8, 2);
        ctx.fillRect(lx - 6, gY - 8, 2, 8);
        ctx.fillStyle = '#a4332e'; ctx.fillRect(lx - 6, gY - 14, 8, 4);
        ctx.fillStyle = '#1a1610';
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.4;
        ctx.strokeRect(lx - 6 + 0.5, gY - 14 + 0.5, 7, 3);
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(lx - 2, gY - 12, 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath();
        ctx.moveTo(lx + 30, gY - 10); ctx.lineTo(lx + 34, gY - 14); ctx.lineTo(lx + 38, gY - 10);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.3; ctx.stroke();
        ctx.fillStyle = '#7a1f1a';
        ctx.fillRect(lx + 32, gY - 11.5, 4, 0.6);
        const leanC = Math.sin(tMs / 800) * 0.8;
        ctx.fillStyle = '#1a1610';
        ctx.beginPath(); ctx.arc(lx + 40, gY - 22 + leanC, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c9a151';
        ctx.fillRect(lx + 37, gY - 19 + leanC, 6, 5);

        // PAYCHECK+ · piggy bank with coin + calendar with circled date + tiny Alto
        ctx.fillStyle = '#c9a151';
        ctx.beginPath();
        ctx.ellipse(kx + 4, gY - 14, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(kx + 1, gY - 12, 1.4, 2); ctx.fillRect(kx + 5.5, gY - 12, 1.4, 2);
        ctx.fillStyle = '#1a1610';
        ctx.fillRect(kx + 3.5, gY - 17, 1, 0.6);
        ctx.beginPath(); ctx.arc(kx + 7, gY - 15, 0.4, 0, Math.PI * 2); ctx.fill();
        const coinY = ((tMs / 50) % 16);
        if (coinY < 9) {
            ctx.fillStyle = '#d4a653';
            ctx.beginPath(); ctx.arc(kx + 4, gY - 24 + coinY, 0.9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(kx + 12, gY - 18, 10, 9);
        ctx.fillStyle = '#a4332e'; ctx.fillRect(kx + 12, gY - 18, 10, 2);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
            ctx.fillStyle = '#1a1610';
            ctx.fillRect(kx + 13 + c * 2.2, gY - 15 + r * 2.5, 0.5, 0.5);
        }
        ctx.strokeStyle = '#a4332e'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(kx + 17.4, gY - 12.5, 1.4, 0, Math.PI * 2); ctx.stroke();
        ctx.save();
        ctx.globalAlpha = a * 0.55;
        ctx.translate(kx + 30, gY - 18); ctx.scale(0.45, 0.45);
        ctx.fillStyle = '#d9c9a0';
        ctx.fillRect(-14, -6, 28, 6);
        ctx.beginPath();
        ctx.moveTo(-10, -6); ctx.lineTo(-7, -13); ctx.lineTo(8, -13); ctx.lineTo(11, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a1812'; ctx.fillRect(-6, -12, 6, 5); ctx.fillRect(1, -12, 6, 5);
        ctx.fillStyle = '#0a0806';
        ctx.beginPath(); ctx.arc(-8, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // === COVID/OFFICE BEATS · WFH + standup + late-night + outing ===
        // WFH DURING COVID · home desk + blanket + sleeping pet + window
        const wx0 = px - 540;
        ctx.fillStyle = '#7a92a6'; ctx.fillRect(wx0 - 4, gY - 46, 26, 22);
        ctx.fillStyle = '#a8c4d8'; ctx.fillRect(wx0 - 3, gY - 45, 24, 20);
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.5;
        ctx.strokeRect(wx0 - 4, gY - 46, 26, 22);
        ctx.beginPath(); ctx.moveTo(wx0 + 9, gY - 46); ctx.lineTo(wx0 + 9, gY - 24); ctx.moveTo(wx0 - 4, gY - 35); ctx.lineTo(wx0 + 22, gY - 35); ctx.stroke();
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(wx0 + 24, gY - 44, 1, 3);
        ctx.fillStyle = '#5e7a8a';
        ctx.beginPath(); ctx.ellipse(wx0 + 24.5, gY - 39, 2.2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5e7a8a'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(wx0 + 22.5, gY - 41); ctx.lineTo(wx0 + 24, gY - 40); ctx.moveTo(wx0 + 26.5, gY - 41); ctx.lineTo(wx0 + 25, gY - 40); ctx.stroke();
        ctx.fillStyle = '#a4332e'; ctx.fillRect(wx0 - 10, gY - 12, 7, 2);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(wx0 - 9, gY - 14, 6, 2);
        ctx.fillStyle = '#3a5a8a'; ctx.fillRect(wx0 - 11, gY - 16, 8, 2);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(wx0 - 2, gY - 18, 32, 2);
        ctx.fillRect(wx0, gY - 16, 2, 16); ctx.fillRect(wx0 + 26, gY - 16, 2, 16);
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(wx0 + 2, gY - 23, 4, 5);
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.arc(wx0 + 7, gY - 21, 1.4, -Math.PI/2, Math.PI/2); ctx.stroke();
        const steam0 = Math.sin(tMs / 400) * 0.6;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(wx0 + 4, gY - 24); ctx.quadraticCurveTo(wx0 + 4.6 + steam0, gY - 27, wx0 + 4, gY - 30); ctx.stroke();
        ctx.fillStyle = '#1a1610'; ctx.fillRect(wx0 + 10, gY - 18, 14, 1.4);
        ctx.fillRect(wx0 + 11, gY - 26, 12, 8);
        ctx.fillStyle = '#7fffd4'; ctx.fillRect(wx0 + 12, gY - 25, 10, 6);
        ctx.fillStyle = '#1a1610';
        for (let rW = 0; rW < 3; rW++) ctx.fillRect(wx0 + 13, gY - 24 + rW * 2, 4 + (rW % 2) * 3, 0.5);
        const blink0 = Math.floor(tMs / 500) % 2;
        if (blink0) { ctx.fillStyle = '#7fffd4'; ctx.fillRect(wx0 + 20, gY - 20, 0.7, 0.8); }
        ctx.fillStyle = '#3a5a8a';
        ctx.fillRect(wx0 + 4, gY - 12, 8, 8);
        ctx.fillStyle = '#1a1610';
        ctx.beginPath(); ctx.arc(wx0 + 8, gY - 16, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a4332e';
        ctx.beginPath(); ctx.moveTo(wx0 + 2, gY - 14); ctx.lineTo(wx0 + 14, gY - 14); ctx.lineTo(wx0 + 12, gY - 4); ctx.lineTo(wx0 + 4, gY - 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a1f1a';
        ctx.fillRect(wx0 + 5, gY - 11, 8, 0.5); ctx.fillRect(wx0 + 5, gY - 8, 8, 0.5);
        const breath = Math.sin(tMs / 900) * 0.4;
        ctx.fillStyle = '#1a1610';
        ctx.beginPath(); ctx.ellipse(wx0 + 18, gY - 6 - breath, 4, 2 + breath * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(wx0 + 21, gY - 7 - breath, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(wx0 + 20, gY - 8.5 - breath); ctx.lineTo(wx0 + 20.6, gY - 9.6 - breath); ctx.lineTo(wx0 + 21.2, gY - 8.4 - breath); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(wx0 + 21.8, gY - 8.5 - breath); ctx.lineTo(wx0 + 22.2, gY - 9.6 - breath); ctx.lineTo(wx0 + 22.6, gY - 8.4 - breath); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(233,216,176,0.7)'; ctx.font = 'italic 3px sans-serif';
        ctx.fillText('z', wx0 + 23, gY - 10 + Math.sin(tMs / 600) * 0.4);

        // OFFICE STAND-UP · whiteboard with stickies + 5 silhouettes + pointer
        const stX = px - 490;
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(stX - 6, gY - 32, 22, 18);
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.5;
        ctx.strokeRect(stX - 6, gY - 32, 22, 18);
        const stickies = ['#c9a151', '#a4332e', '#7fffd4', '#5e7a8a', '#d4a653'];
        for (let i = 0; i < 5; i++) {
            const sxN = stX - 4 + (i % 3) * 6;
            const syN = gY - 30 + Math.floor(i / 3) * 7;
            const wave = Math.sin(tMs / 500 + i * 1.2) * 0.4;
            ctx.fillStyle = stickies[i];
            ctx.save();
            ctx.translate(sxN + 2.5, syN + 2.5);
            ctx.rotate(wave * 0.05);
            ctx.fillRect(-2.5, -2.5, 5, 5);
            ctx.fillStyle = '#1a1610';
            ctx.fillRect(-1.5, -1, 3, 0.3); ctx.fillRect(-1.5, 0, 2, 0.3);
            ctx.restore();
        }
        const standPos = [
            { x: -10, h: 16 }, { x: -3, h: 18 }, { x: 4, h: 12 }, { x: 11, h: 17 }, { x: 18, h: 16 }
        ];
        for (let i = 0; i < standPos.length; i++) {
            const p = standPos[i];
            const sway = Math.sin(tMs / 700 + i * 0.8) * 0.3;
            ctx.fillStyle = '#1a1610';
            ctx.fillRect(stX + p.x + sway, gY - p.h + 4, 4, p.h - 4);
            ctx.beginPath(); ctx.arc(stX + p.x + 2 + sway, gY - p.h + 2, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(stX - 1, gY - 12); ctx.lineTo(stX + 2, gY - 22); ctx.stroke();

        // LATE-NIGHT CODING · dark office + 1 lit desk + clock at 11
        const nx = px - 440;
        ctx.fillStyle = '#0a0806'; ctx.fillRect(nx - 6, gY - 28, 50, 28);
        for (let d = 0; d < 3; d++) {
            const dx = nx - 4 + d * 16;
            ctx.fillStyle = '#1a1610';
            ctx.fillRect(dx, gY - 12, 12, 1.5);
            ctx.fillRect(dx + 1, gY - 11, 1, 11); ctx.fillRect(dx + 10, gY - 11, 1, 11);
        }
        const flicker = 0.85 + Math.sin(tMs / 130) * 0.08;
        ctx.fillStyle = `rgba(201,161,81,${0.18 * flicker})`;
        ctx.beginPath(); ctx.moveTo(nx, gY - 18); ctx.lineTo(nx - 4, gY - 4); ctx.lineTo(nx + 12, gY - 4); ctx.lineTo(nx + 8, gY - 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(201,161,81,${0.16 * flicker})`;
        ctx.beginPath(); ctx.moveTo(nx + 28, gY - 18); ctx.lineTo(nx + 24, gY - 4); ctx.lineTo(nx + 40, gY - 4); ctx.lineTo(nx + 36, gY - 18); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(nx + 2, gY - 12); ctx.lineTo(nx + 2, gY - 18); ctx.lineTo(nx + 6, gY - 20); ctx.stroke();
        ctx.fillStyle = '#c9a151'; ctx.fillRect(nx + 5, gY - 21, 3, 2);
        ctx.beginPath(); ctx.moveTo(nx + 30, gY - 12); ctx.lineTo(nx + 30, gY - 18); ctx.lineTo(nx + 34, gY - 20); ctx.stroke();
        ctx.fillStyle = '#c9a151'; ctx.fillRect(nx + 33, gY - 21, 3, 2);
        ctx.fillStyle = '#1a1610'; ctx.fillRect(nx + 1, gY - 22, 10, 8);
        ctx.fillStyle = '#0a1a14'; ctx.fillRect(nx + 2, gY - 21, 8, 6);
        ctx.fillStyle = '#7fffd4';
        for (let rN = 0; rN < 4; rN++) {
            const wL = 2 + (rN * 1.3) % 5;
            ctx.fillRect(nx + 3, gY - 20 + rN * 1.5, wL, 0.5);
        }
        const cursor = Math.floor(tMs / 500) % 2;
        if (cursor) { ctx.fillStyle = '#7fffd4'; ctx.fillRect(nx + 9, gY - 16, 0.6, 0.8); }
        ctx.fillStyle = '#1a1610';
        ctx.fillRect(nx + 2, gY - 12, 6, 6);
        ctx.beginPath(); ctx.arc(nx + 5, gY - 14, 2, 0, Math.PI * 2); ctx.fill();
        const ncX = nx + 38, ncY = gY - 28;
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.arc(ncX, ncY, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(ncX, ncY, 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#1a1610'; ctx.font = '2.2px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('11', ncX, ncY - 1.6);
        ctx.textAlign = 'start';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(ncX, ncY);
        ctx.lineTo(ncX + Math.cos(-Math.PI/2 - Math.PI/6) * 2.2, ncY + Math.sin(-Math.PI/2 - Math.PI/6) * 2.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ncX, ncY); ctx.lineTo(ncX, ncY - 3.4); ctx.stroke();
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(nx + 12, gY - 18, 3, 6);
        ctx.fillStyle = '#c9a151'; ctx.fillRect(nx + 12, gY - 18, 3, 1);
        ctx.fillStyle = '#a4332e'; ctx.fillRect(nx + 16, gY - 14, 2, 4);
        ctx.fillStyle = '#3a5a8a'; ctx.fillRect(nx + 19, gY - 13, 2, 3);

        // TEAM OUTING · restaurant booth + table + 4 silhouettes + cheers glasses
        const rxR = px - 390;
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(rxR - 8, gY - 30, 50, 14);
        ctx.fillStyle = '#3a2418'; ctx.fillRect(rxR - 8, gY - 22, 50, 6);
        for (let p = 0; p < 2; p++) {
            const plx = rxR + 6 + p * 22;
            ctx.strokeStyle = '#1a1610'; ctx.lineWidth = 0.4;
            ctx.beginPath(); ctx.moveTo(plx, gY - 30); ctx.lineTo(plx, gY - 24); ctx.stroke();
            ctx.fillStyle = '#c9a151';
            ctx.beginPath(); ctx.moveTo(plx - 2.5, gY - 24); ctx.lineTo(plx + 2.5, gY - 24); ctx.lineTo(plx + 1.5, gY - 20); ctx.lineTo(plx - 1.5, gY - 20); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,140,0.25)';
            ctx.beginPath(); ctx.arc(plx, gY - 19, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(rxR - 4, gY - 10, 38, 2);
        ctx.fillRect(rxR, gY - 8, 2, 8); ctx.fillRect(rxR + 30, gY - 8, 2, 8);
        ctx.fillStyle = '#e9d8b0';
        ctx.beginPath(); ctx.ellipse(rxR + 6, gY - 11, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(rxR + 16, gY - 11, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(rxR + 26, gY - 11, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a4332e'; ctx.fillRect(rxR + 5, gY - 11.5, 2, 0.8);
        ctx.fillStyle = '#7f5a2a'; ctx.fillRect(rxR + 15, gY - 11.5, 2, 0.8);
        ctx.fillStyle = '#4a6a3a'; ctx.fillRect(rxR + 25, gY - 11.5, 2, 0.8);
        const seats = [-2, 8, 18, 28];
        for (let i = 0; i < seats.length; i++) {
            ctx.fillStyle = '#1a1610';
            ctx.fillRect(rxR + seats[i], gY - 18, 5, 8);
            ctx.beginPath(); ctx.arc(rxR + seats[i] + 2.5, gY - 20, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        const clink = Math.sin(tMs / 280);
        const clinkOn = clink > 0.92;
        ctx.fillStyle = 'rgba(180,200,220,0.55)';
        ctx.strokeStyle = '#e9d8b0'; ctx.lineWidth = 0.4;
        const gCx = rxR + 14, gCy = gY - 16;
        const glassPos = [
            { x: gCx - 4, y: gCy }, { x: gCx - 1.5, y: gCy - 1 }, { x: gCx + 1.5, y: gCy - 1 }, { x: gCx + 4, y: gCy }
        ];
        for (const gl of glassPos) {
            ctx.beginPath(); ctx.moveTo(gl.x - 1.5, gl.y - 2); ctx.lineTo(gl.x + 1.5, gl.y - 2); ctx.lineTo(gl.x + 1, gl.y + 1.5); ctx.lineTo(gl.x - 1, gl.y + 1.5); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        if (clinkOn) {
            ctx.fillStyle = 'rgba(255,255,200,0.9)';
            for (let s = 0; s < 4; s++) {
                const ang = s * Math.PI / 2 + tMs / 100;
                ctx.fillRect(gCx + Math.cos(ang) * 2 - 0.4, gCy - 1 + Math.sin(ang) * 2 - 0.4, 0.8, 0.8);
            }
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(gCx, gCy - 1, 0.8, 0, Math.PI * 2); ctx.fill();
        }

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

        // === STORY BEATS · drop into Scripbox AI work (-380 → -260) ===
        // BEAT 1 · ONBOARDING · open laptop + welcome card + lanyard
        const bx1 = px - 380;
        ctx.fillStyle = '#8a6f4a'; ctx.fillRect(bx1 - 14, gY - 8, 32, 8);
        ctx.fillStyle = '#6b5538'; ctx.fillRect(bx1 - 14, gY - 9, 32, 1);
        ctx.save(); ctx.translate(bx1, gY - 8); ctx.rotate(-0.55);
        ctx.fillStyle = '#1a2230'; ctx.fillRect(-12, -14, 24, 14);
        ctx.fillStyle = '#7fffd4'; ctx.globalAlpha = a * 0.75;
        ctx.fillRect(-10, -12, 20, 10); ctx.restore(); ctx.globalAlpha = a;
        ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx1 - 12, gY - 4, 24, 4);
        ctx.fillStyle = '#e9d8b0';
        ctx.fillRect(bx1 + 18, gY - 16, 18, 12);
        ctx.fillStyle = color; ctx.font = '4px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.fillText('WELCOME', bx1 + 27, gY - 10);
        ctx.fillText('SCRIPBOX', bx1 + 27, gY - 6);
        ctx.strokeStyle = color; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(bx1 - 22, gY - 18); ctx.quadraticCurveTo(bx1 - 20, gY - 8, bx1 - 24, gY - 2); ctx.stroke();
        ctx.fillStyle = '#7a9a8a'; ctx.fillRect(bx1 - 28, gY - 2, 10, 8);
        ctx.fillStyle = '#7fffd4'; ctx.fillRect(bx1 - 26, gY, 6, 1); ctx.fillRect(bx1 - 26, gY + 2, 4, 1);

        // BEAT 2 · PR REVIEW · two devs at single laptop
        const bx2 = px - 340; const pt2 = Math.sin(phase * 2.5) * 1.2;
        ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx2 - 8, gY - 2, 16, 2);
        ctx.fillStyle = '#1a2230'; ctx.fillRect(bx2 - 6, gY - 10, 12, 8);
        ctx.fillStyle = '#7fffd4'; ctx.globalAlpha = a * (0.6 + 0.3 * Math.sin(phase * 4));
        for (let i = 0; i < 3; i++) ctx.fillRect(bx2 - 5, gY - 9 + i * 2, 4 + ((i + Math.floor(phase * 2)) % 5), 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#0e1218';
        ctx.beginPath(); ctx.arc(bx2 - 10, gY - 16, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(bx2 - 12, gY - 14, 5, 12);
        ctx.beginPath(); ctx.arc(bx2 + 10, gY - 16, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(bx2 + 8, gY - 14, 5, 12);
        ctx.strokeStyle = '#0e1218'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx2 + 8, gY - 12); ctx.lineTo(bx2 + 2 + pt2, gY - 8); ctx.stroke();

        // BEAT 3 · ANTHROPIC CATALOG · banner + arrow + sparkles
        const bx3 = px - 300; const sp = 0.5 + 0.5 * Math.sin(phase * 3);
        ctx.fillStyle = '#6b5538'; ctx.fillRect(bx3 - 1, gY - 18, 2, 18);
        ctx.globalAlpha = a * (0.4 + 0.4 * sp);
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath(); ctx.arc(bx3, gY - 30, 14, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bx3 - 16, gY - 36, 32, 16);
        ctx.strokeStyle = '#0e1218'; ctx.lineWidth = 0.6; ctx.strokeRect(bx3 - 16, gY - 36, 32, 16);
        ctx.fillStyle = '#0e1218'; ctx.font = 'bold 5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.fillText('ANTHROPIC', bx3, gY - 29);
        ctx.fillStyle = color; ctx.fillText('PR #2913', bx3, gY - 22);
        ctx.strokeStyle = '#7fffd4'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx3 - 22, gY - 28); ctx.lineTo(bx3 - 16, gY - 28);
        ctx.lineTo(bx3 - 19, gY - 30); ctx.moveTo(bx3 - 16, gY - 28); ctx.lineTo(bx3 - 19, gY - 26); ctx.stroke();
        for (let k = 0; k < 4; k++) {
            const sa = (phase * 2 + k * 1.5) % 6.28;
            const skx = bx3 + Math.cos(sa) * 22, sky = gY - 30 + Math.sin(sa) * 14;
            ctx.fillStyle = '#ff6b6b'; ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(phase * 4 + k)));
            ctx.fillRect(skx, sky, 2, 2); ctx.fillRect(skx - 1, sky + 1, 1, 1); ctx.fillRect(skx + 2, sky + 1, 1, 1);
        }
        ctx.globalAlpha = a;

        // BEAT 4 · WHITEBOARD ARCHITECTURE · easel + sticky notes + arrows
        const bx4 = px - 260;
        ctx.strokeStyle = '#6b5538'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(bx4 - 14, gY); ctx.lineTo(bx4 - 8, gY - 30);
        ctx.moveTo(bx4 + 14, gY); ctx.lineTo(bx4 + 8, gY - 30); ctx.stroke();
        ctx.fillStyle = '#f4f1e8'; ctx.fillRect(bx4 - 20, gY - 42, 40, 30);
        ctx.strokeStyle = '#0e1218'; ctx.lineWidth = 0.5; ctx.strokeRect(bx4 - 20, gY - 42, 40, 30);
        const stickies = [['#ff6b6b', -16, -38, 'CLI'], ['#7fffd4', -3, -38, 'SRV'], ['#e9d8b0', 10, -38, 'TLS']];
        stickies.forEach(([col, dx, dy, lbl], i) => {
            const wave = Math.sin(phase * 2 + i) * 0.5;
            ctx.fillStyle = col; ctx.fillRect(bx4 + dx, gY + dy + wave, 8, 8);
            ctx.fillStyle = '#0e1218'; ctx.font = '4px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.fillText(lbl, bx4 + dx + 4, gY + dy + 5 + wave);
        });
        ctx.strokeStyle = '#0e1218'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(bx4 - 8, gY - 34); ctx.lineTo(bx4 - 3, gY - 34);
        ctx.moveTo(bx4 + 5, gY - 34); ctx.lineTo(bx4 + 10, gY - 34); ctx.stroke();
        ctx.fillStyle = '#0e1218';
        ctx.beginPath(); ctx.moveTo(bx4 - 3, gY - 34); ctx.lineTo(bx4 - 5, gY - 35); ctx.lineTo(bx4 - 5, gY - 33); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx4 + 10, gY - 34); ctx.lineTo(bx4 + 8, gY - 35); ctx.lineTo(bx4 + 8, gY - 33); ctx.fill();
        ctx.textAlign = 'start';

        // === AI-ERA BEATS · Claude Code + Anthropic + coffee + traffic ===
        // PAIR-PROGRAMMING WITH CLAUDE CODE · dev + dual monitors + chat
        {
            const bx = px - 540, by = gY - 2;
            ctx.fillStyle = '#3a2418'; ctx.fillRect(bx - 26, by - 12, 56, 3);
            ctx.fillRect(bx - 24, by - 9, 2, 9); ctx.fillRect(bx + 26, by - 9, 2, 9);
            ctx.fillStyle = '#1a1a1f'; ctx.fillRect(bx - 4, by - 4, 8, 6);
            ctx.fillStyle = '#1a1a1f'; ctx.fillRect(bx - 5, by - 18, 10, 8);
            ctx.fillStyle = '#f0d9b5'; ctx.beginPath(); ctx.arc(bx, by - 22, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx - 26, by - 32, 22, 18);
            ctx.fillStyle = '#050a08'; ctx.fillRect(bx - 24, by - 30, 18, 14);
            ctx.fillStyle = '#7fffd4';
            ctx.globalAlpha = a * 0.85;
            for (let i = 0; i < 5; i++) {
                const lw = 4 + ((i * 3 + Math.floor(phase * 2)) % 9);
                ctx.fillRect(bx - 23, by - 29 + i * 3, lw, 1);
            }
            ctx.globalAlpha = a;
            ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx - 18, by - 14, 6, 2);
            ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx + 4, by - 32, 22, 18);
            ctx.fillStyle = '#0e1218'; ctx.fillRect(bx + 6, by - 30, 18, 14);
            ctx.fillStyle = color; ctx.fillRect(bx + 6, by - 30, 18, 2);
            ctx.fillStyle = '#7fffd4'; ctx.font = '3px "JetBrains Mono", monospace'; ctx.textAlign = 'start';
            ctx.fillText('> claude', bx + 7, by - 25);
            ctx.fillStyle = '#d4a653'; ctx.globalAlpha = a * 0.85;
            ctx.fillRect(bx + 7, by - 22, 14, 1);
            ctx.fillRect(bx + 7, by - 20, 10, 1);
            const dot = Math.floor(phase * 3) % 3;
            ctx.fillStyle = '#7fffd4';
            for (let d = 0; d < 3; d++) {
                ctx.globalAlpha = a * (d === dot ? 1 : 0.3);
                ctx.fillRect(bx + 8 + d * 3, by - 17, 1.5, 1.5);
            }
            ctx.globalAlpha = a;
            if (cursorOn) { ctx.fillStyle = '#7fffd4'; ctx.fillRect(bx + 22, by - 17, 1, 2); }
            ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx + 12, by - 14, 6, 2);
            ctx.textAlign = 'start';
        }

        // ANTHROPIC TALK · dev in chair watching big screen with LIVE indicator
        {
            const bx = px - 490, by = gY - 2;
            ctx.fillStyle = '#1a1a1f'; ctx.fillRect(bx + 14, by - 16, 4, 16);
            ctx.fillStyle = '#2a2a32'; ctx.fillRect(bx + 12, by - 14, 8, 10);
            ctx.fillStyle = '#f0d9b5';
            const nod = Math.sin(phase * 1.5) * 0.4;
            ctx.beginPath(); ctx.arc(bx + 16, by - 20 + nod, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx - 22, by - 2, 30, 2);
            ctx.fillRect(bx - 9, by - 8, 4, 6);
            ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx - 24, by - 36, 34, 28);
            ctx.fillStyle = '#1a1814'; ctx.fillRect(bx - 22, by - 34, 30, 24);
            ctx.fillStyle = '#d4a653'; ctx.font = 'bold 4px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.fillText('ANTHROPIC', bx - 7, by - 29);
            ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(bx - 13, by - 25); ctx.lineTo(bx - 10, by - 19); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 10, by - 25); ctx.lineTo(bx - 7, by - 19); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 4, by - 25); ctx.lineTo(bx - 4, by - 19); ctx.stroke();
            ctx.fillStyle = '#0e1218';
            ctx.beginPath(); ctx.arc(bx - 7, by - 16, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(bx - 12, by - 11); ctx.lineTo(bx - 2, by - 11);
            ctx.lineTo(bx - 4, by - 14); ctx.lineTo(bx - 10, by - 14); ctx.closePath(); ctx.fill();
            const live = 0.5 + 0.5 * Math.sin(phase * 5);
            ctx.fillStyle = '#ff6b6b'; ctx.globalAlpha = a * (0.5 + 0.5 * live);
            ctx.beginPath(); ctx.moveTo(bx + 1, by - 33); ctx.lineTo(bx + 4, by - 31.5);
            ctx.lineTo(bx + 1, by - 30); ctx.closePath(); ctx.fill();
            ctx.font = 'bold 3px "JetBrains Mono", monospace';
            ctx.fillText('LIVE', bx + 6, by - 30.5);
            ctx.globalAlpha = a;
            for (let i = 0; i < 12; i++) {
                const h = 1 + ((Math.sin(phase * 6 + i * 0.7) + 1) * 1.2);
                ctx.fillStyle = '#7a9a8a';
                ctx.fillRect(bx - 21 + i * 2.5, by - 12 + (2.4 - h), 1.6, h);
            }
            ctx.textAlign = 'start';
        }

        // COFFEE SETUP AT HOME · pour-over + grinder + scale + beans
        {
            const bx = px - 440, by = gY - 2;
            ctx.fillStyle = '#6b5538'; ctx.fillRect(bx - 30, by - 2, 60, 3);
            ctx.fillStyle = '#3a2418'; ctx.fillRect(bx - 30, by + 1, 60, 1);
            ctx.fillStyle = 'rgba(180,200,210,0.35)';
            ctx.beginPath();
            ctx.moveTo(bx - 22, by - 2); ctx.lineTo(bx - 10, by - 2);
            ctx.lineTo(bx - 12, by - 14); ctx.lineTo(bx - 20, by - 14); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#c8e6d8'; ctx.lineWidth = 0.6; ctx.stroke();
            ctx.fillStyle = '#e9d8b0';
            ctx.beginPath();
            ctx.moveTo(bx - 22, by - 14); ctx.lineTo(bx - 10, by - 14);
            ctx.lineTo(bx - 14, by - 22); ctx.lineTo(bx - 18, by - 22); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#6b5538'; ctx.lineWidth = 0.4; ctx.stroke();
            const dripY = (phase * 12) % 10;
            ctx.fillStyle = '#3a2418';
            ctx.beginPath(); ctx.arc(bx - 16, by - 13 + dripY, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#c8e6d8'; ctx.lineWidth = 0.5;
            for (let s = 0; s < 2; s++) {
                ctx.globalAlpha = a * (0.4 + 0.3 * Math.sin(phase * 2 + s));
                ctx.beginPath();
                ctx.moveTo(bx - 18 + s * 4, by - 24);
                ctx.quadraticCurveTo(bx - 16 + s * 4 + Math.sin(phase * 3 + s) * 1.5, by - 28,
                                     bx - 17 + s * 4, by - 32);
                ctx.stroke();
            }
            ctx.globalAlpha = a;
            ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bx - 4, by - 10, 8, 8);
            ctx.fillStyle = '#3a2418'; ctx.fillRect(bx - 3, by - 9, 6, 2);
            ctx.strokeStyle = '#e9d8b0'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(bx + 5, by - 6, 2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
            ctx.strokeStyle = '#c8e6d8'; ctx.lineWidth = 0.5;
            ctx.globalAlpha = a * (0.4 + 0.4 * Math.sin(phase * 2.5));
            ctx.beginPath();
            ctx.moveTo(bx - 1, by - 11);
            ctx.quadraticCurveTo(bx + 1 + Math.sin(phase * 3) * 1.2, by - 15, bx, by - 19);
            ctx.stroke();
            ctx.globalAlpha = a;
            ctx.fillStyle = '#1a1a1f'; ctx.fillRect(bx + 10, by - 14, 8, 12);
            ctx.fillStyle = '#3a3a42'; ctx.fillRect(bx + 11, by - 13, 6, 4);
            const phG = Math.sin(phase * 6) * 0.6;
            ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx + 14, by - 14); ctx.lineTo(bx + 18 + phG, by - 18 - phG); ctx.stroke();
            ctx.fillStyle = '#d4a653'; ctx.beginPath(); ctx.arc(bx + 18 + phG, by - 18 - phG, 1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0a0e12'; ctx.fillRect(bx + 20, by - 5, 10, 3);
            ctx.fillStyle = '#7fffd4'; ctx.font = '2.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.fillText('18.2g', bx + 25, by - 3);
            ctx.textAlign = 'start';
            ctx.fillStyle = '#3a2418';
            for (let b = 0; b < 5; b++) {
                ctx.beginPath();
                ctx.ellipse(bx - 8 + b * 2.5, by - 0.5, 0.9, 0.5, b * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // BANGALORE TRAFFIC · navy VW in 4-lane jam + auto rickshaw + billboards
        {
            const bx = px - 390, by = gY - 2;
            ctx.fillStyle = '#1a1a1f'; ctx.fillRect(bx - 30, by - 2, 60, 4);
            ctx.fillStyle = '#d4a653'; ctx.globalAlpha = a * 0.35;
            for (let i = 0; i < 4; i++) ctx.fillRect(bx - 28 + i * 16, by, 6, 0.8);
            ctx.globalAlpha = a;
            ctx.strokeStyle = 'rgba(212, 166, 83, 0.25)'; ctx.lineWidth = 0.5;
            for (let h = 0; h < 4; h++) {
                const wob = Math.sin(phase * 4 + h * 1.3) * 1.2;
                ctx.beginPath();
                ctx.moveTo(bx - 26 + h * 14, by - 3);
                ctx.quadraticCurveTo(bx - 22 + h * 14 + wob, by - 6,
                                     bx - 20 + h * 14, by - 8 - Math.abs(wob));
                ctx.stroke();
            }
            ctx.fillStyle = '#3a2418'; ctx.fillRect(bx - 22, by - 26, 1, 12);
            ctx.fillRect(bx - 9, by - 26, 1, 12);
            ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bx - 24, by - 32, 16, 6);
            ctx.fillStyle = '#1d3a5c'; ctx.font = 'bold 3px sans-serif';
            ctx.textAlign = 'center'; ctx.fillText('FLATS', bx - 16, by - 28);
            ctx.fillStyle = '#7a9a8a'; ctx.fillRect(bx - 7, by - 32, 14, 6);
            ctx.fillStyle = '#e9d8b0'; ctx.fillText('REALTY', bx, by - 28);
            ctx.textAlign = 'start';
            const brake = 0.6 + 0.4 * Math.sin(phase * 4);
            for (let c = 0; c < 3; c++) {
                const cxx = bx + 4 + c * 9, cs = 0.85 - c * 0.12;
                ctx.fillStyle = '#0e1218';
                ctx.fillRect(cxx, by - 6 * cs, 8 * cs, 5 * cs);
                ctx.fillRect(cxx + 1 * cs, by - 8 * cs, 6 * cs, 2.5 * cs);
                ctx.fillStyle = '#ff6b6b'; ctx.globalAlpha = a * brake;
                ctx.fillRect(cxx, by - 4 * cs, 1.5 * cs, 1.5 * cs);
                ctx.fillRect(cxx + 6.5 * cs, by - 4 * cs, 1.5 * cs, 1.5 * cs);
                ctx.globalAlpha = a;
            }
            ctx.fillStyle = '#1d3a5c';
            ctx.fillRect(bx - 24, by - 7, 16, 5);
            ctx.beginPath();
            ctx.moveTo(bx - 23, by - 7); ctx.lineTo(bx - 20, by - 11);
            ctx.lineTo(bx - 12, by - 11); ctx.lineTo(bx - 9, by - 7); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#0e1218'; ctx.fillRect(bx - 19, by - 10, 8, 3);
            ctx.fillStyle = '#a4332e'; ctx.fillRect(bx - 11, by - 5, 2, 1);
            ctx.fillStyle = '#0a0e12';
            ctx.beginPath(); ctx.arc(bx - 21, by - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(bx - 11, by - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff6b6b'; ctx.globalAlpha = a * brake;
            ctx.fillRect(bx - 9, by - 5, 1.5, 2);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#1a3a1a'; ctx.fillRect(bx + 12, by - 13, 9, 5);
            ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bx + 13, by - 16, 7, 3);
            ctx.fillStyle = '#0e1218'; ctx.fillRect(bx + 14, by - 15, 5, 1.5);
            ctx.fillStyle = '#0a0e12';
            ctx.beginPath(); ctx.arc(bx + 14, by - 8, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(bx + 19, by - 8, 1.2, 0, Math.PI * 2); ctx.fill();
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
        ctx.globalAlpha = a;

        // === STORY BEATS · drop into GT-delivery story (-380 → -260) ===
        // BEAT 1 · TEST DRIVE · mini sedan with motion trails + stake sign
        {
            const bx = px - 380, by = gY - 2;
            ctx.fillStyle = '#1a1a1f'; ctx.fillRect(bx - 24, by, 50, 3);
            const phaseT = (t * 3) % 1;
            ctx.strokeStyle = color; ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const off = (i + phaseT) * 6;
                ctx.globalAlpha = a * (1 - i / 4) * 0.7;
                ctx.beginPath(); ctx.moveTo(bx - 26 - off, by - 6); ctx.lineTo(bx - 18 - off, by - 6); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(bx - 26 - off, by - 10); ctx.lineTo(bx - 20 - off, by - 10); ctx.stroke();
            }
            ctx.globalAlpha = a;
            drawVwSedan(bx, by, 0.5);
            ctx.fillStyle = '#6b4423'; ctx.fillRect(bx - 18, by - 18, 1.5, 10);
            ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bx - 24, by - 24, 14, 7);
            ctx.fillStyle = '#1a1a1f'; ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('TEST DRIVE', bx - 17, by - 19.5);
            ctx.textAlign = 'start';
        }

        // BEAT 2 · DOCUMENTS SIGNING · desk + contract + pen
        {
            const bx = px - 340, by = gY - 2;
            ctx.fillStyle = '#3a2418'; ctx.fillRect(bx - 12, by - 8, 24, 3);
            ctx.fillRect(bx - 10, by - 5, 2, 5); ctx.fillRect(bx + 8, by - 5, 2, 5);
            ctx.fillStyle = '#e9d8b0'; ctx.fillRect(bx - 8, by - 10, 16, 4);
            ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(bx - 6, by - 8.5); ctx.lineTo(bx + 3, by - 8.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 6, by - 7); ctx.lineTo(bx + 5, by - 7); ctx.stroke();
            ctx.fillStyle = '#1d3a5c'; ctx.fillRect(bx + 5, by - 9.5, 2.5, 2.5);
            ctx.fillStyle = '#d4a653'; ctx.font = 'bold 2px sans-serif'; ctx.fillText('VW', bx + 5.3, by - 7.8);
            const pBob = Math.sin(t * 5) * 0.6;
            ctx.strokeStyle = '#1a1a1f'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(bx + 2, by - 11 + pBob); ctx.lineTo(bx + 7, by - 17 + pBob); ctx.stroke();
            ctx.fillStyle = '#d4a653'; ctx.beginPath(); ctx.arc(bx + 7, by - 17 + pBob, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f0d9b5'; ctx.beginPath(); ctx.arc(bx + 2, by - 11 + pBob, 1.3, 0, Math.PI * 2); ctx.fill();
        }

        // BEAT 3 · KEYS HANDOVER · two figures, key animated approach/withdraw
        {
            const bx = px - 300, by = gY - 2;
            const reach = (Math.sin(t * 1.8) + 1) * 0.5;
            const keyX = bx - 3 + reach * 6;
            ctx.fillStyle = '#f0d9b5'; ctx.beginPath(); ctx.arc(bx - 10, by - 22, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1d3a5c'; ctx.fillRect(bx - 12, by - 19, 4, 9);
            ctx.fillRect(bx - 12, by - 10, 1.6, 8); ctx.fillRect(bx - 9.6, by - 10, 1.6, 8);
            ctx.strokeStyle = '#f0d9b5'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(bx - 8, by - 17); ctx.lineTo(keyX - 2, by - 16); ctx.stroke();
            ctx.fillStyle = '#f0d9b5'; ctx.beginPath(); ctx.arc(bx + 12, by - 22, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = color; ctx.fillRect(bx + 10, by - 19, 4, 9);
            ctx.fillStyle = '#1d3a5c'; ctx.fillRect(bx + 10, by - 10, 1.6, 8); ctx.fillRect(bx + 12.4, by - 10, 1.6, 8);
            ctx.strokeStyle = '#f0d9b5'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(bx + 10, by - 17); ctx.lineTo(keyX + 3, by - 16); ctx.stroke();
            ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(keyX, by - 16, 1.6, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#d4a653'; ctx.fillRect(keyX + 1, by - 16.5, 3, 1);
            ctx.fillStyle = '#a4332e';
            ctx.beginPath(); ctx.arc(keyX - 1.5, by - 18, 1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(keyX + 1.5, by - 18, 1, 0, Math.PI * 2); ctx.fill();
        }

        // BEAT 4 · FIRST DRIVE OUT · sedan exiting showroom + exhaust puff
        {
            const bx = px - 260, by = gY - 2;
            ctx.fillStyle = '#1a0e0a'; ctx.fillRect(bx + 14, by - 22, 20, 22);
            ctx.fillStyle = '#040608'; ctx.fillRect(bx + 16, by - 20, 16, 20);
            ctx.fillStyle = '#a4332e'; ctx.fillRect(bx + 13, by - 25, 22, 4);
            drawVwSedan(bx, by, 0.5);
            const spin = (t * 30) % (Math.PI * 2);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6; ctx.globalAlpha = a * 0.7;
            [-11, 11].forEach(dx => {
                ctx.beginPath();
                ctx.moveTo(bx + dx + Math.cos(spin) * 2.5, by - 1.5 + Math.sin(spin) * 2.5);
                ctx.lineTo(bx + dx - Math.cos(spin) * 2.5, by - 1.5 - Math.sin(spin) * 2.5);
                ctx.stroke();
            });
            ctx.globalAlpha = a;
            const puff = (t * 1.5) % 1;
            ctx.fillStyle = '#888';
            for (let i = 0; i < 3; i++) {
                const p = (puff + i / 3) % 1;
                ctx.globalAlpha = a * (1 - p) * 0.6;
                const exh = bx - 22 - p * 8, eyh = by - 4 - p * 5, er = 1.8 + p * 2;
                ctx.beginPath(); ctx.arc(exh, eyh, er, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = a;
        }

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

        // === STORY BEATS · drop into present (-380 → -260) ===
        // BEAT 1 · MORNING ROUTINE · coffee + phone + window sunrise
        const b1x = px - 380;
        drawCoffeeWithSteam(b1x, gY - 4, t);
        ctx.fillStyle = '#3a2a1c';
        ctx.fillRect(b1x + 10, gY - 12, 5, 9);
        ctx.fillStyle = '#7fffd4';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(b1x + 12.5, gY - 10 + i * 2.2, 0.6, 0, Math.PI * 2); ctx.fill(); }
        const srG = ctx.createLinearGradient(b1x - 14, gY - 40, b1x - 14, gY - 20);
        srG.addColorStop(0, 'rgba(255,228,170,0.8)'); srG.addColorStop(1, 'rgba(230,194,133,0.15)');
        ctx.fillStyle = srG; ctx.fillRect(b1x - 22, gY - 40, 16, 20);
        ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 0.5; ctx.strokeRect(b1x - 22, gY - 40, 16, 20);

        // BEAT 2 · CODE FLOW · mini multi-monitor desk
        const b2x = px - 340;
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(b2x - 14, gY - 6, 28, 2);
        ctx.fillStyle = '#1a1208';
        ctx.fillRect(b2x - 12, gY - 22, 11, 14);
        ctx.fillRect(b2x +  1, gY - 22, 11, 14);
        for (let m = 0; m < 2; m++) {
            const mx = b2x - 11 + m * 13;
            for (let r = 0; r < 5; r++) {
                const shift = ((t * 18 + r * 7 + m * 3) % 9);
                ctx.fillStyle = r % 2 ? '#7fffd4' : '#fff3c4';
                ctx.globalAlpha = a * (0.55 + 0.25 * Math.sin(t * 2 + r));
                ctx.fillRect(mx + (shift % 9) * 0.1, gY - 20 + r * 2.4, 5 + (r % 3), 0.9);
            }
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.arc(b2x + 9, gY - 4, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.arc(b2x - 9, gY - 4, 3, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = '#3a2a1c'; ctx.fillRect(b2x - 12.5, gY - 4, 1.5, 2.5); ctx.fillRect(b2x - 6.5, gY - 4, 1.5, 2.5);

        // BEAT 3 · ANTHROPIC GOAL · parchment on pedestal with glow aura
        const b3x = px - 300;
        const pulseAnt = 0.55 + 0.45 * Math.sin(t * 1.6);
        const aura = ctx.createRadialGradient(b3x, gY - 18, 2, b3x, gY - 18, 22 + pulseAnt * 6);
        aura.addColorStop(0, `rgba(255,243,196,${0.55 * pulseAnt})`);
        aura.addColorStop(0.5, `rgba(230,194,133,${0.25 * pulseAnt})`);
        aura.addColorStop(1, 'rgba(230,194,133,0)');
        ctx.fillStyle = aura; ctx.fillRect(b3x - 26, gY - 44, 52, 52);
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(b3x - 7, gY - 6, 14, 4);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(b3x - 9, gY - 8, 18, 2);
        ctx.fillStyle = '#f3e0b8';
        ctx.fillRect(b3x - 11, gY - 22, 22, 14);
        ctx.fillStyle = '#d9b890';
        ctx.fillRect(b3x - 12, gY - 23, 24, 2); ctx.fillRect(b3x - 12, gY - 10, 24, 2);
        ctx.fillStyle = '#3a2a1c';
        ctx.font = '600 3.4px ui-serif, Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillText('Anthropic',     b3x, gY - 17);
        ctx.fillText('AI Engineer',   b3x, gY - 12.5);
        ctx.textAlign = 'start';

        // BEAT 4 · FORWARD HORIZON · pathway curving up + walking silhouette
        const b4x = px - 260;
        ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b4x - 18, gY - 1); ctx.quadraticCurveTo(b4x, gY - 6, b4x + 22, gY - 14); ctx.stroke();
        ctx.setLineDash([1.5, 2]); ctx.strokeStyle = '#d9b890';
        ctx.beginPath(); ctx.moveTo(b4x - 18, gY - 2.5); ctx.quadraticCurveTo(b4x, gY - 7.5, b4x + 22, gY - 15.5); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#3a2a1c';
        ctx.font = '600 5px ui-serif, Georgia, serif';
        ctx.fillText('?',   b4x - 6,  gY - 8);
        ctx.fillText('...', b4x + 6,  gY - 12);
        const stride = Math.sin(t * 4.5);
        const wkx = b4x - 14 + ((t * 6) % 28);
        const wky = gY - 2 - (wkx - (b4x - 14)) * 0.28;
        ctx.fillStyle = '#2a1c12';
        ctx.fillRect(wkx - 1, wky - 7, 2, 5);
        ctx.beginPath(); ctx.arc(wkx, wky - 9, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a1c12'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(wkx, wky - 2); ctx.lineTo(wkx + stride * 1.8, wky + 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wkx, wky - 2); ctx.lineTo(wkx - stride * 1.8, wky + 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wkx, wky - 5); ctx.lineTo(wkx + stride * 1.2, wky - 3); ctx.stroke();

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
            // Cull bounds widened: beats now extend to x-offset -540 (far
            // left of chapter center) and content can extend +220 right.
            // The old ±200 cull caused beats to POP IN late (when chapter
            // center crossed W+200, beats that should have already slid
            // in from the right edge materialized abruptly). New bounds
            // (-700 left, +800 right) give beats room to slide in/out
            // smoothly.
            if (px < -700 || px > W + 800) continue;
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

            // OBJECTIVE COMPLETE celebration · in-world golden stamp +
            // sparkle ring over collected chapters. The HUD card fires once
            // on collection; this is the PERSISTENT in-world celebration
            // that says "you achieved this — it remains earned."
            if (collected) drawObjectiveComplete(px, groundY, ch.color, i);
        }
        ctx.textAlign = 'start';
    }

    /** In-world celebration ring + stamp above a collected chapter.
     *  Sparkles orbit the landmark, golden ring pulses, "✓" stamp tilts in. */
    function drawObjectiveComplete(px, gY, color, idx) {
        const t = state.elapsedMs;
        // sparkle ring around the chapter
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 6; k++) {
            const ang = (t * 0.001 + idx * 0.7 + k * Math.PI / 3) % (Math.PI * 2);
            const r   = 70 + Math.sin(t * 0.003 + k) * 6;
            const sx  = px + Math.cos(ang) * r;
            const sy  = gY - 50 + Math.sin(ang) * r * 0.6;
            const sparklePulse = 0.5 + 0.5 * Math.sin(t * 0.005 + k * 1.7);
            ctx.fillStyle = `rgba(255, 220, 130, ${sparklePulse * 0.7})`;
            ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 200, ${sparklePulse * 0.4})`;
            ctx.fillRect(sx - 0.5, sy - 3, 1, 6);
            ctx.fillRect(sx - 3, sy - 0.5, 6, 1);
        }
        ctx.restore();
        // golden stamp · tilted, sits high above the landmark
        const stampY = gY - 150 + Math.sin(t * 0.002 + idx) * 2;
        ctx.save();
        ctx.translate(px, stampY);
        ctx.rotate(-0.1);
        // outer ring · brass
        ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(233, 216, 176, 0.92)';
        ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
        // checkmark · drawn as 2 strokes for thickness
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-2, 5); ctx.lineTo(8, -6); ctx.stroke();
        // ribbon label below ring
        ctx.fillStyle = '#a4332e';
        ctx.beginPath();
        ctx.moveTo(-22, 13); ctx.lineTo(22, 13); ctx.lineTo(18, 22); ctx.lineTo(-18, 22);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e9d8b0';
        ctx.font = 'bold 8px "Cinzel", serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ACHIEVED', 0, 18);
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
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

        // STAGE-SPECIFIC ACCESSORIES · character evolves with life phase.
        // School (< 1100m): RED backpack with straps, messy hair tuft.
        // College (1100-2500m): blue shoulder bag, baseball cap.
        // Adult (>= 2500m): classic cowboy hat (the original look).
        const stage = state.playerX < 1100 ? 'school'
                    : state.playerX < 2500 ? 'college'
                    : 'adult';

        if (stage === 'school') {
            // SCHOOL · backpack over shoulders + hair tuft
            ctx.fillStyle = '#5a3a22';       // hair tuft (dark brown)
            ctx.beginPath();
            ctx.arc(headX, headY - headR + 2, headR + 1, Math.PI, 2 * Math.PI);
            ctx.fill();
            ctx.fillRect(headX - 3 + sinL * 2, headY - headR - 2, 6, 2);
            // BACKPACK (rectangle on back, two thin straps over shoulders)
            const bagX = hipX - sinL * 8 - 7;
            const bagY = hipY - cosL * (torsoH - 4);
            ctx.fillStyle = '#a4332e';       // red school bag
            ctx.fillRect(bagX, bagY, 9, 14);
            ctx.fillStyle = '#7a221c';
            ctx.fillRect(bagX, bagY, 9, 2);  // top flap
            ctx.strokeStyle = '#7a221c'; ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(shoulder.x - 4, shoulder.y); ctx.lineTo(bagX + 2, bagY + 2);
            ctx.moveTo(shoulder.x + 4, shoulder.y); ctx.lineTo(bagX + 7, bagY + 2);
            ctx.stroke();
        } else if (stage === 'college') {
            // COLLEGE · baseball cap + messenger shoulder bag
            ctx.fillStyle = '#2a3a5a';       // navy cap crown
            ctx.beginPath();
            ctx.arc(headX, headY - headR + 1, headR + 1, Math.PI, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = '#1a2a4a';       // cap brim (front-only)
            ctx.fillRect(headX + sinL * 4, headY - headR + 1, headR + 2, 2);
            // MESSENGER BAG · across the body, strap diagonal
            ctx.strokeStyle = '#3a4a6a'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(shoulder.x - 3, shoulder.y);
            ctx.lineTo(hipX + 10, hipY - 4);
            ctx.stroke();
            ctx.fillStyle = '#4a5a7a';
            ctx.fillRect(hipX + 6, hipY - 8, 10, 9);
            ctx.fillStyle = '#2a3a5a';
            ctx.fillRect(hipX + 6, hipY - 8, 10, 2);
        } else {
            // ADULT · classic cowboy hat (brim + crown) — RDR vibe
            ctx.fillStyle = HAT;
            ctx.beginPath();
            ctx.ellipse(headX + sinL * 2, headY - headR + 1, headR + 4, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(headX - 4 + sinL * 3, headY - headR - 5, 8, 4);
        }
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
            case 'bike':
                drawBikeWithRider(cx, groundY);
                break;
            case 'alto':
                drawAltoWithRider(cx, groundY);
                break;
            case 'vw':
                drawVirtusGT(cx, groundY);
                break;
            default:
                drawVehicleEmoji(cx, groundY, VEHICLES[state.vehicle].icon, bob);
                break;
        }
    }

    /** Maruti Alto 800 · the iconic Indian first-car. Compact city hatchback,
     *  TALL greenhouse, BOXY rear, short wheelbase, round headlight, small
     *  alloys. Cream/silver body — the classic Indian middle-class beige. */
    function drawAltoWithRider(cx, footY) {
        const moving = state.keys.right || state.touchHold;
        const jitter = moving ? Math.sin(state.bobT * 0.05) * 0.4 : 0;
        ctx.save();
        ctx.translate(0, jitter);

        const wheelR = 11;
        const wheelY = footY - wheelR;
        const wLx = cx - 22, wRx = cx + 22;
        const BODY = '#d9c9a0';     // cream-silver Alto body
        const SHADOW = '#a89878';
        const WINDOW = 'rgba(30, 40, 50, 0.75)';

        // shadow under
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(cx, footY + 3, 34, 4, 0, 0, Math.PI * 2); ctx.fill();

        // body lower band
        ctx.fillStyle = BODY;
        ctx.fillRect(cx - 30, wheelY - 6, 60, 8);
        // body shadow line
        ctx.fillStyle = SHADOW;
        ctx.fillRect(cx - 30, wheelY - 2, 60, 1);
        // GREENHOUSE · tall + short (Alto signature)
        ctx.fillStyle = BODY;
        ctx.beginPath();
        ctx.moveTo(cx - 24, wheelY - 6);
        ctx.lineTo(cx - 20, wheelY - 22);     // rear A-pillar (boxy)
        ctx.lineTo(cx + 14, wheelY - 22);     // roofline (short)
        ctx.lineTo(cx + 20, wheelY - 6);      // front A-pillar (slight slope)
        ctx.closePath();
        ctx.fill();
        // windows · 2 doors visible
        ctx.fillStyle = WINDOW;
        ctx.fillRect(cx - 18, wheelY - 20, 14, 12);   // rear door window
        ctx.fillRect(cx - 2,  wheelY - 20, 14, 12);   // front door window
        // B-pillar between doors
        ctx.fillStyle = BODY;
        ctx.fillRect(cx - 4, wheelY - 21, 2, 13);
        // driver silhouette through window
        ctx.fillStyle = '#2a1810';
        ctx.beginPath(); ctx.arc(cx + 5, wheelY - 16, 2.5, 0, Math.PI * 2); ctx.fill();
        // round headlight (Alto classic round)
        ctx.fillStyle = '#fff4c2';
        ctx.beginPath(); ctx.arc(cx + 26, wheelY - 5, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d4a653';
        ctx.beginPath(); ctx.arc(cx + 26, wheelY - 5, 1.2, 0, Math.PI * 2); ctx.fill();
        // tail lamp
        ctx.fillStyle = '#a4332e';
        ctx.fillRect(cx - 29, wheelY - 8, 2.5, 3);
        // door handle line
        ctx.strokeStyle = SHADOW; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(cx - 18, wheelY - 4); ctx.lineTo(cx + 18, wheelY - 4); ctx.stroke();
        // tiny "ALTO" badge on rear door
        ctx.fillStyle = '#5a3a22';
        ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('ALTO', cx - 22, wheelY - 9);
        ctx.textAlign = 'start';
        // bumper
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(cx - 28, wheelY + 1, 56, 1.5);
        // wheels · small alloys
        drawWheel(wLx, wheelY, wheelR, state.wheelPhase);
        drawWheel(wRx, wheelY, wheelR, state.wheelPhase);
        ctx.restore();
    }

    /** VW Virtus GT · 4-door sporty sedan. Long, low, fastback-ish roofline,
     *  3-box silhouette with distinct trunk, GT spoiler, gold racing stripe,
     *  LED headlights, larger alloys. NOT a Formula car — this is a road
     *  sedan with GT trim. Color: deep red (Wild Cherry Red) matching the
     *  GT lineup, with black accents. */
    function drawVirtusGT(cx, footY) {
        const moving = state.keys.right || state.touchHold;
        const jitter = moving ? Math.sin(state.bobT * 0.05) * 0.4 : 0;
        ctx.save();
        ctx.translate(0, jitter);

        const wheelR = 13;
        const wheelY = footY - wheelR;
        const wLx = cx - 28, wRx = cx + 28;
        const BODY = '#a83020';      // Wild Cherry Red (Virtus GT signature)
        const BODY_DARK = '#7a2218';
        const TRIM = '#1a0d08';      // glossy black trim
        const ACCENT = '#d4a653';    // gold racing accent

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(cx, footY + 3, 44, 5, 0, 0, Math.PI * 2); ctx.fill();

        // lower body (long sedan profile)
        ctx.fillStyle = BODY;
        ctx.fillRect(cx - 40, wheelY - 8, 80, 8);
        // belt line shadow
        ctx.fillStyle = BODY_DARK;
        ctx.fillRect(cx - 40, wheelY - 1, 80, 1);
        // GREENHOUSE · 4-door sedan with sloped C-pillar (fastback hint)
        ctx.fillStyle = BODY;
        ctx.beginPath();
        ctx.moveTo(cx - 34, wheelY - 8);
        ctx.lineTo(cx - 28, wheelY - 16);   // trunk top start
        ctx.lineTo(cx - 12, wheelY - 22);   // C-pillar (sloped, fastback)
        ctx.lineTo(cx + 6,  wheelY - 24);   // roof apex (lower than alto)
        ctx.lineTo(cx + 18, wheelY - 22);   // A-pillar
        ctx.lineTo(cx + 28, wheelY - 14);   // hood line (long hood)
        ctx.lineTo(cx + 36, wheelY - 8);    // front bumper
        ctx.closePath();
        ctx.fill();

        // 4 windows visible (sedan)
        ctx.fillStyle = 'rgba(20, 30, 40, 0.78)';
        // rear-most quarter window
        ctx.beginPath();
        ctx.moveTo(cx - 26, wheelY - 16);
        ctx.lineTo(cx - 22, wheelY - 21);
        ctx.lineTo(cx - 14, wheelY - 21);
        ctx.lineTo(cx - 14, wheelY - 16);
        ctx.closePath(); ctx.fill();
        // rear door window
        ctx.fillRect(cx - 12, wheelY - 21, 11, 13);
        // front door window
        ctx.fillRect(cx + 1, wheelY - 22, 11, 14);
        // windshield triangle
        ctx.beginPath();
        ctx.moveTo(cx + 14, wheelY - 22);
        ctx.lineTo(cx + 22, wheelY - 17);
        ctx.lineTo(cx + 22, wheelY - 14);
        ctx.lineTo(cx + 14, wheelY - 14);
        ctx.closePath(); ctx.fill();

        // B-pillar between doors (4-door tell)
        ctx.fillStyle = TRIM;
        ctx.fillRect(cx - 1, wheelY - 21, 1.5, 13);

        // driver silhouette through front window
        ctx.fillStyle = '#1a0d08';
        ctx.beginPath(); ctx.arc(cx + 7, wheelY - 18, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx + 4, wheelY - 16, 6, 4);

        // GT racing stripe (gold, runs along belt line)
        ctx.fillStyle = ACCENT;
        ctx.fillRect(cx - 38, wheelY - 5, 76, 0.8);

        // REAR SPOILER (GT trim signature — small ducktail)
        ctx.fillStyle = TRIM;
        ctx.beginPath();
        ctx.moveTo(cx - 34, wheelY - 16);
        ctx.lineTo(cx - 34, wheelY - 18);
        ctx.lineTo(cx - 28, wheelY - 18);
        ctx.lineTo(cx - 28, wheelY - 16);
        ctx.closePath(); ctx.fill();

        // LED headlight (narrow strip, sporty)
        ctx.fillStyle = '#fff4c2';
        ctx.fillRect(cx + 32, wheelY - 11, 4, 1.5);
        ctx.fillStyle = '#7fc4ff';
        ctx.fillRect(cx + 32, wheelY - 9, 3, 0.6);

        // LED tail lamp (modern wraparound)
        ctx.fillStyle = '#a4332e';
        ctx.fillRect(cx - 38, wheelY - 13, 3, 4);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(cx - 38, wheelY - 12, 3, 1);

        // grille hint
        ctx.fillStyle = TRIM;
        ctx.fillRect(cx + 30, wheelY - 7, 6, 4);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(cx + 31, wheelY - 5, 4, 0.6);

        // "GT" badge on rear quarter
        ctx.fillStyle = ACCENT;
        ctx.font = 'bold 4px "Cinzel", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('GT', cx - 30, wheelY - 9);
        ctx.textAlign = 'start';

        // skirt + lower bumper (sporty)
        ctx.fillStyle = TRIM;
        ctx.fillRect(cx - 38, wheelY, 76, 2);

        // 18" alloy wheels (sportier than Alto)
        drawWheel(wLx, wheelY, wheelR, state.wheelPhase);
        drawWheel(wRx, wheelY, wheelR, state.wheelPhase);
        ctx.restore();
    }

    /** College-stage motorbike + rider · procedural side-view facing RIGHT.
     *  Rider in navy baseball cap + blue messenger bag (matches drawWalker
     *  college stage). Spinning wheels via state.wheelPhase, engine jitter,
     *  motion streaks when moving forward. */
    function drawBikeWithRider(cx, footY) {
        const moving = state.keys.right || state.touchHold;
        const jitter = moving ? Math.sin(state.bobT * 0.05) * 0.6 : 0;
        ctx.save();
        ctx.translate(0, jitter);
        const wheelR = 14;
        const wheelY = footY - wheelR;
        const wLx = cx - 24, wRx = cx + 24;
        // motion streaks behind
        if (moving) {
            ctx.strokeStyle = 'rgba(192,196,204,0.45)';
            ctx.lineWidth = 1.2; ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
                const yy = wheelY - 4 + i * 5;
                ctx.beginPath();
                ctx.moveTo(wLx - 14 - i * 3, yy);
                ctx.lineTo(wLx - 4 - i * 3, yy);
                ctx.stroke();
            }
        }
        // exhaust pipe trailing rear
        ctx.strokeStyle = '#c0c4cc'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 6, wheelY - 2); ctx.lineTo(wLx + 2, wheelY + 1); ctx.stroke();
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(wLx, wheelY + 1); ctx.lineTo(wLx - 3, wheelY + 1); ctx.stroke();
        // engine block
        ctx.fillStyle = '#2a1810'; ctx.fillRect(cx - 10, wheelY - 6, 20, 10);
        ctx.fillStyle = '#c0c4cc';
        for (let i = 0; i < 3; i++) ctx.fillRect(cx - 9, wheelY - 5 + i * 3, 18, 1);
        // frame + fuel tank
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(wLx + 4, wheelY - 2); ctx.lineTo(cx - 4, wheelY - 14);
        ctx.lineTo(cx + 12, wheelY - 16); ctx.lineTo(cx + 18, wheelY - 8);
        ctx.lineTo(wRx, wheelY); ctx.stroke();
        ctx.fillStyle = '#5a3a22';
        ctx.beginPath();
        ctx.moveTo(cx - 2, wheelY - 14); ctx.lineTo(cx + 12, wheelY - 16);
        ctx.lineTo(cx + 14, wheelY - 10); ctx.lineTo(cx - 2, wheelY - 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1c0e06';
        ctx.fillRect(cx - 12, wheelY - 14, 12, 3);
        // handlebar + headlight
        ctx.strokeStyle = '#c0c4cc'; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx + 18, wheelY - 8); ctx.lineTo(cx + 22, wheelY - 18);
        ctx.lineTo(cx + 28, wheelY - 19); ctx.stroke();
        ctx.fillStyle = '#c0c4cc';
        ctx.beginPath(); ctx.arc(cx + 20, wheelY - 6, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,150,0.9)';
        ctx.beginPath(); ctx.arc(cx + 21, wheelY - 6, 1.6, 0, Math.PI * 2); ctx.fill();
        // wheels spinning
        drawWheel(wLx, wheelY, wheelR, state.wheelPhase);
        drawWheel(wRx, wheelY, wheelR, state.wheelPhase);
        // RIDER · college outfit, leaning forward
        const SKIN_C = '#f0d9b5';
        const seatX = cx - 4, seatY = wheelY - 16;
        const shoulderX = seatX + 6, shoulderY = seatY - 14;
        const headX = shoulderX + 4, headY = shoulderY - 7;
        const headR = 6;
        // back leg
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(seatX, seatY); ctx.lineTo(seatX + 2, wheelY - 4); ctx.lineTo(cx - 4, wheelY + 2);
        ctx.stroke();
        // torso (shirt + jacket)
        ctx.strokeStyle = '#a86434'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(seatX, seatY); ctx.lineTo(shoulderX, shoulderY); ctx.stroke();
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(seatX - 1, seatY - 1); ctx.lineTo(shoulderX - 2, shoulderY); ctx.stroke();
        // messenger bag strap + bag
        ctx.strokeStyle = '#3a4a6a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shoulderX - 3, shoulderY + 1); ctx.lineTo(seatX + 4, seatY - 2);
        ctx.stroke();
        ctx.fillStyle = '#4a5a7a'; ctx.fillRect(seatX - 4, seatY - 6, 9, 7);
        ctx.fillStyle = '#2a3a5a'; ctx.fillRect(seatX - 4, seatY - 6, 9, 1.6);
        // arms forward to grips
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY); ctx.lineTo(cx + 20, wheelY - 17); ctx.lineTo(cx + 27, wheelY - 18);
        ctx.stroke();
        ctx.fillStyle = SKIN_C;
        ctx.beginPath(); ctx.arc(cx + 27, wheelY - 18, 1.6, 0, Math.PI * 2); ctx.fill();
        // front leg
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(seatX + 2, seatY + 1); ctx.lineTo(cx + 6, wheelY - 4); ctx.lineTo(cx - 2, wheelY + 2);
        ctx.stroke();
        // head + navy baseball cap
        ctx.fillStyle = SKIN_C;
        ctx.beginPath(); ctx.arc(headX, headY, headR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a3a5a';
        ctx.beginPath(); ctx.arc(headX, headY - 1, headR + 0.5, Math.PI, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#1a2a4a';
        ctx.fillRect(headX, headY - headR + 1, headR + 3, 2);
        ctx.restore();
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

        if (state.running && !state.ended && !state.paused) {
            state.elapsedMs += dt;

            // Mission tracker updates LIVE as player walks — was only
            // updating on chapter collect, so it stayed stale during the
            // long approach. Now pickNextObjective() runs every frame
            // (cheap — DOM textContent setter no-ops when value unchanged).
            const nextIdx = pickNextObjective();
            if (nextIdx !== state.lastMissionIdx) {
                state.lastMissionIdx = nextIdx;
                updateMission(nextIdx);
            }
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
            // CHAPTER-PROXIMITY DECELERATION · when within ±400px of any
            // chapter, slow walk speed to 50% so the story beats actually
            // get time to read. User asked to "drop into story" — this is
            // the mechanic that makes the world feel like a paced narrative
            // instead of a flat run.
            let speedMul = 1.0;
            for (const ch of CHAPTERS) {
                const dist = Math.abs(state.playerX - ch.x);
                if (dist < 400) {
                    // Smoothly interpolate: 0.45 at chapter, 1.0 at 400px out
                    const factor = dist / 400;            // 0 at chapter, 1 at edge
                    speedMul = 0.45 + 0.55 * factor;
                    break;
                }
            }
            state.playerX += v.speed * (dt / 1000) * dir * speedMul;

            // GLIDE-TELEPORT · when a progress dot is clicked, lerp playerX
            // toward state.glideTargetX at ~900 px/s. Any direct input (key
            // hold, touch hold) cancels the glide so the user retakes control.
            if (state.glideTargetX !== null) {
                if (movingForward || movingBack) {
                    // user took control · cancel
                    state.glideTargetX = null;
                } else {
                    const delta = state.glideTargetX - state.playerX;
                    const sign  = Math.sign(delta);
                    const step  = 900 * (dt / 1000);   // 900 px/s glide rate
                    if (Math.abs(delta) <= step) {
                        state.playerX = state.glideTargetX;
                        state.glideTargetX = null;
                    } else {
                        state.playerX += sign * step;
                    }
                }
            }

            if (state.playerX < 0) state.playerX = 0;

            // update per-chapter ambient audio gains based on player proximity
            chapterAudioTick();

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
                saveState();   // persist after vehicle upgrade
            }

            // chapter collection · player passes within range of chapter x
            for (let i = 0; i < CHAPTERS.length; i++) {
                const ch = CHAPTERS[i];
                if (state.collected.has(ch.id)) continue;
                if (state.playerX >= ch.x - 80 && state.playerX <= ch.x + 80) {
                    state.collected.add(ch.id);
                    updateProgress(i);
                    // Dedup: skip the chapter achievement card if its achId
                    // was already fired by a vehicle upgrade in the same
                    // frame/zone. This stops "GOT THE GT" + "FIRST JOB · ALTO"
                    // from showing twice (chapter + vehicle share achId).
                    if (!ch.achId || !state.achievements.has(ch.achId)) {
                        if (ch.achId) state.achievements.add(ch.achId);
                        showAchievement(ch, { kind: 'event' });
                    }
                    updateMission(i);
                    setTimeout(() => updateMission(pickNextObjective()), 1400);
                    triggerLetterbox(1100);
                    sfxCollect();
                    shake(10, 380);
                    // 28 particles radiating from the landmark · color-matched
                    burstParticles(W * 0.32 + 20, groundY - 36, ch.color, 28);
                    saveState();   // persist after chapter collect
                }
            }

            // HUD score
            if ($scoreDist) $scoreDist.textContent = Math.round(state.playerX) + ' m';
            if ($scoreChap) $scoreChap.textContent = state.collected.size + ' / ' + CHAPTERS.length;
            if ($scoreTime) {
                const s = Math.floor(state.elapsedMs / 1000);
                $scoreTime.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            }

            // end · past the last chapter · TRIGGER CINEMATIC (not end-card)
            // VW Virtus GT accelerates off-screen with tire smoke, THEN end-card.
            if (state.collected.size >= CHAPTERS.length &&
                state.playerX > CHAPTERS[CHAPTERS.length - 1].x + 150 &&
                !state.endingCinematic && !state.ended) {
                state.endingCinematic = true;
                state.cinematicT = 0;
                state.lockedCameraX = state.playerX - W * 0.32;   // lock camera here
                sfxRev();   // engine rev + tire-screech kickoff
            }

            // ── CINEMATIC update · accelerate GT + spawn tire smoke ──
            if (state.endingCinematic) {
                state.cinematicT += dt;
                const tSec = state.cinematicT / 1000;
                // Speed curve: 200 → 900 px/s over 2.5s, ease-out cubic
                const ease = 1 - Math.pow(1 - Math.min(1, tSec / 2.5), 3);
                const speed = 200 + 700 * ease;
                state.playerX += speed * dt / 1000;
                // Spawn smoke at rear-wheel position (screen coords)
                const gtScreenX = state.playerX - state.lockedCameraX;
                // ~2 puffs per ~30ms
                if (Math.random() < dt / 25) {
                    for (let i = 0; i < 2; i++) {
                        state.tireSmoke.push({
                            x: gtScreenX - 22 + Math.random() * 4,
                            y: groundY - 4 + Math.random() * 4,
                            vx: -50 - Math.random() * 60,   // drifts back-left
                            vy: -10 - Math.random() * 18,   // drifts up
                            life: 1.0,
                            size: 5 + Math.random() * 4,
                        });
                    }
                }
                // Update smoke physics
                for (let i = state.tireSmoke.length - 1; i >= 0; i--) {
                    const p = state.tireSmoke[i];
                    p.x += p.vx * dt / 1000;
                    p.y += p.vy * dt / 1000;
                    p.vx *= 0.93;     // air drag
                    p.vy *= 0.93;
                    p.life -= dt / 1800;
                    p.size += dt * 0.014;   // expand as it fades
                    if (p.life <= 0) state.tireSmoke.splice(i, 1);
                }
                // After 3.5s, transition to end card
                if (state.cinematicT > 3500) {
                    state.ended = true;
                    state.endingCinematic = false;
                    state.lockedCameraX = null;      // release camera lock
                    state.tireSmoke = [];
                    if ($end) {
                        const $endStatChapters = document.getElementById('end-stat-chapters');
                        const $endStatBeats    = document.getElementById('end-stat-beats');
                        const $endStatTime     = document.getElementById('end-stat-time');
                        if ($endStatChapters) {
                            $endStatChapters.textContent =
                                String(state.collected.size).padStart(2, '0') + ' / ' +
                                String(CHAPTERS.length).padStart(2, '0');
                        }
                        if ($endStatBeats) {
                            $endStatBeats.textContent =
                                String(state.discoveredBeats.size).padStart(2, '0') + ' / ' +
                                String(BEATS.length).padStart(2, '0');
                        }
                        if ($endStatTime) {
                            const s = Math.floor(state.elapsedMs / 1000);
                            $endStatTime.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
                        }
                        $end.hidden = false;
                    }
                    saveState();
                }
            }
        }

        // camera · player anchored at 32% from left, OR locked during cinematic
        const cameraX = state.lockedCameraX !== null
            ? state.lockedCameraX
            : (state.playerX - W * 0.32);

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
        drawHolidayProps(W, horizonY, groundY, cameraX);
        drawMidProps(W, horizonY, groundY, cameraX);
        drawChapters(W, horizonY, groundY, cameraX);
        drawChatter(W, H, groundY, cameraX);
        drawParticles();
        // Tire smoke during end-cinematic — drawn BEFORE the GT so the car
        // appears to be ahead of its own dust cloud (correct depth-ordering)
        if (state.tireSmoke && state.tireSmoke.length > 0) {
            for (const p of state.tireSmoke) {
                const a = Math.max(0, p.life) * 0.55;
                ctx.fillStyle = `rgba(220, 220, 224, ${a})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            }
        }
        drawPlayer(W, groundY);
        ctx.restore();

        // Lore card draws ABOVE the world transform (no shake/translate),
        // pinned to viewport so it stays steady regardless of camera state.
        drawLoreCard();

        // PAUSED indicator pill — small, top-center, only when manually paused
        // (NOT during lore card open, since that has its own dim+card)
        if (state.paused && !state.activeLore) {
            ctx.save();
            ctx.fillStyle = 'rgba(8, 6, 4, 0.65)';
            ctx.fillRect(W / 2 - 60, 60, 120, 32);
            ctx.fillStyle = '#e9d8b0';
            ctx.font = 'bold 13px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⏸ PAUSED', W / 2, 76);
            ctx.font = 'italic 10px "IM Fell English", serif';
            ctx.fillStyle = 'rgba(233, 216, 176, 0.6)';
            ctx.fillText('press P to resume', W / 2, 90);
            ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
            ctx.restore();
        }
    }
    requestAnimationFrame(frame);

    // debug
    window.__journey = { state, CHAPTERS, BEATS, openLoreCard, dismissLoreCard };
})();
