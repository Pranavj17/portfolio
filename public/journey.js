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
        { ch:'itics', id:'cricket-match',   dx:-300, dy:-80, w:64, h:48, title:'Cricket match',    lore:'Played district level for Karnataka. CSK fan since I could pronounce Dhoni.', chatter:['WHISTLE PODU!','THALA!','DHONI! DHONI!','CSK! CSK!','Yellove!','SIX!','HOWZAT!','Anbuden!'] },
        { ch:'itics', id:'monsoon-puddles', dx:-220, dy:-12, w:32, h:24, title:'Monsoon puddles', lore:'Bangalore monsoon hits and every pothole is a swimming pool. Splashed in every one on the way home. Came back to a mother with the face.', chatter:['SPLASH!','wet socks','more puddles','run!'] },
        { ch:'itics', id:'first-cycle',     dx:-180, dy:-15, w:36, h:30, title:'First cycle',     lore:'Red BSA. Training wheels off the first weekend. Three skinned knees and the geography of the block, finally learned.', chatter:['no hands!','crash','again','can ride!'] },
        { ch:'itics', id:'cultural-dance',  dx:-260, dy:-80, w:64, h:48, title:'Cultural dance',   lore:'Did it as part of school activity.', chatter:['together!','and... go','one more','smile!'] },

        // ── CMR NATIONAL (PU, 2013–2015) ──
        { ch:'cmr', id:'tuition-rush',      dx:-380, dy:-13, w:44, h:40, title:'Tuition rush',     lore:'Went for IIT JEE.', chatter:['fast!','late again','physics first','JEE in 8 months'] },
        { ch:'cmr', id:'mock-test',         dx:-340, dy:-24, w:44, h:40, title:'Mock test',        lore:'Didn\'t study. Walked in, did what I could, walked out. The rank list came back unkind. Useful data.' },
        { ch:'cmr', id:'study-lamp',        dx:-300, dy:-22, w:44, h:48, title:'Study lamp',       lore:'Had room lights. Late nights.' },
        { ch:'cmr', id:'pu-graduation',     dx:-260, dy:-8,  w:44, h:32, title:'PU graduation',    lore:'Two years of pressure-cooker · finally vented. Took the certificate, the photos, the relief. Felt the actual weight of "what next."', chatter:['woohoo','finally','what now?','college time'] },
        { ch:'cmr', id:'group-study',       dx:-540, dy:-12, w:54, h:44, title:'Group study',      lore:'Did do it during exam times.', chatter:['ch 12 done?','ya','this one?','ugh','5 more chapters'] },
        { ch:'cmr', id:'movie-night',       dx:-490, dy:-30, w:54, h:60, title:'Movie night',      lore:'Watched Bahubali with girlfriend.', chatter:['bahubali wild','best fight','one more sat?','popcorn?'] },
        { ch:'cmr', id:'cricket-weekend',   dx:-440, dy:-10, w:54, h:40, title:'Cricket weekend',  lore:'Yes — every weekend at the ITI pavilion.' },
        { ch:'cmr', id:'first-crush',       dx:-390, dy:-20, w:48, h:40, title:'First crush',      lore:'Yes — at tuition. Sat two rows behind. Borrowed her highlighter once. Returned it. That was the entire courtship.', chatter:['look up','don\'t look up','one chapter','one more glance'] },
        { ch:'cmr', id:'saturday-extra',    dx:-200, dy:-12, w:36, h:36, title:'Saturday extra',   lore:'The "doubt-clearing" class that became 4 hours of derivations. Half the batch skipped. The other half learned what discipline actually costs.', chatter:['weekend gone','one more sum','tea break?','5 min'] },

        // ── D.S.C.E. (mech eng, 2015–2019) ──
        { ch:'college', id:'hostel-room',   dx:-380, dy:-30, w:48, h:64, title:'Hostel room',      lore:'Didn\'t go to hostel. Travelled every day — walking to 3 bus changes to college walk.', chatter:['zzz...','light off','4am bro','let me sleep'] },
        { ch:'college', id:'fest-stage',    dx:-340, dy:-25, w:54, h:54, title:'Fest stage',       lore:'Great fun. Did a dance in the fest.', chatter:['LETS GOOO','encore!','one more!','hands up!'] },
        { ch:'college', id:'group-ride',    dx:-300, dy:-12, w:54, h:36, title:'Group ride',       lore:'Yes — every day, triples.', chatter:['race u to mess!','too late','wait up','catch me'] },
        { ch:'college', id:'convocation',   dx:-260, dy:-30, w:54, h:64, title:'Convocation',      lore:'Black robes, mortarboard, four years compressed into one walk across the stage. Parents in the front row · the only audience that mattered.', chatter:['congrats!','engineer now','your turn next','smile big!'] },
        { ch:'college', id:'bosch-intern',  dx:-200, dy:-18, w:48, h:42, title:'BOSCH intern',     lore:'Two months at BOSCH. ID badge, cafeteria coupons, a project mentor who let me touch real CAD files. First taste of "work" with a paycheck.', chatter:['day 1!','badge ✓','meeting','first project'] },
        { ch:'college', id:'abb-intern',    dx:-160, dy:-22, w:48, h:42, title:'ABB intern',       lore:'Switched gears to ABB the next summer. Industrial automation, programmable logic controllers, the smell of solder. Learned that mechanical and software are the same hand on different keyboards.', chatter:['PLC time','ladder logic','HMI','reload'] },

        // ── FEVER 104 FM (Mar–May 2019) ──
        { ch:'fever104', id:'headphones',   dx:-380, dy:-15, w:36, h:36, title:'Headphones',       lore:'Heavy Shure SM7B-style cans. First time wearing them felt like the city had been turned down. The booth went quiet; the script got louder.', chatter:['rolling','live in 5','levels good','quiet on set'] },
        { ch:'fever104', id:'script-binder',dx:-340, dy:-5,  w:36, h:24, title:'Script binder',    lore:'Spiral-bound, half-typed, half-marked-up in pen. Every shift you took notes for the next person. Whoever came after you was your future self.' },
        { ch:'fever104', id:'sound-engineer',dx:-300,dy:-10, w:36, h:28, title:'Sound engineer',   lore:'Fader by fader. Three months learning what dB ducking actually feels like. Started calling commercials by their cue numbers.' },
        { ch:'fever104', id:'trainee-cert', dx:-260, dy:-5,  w:36, h:28, title:'Trainee cert',     lore:'FEVER 104 FM · Trainee Producer · Mar–May 2019. Framed. On the bookshelf. Still there.', chatter:['certified!','📜','keepsake','wall worthy'] },

        // ── SAKHA GLOBAL (first job, Jul 2019 – Sep 2022) ──
        { ch:'sakha', id:'interview-day',   dx:-380, dy:-25, w:48, h:48, title:'Interview day',    lore:'Crazy feeling — first interview cracked, after 5 failed attempts.' },
        { ch:'sakha', id:'first-day-badge', dx:-340, dy:-22, w:32, h:40, title:'First day badge',  lore:'Plastic ID, lanyard, name spelled right. Spent the first hour just looking at it. Saved a photo · sent to mom.', chatter:['employee!','official','first job','📸'] },
        { ch:'sakha', id:'team-lunch',      dx:-300, dy:-20, w:48, h:40, title:'Team lunch',       lore:'Indiranagar lunches, two-floor cafés, monthly biryani Fridays. The team was the job · code came second.', chatter:['biryani?','5 minutes','same place?','let\'s go'] },
        { ch:'sakha', id:'first-paycheck',  dx:-260, dy:-8,  w:48, h:32, title:'First paycheck',   lore:'Bought a watch and a saree — for dad and mum. The leftover went toward groceries. Felt like the whole month\'s effort sat in two gift boxes.', chatter:['for dad','for mum','wrapped','watch ✓ saree ✓'] },
        { ch:'sakha', id:'wfh-covid',       dx:-540, dy:-30, w:60, h:56, title:'WFH · COVID',      lore:'March 2020. Office shut overnight. Working from a corner of the bedroom, slack down for the first 2 weeks of every month. Shipped 11 PRs in March alone.', chatter:['standup in 5','laptop dead','wifi flaky','one more push'] },
        { ch:'sakha', id:'office-standup',  dx:-490, dy:-25, w:48, h:48, title:'Office standup',   lore:'New experience.', chatter:['blockers?','shipping today','merge ready','done by EOD'] },
        { ch:'sakha', id:'late-night-coding',dx:-440,dy:-20, w:54, h:48, title:'Late-night coding',lore:'Yes — was passionate.', chatter:['one more bug','just one more','sleep at 3','it works!'] },
        { ch:'sakha', id:'team-outing',     dx:-390, dy:-22, w:54, h:44, title:'Team outing',      lore:'Yes — did.', chatter:['to the team!','CHEERS','one more round?','great work'] },

        // ── SCRIPBOX (AI/MCP era, Sep 2022 – present) ──
        { ch:'scripbox', id:'onboarding',     dx:-380, dy:-15, w:48, h:36, title:'Onboarding',       lore:'New laptop, welcome kit, meeting 30 people in two days. The friends you make in week one usually stay · learned that here.', chatter:['welcome!','day 1','hi team','let\'s go!'] },
        { ch:'scripbox', id:'pr-review',      dx:-340, dy:-15, w:36, h:36, title:'PR review',        lore:'Reading other people\'s code became the fastest way to read other people\'s minds. Approve, comment, request changes · all forms of "I see you."', chatter:['lgtm','hmm wait','edge case?','good catch'] },
        { ch:'scripbox', id:'anthropic-catalog',dx:-300,dy:-30,w:48, h:48, title:'Anthropic catalog',lore:'PR #2913 · mcp-server-graylog landed in the Anthropic MCP catalog. Refreshed the page seventeen times to make sure it was real. Sent the link to four people who never asked.', chatter:['merged!','it\'s up','can\'t believe','#2913'] },
        { ch:'scripbox', id:'whiteboard',     dx:-260, dy:-30, w:54, h:48, title:'Whiteboard',       lore:'Gave knowledge transfer on things I learn — with my peers.', chatter:['MCP → SRV','see?','questions?','any blockers?'] },
        { ch:'scripbox', id:'claude-code',    dx:-540, dy:-25, w:54, h:48, title:'Claude Code',      lore:'Best AI skill I\'ve learnt as of now — for me.', chatter:['> claude','thinking...','done','one more pass'] },
        { ch:'scripbox', id:'anthropic-talk', dx:-490, dy:-25, w:54, h:48, title:'Anthropic talk',   lore:'Success.' },
        { ch:'scripbox', id:'coffee-setup',   dx:-440, dy:-15, w:64, h:36, title:'Coffee setup',     lore:'Timepass.' },
        { ch:'scripbox', id:'bangalore-traffic',dx:-390,dy:-15,w:54, h:40, title:'Bangalore traffic',lore:'Okay sometimes.' },
        { ch:'scripbox', id:'thailand-trip',  dx:-220, dy:-30, w:48, h:40, title:'Thailand · NYE 2024', lore:'Bangkok + beaches for the New Year. First international vacation. Pad thai every meal.', chatter:['sawasdee','beach time','street food','📸'] },
        { ch:'scripbox', id:'dubai-trip',     dx:-170, dy:-30, w:48, h:40, title:'Dubai · NYE 2025',     lore:'Marina, Burj, Global Village. Met up with cousins. Came home thinking 2026 is mine.', chatter:['shukran','skyline','desert safari','✈️'] },

        // ── THE GT (Nov 16 2025) ──
        { ch:'vwgt', id:'test-drive',       dx:-380, dy:-12, w:54, h:32, title:'Test drive',       lore:'1.5 TSI turbo on the Outer Ring Road · 35 minutes that decided the next five years of EMIs. The salesperson knew before I did.', chatter:['floor it!','turbo!','smooth','sold'] },
        { ch:'vwgt', id:'documents-signing',dx:-340, dy:-12, w:36, h:28, title:'Documents',        lore:'Loan papers, RC application, insurance form, accessory list · all signed in 40 minutes. Ten years of saving became one signature.', chatter:['sign here','one more','almost done','finished'] },
        { ch:'vwgt', id:'keys-handover',    dx:-300, dy:-20, w:40, h:40, title:'Keys handover',    lore:'Wooden tray, rose petals, metallic key. November 16, 2025. Garland on the bonnet. The salesperson actually clapped.', chatter:['congrats!','thanks!','enjoy!','drive safe'] },
        { ch:'vwgt', id:'first-drive-out',  dx:-260, dy:-15, w:48, h:36, title:'First drive out',  lore:'Out of the showroom, garland still on. Three lefts and onto the open road. The car was lighter than the moment.', chatter:['VROOM','finally','home wait','GT!'] },

        // ── NOW (2026 – present) ──
        { ch:'now', id:'morning-routine',   dx:-380, dy:-25, w:48, h:56, title:'Morning routine',  lore:'Filter coffee · phone face-down · 30 minutes of reading before the first slack ping. The day belongs to whoever claims the first hour.', chatter:['☕','quiet','no phone','sunrise'] },
        { ch:'now', id:'code-flow',         dx:-340, dy:-20, w:48, h:48, title:'Code flow',        lore:'Multi-monitor, terminal warmth, mechanical click. Two hours that feel like ten minutes. The kind of focus you save up for.', chatter:['>','typing...','build ✓','tests ✓'] },
        { ch:'now', id:'anthropic-goal',    dx:-300, dy:-20, w:48, h:52, title:'Anthropic goal',   lore:'AI Engineer at Anthropic. The north star since Dario\'s Senate testimony at midnight Bangalore time. Working backwards from there every day.', chatter:['claude.ai','one day','keep building','focus'] },
        { ch:'now', id:'forward-horizon',   dx:-260, dy:-10, w:48, h:32, title:'Forward horizon',  lore:'Walking confidently toward what\'s next. The destination is foggy · the direction is clear · the legs already know what to do.', chatter:['onward','keep going','no turning back','horizon'] },
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

    // ── CINEMATIC INTERTITLES · "ACT" cards shown when entering a new chapter
    // Each fires once · stored in shownChapterTitles so re-visits stay quiet
    const CHAPTER_INTERTITLES = {
        itics:    { act: 'ACT I',    title: 'THE BEGINNING',         quote: '"School. Football. Cricket."' },
        cmr:      { act: 'ACT II',   title: 'THE PRESSURE COOKER',   quote: '"Two years to crack JEE."' },
        college:  { act: 'ACT III',  title: 'ENGINEERING DAYS',      quote: '"Three buses. Triples on the bike."' },
        fever104: { act: 'INTERLUDE', title: 'ON AIR · 104 FM',      quote: '"Three months in the radio booth."' },
        sakha:    { act: 'ACT IV',   title: 'FIRST JOB',             quote: '"Frontend developer. Maruti Alto."' },
        scripbox: { act: 'ACT V',    title: 'SCRIPBOX · AI',          quote: '"Fullstack. Infra. Anthropic."' },
        vwgt:     { act: 'ACT VI',   title: 'THE GT',                quote: '"VW Virtus. 1.5 TSI. November 16, 2025."' },
        now:      { act: 'EPILOGUE', title: 'NOW',                   quote: '"2026 — present."' },
    };

    // ── BANGALORE BACKGROUND LAYERS ──
    // Far back-ridge (0.10× parallax) sits even BEHIND distHills · Deccan plateau read
    // One prominent Nandi-like asymmetric peak near world-x 4200 (vwgt era)
    const backRidge = [];
    for (let i = 0; i < 800; i++) {
        const x = i * 80;
        let y = 30 + Math.sin(i * 0.09) * 14 + Math.cos(i * 0.21 + 0.7) * 10;
        // Nandi peak overlay around world-x 4200 (i ≈ 52-54)
        const peakDist = Math.abs(i - 52);
        if (peakDist < 5) y += (5 - peakDist) * 7;   // steep east face
        else if (peakDist < 10 && i > 52) y += (10 - peakDist) * 3.5;  // gentler west face
        backRidge.push({ x, y });
    }

    // Palm crowns · sparse, ride mid-band, fill the residential canopy line
    const palms = [];
    for (let i = 0; i < 70; i++) {
        palms.push({
            x: i * 95 + (Math.random() - 0.5) * 40,
            lean: (Math.random() - 0.5) * 4,
            scale: 0.85 + Math.random() * 0.4,
            fronds: 7 + (Math.random() * 3 | 0),
        });
    }

    // Raintree fillers · wide flat canopies between bloom trees and skyline (0.35× band)
    const raintrees = [];
    for (let i = 0; i < 40; i++) {
        raintrees.push({
            x: i * 165 + (Math.random() - 0.5) * 60,
            scale: 0.9 + Math.random() * 0.35,
        });
    }

    // Skyline landmarks · individually era-gated · world-x positions per agent plan
    const SKYLINE = [
        { kind: 'bull_temple',    x:  300, minChapterIdx: 0 },  // 1537 · Dravidian gopuram · always
        { kind: 'vidhana_soudha', x:  600, minChapterIdx: 0 },  // 1956 · always
        { kind: 'cinema',         x:  780, minChapterIdx: 0 },  // 1980s movie theatre · Rajini era
        { kind: 'bangalore_palace', x: 900, minChapterIdx: 0 }, // 1878 · Tudor-style · always
        { kind: 'planetarium',    x: 1150, minChapterIdx: 0 },
        { kind: 'kr_market',      x: 1450, minChapterIdx: 0 },  // 1928 · barrel-vault market · always
        { kind: 'stadium',        x: 1800, minChapterIdx: 0 },  // Kanteerava + dome · 1946 · always
        { kind: 'ub_wtc',         x: 2400, minChapterIdx: 2 },  // UB City 2008, WTC 2010 → DSCE era
        { kind: 'chinnaswamy',    x: 2150, minChapterIdx: 0 },  // 1969 · cricket stadium · always
        { kind: 'iskcon',         x: 3050, minChapterIdx: 0 },
        { kind: 'manyata',        x: 4000, minChapterIdx: 4 },  // tech park · Sakha era
        { kind: 'glass_cluster',  x: 5500, minChapterIdx: 5 },  // dense fill · Scripbox era
        { kind: 'glass_cluster',  x: 5900, minChapterIdx: 5 },
    ];

    // Bangalore bridges · varied infrastructure across the timeline
    //   hebbal_flyover : multi-deck curved road flyover · always (built 2003)
    //   cable_stay     : KR Puram-style A-frame cable-stayed bridge · Sakha+ (2019)
    //   arch_bridge    : small ornate 2-arch bridge over a stream gap · always
    const BRIDGES = [
        { kind: 'hebbal_flyover', x: 1800, minChapterIdx: 0 },
        { kind: 'arch_bridge',    x: 2650, minChapterIdx: 0 },
        { kind: 'cable_stay',     x: 4700, minChapterIdx: 4 },
        { kind: 'h_bridge',       x: 5200, minChapterIdx: 4 },  // Iblur-style twin H-pylons
        { kind: 'hebbal_flyover', x: 5800, minChapterIdx: 0 },
    ];

    // ── LANDMARK LORE · click any background structure to see its story ──
    // Researched mini-encyclopedia about each Bangalore element. Keyed by:
    //   SKYLINE.kind, BRIDGES.kind, metro station name (lowercased+underscored),
    //   plus 'metro_viaduct' / 'metro_train' for generic infra.
    const LANDMARK_LORE = {
        bull_temple: { title: "Bull Temple (1537)", body: "Kempe Gowda built it around a single granite outcrop that kept growing under the chisel — local lore says a copper plate on the bull's forehead was placed to stop it expanding further." },
        cinema: { title: "Single-Screen Cinema (Rajini Era)", body: "RAJINIKANTH NOW SHOWING. The old single-screens — Plaza, Pallavi, Santosh — queued around the block for a Thalaiva first-day-first-show. Five-rupee balcony, ten-rupee gold, hand-painted hoardings with paint still drying. Audience whistled at every punch dialogue and threw flowers when the title card hit." },
        vidhana_soudha: { title: "Vidhana Soudha (1956)", body: "Built in Neo-Dravidian granite by Kengal Hanumanthaiah as a riposte to colonial architecture. The carved sign above the entrance reads 'Government Work is God's Work' — a motto more hopeful than descriptive." },
        bangalore_palace: { title: "Bangalore Palace (1878)", body: "Modelled on Windsor Castle by the Wadiyars of Mysore on land bought from a British headmaster. A decades-long ownership dispute with the Karnataka government still drags through the courts." },
        planetarium: { title: "Nehru Planetarium (1989)", body: "Run by BASE on Sankey Road, its GOTO Chronos projector threw stars onto the dome for a generation of schoolkids. The lawn outside hosts Bangalore's amateur astronomy club on clear weekends." },
        kr_market: { title: "KR Market (1928)", body: "Built over the battlefield where Tipu Sultan fell defending Bangalore in 1791. Today it moves an estimated thousand tonnes of flowers, fruit and vegetables before sunrise each day." },
        stadium: { title: "Kanteerava Stadium (1946)", body: "Named for the Mysore king who wrestled tigers, it now hosts Bengaluru FC's roaring West Block. The indoor aquatic dome next door trained most of Karnataka's national-level swimmers." },
        chinnaswamy: { title: "Chinnaswamy Stadium (1969)", body: "First cricket stadium in India to install rooftop solar panels and a subsoil SubAir drainage system. Home of RCB — the team that played 17 IPL seasons without lifting a trophy until recently." },
        ub_wtc: { title: "UB City & WTC (2008/2010)", body: "UB City rose on Vijay Mallya's family brewery land and gave Bangalore its first true luxury mall. The WTC tower on Brigade Gateway was the city's tallest building for nearly a decade." },
        iskcon: { title: "ISKCON Rajajinagar (1997)", body: "Carved into Hare Krishna Hill by architect Jagat Kinkara Das, it blends gopuram and glass. The Sunday Govinda's queue snakes down the hill — most devotees come as much for the prasadam as the darshan." },
        manyata: { title: "Manyata Embassy Park (2003)", body: "11,000 employees commute here daily across 121 acres of reclaimed Nagavara lakebed. Most of Bangalore's IT export revenue passes through this single complex." },
        glass_cluster: { title: "Glass Tower Clusters (2010+)", body: "Bagmane, Embassy and Prestige stitched Outer Ring Road into one continuous SEZ corridor. The reflective facades are a known headache for BIAL flight paths and local bird populations alike." },
        hebbal_flyover: { title: "Hebbal Flyover (2003)", body: "A five-level cloverleaf where NH-44, ORR and the airport expressway braid together. Designed for 60,000 vehicles a day, it now carries more than three times that — the reason your airport cab leaves two hours early." },
        cable_stay: { title: "KR Puram Cable-Stay (2019)", body: "The Baiyappanahalli–KR Puram steel-deck bridge was India's first metro cable-stayed span over an active railway line. Erected in 12-hour night windows because the tracks below couldn't be shut." },
        h_bridge: { title: "Iblur H-Pylon Bridge", body: "The signature H-shaped pylon at Iblur Junction was Bangalore's first asymmetric cable-stay — chosen so the cables wouldn't foul the ORR signal-free corridor below. It is quietly the most photographed flyover in the city." },
        arch_bridge: { title: "Stone Arch Drain Bridge", body: "Cantonment-era arches like these still span the raja kaluves — storm-water drains that were once the lakes' overflow channels. Most are older than the roads that cross them." },
        'VIDHANA SOUDHA': { title: "Vidhana Soudha Metro", body: "An underground Purple Line station tucked between the Soudha and Cubbon Park, blasted through Bangalore's notoriously hard gneiss bedrock. The granite cladding inside echoes the legislature above." },
        'CUBBON PARK': { title: "Cubbon Park Metro", body: "The only BMRCL station built directly under a heritage park — engineers used a cut-and-cover method then replanted every disturbed tree. Exits emerge beside the bandstand and the High Court." },
        'MG ROAD': { title: "MG Road Metro (2011)", body: "First stretch of Namma Metro opened here on 20 October 2011, six kilometres from Baiyappanahalli. The elevated platform replaced the much-loved tree-lined Boulevard that ran down the road's central spine." },
        'HALASURU': { title: "Halasuru Metro", body: "Named for the 1,000-year-old Someshwara temple a short walk away. The station sits on the edge of Ulsoor's older Tamil-speaking quarter, where Kempe Gowda's lake still anchors the neighbourhood." },
        'INDIRANAGAR': { title: "Indiranagar Metro (2016)", body: "Lifted Bangalore's pub district into the metro age — 100ft Road's bars suddenly accessible without a Friday-night auto fare negotiation. The station's curved canopy is a local landmark in its own right." },
        'BYAPPANAHALLI': { title: "Byappanahalli Metro (2011)", body: "Eastern terminus and BMRCL's first depot, where the Purple Line's inaugural train rolled out in 2011. The depot's stabling yard holds the entire fleet overnight under floodlights visible from the ORR." },
    };

    // Kites · only chapter 0-1 (school nostalgia, Sankranti coding)
    const kites = [
        { x:  300, baseY: 130, color: '#c89a5a' },
        { x:  750, baseY: 105, color: '#d4b48a' },
        { x: 1050, baseY: 145, color: '#c89a5a' },
        { x: 1450, baseY: 115, color: '#a47a52' },
    ];

    // Utility poles · continuous network along the whole world.
    // Each pole anchors the spans coming in from its neighbors — no gaps.
    const powerPoles = [];
    for (let i = 0; i < 36; i++) {
        powerPoles.push({
            x: i * 200,
            h: 22 + (i % 3) * 3,       // shorter so they don't compete with metro
            armW: 10 + (i % 2) * 1,    // narrower cross-arm
        });
    }

    // ROAD INFRASTRUCTURE · Bangalore street layout
    // Speed bumps every 600 world-px · zebra crossings at chapter boundaries
    const speedBumps = [];
    for (let i = 0; i < 12; i++) speedBumps.push(600 + i * 600);
    // Cirrus cloud streaks · the wispy curving sky-strokes from real Bangalore dawn.
    // Pre-generated so they don't shimmer per-frame; gentle scroll with parallax 0.05
    // makes them feel suspended above the world.
    const cirrusClouds = [];
    for (let i = 0; i < 18; i++) {
        const wx = i * 380 + (Math.random() - 0.5) * 200;
        cirrusClouds.push({
            x: wx,
            y: 30 + Math.random() * 90,             // top-band placement
            len: 120 + Math.random() * 180,
            curve: 12 + Math.random() * 28,         // arc height
            thickness: 1.5 + Math.random() * 2,
            alpha: 0.18 + Math.random() * 0.22,
            tilt: (Math.random() - 0.5) * 0.3,      // slight diagonal
        });
    }

    // Bangalore flowering canopy · per-chapter bloom color
    //   gulmohar (delonix regia)   = saturated brick-red, peaks Apr–Jun
    //   tabebuia rosea             = soft pink, peaks Feb–Mar
    //   jacaranda mimosifolia      = purple, peaks Mar–Apr (desaturated for sepia)
    //   copper pod (peltophorum)   = brass-yellow, peaks May–Jul
    // Each chapter gets a dominant bloom so the world rotates through Bangalore's
    // actual seasonal palette as the player walks the timeline left→right.
    const CHAPTER_BLOOMS = {
        itics:    '#e6b840',  // copper pod yellow · primary school = sunny
        cmr:      '#8a6db8',  // jacaranda purple · PU = pressure/dusk
        college:  '#d8442a',  // gulmohar red · DSCE = orange chapter accent
        fever104: '#d8442a',  // gulmohar red carries radio-era heat
        sakha:    '#e6b840',  // copper pod · first job = brass
        scripbox: '#e88aa8',  // tabebuia pink against sage accent
        vwgt:     '#d8442a',  // gulmohar red against burgundy
        now:      '#e88aa8',  // tabebuia pink · present-tense softness
    };
    function bloomForWorldX(wx) {
        // pick the chapter whose .x is nearest
        let best = CHAPTERS[0]; let bestD = Infinity;
        for (const ch of CHAPTERS) {
            const d = Math.abs(ch.x - wx);
            if (d < bestD) { bestD = d; best = ch; }
        }
        return CHAPTER_BLOOMS[best.id] || '#d8442a';
    }
    function chapterIdxAt(wx) {
        // index of the chapter the world-x has passed (0..7)
        let idx = 0;
        for (let i = 0; i < CHAPTERS.length; i++) {
            if (wx >= CHAPTERS[i].x - 200) idx = i;
            else break;
        }
        return idx;
    }

    // pre-generate mid-ground trees + telegraph poles at random x positions
    const midProps = [];
    for (let i = 0; i < 150; i++) {
        const x = i * 110 + (Math.random() - 0.5) * 50;
        // mid-band parallax is 0.5, so screen-x ≈ world-x * 0.5; convert back
        // to world-x for chapter lookup. (world coord that this prop "represents")
        const worldX = x * 2;
        const kind = Math.random() < 0.65 ? 'tree' : 'pole';
        midProps.push({
            x,
            kind,
            scale: 0.85 + Math.random() * 0.35,
            bloom: kind === 'tree' ? bloomForWorldX(worldX) : null,
            // pre-baked petal sprinkle offsets so they don't shimmer per-frame
            petals: kind === 'tree' ? Array.from({length: 5 + (Math.random() * 4 | 0)}, () => ({
                dx: (Math.random() - 0.5) * 22,
                dy: -2 - Math.random() * 6,
            })) : null,
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
        // BANGALORE AMBIENCE
        petals:          [],       // [{x,y,vx,vy,life,color}] · falling flower petals
        rain:            [],       // [{x,y,vx,vy,len}] · monsoon streaks (screen-space)
        rainIntensity:   0,        // 0..1 · ramps up during a burst, decays after
        rainNextAt:      45000,    // ms timestamp for next monsoon burst
        autoX:           -200,     // world-x of the auto rickshaw (off-screen between trips)
        autoNextAt:      18000,    // ms timestamp for next rickshaw pass
        autoDir:         1,        // 1 = left→right, -1 = right→left
        // ROAD TRAFFIC · Bangalore street vehicles (BMTC bus, Maruti, motorbike, lorry)
        traffic:         [],       // [{kind, x, dir, speed}] · screen-space
        trafficNextAt:   3000,
        // PEEK CAMERA · brief lean-forward when user taps empty space
        peekT:           0,        // ms remaining of peek animation
        peekDir:         1,        // +1 = lean forward, -1 = lean back
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
    let _initialPlayerX = null;
    let _audioBooted = false;
    function chapterAudioBoot() {
        if (chapterAudio) return;
        const ac = initAudio(); if (!ac) return;
        if (ac.state === 'suspended') ac.resume().catch(() => {});
        const master = ac.createGain();
        master.gain.value = 1;
        master.connect(ac.destination);
        // iOS PRIME · push a 1-sample silent buffer through destination
        // immediately. This tells iOS Safari that the AudioContext IS
        // producing output, preventing it from going silent in background.
        // Without this, iOS sometimes suspends the context even after resume().
        try {
            const silent = ac.createBuffer(1, 1, 22050);
            const src = ac.createBufferSource();
            src.buffer = silent;
            src.connect(ac.destination);
            src.start(0);
        } catch (_) {}
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
        // ITICS · Bhupali pentatonic music-box, school nostalgia (C major pentatonic)
        mk('itics', 0.08, (lane) => {
            const d1 = osc('sine', 65.41), d2 = osc('sine', 98.00), dg = g(0.06);
            d1.connect(dg); d2.connect(dg); dg.connect(lane.gain);
            const bhupali = [523.25, 587.33, 659.25, 783.99, 880.00];
            const phrases = [[0,2,4,2,1], [4,3,2,0,2], [0,1,2,4,2], [2,4,3,2,0]];
            let phraseIdx = 0, noteIdx = 0;
            every(700, () => {
                const phrase = phrases[phraseIdx];
                const f = bhupali[phrase[noteIdx]];
                ping(lane, 'triangle', f, 1.4, 0.08);
                if (noteIdx === 0) ping(lane, 'sine', f / 2, 1.8, 0.05);
                noteIdx++;
                if (noteIdx >= phrase.length) {
                    noteIdx = 0;
                    phraseIdx = (phraseIdx + 1) % phrases.length;
                }
            });
            every(14000, () => ping(lane, 'sine', 261.63, 3.0, 0.08));
        });
        // CMR · anxious pre-university pressure (A minor with chromatic neighbor)
        mk('cmr', 0.08, (lane) => {
            const d = osc('sawtooth', 55), df = lp(180), dg = g(0.04);
            d.connect(df).connect(dg).connect(lane.gain);
            const aminor = [440, 523.25, 493.88, 440, 415.30];   // A C B A G#
            let i = 0;
            every(600, () => ping(lane, 'triangle', aminor[i++ % aminor.length], 0.5, 0.07));
            every(1000, () => ping(lane, 'sine', 1760, 0.04, 0.08));   // clock tick
            every(4000, () => noisePulse(lane, 0.18, 0.06, 3200, 4));   // pencil scratch
        });
        // DSCE · engineering · youthful expansive D major
        mk('college', 0.08, (lane) => {
            const a = osc('triangle', 146.83), b = osc('triangle', 220), c = osc('triangle', 277.18);
            const pad = g(0.05);
            a.connect(pad); b.connect(pad); c.connect(pad); pad.connect(lane.gain);
            const dmaj = [293.66, 369.99, 440, 587.33, 554.37];
            let i = 0;
            every(900, () => ping(lane, 'sine', dmaj[i++ % dmaj.length], 1.0, 0.07));
            every(1800, () => ping(lane, 'sine', 73.42, 0.12, 0.10));    // bass kick
            const n = noise(), f = bp(700, 1.2), atten = g(0.04);
            const lfo = osc('sine', 0.3), lfoG = g(220);
            lfo.connect(lfoG).connect(f.frequency);
            n.connect(f).connect(atten).connect(lane.gain);
        });
        // FEVER 104 · F major pentatonic radio jingle vibe
        mk('fever104', 0.08, (lane) => {
            const wobble = osc('sine', 0.5), wf = lp(800), wg = g(220);
            wobble.connect(wg).connect(wf.frequency);
            const n = noise(), atten = g(0.05);
            n.connect(wf).connect(atten).connect(lane.gain);
            const fpenta = [349.23, 440, 523.25, 587.33, 698.46];
            const phrases = [[0,2,4,3,2], [4,2,0,2,4], [2,4,3,4,2]];
            let pi = 0, ni = 0;
            every(450, () => {
                const ph = phrases[pi];
                ping(lane, 'triangle', fpenta[ph[ni]], 0.6, 0.09);
                ni++;
                if (ni >= ph.length) { ni = 0; pi = (pi + 1) % phrases.length; }
            });
        });
        // SAKHA · lo-fi melancholy first-job (E minor)
        mk('sakha', 0.08, (lane) => {
            const a = osc('sine', 82.41), b = osc('sine', 123.47);
            const pad = g(0.06);
            a.connect(pad); b.connect(pad); pad.connect(lane.gain);
            const eminor = [329.63, 392, 493.88, 440, 392];
            let i = 0;
            every(1500, () => ping(lane, 'triangle', eminor[i++ % eminor.length], 1.4, 0.08));
            const n = noise(), f = lp(350), atten = g(0.04);
            n.connect(f).connect(atten).connect(lane.gain);
        });
        // SCRIPBOX · purposeful modern building (A minor → C major arpeggio)
        mk('scripbox', 0.08, (lane) => {
            const subOsc = osc('sine', 55), sg = g(0.05);
            subOsc.connect(sg).connect(lane.gain);
            // 16th-note arpeggio · A C E G E C E G
            const arp = [440, 523.25, 659.25, 783.99, 659.25, 523.25, 659.25, 783.99];
            let i = 0;
            every(220, () => ping(lane, 'triangle', arp[i++ % arp.length], 0.25, 0.06));
            // Keystroke ticks
            const tick = () => { noisePulse(lane, 0.022, 0.08, 4500, 6); setTimeout(tick, rand(80, 220)); };
            tick();
            // AI shimmer every 8s
            every(8000, () => {
                ping(lane, 'sine', 1760, 0.6, 0.06);
                setTimeout(() => ping(lane, 'sine', 2093, 0.6, 0.05), 100);
            });
        });
        // VWGT · triumphant G major fanfare + engine idle
        mk('vwgt', 0.08, (lane) => {
            const o = osc('sawtooth', 80), f = lp(220), atten = g(0.08);
            o.connect(f).connect(atten).connect(lane.gain);
            const fanfare = [392, 493.88, 587.33, 783.99, 493.88];
            let i = 0;
            every(800, () => ping(lane, 'sawtooth', fanfare[i++ % fanfare.length], 0.5, 0.06));
            every(400, () => noisePulse(lane, 0.02, 0.04, 6000, 4));   // light hi-hat
        });
        // NOW · contemplative A minor add9 pad
        mk('now', 0.08, (lane) => {
            const a1 = osc('sine', 220), b1 = osc('sine', 277.18), c1 = osc('sine', 329.63);
            const pad = g(0.10);
            a1.connect(pad); b1.connect(pad); c1.connect(pad);
            const lfo2 = osc('sine', 0.08), lfoG2 = g(0.06);
            lfo2.connect(lfoG2).connect(pad.gain);
            pad.connect(lane.gain);
            const motif = [440, 523.25, 659.25, 493.88];
            let i = 0;
            every(2400, () => ping(lane, 'triangle', motif[i++ % motif.length], 2.5, 0.08));
        });
        chapterAudio = { ac, master, lanes };
    }
    function chapterAudioTick() {
        if (_initialPlayerX === null) _initialPlayerX = state.playerX;
        const traveled = Math.abs(state.playerX - _initialPlayerX);
        // (Background MP3 removed · SFX is triggered per chapter-entry instead)
        if (!chapterAudio) return;
        const targetMaster = traveled > 40 ? 1 : 0;
        chapterAudio.master.gain.setTargetAtTime(
            targetMaster, chapterAudio.ac.currentTime, 0.4
        );
        for (const lane of chapterAudio.lanes) {
            const d = Math.abs(state.playerX - lane.x);
            // Wider proximity range (700 vs 400) so chapters overlap and the
            // player never walks through a "dead zone" with no chapter music.
            // ITICS at x=500 now reaches back to world-x -200 (covers
            // pre-school zone with all the beats at wx 120-240).
            const prox = d >= 700 ? 0 : 1 - d / 700;
            const target = prox * lane.cap;
            lane.gain.gain.setTargetAtTime(target, chapterAudio.ac.currentTime, 0.12);
        }
    }
    // ── BACKGROUND MUSIC REMOVED ──
    // Per user request: no looping background track. Each chapter instead
    // triggers a one-shot SFX sting when entered (see CHAPTER_STING_SFX below).
    let bgMusicAudio = null, ytReady = false, ytStarted = false;
    void bgMusicAudio; void ytReady; void ytStarted;

    // Audio auto-boots only after the player has actually MOVED into the
    // world (not on page load, not on idle tap). This means a viewer who
    // glances at the page in a shared environment hears nothing. Once
    // they start walking, the chapter music ramps in naturally.
    function audioGesture() {
        if (_initialPlayerX === null) _initialPlayerX = state.playerX;
        // iOS SAFARI REQUIREMENT: AudioContext must be CREATED inside a user
        // gesture handler. If we wait until "traveled > 40" (which fires in a
        // rAF tick, not a gesture), iOS blocks creation forever. So boot
        // immediately on first gesture. The MASTER GAIN stays at 0 until the
        // player has actually walked (gated in chapterAudioTick).
        if (!_audioBooted) {
            _audioBooted = true;
            chapterAudioBoot();
        }
        // iOS can re-suspend after backgrounding · resume every gesture
        if (chapterAudio && chapterAudio.ac && chapterAudio.ac.state !== 'running') {
            chapterAudio.ac.resume().catch(() => {});
        }
    }
    window.addEventListener('touchstart', audioGesture, { passive: true, once: false });
    window.addEventListener('pointerdown', audioGesture, { passive: true, once: false });
    window.addEventListener('keydown', audioGesture, { passive: true, once: false });

    // ── CHAPTER-ENTRY SOUND STINGS · one-shot SFX fired when crossing into
    // a chapter. Each is procedural WebAudio (~1-2s), evocative of the era.
    // Reuses the chapterAudio.ac context so it inherits autoplay-policy unlock.
    function playChapterSting(id) {
        if (!chapterAudio) return;
        const ac = chapterAudio.ac;
        const master = chapterAudio.master;
        const t0 = ac.currentTime;

        // small helpers · local copies of the ones in chapterAudioBoot scope
        const o = (type, f) => { const n = ac.createOscillator(); n.type = type; n.frequency.value = f; return n; };
        const gn = (v) => { const n = ac.createGain(); n.gain.value = v; return n; };
        const lp = (f) => { const n = ac.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = f; return n; };
        const bp = (f, q) => { const n = ac.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = f; n.Q.value = q; return n; };
        const noiseBuf = (() => {
            const b = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            return b;
        })();
        const nsrc = () => { const s = ac.createBufferSource(); s.buffer = noiseBuf; return s; };

        // tone helper · plays a single note with envelope
        function tone(type, freq, start, dur, vol) {
            const osc = o(type, freq);
            const g = gn(0);
            osc.connect(g).connect(master);
            g.gain.setValueAtTime(0, t0 + start);
            g.gain.linearRampToValueAtTime(vol, t0 + start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
            osc.start(t0 + start); osc.stop(t0 + start + dur + 0.05);
        }
        // noise burst helper
        function burst(start, dur, vol, freq, q) {
            const s = nsrc(); const f = bp(freq, q); const g = gn(0);
            s.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0 + start);
            g.gain.linearRampToValueAtTime(vol, t0 + start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
            s.start(t0 + start); s.stop(t0 + start + dur + 0.05);
        }

        if (id === 'itics') {
            // SCHOOL BELL · struck-metal bell (additive harmonics)
            const bell = [1320, 1980, 2640, 3300];
            const vols = [0.18, 0.10, 0.06, 0.04];
            bell.forEach((f, i) => tone('sine', f, 0, 2.5, vols[i]));
            tone('sine', 660, 0, 2.5, 0.06);
        } else if (id === 'cmr') {
            // STUDY HALL · page turn + pencil scratch + soft tick
            burst(0,    0.18, 0.10, 2400, 4);   // page turn
            burst(0.6,  0.12, 0.08, 3200, 6);   // pencil scratch
            tone('sine', 1600, 1.0, 0.04, 0.08); // soft clock tick
        } else if (id === 'college') {
            // ENGINEERING · cycle bell ding + tool clink
            tone('triangle', 1760, 0,    0.35, 0.12);   // cycle bell
            tone('triangle', 1320, 0.10, 0.40, 0.10);
            tone('square',    400, 0.7,  0.15, 0.06);   // tool clink
            tone('square',    600, 0.75, 0.15, 0.06);
        } else if (id === 'fever104') {
            // RADIO TUNE-IN · static sweep into pentatonic note
            burst(0,    0.5,  0.10, 2400, 3);
            burst(0.2,  0.3,  0.07, 1800, 4);
            tone('sine', 523.25, 0.7, 0.6, 0.10);   // C5 settle
            tone('sine', 659.25, 0.9, 0.5, 0.08);   // E5
        } else if (id === 'sakha') {
            // FIRST JOB · mechanical keyboard cluster + soft chime
            for (let i = 0; i < 6; i++) {
                burst(0.05 * i, 0.025, 0.10, 3500 + (i % 3) * 800, 6);
            }
            tone('sine', 880, 0.5, 0.8, 0.08);   // task-complete chime
        } else if (id === 'scripbox') {
            // AI / SCRIPBOX · ascending arpeggio + shimmer
            tone('triangle', 440,    0.0, 0.3, 0.08);
            tone('triangle', 523.25, 0.15, 0.3, 0.08);
            tone('triangle', 659.25, 0.30, 0.3, 0.08);
            tone('triangle', 880,    0.45, 0.5, 0.09);
            burst(0.5, 0.4, 0.05, 4500, 2);
        } else if (id === 'vwgt') {
            // CAR · door slam + engine rev
            burst(0, 0.08, 0.18, 200, 2);          // door thunk
            // Engine rev = sawtooth pitching down
            const eng = o('sawtooth', 180);
            const ef  = lp(400);
            const eg  = gn(0);
            eng.connect(ef).connect(eg).connect(master);
            eg.gain.setValueAtTime(0, t0 + 0.4);
            eg.gain.linearRampToValueAtTime(0.10, t0 + 0.5);
            eng.frequency.setValueAtTime(110, t0 + 0.4);
            eng.frequency.exponentialRampToValueAtTime(220, t0 + 0.8);
            eng.frequency.exponentialRampToValueAtTime(90, t0 + 1.3);
            eg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
            eng.start(t0 + 0.4); eng.stop(t0 + 1.5);
        } else if (id === 'now') {
            // PRESENT · contemplative chime cluster (A minor add9)
            tone('sine', 220,    0.0, 2.5, 0.10);
            tone('sine', 329.63, 0.1, 2.5, 0.07);
            tone('sine', 440,    0.2, 2.5, 0.06);
            tone('sine', 587.33, 0.3, 2.5, 0.05);
        }
    }

    // ── PROXIMITY SFX ZONES · ambient sound triggers near specific landmarks
    const NEAR_SFX_ZONES = [
        { wx:  300, range: 90,  kind: 'prayer_bell',     cooldown: 40000 },   // Bull Temple
        { wx:  780, range: 90,  kind: 'cinema_audience', cooldown: 25000 },
        { wx: 1450, range: 100, kind: 'market_chatter',  cooldown: 32000 },
        { wx: 1550, range: 85,  kind: 'food_vendor',     cooldown: 28000 },   // food carts near KR Market
        { wx: 1800, range: 100, kind: 'stadium_roar',    cooldown: 38000 },
        { wx: 2150, range: 100, kind: 'cricket_crack',   cooldown: 42000 },
        { wx: 3050, range: 90,  kind: 'prayer_bell',     cooldown: 42000 },   // ISKCON Temple
        { wx: 4000, range: 110, kind: 'office_chatter',  cooldown: 35000 },
    ];
    const _zoneLastFired = {};

    // ── BEAT-LEVEL PROXIMITY SFX ──
    // Each beat in the BEATS array (44 total) maps to a procedural SFX type.
    // Walking within 60px of a beat's world-x triggers its sound, with a
    // per-beat cooldown (default 18s) so the same beat doesn't re-fire spam.
    const BEAT_SFX_MAP = {
        // ITICS · school years
        'monsoon-puddles': 'lunch_chatter',   // splash + giggles
        'first-cycle':     'bike_engine',
        'football-match':  'football_cheer',
        'cricket-match':   'cricket_chant',   // CSK "Whistle Podu" crowd vibe
        'sports-day':      'graduation_applause',
        'cultural-dance':  'graduation_applause',
        'assembly-stage':  'school_bell_distant',
        'exam-anxiety':    'classroom_quiet',
        'chit-chat':       'lunch_chatter',
        'trips':           'bike_engine',
        // CMR · PU pressure
        'saturday-extra':  'classroom_chatter',
        'tuition-rush':    'classroom_chatter',
        'study-lamp':      'classroom_quiet',
        'mock-test':       'classroom_quiet',
        'group-study':     'classroom_chatter',
        'pu-graduation':   'graduation_applause',
        'movie-night':     'cinema_audience',
        'cricket-weekend': 'cricket_play',
        'first-crush':     'heartbeat_chime',
        // DSCE · engineering
        'bosch-intern':    'office_meeting',
        'abb-intern':      'office_meeting',
        'hostel-room':     'lunch_chatter',
        'fest-stage':      'graduation_applause',
        'group-ride':      'bike_engine',
        'convocation':     'graduation_applause',
        // FEVER 104 · radio
        'headphones':      'radio_static',
        'script-binder':   'radio_static',
        'sound-engineer':  'radio_static',
        'trainee-cert':    'paycheck_chime',
        // SAKHA · first job
        'interview-day':   'office_meeting',
        'first-day-badge': 'paycheck_chime',
        'team-lunch':      'lunch_chatter',
        'first-paycheck':  'paycheck_chime',
        'wfh-covid':       'typing_keyboard',
        'office-standup':  'office_meeting',
        'late-night-coding': 'typing_keyboard',
        'team-outing':     'lunch_chatter',
        // SCRIPBOX · current
        'onboarding':      'office_meeting',
        'pr-review':       'typing_keyboard',
        'anthropic-catalog': 'ai_shimmer',
        'whiteboard':      'office_meeting',
        'claude-code':     'typing_keyboard',
        'anthropic-talk':  'office_meeting',
        'coffee-setup':    'morning_ambient',
        'bangalore-traffic': 'bike_engine',
        'thailand-trip':   'morning_ambient',  // tropical bird chirp + chime
        'dubai-trip':      'ai_shimmer',        // skyline shimmer feel
        // VWGT · car
        'test-drive':      'car_engine',
        'documents-signing': 'paycheck_chime',
        'keys-handover':   'paycheck_chime',
        'first-drive-out': 'car_engine',
        // NOW · present
        'morning-routine': 'morning_ambient',
        'code-flow':       'typing_keyboard',
        'anthropic-goal':  'ai_shimmer',
        'forward-horizon': 'morning_ambient',
    };
    const _beatLastFired = {};
    const BEAT_COOLDOWN = 8000;        // 8s between same-beat firings (was 18s)
    const BEAT_RANGE_WX = 80;          // world-x distance to trigger (was 60)

    function tickProximitySFX() {
        if (!chapterAudio || !_audioBooted) return;
        const now = state.elapsedMs;
        // 1. Landmark zones (cinema, market, stadium, etc.)
        for (const z of NEAR_SFX_ZONES) {
            const d = Math.abs(state.playerX - z.wx);
            if (d > z.range) continue;
            const last = _zoneLastFired[z.kind] || 0;
            if (now - last < z.cooldown) continue;
            _zoneLastFired[z.kind] = now;
            playProximitySFX(z.kind);
        }
        // 2. BEAT-level proximity · 44 beats with per-beat cooldown
        if (typeof BEATS !== 'undefined' && BEATS) {
            for (const b of BEATS) {
                const sfxKind = BEAT_SFX_MAP[b.id];
                if (!sfxKind) continue;
                const ch = CHAPTERS.find(c => c.id === b.ch);
                if (!ch) continue;
                const beatWX = ch.x + b.dx;
                const d = Math.abs(state.playerX - beatWX);
                if (d > BEAT_RANGE_WX) continue;
                const beatKey = b.ch + ':' + b.id;
                const last = _beatLastFired[beatKey] || 0;
                if (now - last < BEAT_COOLDOWN) continue;
                _beatLastFired[beatKey] = now;
                playBeatSFX(sfxKind);
            }
        }
    }
    function playProximitySFX(kind) {
        if (!chapterAudio) return;
        const ac = chapterAudio.ac;
        const master = chapterAudio.master;
        const t0 = ac.currentTime;
        const o = (type, f) => { const n = ac.createOscillator(); n.type = type; n.frequency.value = f; return n; };
        const gn = (v) => { const n = ac.createGain(); n.gain.value = v; return n; };
        const bp = (f, q) => { const n = ac.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = f; n.Q.value = q; return n; };
        const lp = (f) => { const n = ac.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = f; return n; };
        const noiseBuf = (() => {
            const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            return b;
        })();
        const ns = () => { const s = ac.createBufferSource(); s.buffer = noiseBuf; return s; };

        if (kind === 'cinema_audience') {
            const n = ns(); const f = bp(500, 0.8); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.06, t0 + 0.3);
            g.gain.linearRampToValueAtTime(0, t0 + 2.5);
            n.start(t0); n.stop(t0 + 2.6);
            for (let i = 0; i < 3; i++) {
                const cs = ns(); const cf = bp(2500, 1.5); const cg = gn(0);
                cs.connect(cf).connect(cg).connect(master);
                const ct = t0 + 0.5 + i * 0.6 + Math.random() * 0.2;
                cg.gain.setValueAtTime(0.10, ct);
                cg.gain.exponentialRampToValueAtTime(0.001, ct + 0.08);
                cs.start(ct); cs.stop(ct + 0.1);
            }
            const w1 = o('triangle', 2200); const w2 = o('triangle', 2210);
            const wg = gn(0); w1.connect(wg); w2.connect(wg); wg.connect(master);
            const wt = t0 + 1.8;
            wg.gain.setValueAtTime(0, wt);
            wg.gain.linearRampToValueAtTime(0.06, wt + 0.04);
            wg.gain.setValueAtTime(0.06, wt + 0.3);
            wg.gain.exponentialRampToValueAtTime(0.001, wt + 0.4);
            w1.start(wt); w2.start(wt); w1.stop(wt + 0.42); w2.stop(wt + 0.42);
        } else if (kind === 'market_chatter') {
            const n = ns(); const f = bp(600, 0.6); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.05, t0 + 0.5);
            g.gain.linearRampToValueAtTime(0, t0 + 3.0);
            n.start(t0); n.stop(t0 + 3.1);
        } else if (kind === 'stadium_roar') {
            const n = ns(); const f = bp(450, 0.5); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.12, t0 + 0.8);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.8);
            n.start(t0); n.stop(t0 + 2.9);
            const w = o('triangle', 2400); const wg = gn(0);
            w.connect(wg).connect(master);
            wg.gain.setValueAtTime(0.08, t0 + 0.5);
            wg.gain.setValueAtTime(0.08, t0 + 0.8);
            wg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
            w.start(t0 + 0.5); w.stop(t0 + 0.95);
        } else if (kind === 'cricket_crack') {
            const cs = ns(); const cf = bp(3000, 4); const cg = gn(0);
            cs.connect(cf).connect(cg).connect(master);
            cg.gain.setValueAtTime(0.15, t0);
            cg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
            cs.start(t0); cs.stop(t0 + 0.08);
            const n = ns(); const nf = bp(500, 0.8); const ng = gn(0);
            n.connect(nf).connect(ng).connect(master);
            ng.gain.setValueAtTime(0, t0 + 0.3);
            ng.gain.linearRampToValueAtTime(0.10, t0 + 0.7);
            ng.gain.exponentialRampToValueAtTime(0.001, t0 + 2.5);
            n.start(t0 + 0.3); n.stop(t0 + 2.6);
        } else if (kind === 'office_chatter') {
            for (let i = 0; i < 8; i++) {
                const ks = ns(); const kf = bp(3200, 5); const kg = gn(0);
                ks.connect(kf).connect(kg).connect(master);
                const kt = t0 + Math.random() * 2.5;
                kg.gain.setValueAtTime(0.06, kt);
                kg.gain.exponentialRampToValueAtTime(0.001, kt + 0.025);
                ks.start(kt); ks.stop(kt + 0.05);
            }
            const n = ns(); const f = lp(500); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.03, t0 + 0.5);
            g.gain.linearRampToValueAtTime(0, t0 + 2.8);
            n.start(t0); n.stop(t0 + 2.9);
        }
    }

    // ── BEAT-LEVEL SFX · 13 procedural sound types · ~2s each ──
    // Fires when player walks within 60 world-px of a story beat
    function playBeatSFX(kind) {
        if (!chapterAudio) return;
        const ac = chapterAudio.ac;
        const master = chapterAudio.master;
        const t0 = ac.currentTime;
        const o = (type, f) => { const n = ac.createOscillator(); n.type = type; n.frequency.value = f; return n; };
        const gn = (v) => { const n = ac.createGain(); n.gain.value = v; return n; };
        const bp = (f, q) => { const n = ac.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = f; n.Q.value = q; return n; };
        const lp = (f) => { const n = ac.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = f; return n; };
        const noiseBuf = (() => {
            const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            return b;
        })();
        const ns = () => { const s = ac.createBufferSource(); s.buffer = noiseBuf; return s; };
        const tone = (type, freq, start, dur, vol) => {
            const osc = o(type, freq); const g = gn(0);
            osc.connect(g).connect(master);
            g.gain.setValueAtTime(0, t0 + start);
            g.gain.linearRampToValueAtTime(vol, t0 + start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
            osc.start(t0 + start); osc.stop(t0 + start + dur + 0.05);
        };
        const burst = (start, dur, vol, freq, q) => {
            const s = ns(); const f = bp(freq, q); const g = gn(0);
            s.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0 + start);
            g.gain.linearRampToValueAtTime(vol, t0 + start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
            s.start(t0 + start); s.stop(t0 + start + dur + 0.05);
        };

        if (kind === 'football_cheer') {
            // Crowd cheer + ref whistle
            const n = ns(); const f = bp(450, 0.6); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.10, t0 + 0.4);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.5);
            n.start(t0); n.stop(t0 + 2.6);
            // Whistle at 1.2s
            const w1 = o('triangle', 2200), w2 = o('triangle', 2208);
            const wg = gn(0); w1.connect(wg); w2.connect(wg); wg.connect(master);
            wg.gain.setValueAtTime(0, t0 + 1.2);
            wg.gain.linearRampToValueAtTime(0.08, t0 + 1.25);
            wg.gain.setValueAtTime(0.08, t0 + 1.55);
            wg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.65);
            w1.start(t0 + 1.2); w2.start(t0 + 1.2);
            w1.stop(t0 + 1.7); w2.stop(t0 + 1.7);
        } else if (kind === 'cricket_chant') {
            // CSK "Whistle Podu" stadium chant · 4-syllable rhythmic crowd
            // pulses + signature train-whistle on top
            const crowdN = ns(); const crowdF = bp(450, 0.7); const crowdG = gn(0);
            crowdN.connect(crowdF).connect(crowdG).connect(master);
            crowdG.gain.setValueAtTime(0, t0);
            crowdG.gain.linearRampToValueAtTime(0.08, t0 + 0.3);
            crowdG.gain.setValueAtTime(0.08, t0 + 3.0);
            crowdG.gain.exponentialRampToValueAtTime(0.001, t0 + 3.5);
            crowdN.start(t0); crowdN.stop(t0 + 3.6);
            // 4-syllable chant: WHIS-TLE  PO-DU (low + high pulse alternating)
            // Each pulse = bandpassed noise burst pitched to vowel formant
            const chant = [
                { t: 0.20, f: 380 }, { t: 0.40, f: 480 },   // WHIS-TLE
                { t: 0.70, f: 380 }, { t: 0.90, f: 480 },   // PO-DU
                { t: 1.30, f: 380 }, { t: 1.50, f: 480 },   // WHIS-TLE
                { t: 1.80, f: 380 }, { t: 2.00, f: 480 },   // PO-DU
            ];
            for (const pulse of chant) {
                const s = ns(); const f = bp(pulse.f, 2.5); const g = gn(0);
                s.connect(f).connect(g).connect(master);
                const tt = t0 + pulse.t;
                g.gain.setValueAtTime(0.16, tt);
                g.gain.exponentialRampToValueAtTime(0.001, tt + 0.14);
                s.start(tt); s.stop(tt + 0.16);
            }
            // Signature train whistle · long sweep on top
            const w1 = o('triangle', 2100), w2 = o('triangle', 2110);
            const wg = gn(0); w1.connect(wg); w2.connect(wg); wg.connect(master);
            wg.gain.setValueAtTime(0, t0 + 2.3);
            wg.gain.linearRampToValueAtTime(0.10, t0 + 2.4);
            wg.gain.setValueAtTime(0.10, t0 + 2.9);
            wg.gain.exponentialRampToValueAtTime(0.001, t0 + 3.2);
            w1.start(t0 + 2.3); w2.start(t0 + 2.3);
            w1.stop(t0 + 3.3); w2.stop(t0 + 3.3);
            // Bat crack to anchor the cricket context (subtle)
            burst(0.05, 0.05, 0.12, 3200, 4);
        } else if (kind === 'cricket_play') {
            // Bat crack + crowd
            burst(0, 0.05, 0.18, 3200, 4);     // bat hit
            const n = ns(); const f = bp(500, 0.7); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0 + 0.2);
            g.gain.linearRampToValueAtTime(0.08, t0 + 0.6);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.0);
            n.start(t0 + 0.2); n.stop(t0 + 2.1);
        } else if (kind === 'classroom_chatter') {
            // Murmur of voices, occasional shuffle
            const n = ns(); const f = bp(700, 0.5); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.06, t0 + 0.4);
            g.gain.linearRampToValueAtTime(0, t0 + 2.5);
            n.start(t0); n.stop(t0 + 2.6);
            // Page rustle
            burst(0.8, 0.15, 0.06, 2800, 4);
        } else if (kind === 'classroom_quiet') {
            // Soft pencil scratch + clock tick · concentration
            burst(0.1, 0.15, 0.09, 3200, 5);    // pencil
            tone('sine', 1600, 0.6, 0.04, 0.08);  // tick
            tone('sine', 1600, 1.6, 0.04, 0.08);
            burst(2.0, 0.15, 0.08, 3200, 5);
        } else if (kind === 'lunch_chatter') {
            // Cafeteria · plates + chatter + laughter
            const n = ns(); const f = bp(650, 0.55); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.09, t0 + 0.3);
            g.gain.linearRampToValueAtTime(0, t0 + 2.6);
            n.start(t0); n.stop(t0 + 2.7);
            // Plate clink
            burst(0.5, 0.08, 0.12, 2400, 6);
            burst(1.4, 0.08, 0.12, 2600, 6);
        } else if (kind === 'school_bell_distant') {
            // Distant struck bell · gentle
            const freqs = [1320, 1980, 2640];
            freqs.forEach((f, i) => tone('sine', f, 0, 2.2, 0.08 - i * 0.02));
        } else if (kind === 'cinema_audience') {
            // Audience claps + whistle
            const n = ns(); const f = bp(550, 0.6); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.06, t0 + 0.3);
            g.gain.linearRampToValueAtTime(0, t0 + 2.4);
            n.start(t0); n.stop(t0 + 2.5);
            for (let i = 0; i < 3; i++) {
                burst(0.6 + i * 0.5, 0.08, 0.10, 2500, 5);
            }
        } else if (kind === 'graduation_applause') {
            // Sustained applause
            const n = ns(); const f = bp(2200, 1.0); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.10, t0 + 0.2);
            g.gain.setValueAtTime(0.10, t0 + 2.0);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.5);
            n.start(t0); n.stop(t0 + 2.6);
        } else if (kind === 'bike_engine') {
            // Motorbike rev · sawtooth pitch curve
            const eng = o('sawtooth', 80);
            const ef  = lp(380);
            const eg  = gn(0);
            eng.connect(ef).connect(eg).connect(master);
            eg.gain.setValueAtTime(0, t0);
            eg.gain.linearRampToValueAtTime(0.08, t0 + 0.2);
            eng.frequency.setValueAtTime(80, t0);
            eng.frequency.exponentialRampToValueAtTime(160, t0 + 0.7);
            eng.frequency.exponentialRampToValueAtTime(100, t0 + 1.6);
            eng.frequency.exponentialRampToValueAtTime(180, t0 + 2.2);
            eg.gain.exponentialRampToValueAtTime(0.001, t0 + 2.6);
            eng.start(t0); eng.stop(t0 + 2.7);
        } else if (kind === 'heartbeat_chime') {
            // Soft heartbeat + chime · first crush
            for (let i = 0; i < 4; i++) {
                tone('sine', 90, 0.4 * i, 0.12, 0.10);
            }
            tone('sine', 880, 0.5, 1.2, 0.06);
            tone('sine', 1109, 0.7, 1.0, 0.05);
        } else if (kind === 'radio_static') {
            // Radio tune-in sweep
            const n = ns(); const f = bp(2400, 3); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.10, t0 + 0.2);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.5);
            n.start(t0); n.stop(t0 + 1.6);
            f.frequency.setValueAtTime(2400, t0);
            f.frequency.exponentialRampToValueAtTime(800, t0 + 1.2);
            tone('sine', 523, 1.3, 0.6, 0.08);   // note settles
        } else if (kind === 'paycheck_chime') {
            // Bright achievement chime
            tone('triangle', 880,  0.0, 0.3, 0.10);
            tone('triangle', 1109, 0.15, 0.3, 0.09);
            tone('triangle', 1318, 0.30, 0.6, 0.10);
        } else if (kind === 'typing_keyboard') {
            // Mechanical keys cluster
            for (let i = 0; i < 12; i++) {
                burst(0.05 * i, 0.02, 0.08, 3500 + (i % 4) * 700, 6);
            }
        } else if (kind === 'office_meeting') {
            // Low office murmur + slide click
            const n = ns(); const f = lp(500); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.05, t0 + 0.3);
            g.gain.linearRampToValueAtTime(0, t0 + 2.4);
            n.start(t0); n.stop(t0 + 2.5);
            burst(0.6, 0.03, 0.08, 1800, 8);   // pen click
        } else if (kind === 'ai_shimmer') {
            // AI moment · high shimmer + arpeggio
            tone('sine', 1760, 0.0, 0.6, 0.08);
            tone('sine', 2093, 0.1, 0.6, 0.06);
            tone('triangle', 880, 0.3, 0.4, 0.07);
            tone('triangle', 1109, 0.5, 0.4, 0.06);
            burst(0.0, 0.8, 0.04, 4500, 2);   // sparkle wash
        } else if (kind === 'car_engine') {
            // VW engine rev
            const eng = o('sawtooth', 120);
            const ef = lp(450);
            const eg = gn(0);
            eng.connect(ef).connect(eg).connect(master);
            eg.gain.setValueAtTime(0, t0);
            eg.gain.linearRampToValueAtTime(0.10, t0 + 0.2);
            eng.frequency.setValueAtTime(120, t0);
            eng.frequency.exponentialRampToValueAtTime(280, t0 + 0.9);
            eng.frequency.exponentialRampToValueAtTime(110, t0 + 2.0);
            eg.gain.exponentialRampToValueAtTime(0.001, t0 + 2.3);
            eng.start(t0); eng.stop(t0 + 2.4);
        } else if (kind === 'morning_ambient') {
            // Bird chirp + soft chime · contemplative morning
            tone('sine', 2400, 0.0, 0.15, 0.07);   // chirp 1
            tone('sine', 2200, 0.18, 0.15, 0.07);
            tone('sine', 2600, 1.0, 0.15, 0.07);   // chirp 2
            tone('sine', 220, 0.3, 2.0, 0.10);
            tone('sine', 329, 0.5, 1.8, 0.09);
        } else if (kind === 'food_vendor') {
            // Street food sizzle + vendor calling · cumin + spice market
            // Hiss = sizzling oil (filtered noise)
            const sizzle = ns(); const sf = bp(3200, 1.5); const sg = gn(0);
            sizzle.connect(sf).connect(sg).connect(master);
            sg.gain.setValueAtTime(0, t0);
            sg.gain.linearRampToValueAtTime(0.10, t0 + 0.3);
            sg.gain.linearRampToValueAtTime(0, t0 + 2.5);
            sizzle.start(t0); sizzle.stop(t0 + 2.6);
            // Vendor call · short rising pitch sweep (voice-like)
            const callOsc = o('sawtooth', 220);
            const callFilt = lp(900);
            const callGain = gn(0);
            callOsc.connect(callFilt).connect(callGain).connect(master);
            callGain.gain.setValueAtTime(0, t0 + 0.8);
            callGain.gain.linearRampToValueAtTime(0.08, t0 + 0.95);
            callGain.gain.setValueAtTime(0.08, t0 + 1.2);
            callGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.5);
            callOsc.frequency.setValueAtTime(220, t0 + 0.8);
            callOsc.frequency.linearRampToValueAtTime(310, t0 + 1.0);
            callOsc.frequency.linearRampToValueAtTime(190, t0 + 1.4);
            callOsc.start(t0 + 0.8); callOsc.stop(t0 + 1.6);
        } else if (kind === 'prayer_bell') {
            // Temple bell · brass struck-metal harmonics + low chant murmur
            // Bell: fundamental + 3 inharmonic partials
            const partials = [
                { f: 880,  v: 0.16 },
                { f: 1320, v: 0.10 },
                { f: 1760, v: 0.07 },
                { f: 2640, v: 0.05 },
            ];
            for (const p of partials) tone('sine', p.f, 0, 3.2, p.v);
            tone('sine', 440, 0, 2.8, 0.10);   // sub-tone
            // Low murmur (chanting) sustained underneath
            const n = ns(); const f = lp(500); const g = gn(0);
            n.connect(f).connect(g).connect(master);
            g.gain.setValueAtTime(0, t0 + 0.3);
            g.gain.linearRampToValueAtTime(0.04, t0 + 0.8);
            g.gain.linearRampToValueAtTime(0, t0 + 3.0);
            n.start(t0 + 0.3); n.stop(t0 + 3.1);
        } else if (kind === 'monsoon_thunder') {
            // Distant thunder rumble + intensifying rain hiss
            // Thunder: low-frequency noise burst with delayed echo
            const rumble = ns(); const rf = lp(180); const rg = gn(0);
            rumble.connect(rf).connect(rg).connect(master);
            rg.gain.setValueAtTime(0, t0);
            rg.gain.linearRampToValueAtTime(0.18, t0 + 0.4);
            rg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
            rumble.start(t0); rumble.stop(t0 + 1.9);
            // Echo after 0.4s · quieter
            const echo = ns(); const ef = lp(160); const eg = gn(0);
            echo.connect(ef).connect(eg).connect(master);
            eg.gain.setValueAtTime(0, t0 + 0.6);
            eg.gain.linearRampToValueAtTime(0.10, t0 + 0.9);
            eg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
            echo.start(t0 + 0.6); echo.stop(t0 + 1.9);
            // Rain hiss · sustained high-band noise
            const rain = ns(); const raf = bp(3000, 0.8); const rag = gn(0);
            rain.connect(raf).connect(rag).connect(master);
            rag.gain.setValueAtTime(0, t0);
            rag.gain.linearRampToValueAtTime(0.06, t0 + 0.5);
            rag.gain.setValueAtTime(0.06, t0 + 2.0);
            rag.gain.linearRampToValueAtTime(0, t0 + 3.0);
            rain.start(t0); rain.stop(t0 + 3.1);
        }
    }

    // ── CHAPTER MUSIC · per-chapter .mp3 theme files (overrides procedural) ──
    // Drop files into /public/music/{id}.mp3 and they'll auto-load + crossfade
    // based on player position. If a file 404s, the procedural ambient covers
    // that chapter naturally. Per-chapter master volume cap = 0.45 to leave
    // headroom for chatter + lore card SFX.
    const CHAPTER_MUSIC_FILES = [
        { id: 'itics',    x:  500, src: '/music/itics.mp3' },
        { id: 'cmr',      x: 1200, src: '/music/cmr.mp3' },
        { id: 'college',  x: 2000, src: '/music/dsce.mp3' },
        { id: 'fever104', x: 2800, src: '/music/fever104.mp3' },
        { id: 'sakha',    x: 3600, src: '/music/sakha.mp3' },
        { id: 'scripbox', x: 4400, src: '/music/scripbox.mp3' },
        { id: 'vwgt',     x: 5300, src: '/music/vwgt.mp3' },
        { id: 'now',      x: 6200, src: '/music/now.mp3' },
    ];
    let chapterMusic = null;
    function chapterMusicBoot() {
        if (chapterMusic) return;
        // Attempt to load each chapter theme · failures fall back gracefully
        const tracks = CHAPTER_MUSIC_FILES.map(cfg => {
            const audio = new Audio(cfg.src);
            audio.loop = true;
            audio.volume = 0;
            audio.preload = 'auto';
            audio.crossOrigin = 'anonymous';
            const track = { ...cfg, audio, loaded: false, playing: false };
            audio.addEventListener('canplaythrough', () => {
                track.loaded = true;
                console.log(`♪ chapter music loaded: ${cfg.id}`);
            }, { once: true });
            audio.addEventListener('error', () => {
                // File missing · silent fallback to procedural ambient
                track.loaded = false;
            });
            return track;
        });
        chapterMusic = { tracks, masterMul: 0.45 };
    }
    function chapterMusicTick() {
        if (!chapterMusic) return;
        for (const track of chapterMusic.tracks) {
            if (!track.loaded) continue;
            const d = Math.abs(state.playerX - track.x);
            const prox = d >= 500 ? 0 : 1 - d / 500;
            const targetVol = prox * chapterMusic.masterMul;
            // Smooth approach (no instant jumps)
            const cur = track.audio.volume;
            const next = cur + (targetVol - cur) * 0.05;
            track.audio.volume = Math.max(0, Math.min(1, next));
            // Auto-play when within range, pause when far away
            if (next > 0.01 && !track.playing) {
                track.audio.play().catch(() => {});
                track.playing = true;
                // When real music plays, DUCK the procedural ambient for this chapter
                if (chapterAudio) {
                    const lane = chapterAudio.lanes.find(l => l.id === track.id);
                    if (lane) lane.cap = 0;   // mute procedural when MP3 active
                }
            } else if (next < 0.005 && track.playing) {
                track.audio.pause();
                track.playing = false;
            }
        }
    }
    // MP3 chapter music ALSO opt-in only · same ?music=1 flag
    const _musicFlag = new URLSearchParams(location.search).get('music') === '1';
    if (_musicFlag) {
        window.addEventListener('touchstart', chapterMusicBoot, { passive: true, once: false });
        window.addEventListener('pointerdown', chapterMusicBoot, { passive: true, once: false });
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
    const $scoreBeats   = document.getElementById('score-beats');
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
        // Camera lean-forward · the actual "peek" gesture · 700ms animation
        state.peekT = 700;
        state.peekDir = 1;
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
        // Touch-friendly padding · 12-pixel halo around each beat for finger
        // taps on phone screens. Desktop pointer events use the same halo
        // (forgiving but not excessive).
        const PAD = 12;
        let best = null, bestDist = Infinity;
        for (const b of BEATS) {
            const ch = CHAPTERS.find(c => c.id === b.ch);
            if (!ch) continue;
            const bx = ch.x + b.dx;
            const by = groundY + b.dy;
            if (worldX >= bx - b.w / 2 - PAD && worldX <= bx + b.w / 2 + PAD &&
                clientY >= by - b.h / 2 - PAD && clientY <= by + b.h / 2 + PAD) {
                const d = Math.hypot(worldX - bx, clientY - by);
                if (d < bestDist) { bestDist = d; best = b; }
            }
        }
        return best;
    }

    // ── LANDMARK HIT-TEST · click any background structure to see its story ──
    // Tests against skyline silhouettes (parallax 0.30) + bridges (0.40) +
    // metro stations (0.45). Returns a synthetic "beat-like" object that
    // openLoreCard() can render the same way as a normal BEATS entry.
    function hitTestLandmark(clientX, clientY) {
        const H = window.innerHeight;
        const W = window.innerWidth;
        const horizonY = H * HORIZON_PCT;
        const cameraX = state.playerX - W * 0.32;
        const playerChapter = chapterIdxAt(state.playerX);

        // Helper: test a landmark at world-x `wx` with parallax `parallax` and
        // a hit-zone of `hw × hh` centered at screen-y `sy`. Returns true if
        // the click is inside.
        function inside(wx, parallax, hw, hh, sy) {
            const sx = (wx - cameraX) * parallax + W * 0.32 * (1 - parallax);
            return clientX >= sx - hw / 2 && clientX <= sx + hw / 2 &&
                   clientY >= sy - hh / 2 && clientY <= sy + hh / 2;
        }
        // Helper: find the closest landmark to a click (best match)
        let best = null, bestDist = Infinity;
        function check(wx, parallax, hw, hh, sy, kind, lookupKey) {
            const sx = (wx - cameraX) * parallax + W * 0.32 * (1 - parallax);
            if (clientX >= sx - hw / 2 && clientX <= sx + hw / 2 &&
                clientY >= sy - hh / 2 && clientY <= sy + hh / 2) {
                const d = Math.hypot(clientX - sx, clientY - sy);
                if (d < bestDist) {
                    const lore = LANDMARK_LORE[lookupKey];
                    if (lore) {
                        bestDist = d;
                        best = { ch: 'landmark', id: kind, title: lore.title, lore: lore.body };
                    }
                }
            }
        }

        // 1. SKYLINE landmarks (parallax 0.30) · tight hit-zone matched to building height
        for (const lm of SKYLINE) {
            if (playerChapter < lm.minChapterIdx) continue;
            // Hit-zone tracks the actual silhouette: tall buildings get tall zones
            const hw = lm.kind === 'vidhana_soudha' ? 120
                     : lm.kind === 'kr_market' || lm.kind === 'manyata' ? 90
                     : lm.kind === 'stadium' || lm.kind === 'chinnaswamy' ? 80
                     : 55;
            const hh = lm.kind === 'ub_wtc' ? 80 : 50;
            const sy = horizonY - 25;
            check(lm.x, 0.30, hw, hh, sy, lm.kind, lm.kind);
        }
        // 2. BRIDGES (parallax 0.40)
        for (const br of BRIDGES) {
            if (playerChapter < br.minChapterIdx) continue;
            const hw = br.kind === 'h_bridge' ? 180
                     : br.kind === 'cable_stay' ? 160
                     : br.kind === 'hebbal_flyover' ? 200
                     : 80;
            const hh = br.kind === 'cable_stay' || br.kind === 'h_bridge' ? 70 : 40;
            const sy = horizonY - 10;
            check(br.x, 0.40, hw, hh, sy, br.kind, br.kind);
        }
        // 3. METRO STATIONS (parallax 0.45)
        if (playerChapter >= 1) {
            const stations = [
                { x: 1700, name: 'VIDHANA SOUDHA' },
                { x: 2350, name: 'CUBBON PARK' },
                { x: 3000, name: 'MG ROAD' },
                { x: 3650, name: 'HALASURU' },
                { x: 4350, name: 'INDIRANAGAR' },
                { x: 5100, name: 'BYAPPANAHALLI' },
            ];
            const sy = horizonY - 30;
            for (const stn of stations) {
                check(stn.x, 0.45, 120, 35, sy, 'metro:' + stn.name, stn.name);
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

    // ── STAGE-COMPLETION VIDEO · plays an AI-generated 5s montage when a
    //    chapter is collected. Pauses world + ducks audio. Dismisses on
    //    video-end, skip button, click outside, or ESC. Graceful no-op if
    //    the MP4 file is missing (e.g. user hasn't run the build script).
    let _stageVideoActive = false;
    function playStageVideo(chapterId, chapterLabel) {
        if (_stageVideoActive) return;   // dedupe rapid calls
        const $vid = document.getElementById('stage-video');
        const $overlay = document.getElementById('stage-video-overlay');
        const $skip = document.getElementById('stage-video-skip');
        const $caption = document.getElementById('stage-video-caption');
        if (!$vid || !$overlay) return;
        const src = `/videos/${chapterId}.mp4`;
        // Probe whether the file exists · HEAD request before fully committing
        fetch(src, { method: 'HEAD' }).then(res => {
            if (!res.ok) return;   // file missing · graceful no-op
            actuallyPlay();
        }).catch(() => {/* network/CORS error · graceful no-op */});

        function actuallyPlay() {
            _stageVideoActive = true;
            $vid.src = src;
            $vid.currentTime = 0;
            if ($caption) $caption.textContent = chapterLabel || '';
            document.body.classList.add('stage-video-active');
            $overlay.setAttribute('aria-hidden', 'false');
            // Pause world + mute game audio
            state.paused = true;
            if (chapterAudio && chapterAudio.master) {
                chapterAudio.master.gain.setTargetAtTime(0, chapterAudio.ac.currentTime, 0.15);
            }
            $vid.play().catch(err => {
                console.log('stage video play err', err);
                dismiss();
            });
            $vid.onended = dismiss;
            $skip.onclick = (e) => { e.stopPropagation(); dismiss(); };
            $overlay.onclick = (e) => {
                if (e.target === $overlay) dismiss();   // click backdrop = dismiss
            };
            document.addEventListener('keydown', escDismiss, true);
        }
        function escDismiss(e) {
            if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
        }
        function dismiss() {
            if (!_stageVideoActive) return;
            _stageVideoActive = false;
            try { $vid.pause(); } catch (_) {}
            $vid.removeAttribute('src');
            $vid.load();
            document.body.classList.remove('stage-video-active');
            $overlay.setAttribute('aria-hidden', 'true');
            state.paused = false;
            if (chapterAudio && chapterAudio.master) {
                chapterAudio.master.gain.setTargetAtTime(1.0, chapterAudio.ac.currentTime, 0.15);
            }
            $vid.onended = null;
            $skip.onclick = null;
            $overlay.onclick = null;
            document.removeEventListener('keydown', escDismiss, true);
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
        } else if (k === ' ') {
            // Space-bar previously triggered peek but the camera-lean
            // forward-and-back felt like the character was glitching.
            // Suppress the default page-scroll without doing anything else.
            e.preventDefault();
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
        // BEATS are intentional UI icons · open on pointerdown (immediate feedback)
        const hit = hitTestBeat(e.clientX, e.clientY);
        if (hit) {
            e.preventDefault();
            openLoreCard(hit);
            return;
        }
        // Otherwise prep for hold-to-walk OR quick-tap (peek/landmark)
        state.touchHold = true;
        touchStartT = performance.now();
        touchMoved = false;
        touchStartX = e.clientX;
        touchStartY = e.clientY;
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!state.touchHold || touchMoved) return;
        const dx = e.clientX - touchStartX;
        const dy = e.clientY - touchStartY;
        if (dx * dx + dy * dy > TAP_TRAVEL_PX * TAP_TRAVEL_PX) touchMoved = true;
    });
    canvas.addEventListener('pointerup', (e) => {
        const heldMs = performance.now() - touchStartT;
        state.touchHold = false;
        // Quick tap with no movement = landmark click ONLY (peek removed per
        // user feedback · "double tap" camera-lean felt glitchy).
        // Empty-space taps do nothing now.
        if (heldMs < 400 && !touchMoved) {
            const lm = hitTestLandmark(e.clientX, e.clientY);
            if (lm) openLoreCard(lm);
        }
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

    // ── AUDIO TEST BUTTON · diagnoses iOS mute-switch / autoplay issues
    // Plays a loud chime via WebAudio. If user hears it → audio works,
    // hide button. If silent → likely iPhone hardware mute switch.
    const $audioTestBtn = document.getElementById('audio-test-btn');
    if ($audioTestBtn) {
        $audioTestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Force-boot audio context inside this gesture handler
            audioGesture();
            if (chapterAudio && chapterAudio.ac) {
                const ac = chapterAudio.ac;
                if (ac.state !== 'running') ac.resume().catch(() => {});
                // Play loud ascending chime (3 notes · 1.2s total)
                const t0 = ac.currentTime;
                const master = chapterAudio.master;
                // Ensure master is audible
                master.gain.cancelScheduledValues(t0);
                master.gain.setValueAtTime(1.0, t0);
                const tone = (freq, start, dur, vol) => {
                    const osc = ac.createOscillator();
                    const g = ac.createGain();
                    osc.type = 'triangle';
                    osc.frequency.value = freq;
                    osc.connect(g).connect(master);
                    g.gain.setValueAtTime(0, t0 + start);
                    g.gain.linearRampToValueAtTime(vol, t0 + start + 0.02);
                    g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
                    osc.start(t0 + start); osc.stop(t0 + start + dur + 0.05);
                };
                tone(523.25, 0.0, 0.35, 0.18);  // C5
                tone(659.25, 0.2, 0.35, 0.18);  // E5
                tone(783.99, 0.4, 0.6,  0.20);  // G5
            }
            // Hide after first tap regardless · either it worked or hardware mute
            setTimeout(() => $audioTestBtn.classList.add('hidden'), 200);
        });
        // Auto-hide if user starts walking without tapping (assumes audio works)
        setInterval(() => {
            if (_initialPlayerX !== null &&
                Math.abs(state.playerX - _initialPlayerX) > 200) {
                $audioTestBtn.classList.add('hidden');
            }
        }, 1000);
    }

    // Music toggle · bottom-right brass button · persisted in localStorage
    // DEFAULTS TO MUTED on first visit · user opt-in to enable music
    const $musicBtn = document.getElementById('music-btn');
    if ($musicBtn) {
        const stored = localStorage.getItem('journey_muted');
        let muted = stored === null ? true : (stored === '1');  // default muted
        const updateBtn = () => {
            $musicBtn.textContent = muted ? '🔇' : '🔊';
            $musicBtn.classList.toggle('muted', muted);
            if (chapterAudio && chapterAudio.master) {
                chapterAudio.master.gain.setTargetAtTime(
                    muted ? 0 : 1,
                    chapterAudio.ac.currentTime,
                    0.15
                );
            }
            if (chapterMusic) {
                for (const t of chapterMusic.tracks) {
                    if (t.playing && muted) t.audio.pause();
                }
            }
        };
        $musicBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            muted = !muted;
            localStorage.setItem('journey_muted', muted ? '1' : '0');
            // Ensure audio is booted before changing volume
            chapterAudioBoot();
            if (chapterAudio && chapterAudio.ac.state !== 'running') {
                chapterAudio.ac.resume().catch(() => {});
            }
            updateBtn();
        });
        // Apply on page load
        setTimeout(updateBtn, 100);
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

        // --- 4.5 Cirrus cloud streaks · wispy curving brush-strokes
        //          The "real Bangalore dawn" signature — high cirrus catching
        //          golden light. Parallax 0.05 makes them feel suspended.
        const cirrusOffset = -(state.playerX * 0.05);
        const cirrusBaseAlpha = horizonGlow * 0.85 + (1 - nightStrength) * 0.5;
        if (cirrusBaseAlpha > 0.05) {
            ctx.save();
            for (let i = 0; i < cirrusClouds.length; i++) {
                const cl = cirrusClouds[i];
                const cx = (cl.x % (W * 3)) + cirrusOffset;
                // wrap clouds in screen-space
                const wrappedX = ((cx % (W + 600)) + (W + 600)) % (W + 600) - 300;
                if (wrappedX < -cl.len - 50 || wrappedX > W + 50) continue;
                // tinted golden if dawn/dusk, cool grey otherwise
                const r = 240 - (1 - horizonGlow) * 80;
                const g = 220 - (1 - horizonGlow) * 60;
                const b = 180 - horizonGlow * 60;
                ctx.strokeStyle = `rgba(${r|0}, ${g|0}, ${b|0}, ${cl.alpha * cirrusBaseAlpha})`;
                ctx.lineWidth = cl.thickness;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(wrappedX, cl.y);
                ctx.quadraticCurveTo(
                    wrappedX + cl.len * 0.5, cl.y - cl.curve,
                    wrappedX + cl.len, cl.y + cl.tilt * cl.len
                );
                ctx.stroke();
                // Secondary thinner stroke offset slightly · feathered look
                ctx.lineWidth = cl.thickness * 0.4;
                ctx.strokeStyle = `rgba(${r|0}, ${g|0}, ${b|0}, ${cl.alpha * cirrusBaseAlpha * 0.5})`;
                ctx.beginPath();
                ctx.moveTo(wrappedX, cl.y + 3);
                ctx.quadraticCurveTo(
                    wrappedX + cl.len * 0.5, cl.y - cl.curve + 4,
                    wrappedX + cl.len, cl.y + cl.tilt * cl.len + 3
                );
                ctx.stroke();
            }
            ctx.restore();
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

    /** Far back-ridge · 0.10× parallax · sits behind distHills.
     *  Includes Nandi-like asymmetric peak around world-x 4200. */
    function drawBackRidge(W, horizonY, cameraX) {
        const offset = -(cameraX * 0.10);
        ctx.fillStyle = '#8a6a48';   // SEPIA_HAZE
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        for (let i = 0; i < backRidge.length; i++) {
            const p = backRidge[i];
            const px = p.x + offset;
            if (px > -100 && px < W + 100) {
                ctx.lineTo(px, horizonY - p.y * 0.7);
            }
        }
        ctx.lineTo(W, horizonY);
        ctx.closePath();
        ctx.fill();
    }

    /** Bangalore skyline silhouettes · 0.30× parallax · era-gated landmarks.
     *  Drawn between distHills and mid-band. */
    function drawSkyline(W, horizonY, cameraX) {
        const parallax = 0.30;
        const playerChapter = chapterIdxAt(state.playerX);
        ctx.save();
        for (const lm of SKYLINE) {
            if (playerChapter < lm.minChapterIdx) continue;
            const sx = (lm.x - cameraX) * parallax + W * 0.32 * (1 - parallax);
            // ↑ keep the camera 0.32 anchor point stable across bands
            if (sx < -200 || sx > W + 200) continue;
            const baseY = horizonY - 2;
            if (lm.kind === 'vidhana_soudha') {
                // Vidhana Soudha · Mysore-Neo-Dravidian, 1956
                // CORRECTED: extremely horizontal (real-world 700×175 ft ≈ 6:1 ratio)
                // Long arcaded body + corner pavilion towers with stepped finials
                // + central dome drum + Sarnath lion + tricolor flag
                const W_BODY = 180, H_BODY = 20;
                const bx = sx - W_BODY / 2;
                // Granite stepped base · 3-tier
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(bx - 4, baseY - 3, W_BODY + 8, 3);
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(bx - 2, baseY - 6, W_BODY + 4, 3);
                // Main body block
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(bx, baseY - H_BODY - 6, W_BODY, H_BODY);
                // Continuous arcade · arched openings along full length
                ctx.fillStyle = '#3a2418';
                for (let i = 4; i < W_BODY - 4; i += 5) {
                    ctx.fillRect(bx + i, baseY - 18, 3, 10);
                    ctx.beginPath();
                    ctx.arc(bx + i + 1.5, baseY - 18, 1.5, Math.PI, 0); ctx.fill();
                }
                // Roof cornice line · gold
                ctx.fillStyle = '#c89a5a';
                ctx.fillRect(bx, baseY - H_BODY - 7, W_BODY, 1);
                // Corner pavilion towers · 4 with stepped finials
                const towerXs = [bx - 2, bx + W_BODY / 2 - 30, bx + W_BODY / 2 + 28, bx + W_BODY - 4];
                for (const tx of towerXs) {
                    ctx.fillStyle = '#8a6a48';
                    ctx.fillRect(tx, baseY - H_BODY - 18, 8, 12);     // tower body
                    ctx.fillStyle = '#c89a5a';
                    ctx.fillRect(tx + 1, baseY - H_BODY - 22, 6, 4);  // stepped cap
                    ctx.fillRect(tx + 2, baseY - H_BODY - 26, 4, 4);  // upper step
                    ctx.fillStyle = '#d4b48a';
                    ctx.fillRect(tx + 3, baseY - H_BODY - 30, 2, 4);  // spire
                }
                // Central porch · larger projecting entrance
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(sx - 14, baseY - H_BODY - 4, 28, 4);  // porch roof projection
                // Central dome on drum
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(sx - 12, baseY - H_BODY - 14, 24, 8);   // octagonal drum
                ctx.fillStyle = '#c89a5a';
                ctx.beginPath();
                ctx.arc(sx, baseY - H_BODY - 14, 12, Math.PI, 0); ctx.fill();
                // Lantern + Sarnath Lion finial in gold
                ctx.fillStyle = '#d4b48a';
                ctx.fillRect(sx - 2, baseY - H_BODY - 30, 4, 5);     // lantern
                ctx.fillStyle = '#e6c285';
                ctx.fillRect(sx - 1, baseY - H_BODY - 34, 2, 4);     // lion finial · gold catches light
                // Indian tricolor flag flying from central dome
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(sx - 1, baseY - H_BODY - 40, 1, 6);     // flagpole
                const flagWave = Math.sin(state.elapsedMs / 600) * 2;
                ctx.fillStyle = '#c47540'; ctx.fillRect(sx, baseY - H_BODY - 40 + flagWave, 6, 2);  // saffron
                ctx.fillStyle = '#d4b48a'; ctx.fillRect(sx, baseY - H_BODY - 38 + flagWave, 6, 1);  // white
                ctx.fillStyle = '#5a6a4a'; ctx.fillRect(sx, baseY - H_BODY - 37 + flagWave, 6, 2);  // green
            } else if (lm.kind === 'cinema') {
                // Single-screen cinema · marquee + theatre block with Rajini hoarding
                const cx = sx;
                // Building base
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(cx - 28, baseY - 36, 56, 36);
                // Roof cornice line
                ctx.fillStyle = '#c89a5a';
                ctx.fillRect(cx - 30, baseY - 36, 60, 2);
                // Marquee · vertical-format "NOW SHOWING" sign with hand-painted hoarding
                ctx.fillStyle = '#a4332e';   // red Rajini-coded hoarding
                ctx.fillRect(cx - 8, baseY - 36, 16, 26);
                ctx.fillStyle = '#e6c285';   // yellow paint
                ctx.fillRect(cx - 6, baseY - 33, 12, 1);
                ctx.fillRect(cx - 6, baseY - 30, 12, 1);
                ctx.fillRect(cx - 6, baseY - 22, 12, 1);
                ctx.fillRect(cx - 6, baseY - 14, 12, 1);
                // Tiny "RAJINI" text suggestion (1-px painted lines)
                ctx.fillStyle = '#d4b48a';
                ctx.fillRect(cx - 5, baseY - 28, 10, 2);
                ctx.fillRect(cx - 5, baseY - 19, 10, 2);
                // Entrance · dark archway
                ctx.fillStyle = '#1a1208';
                ctx.fillRect(cx - 6, baseY - 9, 12, 9);
                ctx.beginPath();
                ctx.arc(cx, baseY - 9, 6, Math.PI, 0); ctx.fill();
                // Marquee bulb dots (animated · twinkling for "first show feel")
                ctx.fillStyle = '#e6c285';
                const blink = Math.sin(state.elapsedMs / 300);
                if (blink > 0) {
                    for (let i = 0; i < 5; i++) {
                        ctx.fillRect(cx - 22 + i * 10, baseY - 34, 2, 2);
                    }
                }
                // Tiny stick figures queueing at entrance (3 figures)
                ctx.fillStyle = '#3a2418';
                for (let i = 0; i < 3; i++) {
                    const fx = cx + 10 + i * 4;
                    ctx.fillRect(fx, baseY - 6, 1, 4);   // body
                    ctx.fillRect(fx - 0.5, baseY - 8, 2, 2);   // head
                }
            } else if (lm.kind === 'kr_market') {
                // KR Market (1928) · 4 curved barrel-vault roofs in a row
                // The unmistakable Bangalore commercial-heritage silhouette
                const km = sx - 60;
                // Base building block
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(km, baseY - 14, 120, 14);
                // 4 segmental barrel-vault roofs
                ctx.fillStyle = '#8a6a48';
                for (let i = 0; i < 4; i++) {
                    const vx = km + 12 + i * 26;
                    ctx.beginPath();
                    ctx.ellipse(vx + 11, baseY - 14, 13, 8, 0, Math.PI, 0);
                    ctx.fill();
                }
                // Roof ridge highlights
                ctx.fillStyle = '#c89a5a';
                for (let i = 0; i < 4; i++) {
                    const vx = km + 12 + i * 26;
                    ctx.fillRect(vx - 1, baseY - 21, 24, 1);
                }
                // Frontage shop awnings · darker stripe
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(km, baseY - 6, 120, 2);
                // Window grid · cross-vent pattern
                ctx.fillStyle = '#3a2418';
                for (let i = 0; i < 8; i++) {
                    ctx.fillRect(km + 10 + i * 14, baseY - 12, 2, 4);
                }
            } else if (lm.kind === 'stadium') {
                // Sree Kanteerava Stadium + Indoor Dome (1946 / 1995)
                // Oval stadium with 4 floodlight towers + adjacent dome silhouette
                const sm = sx;
                // Stadium oval seating ring
                ctx.fillStyle = '#5a3a22';
                ctx.beginPath();
                ctx.ellipse(sm, baseY - 12, 50, 14, 0, Math.PI, 0);
                ctx.fill();
                // Inner pitch · darker green for grass
                ctx.fillStyle = '#3a4a26';
                ctx.beginPath();
                ctx.ellipse(sm, baseY - 12, 40, 10, 0, Math.PI, 0);
                ctx.fill();
                // Upper canopy roof rim · curving along top of stand
                ctx.fillStyle = '#8a6a48';
                ctx.beginPath();
                ctx.ellipse(sm, baseY - 22, 52, 8, 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#3a2418';
                ctx.beginPath();
                ctx.ellipse(sm, baseY - 20, 48, 4, 0, Math.PI, 0);
                ctx.fill();
                // Four floodlight towers at corners · tall masts with light boxes
                const floodXs = [sm - 50, sm - 18, sm + 18, sm + 50];
                for (const fx of floodXs) {
                    ctx.fillStyle = '#3a2418';
                    ctx.fillRect(fx - 1, baseY - 38, 2, 26);
                    ctx.fillStyle = '#e6c285';
                    ctx.fillRect(fx - 4, baseY - 42, 8, 5);
                    // Light beam glow · subtle radial
                    ctx.fillStyle = 'rgba(230, 194, 133, 0.18)';
                    ctx.beginPath();
                    ctx.arc(fx, baseY - 40, 12, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Indoor dome companion · behind/right of stadium
                ctx.fillStyle = '#5a3a22';
                ctx.beginPath();
                ctx.ellipse(sm + 65, baseY - 14, 22, 14, 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(sm + 43, baseY - 4, 44, 4);  // base band
            } else if (lm.kind === 'planetarium') {
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(sx - 20, baseY - 8, 40, 8);
                ctx.beginPath();
                ctx.arc(sx, baseY - 8, 20, Math.PI, 0); ctx.fill();
            } else if (lm.kind === 'ub_wtc') {
                // UB Tower · stepped crown
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(sx - 14, baseY - 60, 14, 60);
                ctx.fillRect(sx - 16, baseY - 62, 18, 2);
                // window grid · warm dusk glow
                ctx.fillStyle = '#c89a5a';
                for (let r = 0; r < 12; r++) for (let c = 0; c < 4; c++) {
                    if (((r * 4 + c) * 1103515245 + 12345) & 4) {  // pseudo-random lit pattern
                        ctx.fillRect(sx - 12 + c * 3, baseY - 56 + r * 4, 2, 2);
                    }
                }
                // WTC slim tower next to it
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(sx + 18, baseY - 70, 10, 70);
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(sx + 22, baseY - 68, 2, 66);  // central mullion
            } else if (lm.kind === 'chinnaswamy') {
                // M. Chinnaswamy Stadium (1969) · home of RCB · cricket-specific
                // Wider oval than football stadium, no track, RCB red+gold accents
                const cm = sx;
                // Stadium oval — larger than Kanteerava
                ctx.fillStyle = '#5a3a22';
                ctx.beginPath();
                ctx.ellipse(cm, baseY - 14, 58, 16, 0, Math.PI, 0);
                ctx.fill();
                // Cricket pitch · circular green field
                ctx.fillStyle = '#3a4a26';
                ctx.beginPath();
                ctx.ellipse(cm, baseY - 14, 46, 12, 0, Math.PI, 0);
                ctx.fill();
                // Wicket strip · vertical lighter mark in center
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(cm - 1, baseY - 18, 2, 6);
                // Roof canopy · curving along stand · RCB red+gold accent
                ctx.fillStyle = '#a4332e';   // RCB red (sepia-desaturated)
                ctx.beginPath();
                ctx.ellipse(cm, baseY - 26, 60, 6, 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#c89a5a';   // RCB gold band
                ctx.beginPath();
                ctx.ellipse(cm, baseY - 24, 60, 3, 0, Math.PI, 0);
                ctx.fill();
                // 4 floodlight towers · classic cricket-stadium pattern
                const cflood = [cm - 56, cm - 22, cm + 22, cm + 56];
                for (const fx of cflood) {
                    ctx.fillStyle = '#3a2418';
                    ctx.fillRect(fx - 1, baseY - 42, 2, 28);
                    ctx.fillStyle = '#e6c285';
                    ctx.fillRect(fx - 5, baseY - 46, 10, 6);
                    ctx.fillStyle = 'rgba(230, 194, 133, 0.22)';
                    ctx.beginPath();
                    ctx.arc(fx, baseY - 43, 14, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (lm.kind === 'iskcon') {
                // Stepped pyramid temple · gold finial
                ctx.fillStyle = '#5a3a22';
                for (let i = 0; i < 4; i++) {
                    ctx.fillRect(sx - 15 + i * 3, baseY - (4 + i * 4), 30 - i * 6, 4);
                }
                ctx.fillStyle = '#c89a5a';
                ctx.fillRect(sx - 1, baseY - 22, 2, 4);
            } else if (lm.kind === 'bull_temple') {
                // Bull Temple gopuram (1537) · Dravidian 4-tier stepped pyramid
                // Sharper taper than ISKCON · kalasha finial on top
                const bx = sx - 25;
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(bx,      baseY - 28, 50, 28);   // tier 1 base
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(bx + 4,  baseY - 50, 42, 22);   // tier 2
                ctx.fillStyle = '#c89a5a';
                ctx.fillRect(bx + 9,  baseY - 68, 32, 18);   // tier 3
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(bx + 14, baseY - 82, 22, 14);   // tier 4 top
                // Cornice shadow strips between tiers
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(bx,      baseY - 30, 50, 2);
                ctx.fillRect(bx + 4,  baseY - 52, 42, 2);
                ctx.fillRect(bx + 9,  baseY - 70, 32, 2);
                ctx.fillRect(bx + 14, baseY - 84, 22, 2);
                // Kalasha finial (dome + spire + pointed tip)
                ctx.fillStyle = '#d4b48a';
                ctx.beginPath();
                ctx.arc(bx + 25, baseY - 84, 4, Math.PI, 0); ctx.fill();
                ctx.fillRect(bx + 24, baseY - 92, 2, 6);
                ctx.beginPath();
                ctx.moveTo(bx + 22, baseY - 92);
                ctx.lineTo(bx + 25, baseY - 96);
                ctx.lineTo(bx + 28, baseY - 92);
                ctx.closePath();
                ctx.fill();
                // Central doorway · deep shadow anchors silhouette
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(bx + 22, baseY - 18, 6, 18);
                // Sculpture tick rows · 1-px verticals suggest carved figures
                for (let i = 4; i < 46; i += 4) ctx.fillRect(bx + i, baseY - 24, 1, 4);
                for (let i = 8; i < 42; i += 4) ctx.fillRect(bx + i, baseY - 46, 1, 3);
            } else if (lm.kind === 'bangalore_palace') {
                // Bangalore Palace (1878) · Tudor-style with crenellation + corner
                // turrets + central pointed gable + lancet windows
                const px = sx - 60;
                // Main body block
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(px, baseY - 50, 120, 50);
                // Four corner turrets · slightly taller than body
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(px - 4,   baseY - 70, 16, 70);
                ctx.fillRect(px + 28,  baseY - 65, 12, 65);
                ctx.fillRect(px + 80,  baseY - 65, 12, 65);
                ctx.fillRect(px + 108, baseY - 70, 16, 70);
                // Crenellations · 2-px teeth on each turret top
                ctx.fillStyle = '#3a2418';
                const turrets = [[-4, 16], [28, 12], [80, 12], [108, 16]];
                for (const [tx, tw] of turrets) {
                    for (let i = 0; i < tw; i += 4) ctx.fillRect(px + tx + i, baseY - 72, 2, 4);
                }
                // Crenellation along main parapet
                for (let i = 12; i < 108; i += 6) ctx.fillRect(px + i, baseY - 52, 3, 4);
                // Central Tudor pointed gable
                ctx.fillStyle = '#c89a5a';
                ctx.beginPath();
                ctx.moveTo(px + 50, baseY - 50);
                ctx.lineTo(px + 60, baseY - 72);
                ctx.lineTo(px + 70, baseY - 50);
                ctx.closePath();
                ctx.fill();
                // Lancet (pointed) arched windows · 3 across
                ctx.fillStyle = '#3a2418';
                for (const wx of [20, 56, 92]) {
                    ctx.fillRect(px + wx, baseY - 30, 6, 14);
                    ctx.beginPath();
                    ctx.arc(px + wx + 3, baseY - 30, 3, Math.PI, 0); ctx.fill();
                }
                // Edge highlight · catches dawn light on left turret face
                ctx.fillStyle = '#d4b48a';
                ctx.fillRect(px - 4, baseY - 70, 1, 70);
                ctx.fillRect(px + 108, baseY - 70, 1, 70);
            } else if (lm.kind === 'manyata') {
                // Tech park cluster · 8 boxes of varied heights
                ctx.fillStyle = '#5a3a22';
                const heights = [28, 38, 32, 42, 30, 48, 35, 60];
                let cx = sx - 90;
                for (let i = 0; i < heights.length; i++) {
                    const w = 20 + (i & 1) * 2;
                    ctx.fillRect(cx, baseY - heights[i], w, heights[i]);
                    cx += w + 2;
                }
                // Sprinkle lit windows
                ctx.fillStyle = '#c89a5a';
                for (let i = 0; i < 8; i++) {
                    const px = sx - 88 + i * 23;
                    ctx.fillRect(px, baseY - 10, 2, 2);
                    ctx.fillRect(px + 4, baseY - 18, 2, 2);
                }
            } else if (lm.kind === 'glass_cluster') {
                ctx.fillStyle = '#5a3a22';
                const heights = [42, 36, 50, 38];
                let cx = sx - 40;
                for (let i = 0; i < heights.length; i++) {
                    ctx.fillRect(cx, baseY - heights[i], 18, heights[i]);
                    cx += 22;
                }
                ctx.fillStyle = '#c89a5a';
                for (let i = 0; i < 4; i++) ctx.fillRect(sx - 38 + i * 22, baseY - 20, 2, 2);
                // CONSTRUCTION CRANE atop the tallest tower · the modern-Bangalore
                // signature. Every glass tower in BLR is next to a crane.
                const craneBaseX = sx - 40 + 2 * 22 + 9;   // top of tallest (50) tower
                const craneBaseY = baseY - 50;
                ctx.strokeStyle = '#3a2418';
                ctx.lineWidth = 1;
                ctx.beginPath();
                // Vertical mast
                ctx.moveTo(craneBaseX, craneBaseY);
                ctx.lineTo(craneBaseX, craneBaseY - 28);
                // Horizontal jib (forward arm + short counter-jib)
                ctx.moveTo(craneBaseX - 8, craneBaseY - 28);
                ctx.lineTo(craneBaseX + 22, craneBaseY - 28);
                // Diagonal tension cables · A-frame topper
                ctx.moveTo(craneBaseX, craneBaseY - 34);
                ctx.lineTo(craneBaseX - 7, craneBaseY - 28);
                ctx.moveTo(craneBaseX, craneBaseY - 34);
                ctx.lineTo(craneBaseX + 20, craneBaseY - 28);
                ctx.stroke();
                // Operator cab · small square at jib root
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(craneBaseX - 2, craneBaseY - 30, 4, 3);
                // Hook line dangling from jib end
                ctx.strokeStyle = 'rgba(58, 36, 24, 0.6)';
                ctx.beginPath();
                ctx.moveTo(craneBaseX + 18, craneBaseY - 28);
                ctx.lineTo(craneBaseX + 18, craneBaseY - 10);
                ctx.stroke();
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(craneBaseX + 17, craneBaseY - 11, 3, 2);   // hook block
                // Counter-weight slab on counter-jib
                ctx.fillRect(craneBaseX - 8, craneBaseY - 29, 4, 3);
            }
        }
        ctx.restore();
    }

    /** Raintree filler canopies · 0.35× parallax · between skyline and bloom trees.
     *  Wide flat-topped mushroom shape — the dominant Bangalore street tree. */
    function drawRaintrees(W, horizonY, groundY, cameraX) {
        const offset = -(cameraX * 0.35);
        const y = horizonY + 18;
        for (let i = 0; i < raintrees.length; i++) {
            const rt = raintrees[i];
            const px = rt.x + offset;
            if (px < -80 || px > W + 80) continue;
            // Flattened crown ellipse
            ctx.fillStyle = '#3a2418';
            ctx.beginPath();
            ctx.ellipse(px, y, 25 * rt.scale, 8 * rt.scale, 0, 0, Math.PI * 2);
            ctx.fill();
            // Highlight rim · upper edge
            ctx.fillStyle = '#5a3a22';
            ctx.beginPath();
            ctx.ellipse(px, y - 2, 24 * rt.scale, 4 * rt.scale, 0, Math.PI, 0);
            ctx.fill();
        }
    }

    /** Atmospheric haze band · the real Bangalore-dawn signature.
     *  Sits AFTER distant skyline but BEFORE foreground bands — overlays
     *  the bottom 1/3 of buildings with a semi-transparent gradient that
     *  matches the sky color at the horizon. The effect: distant buildings
     *  visibly fade into the smog/fog at their base. */
    function drawAtmosphericHaze(W, horizonY) {
        // Subtle aerial-perspective wash that only fades the FAR bands
        // (back-ridge + distHills + skyline). Drawn BEFORE the closer bands
        // so it doesn't muddy bridges/metro/raintrees.
        const hazeTop = horizonY - 50;
        const hazeBot = horizonY + 2;
        const grad = ctx.createLinearGradient(0, hazeTop, 0, hazeBot);
        grad.addColorStop(0,   `rgba(220, 180, 140, 0)`);
        grad.addColorStop(0.5, `rgba(220, 180, 140, 0.08)`);
        grad.addColorStop(1,   `rgba(220, 180, 140, 0.16)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, hazeTop, W, hazeBot - hazeTop);
    }

    /** Distant tree canopy · 0.32× parallax · dense green band between
     *  skyline and the player band. Matches the thick tree cover that
     *  fronts the city in the real Bangalore photo. */
    function drawDistantCanopy(W, horizonY, groundY, cameraX) {
        // Thin strip of canopy lumps just below horizon · doesn't extend down
        // to ground (was previously filling the entire mid-band, blocking
        // bridges + metro). Now it's a 12-px-tall vegetation strip only.
        const offset = -(cameraX * 0.32);
        const y = horizonY + 4;
        ctx.fillStyle = '#3a4a26';   // muted green · less saturated than before
        ctx.beginPath();
        ctx.moveTo(0, y + 10);
        for (let i = 0; i < 200; i++) {
            const wx = i * 38;
            const px = wx + offset;
            if (px > -50 && px < W + 50) {
                const bump = Math.sin(i * 0.62) * 4 + Math.cos(i * 0.31 + 1.7) * 2;
                ctx.lineTo(px, y + bump);
            }
        }
        ctx.lineTo(W + 100, y + 10);
        ctx.closePath();
        ctx.fill();
    }

    /** Bangalore road bridges · 0.40× parallax · sits just below metro band.
     *  Three kinds: Hebbal-style multi-deck flyover, KR Puram cable-stayed
     *  (Sakha+ era only), small arch bridge over a stream gap. */
    function drawBridges(W, horizonY, cameraX) {
        const parallax = 0.40;
        const offset = -(cameraX * parallax);
        const playerChapter = chapterIdxAt(state.playerX);
        for (const br of BRIDGES) {
            if (playerChapter < br.minChapterIdx) continue;
            const sx = br.x + offset;
            if (sx < -180 || sx > W + 180) continue;
            if (br.kind === 'hebbal_flyover') {
                // Hebbal-style curved 4-lane elevated road · trapezoidal supports
                const deckY = horizonY - 14;
                // Approach ramps · gently rise from ground level up to deck
                ctx.fillStyle = '#5a3a22';
                ctx.beginPath();
                ctx.moveTo(sx - 110, horizonY);
                ctx.lineTo(sx - 60,  deckY);
                ctx.lineTo(sx - 60,  deckY + 4);
                ctx.lineTo(sx - 110, horizonY + 4);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(sx + 60,  deckY);
                ctx.lineTo(sx + 110, horizonY);
                ctx.lineTo(sx + 110, horizonY + 4);
                ctx.lineTo(sx + 60,  deckY + 4);
                ctx.closePath();
                ctx.fill();
                // Main deck · 120px continuous span
                ctx.fillRect(sx - 60, deckY, 120, 5);
                // Underside shadow
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(sx - 60, deckY + 4, 120, 1);
                ctx.fillRect(sx - 110, horizonY + 3, 220, 1);
                // Support columns (4 piers under main deck)
                ctx.fillStyle = '#5a3a22';
                for (let i = 0; i < 4; i++) {
                    const px = sx - 50 + i * 30;
                    ctx.fillRect(px - 2, deckY + 5, 4, horizonY - deckY - 5);
                }
                // Road dashes · centerline marks on deck
                ctx.fillStyle = '#c89a5a';
                for (let i = 0; i < 6; i++) {
                    ctx.fillRect(sx - 54 + i * 20, deckY + 1, 8, 1);
                }
                // Parapet curb · top edge
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(sx - 60, deckY - 1, 120, 1);
            } else if (br.kind === 'cable_stay') {
                // KR Puram-style · single A-frame pylon + fan of cables
                const deckY = horizonY - 12;
                const pylonTop = deckY - 60;
                // Deck · 160-px horizontal span
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(sx - 80, deckY, 160, 4);
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(sx - 80, deckY + 3, 160, 1);   // underside
                // A-frame pylon · two angled lines meeting at top
                ctx.strokeStyle = '#5a3a22';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(sx - 5, deckY);
                ctx.lineTo(sx,     pylonTop);
                ctx.lineTo(sx + 5, deckY);
                ctx.stroke();
                // Cables · 8 fanning to each side from pylon top
                ctx.strokeStyle = 'rgba(90, 58, 34, 0.7)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 1; i <= 8; i++) {
                    const dx = i * 9;
                    ctx.moveTo(sx, pylonTop);
                    ctx.lineTo(sx - dx, deckY);
                    ctx.moveTo(sx, pylonTop);
                    ctx.lineTo(sx + dx, deckY);
                }
                ctx.stroke();
                // Anchor piers below deck (2)
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(sx - 78, deckY + 4, 4, horizonY - deckY - 4);
                ctx.fillRect(sx + 74, deckY + 4, 4, horizonY - deckY - 4);
                // Cap finial at pylon top
                ctx.fillStyle = '#c89a5a';
                ctx.fillRect(sx - 1, pylonTop - 2, 2, 2);
            } else if (br.kind === 'h_bridge') {
                // Iblur-style H-pylon cable-stayed bridge · ORR signature
                // Substantial concrete twin H-pylons with dense cable fan
                const deckY = horizonY - 12;
                const pylonTop = deckY - 80;
                const pylonGap = 80;
                const px1 = sx - pylonGap / 2;
                const px2 = sx + pylonGap / 2;
                const deckHalf = 110;

                // ── DECK · multi-lane road ──
                // Asphalt surface (slightly lighter near-side for road perspective)
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(sx - deckHalf, deckY, deckHalf * 2, 8);
                // Center divider · yellow double-stripe
                ctx.fillStyle = '#e6c285';
                ctx.fillRect(sx - deckHalf, deckY + 3, deckHalf * 2, 1);
                // Lane edge markings · white stripes
                ctx.fillStyle = '#d4b48a';
                ctx.fillRect(sx - deckHalf, deckY, deckHalf * 2, 1);
                ctx.fillRect(sx - deckHalf, deckY + 7, deckHalf * 2, 1);
                // Dashed lane dividers between lanes
                ctx.fillStyle = '#d4b48a';
                for (let i = 0; i < 14; i++) {
                    ctx.fillRect(sx - deckHalf + i * 16, deckY + 5, 4, 0.6);
                }
                // Parapet barriers · low walls on both sides
                ctx.fillStyle = '#5a4a36';
                ctx.fillRect(sx - deckHalf, deckY - 2, deckHalf * 2, 2);
                ctx.fillRect(sx - deckHalf, deckY + 8, deckHalf * 2, 2);
                // Underside shadow band
                ctx.fillStyle = '#1a1208';
                ctx.fillRect(sx - deckHalf, deckY + 10, deckHalf * 2, 1);

                // Cars on the deck · 4 silhouettes scattered
                const carPositions = [
                    { dx: -85, color: '#c4baa8', dir: 1 },   // white hatchback going right
                    { dx: -42, color: '#5a3a22', dir: 1 },   // brown sedan
                    { dx: 28,  color: '#c4baa8', dir: -1 },  // white car going left
                    { dx: 78,  color: '#8a3a2e', dir: -1 },  // red car
                ];
                for (const car of carPositions) {
                    const cx = sx + car.dx;
                    ctx.fillStyle = car.color;
                    ctx.fillRect(cx - 7, deckY + 1, 14, 4);
                    ctx.fillStyle = '#3a4a55';
                    ctx.fillRect(cx - 5, deckY + 1, 10, 2);    // windshield
                    ctx.fillStyle = '#e6c285';
                    ctx.fillRect(cx + (car.dir > 0 ? 6 : -7), deckY + 3, 1.5, 1);
                }

                // ── TWIN H-PYLONS · substantial concrete ──
                for (const px of [px1, px2]) {
                    // Two thick vertical legs
                    ctx.fillStyle = '#6a5a4a';   // concrete grey-brown
                    ctx.fillRect(px - 9, deckY - 2, 5, deckY - pylonTop);
                    ctx.fillRect(px + 4, deckY - 2, 5, deckY - pylonTop);
                    // Shadow side · right edge of each leg
                    ctx.fillStyle = '#3a2818';
                    ctx.fillRect(px - 5, deckY - 2, 1, deckY - pylonTop);
                    ctx.fillRect(px + 8, deckY - 2, 1, deckY - pylonTop);
                    // Light catch · highlight on left edge
                    ctx.fillStyle = '#8a7a5a';
                    ctx.fillRect(px - 9, deckY - 2, 1, deckY - pylonTop);
                    ctx.fillRect(px + 4, deckY - 2, 1, deckY - pylonTop);
                    // HORIZONTAL CROSS-BEAM · the H bar · upper third
                    ctx.fillStyle = '#6a5a4a';
                    ctx.fillRect(px - 9, deckY - 42, 18, 5);
                    ctx.fillStyle = '#3a2818';
                    ctx.fillRect(px - 9, deckY - 38, 18, 1);   // shadow underside
                    ctx.fillStyle = '#8a7a5a';
                    ctx.fillRect(px - 9, deckY - 42, 18, 1);   // highlight top
                    // Access ladder · vertical rungs climbing left leg
                    ctx.fillStyle = '#3a2418';
                    for (let r = 0; r < 14; r++) {
                        ctx.fillRect(px - 4, deckY - 6 - r * 5, 2, 1);
                    }
                    // Pylon top · maintenance light + aviation warning
                    ctx.fillStyle = '#3a2418';
                    ctx.fillRect(px - 4, pylonTop - 3, 8, 3);   // crown box
                    ctx.fillStyle = '#a4332e';                    // red aviation light
                    ctx.fillRect(px - 1, pylonTop - 4, 2, 2);
                    // Subtle glow around aviation light
                    ctx.fillStyle = 'rgba(164, 51, 46, 0.25)';
                    ctx.beginPath();
                    ctx.arc(px, pylonTop - 3, 5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // ── CABLES · dense fan, 17 per pylon ──
                ctx.strokeStyle = 'rgba(70, 50, 30, 0.55)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                // Cables anchor at top crossbeam, fan to deck
                // FROM px1 → outward (12 cables to left)
                for (let i = 1; i <= 12; i++) {
                    const dx = i * 8;
                    ctx.moveTo(px1, deckY - 42);
                    ctx.lineTo(px1 - dx, deckY);
                }
                // FROM px1 → inward (5 cables between pylons)
                for (let i = 1; i <= 5; i++) {
                    const dx = i * 7;
                    ctx.moveTo(px1, deckY - 42);
                    ctx.lineTo(px1 + dx, deckY);
                }
                // FROM px2 → inward
                for (let i = 1; i <= 5; i++) {
                    const dx = i * 7;
                    ctx.moveTo(px2, deckY - 42);
                    ctx.lineTo(px2 - dx, deckY);
                }
                // FROM px2 → outward
                for (let i = 1; i <= 12; i++) {
                    const dx = i * 8;
                    ctx.moveTo(px2, deckY - 42);
                    ctx.lineTo(px2 + dx, deckY);
                }
                ctx.stroke();

                // Cable anchor blocks on the deck · tiny white dots
                ctx.fillStyle = '#d4b48a';
                for (let i = 1; i <= 12; i++) {
                    ctx.fillRect(px1 - i * 8 - 1, deckY - 1, 2, 1);
                    ctx.fillRect(px2 + i * 8 - 1, deckY - 1, 2, 1);
                }

                // ── ANCHOR PIERS under deck at both ends ──
                ctx.fillStyle = '#6a5a4a';
                ctx.fillRect(sx - deckHalf + 2, deckY + 10, 5, horizonY - deckY - 10);
                ctx.fillRect(sx + deckHalf - 7, deckY + 10, 5, horizonY - deckY - 10);
                ctx.fillStyle = '#3a2818';
                ctx.fillRect(sx - deckHalf + 6, deckY + 10, 1, horizonY - deckY - 10);
                ctx.fillRect(sx + deckHalf - 2, deckY + 10, 1, horizonY - deckY - 10);
            } else if (br.kind === 'arch_bridge') {
                // Small 2-arch stone bridge over a stream
                const deckY = horizonY - 4;
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(sx - 40, deckY, 80, 5);
                // Two arches under the deck
                ctx.beginPath();
                ctx.moveTo(sx - 40, horizonY);
                ctx.lineTo(sx - 40, deckY + 4);
                ctx.lineTo(sx - 5,  deckY + 4);
                ctx.arc(sx - 22, deckY + 4, 17, 0, Math.PI, false);
                ctx.lineTo(sx - 40, horizonY);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(sx + 5,  deckY + 4);
                ctx.arc(sx + 22, deckY + 4, 17, Math.PI, 0, true);
                ctx.lineTo(sx + 40, deckY + 4);
                ctx.lineTo(sx + 40, horizonY);
                ctx.lineTo(sx + 5,  horizonY);
                ctx.closePath();
                ctx.fill();
                // Mid-pier
                ctx.fillRect(sx - 4, deckY + 4, 8, horizonY - deckY - 4);
                // Parapet ornament
                ctx.fillStyle = '#8a6a48';
                ctx.fillRect(sx - 40, deckY - 2, 80, 2);
                // Stream water hint · 2-px wavy band under the bridge
                ctx.fillStyle = 'rgba(120, 140, 130, 0.35)';
                ctx.fillRect(sx - 40, horizonY - 1, 80, 2);
            }
        }
    }

    /** Bangalore Metro viaduct · 0.45× parallax · elevated rail line.
     *  Era-gated: appears from CMR era (chapter idx ≥ 1) onward, since Phase 1
     *  opened Oct 2011. Continuous beam with regular piers, station every chapter. */
    function drawMetroViaduct(W, horizonY, cameraX) {
        if (chapterIdxAt(state.playerX) < 1) return;
        const parallax = 0.45;
        const offset = -(cameraX * parallax);
        // Beam only renders past world-x 1500 (CMR onward)
        const beamStart = 1500, beamEnd = 6400;
        const yTop = horizonY - 32, yBot = horizonY - 26;
        // Beam (box girder) · screen-space slice for visible portion only
        ctx.fillStyle = '#5a3a22';
        const sxStart = Math.max(0, beamStart + offset);
        const sxEnd   = Math.min(W, beamEnd + offset);
        if (sxEnd > sxStart) {
            ctx.fillRect(sxStart, yTop, sxEnd - sxStart, 6);
            // underside shadow line
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(sxStart, yBot - 1, sxEnd - sxStart, 1);
            // parapet top band
            ctx.fillStyle = '#8a6a48';
            ctx.fillRect(sxStart, yTop, sxEnd - sxStart, 1);
            // ── RAILS · two parallel 1-px steel lines atop the beam ──
            const railY = yTop - 3;   // sits just above parapet
            ctx.fillStyle = '#8a7a5a';   // muted steel · sepia-cool
            ctx.fillRect(sxStart, railY,     sxEnd - sxStart, 1);
            ctx.fillRect(sxStart, railY - 4, sxEnd - sxStart, 1);
            // ── SLEEPERS (ties) · perpendicular ticks every 6 world-px ──
            ctx.fillStyle = '#3a2418';
            const tieSpacing = 6;
            const firstTie = Math.ceil((sxStart - offset) / tieSpacing) * tieSpacing;
            for (let wx = firstTie; wx + offset < sxEnd; wx += tieSpacing) {
                const px = wx + offset;
                ctx.fillRect(px, railY - 4, 1, 5);
            }
            // ── OVERHEAD CATENARY WIRE · single line above rails ──
            ctx.strokeStyle = 'rgba(58, 36, 24, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sxStart, railY - 22);
            ctx.lineTo(sxEnd,   railY - 22);
            ctx.stroke();
            // ── Catenary masts · OHE supports every 60 world-px (above each pier) ──
            ctx.fillStyle = '#5a3a22';
            const firstMast = Math.ceil((sxStart - offset) / 60) * 60;
            for (let wx = firstMast; wx + offset < sxEnd; wx += 60) {
                const px = wx + offset;
                ctx.fillRect(px - 1, railY - 22, 2, 22);   // vertical mast
                ctx.fillRect(px - 6, railY - 22, 12, 1);   // horizontal arm
            }
        }
        // Piers · every 60 world-px
        ctx.fillStyle = '#5a3a22';
        const firstPier = Math.ceil(beamStart / 60) * 60;
        for (let wx = firstPier; wx <= beamEnd; wx += 60) {
            const px = wx + offset;
            if (px < -10 || px > W + 10) continue;
            ctx.fillRect(px - 3, yBot, 6, 32);
            // shadow strip on right edge
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(px + 2, yBot, 1, 32);
            ctx.fillStyle = '#5a3a22';
        }
        // Multiple Namma Metro Purple Line stations · real names, west→east
        // Spacing ~650 world-px mirrors real ~1km station spacing
        const METRO_STATIONS = [
            { x: 1700, name: 'VIDHANA SOUDHA' },
            { x: 2350, name: 'CUBBON PARK' },
            { x: 3000, name: 'MG ROAD' },
            { x: 3650, name: 'HALASURU' },
            { x: 4350, name: 'INDIRANAGAR' },
            { x: 5100, name: 'BYAPPANAHALLI' },
        ];
        for (const stn of METRO_STATIONS) {
            const stnSx = stn.x + offset;
            if (stnSx < -130 || stnSx > W + 130) continue;
            // Arched canopy roof · 3-panel segmented (real Phase-1 stations have panels)
            ctx.fillStyle = '#5a3a22';
            ctx.beginPath();
            ctx.ellipse(stnSx, yTop - 6, 60, 10, 0, Math.PI, 0);
            ctx.fill();
            // Panel divisions · vertical ribs in the canopy
            ctx.strokeStyle = '#3a2418';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let r = -2; r <= 2; r++) {
                ctx.moveTo(stnSx + r * 20, yTop - 14 + Math.abs(r) * 0.8);
                ctx.lineTo(stnSx + r * 20, yTop - 4);
            }
            ctx.stroke();
            // Roof rim highlight · brass detailing
            ctx.fillStyle = '#c89a5a';
            ctx.beginPath();
            ctx.ellipse(stnSx, yTop - 8, 60, 2, 0, Math.PI, 0);
            ctx.fill();
            // Symmetrical support columns
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(stnSx - 55, yTop - 4, 3, 22);
            ctx.fillRect(stnSx + 52, yTop - 4, 3, 22);
            // Column shadow
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(stnSx - 53, yTop - 4, 1, 22);
            ctx.fillRect(stnSx + 54, yTop - 4, 1, 22);
            // Platform deck band
            ctx.fillStyle = '#8a6a48';
            ctx.fillRect(stnSx - 58, yTop + 6, 120, 3);
            // BMRCL PURPLE LINE LED strip · purple accent along platform edge
            ctx.fillStyle = '#6e4a5c';
            ctx.fillRect(stnSx - 58, yTop + 9, 120, 1);
            // Yellow tactile warning strip
            ctx.fillStyle = '#e6c285';
            ctx.fillRect(stnSx - 58, yTop + 6, 120, 1);
            // STATION NAME BOARD · purple field with cream text
            ctx.fillStyle = '#6e4a5c';
            ctx.fillRect(stnSx - 32, yTop - 14, 64, 6);
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(stnSx - 32, yTop - 9, 64, 1);  // board shadow
            ctx.fillStyle = '#d4b48a';
            ctx.font = '4px "IM Fell English", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stn.name, stnSx, yTop - 11);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
            // Standing passengers on platform · 3-px tall "I" silhouettes
            const passSeed = stn.x | 0;
            for (let p = 0; p < 5; p++) {
                const offsetX = ((passSeed * 7 + p * 23) % 100) - 50;
                const px = stnSx + offsetX;
                // Body
                ctx.fillStyle = ['#5a3a22', '#8a3a2e', '#3a4a55', '#6a4a2a', '#3a2418'][p];
                ctx.fillRect(px - 1, yTop + 2, 2, 4);
                // Head
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(px - 1, yTop + 1, 2, 1);
            }
            // Entrance staircase descending below platform on near side
            ctx.fillStyle = '#3a2418';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(stnSx + 40 + i * 2, yTop + 9 + i, 12, 2);
            }
            // Station entrance arch · semi-circular at base of stairs
            ctx.fillStyle = '#5a3a22';
            ctx.beginPath();
            ctx.arc(stnSx + 56, yTop + 13, 6, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#6e4a5c';   // entrance LED accent
            ctx.fillRect(stnSx + 50, yTop + 12, 12, 1);
        }
    }

    /** Metro train · slides at screen-space velocity, loops every 25s.
     *  Drawn AFTER viaduct so the train sits on the beam. */
    function drawMetroTrain(W, horizonY, cameraX) {
        if (chapterIdxAt(state.playerX) < 1) return;
        const parallax = 0.45;
        const yTop = horizonY - 32;
        const trainY = yTop - 20;
        // Train stations · the train STOPS at each (matches drawMetroViaduct)
        const STATION_STOPS = [1700, 2350, 3000, 3650, 4350, 5100];
        // Cycle = travel + 6 station-pauses. Train spends meaningful time
        // AT each station (4s) so passengers can "board" visually.
        const PAUSE_PER_STATION = 4000;   // 4 seconds paused at each platform
        const SEGMENTS = STATION_STOPS.length + 1;   // 7 segments: 2 edges + 5 interior
        const totalPause = PAUSE_PER_STATION * STATION_STOPS.length;
        const cycle = 70000;   // total cycle time
        const travelTime = cycle - totalPause;
        const timePerSegment = travelTime / SEGMENTS;

        for (let trainIdx = 0; trainIdx < 2; trainIdx++) {
            const phase = (state.elapsedMs + trainIdx * 35000) % cycle;
            const dir = trainIdx === 0 ? 1 : -1;
            const startWX = dir > 0 ?  700 : 7200;
            const endWX   = dir > 0 ? 7200 :  700;
            // Stations in travel direction
            const stationsInDir = STATION_STOPS.slice().sort((a, b) =>
                dir > 0 ? a - b : b - a);
            // Build waypoint list in order: [start, station0, station1, ..., end]
            const waypoints = [startWX, ...stationsInDir, endWX];

            // Walk through schedule to find current headWX
            let elapsed = 0;
            let headWX = startWX;
            let isAtStation = false;
            for (let i = 0; i < SEGMENTS; i++) {
                const segStart = elapsed;
                const segEnd = segStart + timePerSegment;
                if (phase < segEnd) {
                    // In travel segment i (from waypoints[i] to waypoints[i+1])
                    const segT = (phase - segStart) / timePerSegment;
                    headWX = waypoints[i] + (waypoints[i + 1] - waypoints[i]) * segT;
                    break;
                }
                elapsed = segEnd;
                // After segment i, if there's a station (i.e. i < SEGMENTS - 1), pause
                if (i < SEGMENTS - 1) {
                    const pauseEnd = elapsed + PAUSE_PER_STATION;
                    if (phase < pauseEnd) {
                        // Currently paused at station waypoints[i+1] (which is stationsInDir[i])
                        headWX = waypoints[i + 1];
                        isAtStation = true;
                        break;
                    }
                    elapsed = pauseEnd;
                }
            }
            void isAtStation;
            const trainLen = 6 * 30 + 5 * 2;
            const offset = -(cameraX * parallax);
            const headSx = headWX + offset;
            if (headSx < -trainLen - 50 || headSx > W + 50) continue;

            // Determine if it's "night" for interior-light effect
            const cyc = ((state.playerX % 1500) + 1500) % 1500 / 1500;
            const isNight = cyc >= 0.5 && cyc < 0.95;
            const interiorAlpha = isNight ? 0.95 : 0.7;

            // Draw 6 coaches behind the head
            for (let c = 0; c < 6; c++) {
                const cx = headSx - dir * c * 30;
                // Coach body · cream
                ctx.fillStyle = '#d4b48a';
                ctx.fillRect(cx - 14, trainY, 28, 16);
                // Roof shadow band · top edge
                ctx.fillStyle = '#a4845a';
                ctx.fillRect(cx - 14, trainY, 28, 1);
                // Purple Line livery stripe
                ctx.fillStyle = '#6e4a5c';
                ctx.fillRect(cx - 14, trainY + 8, 28, 3);
                // Lit interior windows · 4 per coach, with passenger silhouettes
                for (let w = 0; w < 4; w++) {
                    const wx = cx - 12 + w * 7;
                    // Window frame
                    ctx.fillStyle = '#3a2418';
                    ctx.fillRect(wx, trainY + 2, 5, 5);
                    // Lit interior · warm glow
                    ctx.fillStyle = `rgba(230, 194, 133, ${interiorAlpha})`;
                    ctx.fillRect(wx + 1, trainY + 3, 3, 3);
                    // Passenger silhouette · 1-2 dark heads per window
                    ctx.fillStyle = '#3a2418';
                    if ((c + w) % 3 !== 0) {
                        ctx.fillRect(wx + 1, trainY + 3, 1, 2);
                    }
                    if ((c * 4 + w) % 4 === 0) {
                        ctx.fillRect(wx + 3, trainY + 4, 1, 2);
                    }
                }
                // Door gap · 2 doors visible between window groups
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(cx - 1, trainY + 2, 2, 14);
                // Pantograph · Z-shape on coach roof (coaches 1, 3, 5)
                if (c === 0 || c === 2 || c === 4) {
                    ctx.fillStyle = '#3a2418';
                    ctx.fillRect(cx - 2, trainY - 6, 4, 1);   // contact plate
                    ctx.fillRect(cx - 4, trainY - 4, 1, 4);   // angled arm 1
                    ctx.fillRect(cx + 3, trainY - 4, 1, 4);   // angled arm 2
                    ctx.fillRect(cx - 1, trainY - 1, 2, 1);   // base mount
                }
                // Bogie (wheel housing) · underbody
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(cx - 10, trainY + 16, 4, 1);
                ctx.fillRect(cx + 6, trainY + 16, 4, 1);
                // Coupling link to next coach
                if (c < 5) {
                    ctx.fillStyle = '#3a2418';
                    ctx.fillRect(cx + (dir > 0 ? -16 : 14), trainY + 9, 2, 2);
                }
            }
            // Headlight halo on lead coach · radial warm glow
            const hx = headSx + dir * 13;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const hg = ctx.createRadialGradient(hx, trainY + 12, 0, hx, trainY + 12, 10);
            hg.addColorStop(0,   'rgba(230, 194, 133, 0.95)');
            hg.addColorStop(0.4, 'rgba(230, 194, 133, 0.3)');
            hg.addColorStop(1,   'rgba(0, 0, 0, 0)');
            ctx.fillStyle = hg;
            ctx.fillRect(hx - 10, trainY + 2, 20, 20);
            ctx.restore();
            // Core headlight bulb
            ctx.fillStyle = '#fff8e0';
            ctx.fillRect(hx - 1, trainY + 11, 3, 3);
            // Subtle motion blur · tail trail
            ctx.fillStyle = 'rgba(60, 40, 30, 0.18)';
            ctx.fillRect(headSx - dir * (trainLen + 4), trainY + 6, dir > 0 ? -8 : 8, 8);
        }
    }

    /** Palm crowns · 0.50× parallax · fan-shaped Bangalore residential canopy.
     *  Drawn between metro viaduct and bloom trees. */
    function drawPalms(W, horizonY, groundY, cameraX) {
        const offset = -(cameraX * 0.50);
        for (let i = 0; i < palms.length; i++) {
            const p = palms[i];
            const px = p.x + offset;
            if (px < -30 || px > W + 30) continue;
            const trunkH = 32 * p.scale;
            const topY = groundY - trunkH;
            // Trunk · slight lean
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(px - 1 + p.lean, topY, 2, trunkH);
            // Fronds · radial 1-px lines from trunk top
            ctx.strokeStyle = '#5a4a2a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let f = 0; f < p.fronds; f++) {
                const angle = Math.PI + (f / (p.fronds - 1)) * Math.PI;  // upper half
                const len = 11 * p.scale;
                ctx.moveTo(px + p.lean, topY);
                ctx.lineTo(px + p.lean + Math.cos(angle) * len, topY + Math.sin(angle) * len);
            }
            ctx.stroke();
            // Coconut cluster · 2-3 dots near top
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(px + p.lean - 2, topY + 1, 2, 2);
            ctx.fillRect(px + p.lean + 1, topY + 2, 2, 2);
        }
    }

    /** Utility poles + power lines · 0.40× parallax · CONTINUOUS pole-to-pole
     *  network. Each pole has a cross-arm with ceramic insulators; spans
     *  run between every adjacent pair of poles so there are no air gaps.
     *  Multiple sagging cables (4 lines) per span — classic Indian street pole. */
    function drawPowerLines(W, horizonY, cameraX) {
        const offset = -(cameraX * 0.40);
        // Draw poles + arms first
        for (let i = 0; i < powerPoles.length; i++) {
            const p = powerPoles[i];
            const px = p.x + offset;
            if (px < -30 || px > W + 30) continue;
            const topY = horizonY - p.h;
            // Pole shaft · slight taper, weathered concrete
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(px - 1, topY, 2, p.h);
            // Cross-arm · horizontal beam at top
            ctx.fillRect(px - p.armW, topY + 2, p.armW * 2, 2);
            // Upper cross-arm · smaller, higher
            ctx.fillRect(px - p.armW * 0.6, topY - 3, p.armW * 1.2, 1.5);
            // Ceramic insulators · pale dots on cross-arm
            ctx.fillStyle = '#d4b48a';
            ctx.fillRect(px - p.armW + 1, topY + 1, 2, 2);
            ctx.fillRect(px - 1,          topY + 1, 2, 2);
            ctx.fillRect(px + p.armW - 3, topY + 1, 2, 2);
            ctx.fillStyle = '#c89a5a';
            ctx.fillRect(px - p.armW * 0.5, topY - 4, 1.5, 1.5);
            ctx.fillRect(px + p.armW * 0.5, topY - 4, 1.5, 1.5);
        }
        // Now draw the continuous catenary wires · pole[i] → pole[i+1]
        ctx.strokeStyle = 'rgba(40, 28, 20, 0.78)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < powerPoles.length - 1; i++) {
            const p0 = powerPoles[i];
            const p1 = powerPoles[i + 1];
            const x0 = p0.x + offset;
            const x1 = p1.x + offset;
            if (x1 < -20 || x0 > W + 20) continue;
            const y0 = horizonY - p0.h;
            const y1 = horizonY - p1.h;
            const midX = (x0 + x1) / 2;
            // 3 lines from the lower cross-arm (sag amount varies per line)
            // Outer-left wire
            ctx.moveTo(x0 - p0.armW + 2, y0 + 3);
            ctx.quadraticCurveTo(midX, ((y0 + y1) / 2) + 10, x1 - p1.armW + 2, y1 + 3);
            // Center wire
            ctx.moveTo(x0, y0 + 3);
            ctx.quadraticCurveTo(midX, ((y0 + y1) / 2) + 8, x1, y1 + 3);
            // Outer-right wire
            ctx.moveTo(x0 + p0.armW - 2, y0 + 3);
            ctx.quadraticCurveTo(midX, ((y0 + y1) / 2) + 10, x1 + p1.armW - 2, y1 + 3);
            // Upper cross-arm has 2 thinner wires
            ctx.moveTo(x0 - p0.armW * 0.5, y0 - 3);
            ctx.quadraticCurveTo(midX, ((y0 + y1) / 2) + 3, x1 - p1.armW * 0.5, y1 - 3);
            ctx.moveTo(x0 + p0.armW * 0.5, y0 - 3);
            ctx.quadraticCurveTo(midX, ((y0 + y1) / 2) + 3, x1 + p1.armW * 0.5, y1 - 3);
        }
        ctx.stroke();
    }

    /** Sankranti kites · chapter 0-1 only · bobbing 3-px diamonds.
     *  Pure school-era nostalgia signal. */
    function drawKites(W, horizonY, cameraX) {
        if (chapterIdxAt(state.playerX) > 1) return;
        const offset = -(cameraX * 0.35);
        const t = state.elapsedMs / 1000;
        const KITE_COLORS = [
            { hi: '#a4332e', lo: '#7a221c' },   // red
            { hi: '#e6c285', lo: '#a87a3a' },   // yellow
            { hi: '#3a7a8a', lo: '#264a5a' },   // teal
            { hi: '#7a8a3a', lo: '#4a5a2a' },   // olive green
        ];
        for (let i = 0; i < kites.length; i++) {
            const k = kites[i];
            const px = k.x + offset;
            if (px < -30 || px > W + 30) continue;
            const bob = Math.sin(t * 0.8 + i) * 5;
            const sway = Math.cos(t * 0.5 + i * 1.3) * 4;
            const ky = horizonY - k.baseY + bob;
            const kx = px + sway;
            const pal = KITE_COLORS[i % KITE_COLORS.length];
            // Diamond fighter-kite shape · larger + 2-tone panels
            const W2 = 7, H2 = 10;
            // Left half (light)
            ctx.fillStyle = pal.hi;
            ctx.beginPath();
            ctx.moveTo(kx, ky - H2);
            ctx.lineTo(kx, ky + H2);
            ctx.lineTo(kx - W2, ky);
            ctx.closePath();
            ctx.fill();
            // Right half (dark)
            ctx.fillStyle = pal.lo;
            ctx.beginPath();
            ctx.moveTo(kx, ky - H2);
            ctx.lineTo(kx, ky + H2);
            ctx.lineTo(kx + W2, ky);
            ctx.closePath();
            ctx.fill();
            // Spine + cross-spar
            ctx.strokeStyle = 'rgba(28, 18, 10, 0.7)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(kx, ky - H2); ctx.lineTo(kx, ky + H2);
            ctx.moveTo(kx - W2, ky); ctx.lineTo(kx + W2, ky);
            ctx.stroke();
            // Tail string · curving down with 3 ribbon-bow ties
            ctx.strokeStyle = 'rgba(58, 36, 24, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const tail1x = kx - 10 + Math.sin(t * 1.2 + i) * 2;
            const tail2x = tail1x - 8 + Math.cos(t * 1.1 + i) * 3;
            const tail3x = tail2x - 6 + Math.sin(t * 1.3 + i) * 3;
            ctx.moveTo(kx, ky + H2);
            ctx.quadraticCurveTo(tail1x, ky + H2 + 12, tail2x, ky + H2 + 24);
            ctx.quadraticCurveTo(tail3x, ky + H2 + 36, tail3x - 4, ky + H2 + 48);
            ctx.stroke();
            // Ribbon bows at tail intervals
            ctx.fillStyle = pal.hi;
            ctx.fillRect(tail1x - 1.5, ky + H2 + 11, 3, 2);
            ctx.fillRect(tail2x - 1.5, ky + H2 + 23, 3, 2);
            ctx.fillRect(tail3x - 1.5, ky + H2 + 35, 3, 2);
        }
    }

    /** Fireworks over Vidhana Soudha · brief bursts every ~6s at night.
     *  Each firework rises, peaks, then bursts into 14 colored sparks
     *  that fall with gravity. Color is patriotic (saffron/white/green). */
    // ── FLIGHTS · animated aircraft passing through the sky band ──
    // 3 kinds: passenger jet (large + long contrail), military jet (small + fast),
    // prop plane (low altitude, slower, no contrail). Spawn every 18-35s with
    // randomized altitude and direction. Render in screen-space (no parallax)
    // since they're FAR away and apparent motion is just their own velocity.
    const flights = [];
    function spawnFlight() {
        const kinds = ['jet', 'jet', 'jet', 'prop', 'military'];   // jets more common
        const kind = kinds[(Math.random() * kinds.length) | 0];
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = kind === 'prop' ? 80 + Math.random() * 40
                : kind === 'military' ? 50 + Math.random() * 30
                : 30 + Math.random() * 60;
        const speed = kind === 'military' ? 220 : kind === 'jet' ? 95 : 65;
        flights.push({
            x: dir > 0 ? -80 : (window.innerWidth + 80),
            y, dir, speed, kind,
            trail: [],
        });
    }
    function updateFlights(dt) {
        if (!_audioBooted || _initialPlayerX === null) return;
        // Auto-spawn every 18-35s, cap at 3 on screen
        if (!updateFlights.nextSpawn) updateFlights.nextSpawn = state.elapsedMs + 3000;
        if (state.elapsedMs > updateFlights.nextSpawn && flights.length < 3) {
            spawnFlight();
            updateFlights.nextSpawn = state.elapsedMs + 18000 + Math.random() * 17000;
        }
        for (let i = flights.length - 1; i >= 0; i--) {
            const f = flights[i];
            f.x += f.dir * f.speed * dt / 1000;
            // Contrail emission (jets only)
            if (f.kind !== 'prop' && Math.random() < 0.6) {
                f.trail.push({ x: f.x, y: f.y, life: 1.0 });
                if (f.trail.length > 60) f.trail.shift();
            }
            for (const t of f.trail) t.life -= dt / 4500;
            f.trail = f.trail.filter(t => t.life > 0);
            // Despawn when fully off-screen
            const W = window.innerWidth;
            if (f.x < -150 || f.x > W + 150) flights.splice(i, 1);
        }
    }
    function drawFlights(W, horizonY) {
        for (const f of flights) {
            const screenY = horizonY * (f.y / 240);   // map sky band 0..240 → 0..horizonY
            // Contrail · faded dots receding behind aircraft
            for (const t of f.trail) {
                ctx.fillStyle = `rgba(248, 232, 200, ${t.life * 0.35})`;
                const tScreenY = horizonY * (t.y / 240);
                ctx.fillRect(t.x, tScreenY, 2, 2);
            }
            // Aircraft silhouette
            if (f.kind === 'jet') {
                // Passenger jet · slim fuselage + swept wings
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(f.x - 12, screenY - 1, 24, 2);              // fuselage
                ctx.fillRect(f.x - 4, screenY - 2, 10, 4);                // wing chord
                ctx.fillRect(f.x + (f.dir > 0 ? 10 : -12), screenY - 3, 2, 5);  // tail fin
                // Window line · 3 tiny dots
                ctx.fillStyle = '#c89a5a';
                ctx.fillRect(f.x - 8, screenY, 1, 0.6);
                ctx.fillRect(f.x - 4, screenY, 1, 0.6);
                ctx.fillRect(f.x,     screenY, 1, 0.6);
            } else if (f.kind === 'military') {
                // Small fast military jet · angular delta-wing
                ctx.fillStyle = '#1f1208';
                ctx.beginPath();
                ctx.moveTo(f.x + f.dir * 8, screenY);
                ctx.lineTo(f.x - f.dir * 4, screenY - 2.5);
                ctx.lineTo(f.x - f.dir * 8, screenY);
                ctx.lineTo(f.x - f.dir * 4, screenY + 2.5);
                ctx.closePath();
                ctx.fill();
            } else {
                // Prop plane · twin-engine silhouette + visible propeller blur
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(f.x - 8, screenY - 1, 16, 2);    // fuselage
                ctx.fillRect(f.x - 6, screenY - 3, 12, 1);    // wing
                ctx.fillStyle = 'rgba(58, 36, 24, 0.35)';
                ctx.beginPath();                                // prop disc
                ctx.arc(f.x + f.dir * 9, screenY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // ── BIRDS · flying V-formation across the sky, occasional flocks ──
    // Cheap procedural birds: just M-shapes drawn in screen-space, moving
    // slowly. Spawn every 25-50s, max 2 flocks at once.
    const birdFlocks = [];
    function spawnBirdFlock() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const baseY = 60 + Math.random() * 80;
        const count = 4 + (Math.random() * 5 | 0);
        const flock = { birds: [], dir };
        for (let i = 0; i < count; i++) {
            // V-formation: leader in front, others trailing at offset
            const row = Math.floor(i / 2);
            const side = (i % 2 === 0) ? -1 : 1;
            flock.birds.push({
                offX: -row * 18 * dir,
                offY: row * 5 * side,
                flapPhase: Math.random() * Math.PI * 2,
            });
        }
        flock.x = dir > 0 ? -100 : (window.innerWidth + 100);
        flock.y = baseY;
        flock.speed = 30 + Math.random() * 20;
        birdFlocks.push(flock);
    }
    function updateBirds(dt) {
        if (!_audioBooted) return;
        if (!updateBirds.nextSpawn) updateBirds.nextSpawn = state.elapsedMs + 5000;
        if (state.elapsedMs > updateBirds.nextSpawn && birdFlocks.length < 2) {
            spawnBirdFlock();
            updateBirds.nextSpawn = state.elapsedMs + 25000 + Math.random() * 25000;
        }
        const W = window.innerWidth;
        for (let i = birdFlocks.length - 1; i >= 0; i--) {
            const f = birdFlocks[i];
            f.x += f.dir * f.speed * dt / 1000;
            for (const b of f.birds) b.flapPhase += dt / 100;
            if (f.x < -200 || f.x > W + 200) birdFlocks.splice(i, 1);
        }
    }
    function drawBirds(W, horizonY) {
        ctx.fillStyle = '#3a2418';
        for (const f of birdFlocks) {
            for (const b of f.birds) {
                const bx = f.x + b.offX;
                const by = horizonY * (f.y / 240) + b.offY;
                if (bx < -20 || bx > W + 20) continue;
                // M-shape wings · flap amplitude varies with phase
                const flap = Math.sin(b.flapPhase) * 1.5 + 1;
                ctx.beginPath();
                ctx.moveTo(bx - 3, by);
                ctx.lineTo(bx - 1, by - flap);
                ctx.lineTo(bx,     by);
                ctx.lineTo(bx + 1, by - flap);
                ctx.lineTo(bx + 3, by);
                ctx.strokeStyle = '#3a2418';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }
    }

    const fireworks = [];
    function spawnFirework() {
        const wx = 600 + (Math.random() - 0.5) * 200;   // near Vidhana Soudha
        const targetY = 70 + Math.random() * 50;
        fireworks.push({
            wx,
            y: 0,
            targetY,
            phase: 'rising',
            sparks: [],
            color: ['#c47540', '#d4b48a', '#5a6a4a'][(Math.random() * 3) | 0],
            t: 0,
        });
    }
    function updateFireworks(dt) {
        // Auto-spawn every 5.5-9s if chapter is night-ish (after first move)
        if (_initialPlayerX !== null && state.playerX > _initialPlayerX + 40) {
            if (!updateFireworks.nextSpawn) updateFireworks.nextSpawn = state.elapsedMs + 2000;
            if (state.elapsedMs > updateFireworks.nextSpawn && fireworks.length < 3) {
                spawnFirework();
                updateFireworks.nextSpawn = state.elapsedMs + 5500 + Math.random() * 3500;
            }
        }
        for (let i = fireworks.length - 1; i >= 0; i--) {
            const fw = fireworks[i];
            fw.t += dt;
            if (fw.phase === 'rising') {
                fw.y += 220 * dt / 1000;
                if (fw.y >= fw.targetY) {
                    fw.phase = 'burst';
                    // emit 14 sparks
                    for (let s = 0; s < 14; s++) {
                        const a = (s / 14) * Math.PI * 2;
                        fw.sparks.push({
                            x: 0, y: 0,
                            vx: Math.cos(a) * (60 + Math.random() * 40),
                            vy: Math.sin(a) * (60 + Math.random() * 40),
                            life: 1.0,
                        });
                    }
                }
            } else {
                for (const sp of fw.sparks) {
                    sp.x += sp.vx * dt / 1000;
                    sp.y += sp.vy * dt / 1000;
                    sp.vy += 90 * dt / 1000;   // gravity
                    sp.life -= dt / 1400;
                }
                if (fw.sparks.every(s => s.life <= 0)) fireworks.splice(i, 1);
            }
        }
    }
    function drawFireworks(W, horizonY, cameraX) {
        if (chapterIdxAt(state.playerX) > 1) return;
        const offset = -(cameraX * 0.25);
        for (const fw of fireworks) {
            const px = fw.wx + offset;
            if (px < -30 || px > W + 30) continue;
            if (fw.phase === 'rising') {
                // Trail · 4 fading dots behind the rocket
                for (let i = 0; i < 4; i++) {
                    ctx.fillStyle = `rgba(212, 180, 138, ${0.35 - i * 0.08})`;
                    ctx.fillRect(px - 1, horizonY - fw.y + i * 4, 2, 2);
                }
                // Rocket head
                ctx.fillStyle = fw.color;
                ctx.fillRect(px - 1.5, horizonY - fw.y - 2, 3, 4);
            } else {
                for (const sp of fw.sparks) {
                    if (sp.life <= 0) continue;
                    ctx.fillStyle = fw.color;
                    ctx.globalAlpha = Math.max(0, sp.life);
                    ctx.fillRect(px + sp.x - 1, horizonY - fw.targetY + sp.y - 1, 2, 2);
                }
                ctx.globalAlpha = 1;
            }
        }
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
                // trunk
                const trunkH = 26 * p.scale;
                const canopyY = groundY - trunkH;
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(px - 2, groundY - trunkH, 3, trunkH);
                // 3-blob foliage crown · deep green base
                ctx.fillStyle = '#3d5a2a';
                const r = 11 * p.scale;
                ctx.beginPath();
                ctx.arc(px - 7 * p.scale, canopyY + 2, r,     0, Math.PI * 2);
                ctx.arc(px,                canopyY - 4, r * 1.1, 0, Math.PI * 2);
                ctx.arc(px + 7 * p.scale, canopyY + 2, r,     0, Math.PI * 2);
                ctx.fill();
                // bloom petals · saturated sprinkle on top of canopy
                if (p.bloom && p.petals) {
                    ctx.fillStyle = p.bloom;
                    for (const pt of p.petals) {
                        ctx.fillRect(px + pt.dx, canopyY + pt.dy, 3, 3);
                    }
                }
            } else {
                // telegraph pole
                ctx.fillStyle = '#2a1808';
                ctx.fillRect(px - 1.5, groundY - 40 * p.scale, 3, 40 * p.scale);
                ctx.fillRect(px - 8 * p.scale, groundY - 38 * p.scale, 16 * p.scale, 2);
            }
        }
    }

    /** Bangalore street road · asphalt surface with lane markings, speed bumps,
     *  and zebra crossings at chapter boundaries. Parallax 0.55 — sits between
     *  the mid-band trees and the player's foreground. */
    function drawRoad(W, horizonY, groundY, cameraX) {
        const parallax = 0.55;
        const offset = -(cameraX * parallax);
        const roadTop = groundY - 36;
        const roadBot = groundY - 20;
        // Asphalt surface · sepia-tinted dark
        ctx.fillStyle = '#2a2218';
        ctx.fillRect(0, roadTop, W, roadBot - roadTop);
        // Subtle asphalt texture · faint horizontal scratch lines
        ctx.fillStyle = 'rgba(58, 50, 40, 0.4)';
        ctx.fillRect(0, roadTop + 5, W, 1);
        ctx.fillRect(0, roadTop + 11, W, 1);
        // White edge stripe (top · far side)
        ctx.fillStyle = '#d4b48a';
        ctx.fillRect(0, roadTop, W, 1);
        // Yellow dashed center line · scrolls with parallax
        const dashLen = 14, gapLen = 12;
        const cycle = dashLen + gapLen;
        const phase = ((-(cameraX * parallax)) % cycle + cycle) % cycle - cycle;
        ctx.fillStyle = '#e6c285';
        for (let x = phase; x < W; x += cycle) {
            ctx.fillRect(x, roadTop + 8, dashLen, 1);
        }
        // White edge stripe (near side)
        ctx.fillStyle = '#d4b48a';
        ctx.fillRect(0, roadBot - 1, W, 1);
        // Curb · raised concrete between road and player band
        ctx.fillStyle = '#5a4a36';
        ctx.fillRect(0, roadBot, W, 2);
        ctx.fillStyle = '#8a7a5a';
        ctx.fillRect(0, roadBot + 2, W, 1);
        // Speed bumps · yellow-and-black painted humps (Indian-specific)
        for (const bumpWX of speedBumps) {
            const px = bumpWX + offset;
            if (px < -10 || px > W + 10) continue;
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(px - 5, roadTop + 1, 10, 2);
            ctx.fillStyle = '#e6c285';
            ctx.fillRect(px - 4, roadTop + 1, 2, 2);
            ctx.fillRect(px,     roadTop + 1, 2, 2);
            ctx.fillRect(px + 4, roadTop + 1, 2, 2);
        }
        // Zebra crossings at chapter boundaries
        for (const ch of CHAPTERS) {
            const px = (ch.x - 80) + offset;
            if (px < -50 || px > W + 50) continue;
            ctx.fillStyle = '#d4b48a';
            for (let i = 0; i < 7; i++) {
                ctx.fillRect(px + i * 5, roadTop + 1, 3, roadBot - roadTop - 3);
            }
        }
    }

    /** Bangalore street traffic · vehicles passing on the road in both directions.
     *  4 types: BMTC bus, Maruti hatchback, motorbike, Tata lorry. */
    function drawRoadTraffic(W, groundY) {
        // Vehicle reference Y · wheels at roadY+5 land on road bottom (groundY-20)
        const roadY = groundY - 25;
        for (const v of state.traffic) {
            const x = v.x;
            const flip = v.dir < 0;
            ctx.save();
            if (v.kind === 'hatchback') {
                // White Maruti compact · the most common Bangalore car
                ctx.fillStyle = '#c4baa8';
                ctx.fillRect(x - 18, roadY - 4, 36, 8);
                ctx.fillRect(x - 14, roadY - 10, 26, 6);   // cabin
                ctx.fillStyle = '#3a4a55';
                ctx.fillRect(x - 12, roadY - 9, 22, 4);     // windows
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath(); ctx.arc(x - 12, roadY + 5, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(x + 12, roadY + 5, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#e6c285';
                ctx.fillRect(x + (flip ? -18 : 16), roadY - 1, 2, 2);   // headlight
            } else if (v.kind === 'bmtc_bus') {
                // BMTC bus · faded red + yellow stripe + double-window pattern
                ctx.fillStyle = '#8a3a2e';
                ctx.fillRect(x - 28, roadY - 12, 56, 16);
                ctx.fillStyle = '#e6c285';
                ctx.fillRect(x - 28, roadY - 6, 56, 2);     // yellow body stripe
                ctx.fillStyle = '#3a4a55';
                for (let i = 0; i < 8; i++) ctx.fillRect(x - 26 + i * 7, roadY - 10, 5, 4);
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath(); ctx.arc(x - 18, roadY + 5, 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(x + 18, roadY + 5, 4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#d4b48a';
                ctx.fillRect(x - 6, roadY - 15, 12, 3);     // destination board
                ctx.fillStyle = '#3a2418';
                ctx.font = '3px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('BMTC', x, roadY - 13);
                ctx.textAlign = 'start';
            } else if (v.kind === 'motorbike') {
                // Royal Enfield silhouette · upright rider
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(x - 8, roadY, 16, 3);          // frame
                ctx.fillRect(x - 4, roadY - 3, 8, 4);        // tank
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(x - 2, roadY - 10, 4, 7);       // rider torso
                ctx.fillStyle = '#3a2418';
                ctx.beginPath(); ctx.arc(x, roadY - 11, 2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(x - 8, roadY + 5, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(x + 8, roadY + 5, 3, 0, Math.PI * 2); ctx.fill();
            } else if (v.kind === 'lorry') {
                // Tata lorry · wooden cargo box + separate cab
                ctx.fillStyle = '#6a4a2a';
                ctx.fillRect(x - 22, roadY - 12, 44, 18);    // cargo box
                ctx.fillStyle = '#5a3a22';
                ctx.fillRect(x + (flip ? -32 : 22), roadY - 6, 10, 12); // cab
                ctx.fillStyle = '#3a4a55';
                ctx.fillRect(x + (flip ? -31 : 23), roadY - 4, 4, 4);   // cab window
                ctx.strokeStyle = '#3a2418';
                ctx.lineWidth = 1;
                ctx.strokeRect(x - 22, roadY - 12, 44, 18);
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath(); ctx.arc(x - 14, roadY + 6, 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(x + 14, roadY + 6, 4, 0, Math.PI * 2); ctx.fill();
                // "TATA" painted on cargo
                ctx.fillStyle = '#d4b48a';
                ctx.font = '4px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('TATA', x, roadY - 4);
                ctx.textAlign = 'start';
            }
            ctx.restore();
        }
    }

    /** Bangalore auto rickshaw · yellow-roof black-body 3-wheeler. Crosses
     *  the mid-band in screen-space (no parallax) every ~25–40 seconds,
     *  alternating direction. Keeps proportions small so it reads as scenery
     *  not focal subject. */
    /** Street food carts · stationary roadside vendors with smoke + canopy
     *  Drawn in screen-space converted from world-x · placed near KR Market
     *  (world-x 1550) and near Indiranagar (world-x 4180) by default. */
    const STREET_FOOD_CARTS = [
        { wx: 1530, kind: 'dosa', canopy: '#a4332e' },
        { wx: 1570, kind: 'chai', canopy: '#c47540' },
        { wx: 4170, kind: 'dosa', canopy: '#7a8a6a' },
    ];
    function drawStreetFoodCarts(W, groundY, cameraX) {
        const t = state.elapsedMs;
        for (const cart of STREET_FOOD_CARTS) {
            const sx = cart.wx - cameraX;
            if (sx < -60 || sx > W + 60) continue;
            const y = groundY - 18;
            // Body · wooden cart with wheels
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(sx - 14, y, 28, 12);
            // Front panel with hand-painted color
            ctx.fillStyle = cart.canopy;
            ctx.fillRect(sx - 14, y, 28, 2);
            // Cooking surface · darker griddle / kadai
            ctx.fillStyle = '#1a0e08';
            ctx.fillRect(sx - 11, y + 3, 22, 4);
            // Cooking glow · warm orange flicker
            const flicker = 0.5 + Math.sin(t / 60) * 0.2 + Math.sin(t / 35) * 0.1;
            ctx.fillStyle = `rgba(230, 140, 60, ${flicker * 0.7})`;
            ctx.fillRect(sx - 9, y + 4, 18, 2);
            // Canopy roof · slanted cloth
            ctx.fillStyle = cart.canopy;
            ctx.beginPath();
            ctx.moveTo(sx - 16, y - 1);
            ctx.lineTo(sx + 16, y - 1);
            ctx.lineTo(sx + 12, y - 10);
            ctx.lineTo(sx - 12, y - 10);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(sx - 16, y - 1, 32, 1);   // shadow under canopy
            // Canopy support poles
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(sx - 14, y - 10, 1, 9);
            ctx.fillRect(sx + 13, y - 10, 1, 9);
            // Wheels
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(sx - 9, y + 13, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sx + 9, y + 13, 3, 0, Math.PI * 2); ctx.fill();
            // Vendor figure behind cart · just head + shoulders
            ctx.fillStyle = '#a86434';
            ctx.beginPath(); ctx.arc(sx, y - 13, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = cart.kind === 'chai' ? '#3a4258' : '#5a3a22';
            ctx.fillRect(sx - 2.5, y - 11, 5, 5);
            // SMOKE · 3 rising puffs from the cooking surface
            for (let i = 0; i < 3; i++) {
                const phase = (t / 800 + i * 0.4) % 1;
                const sxOff = sx + (i - 1) * 4 + Math.sin(phase * Math.PI * 2) * 2;
                const syOff = y + 2 - phase * 18;
                const alpha = (1 - phase) * 0.35;
                const radius = 1 + phase * 3;
                ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
                ctx.beginPath(); ctx.arc(sxOff, syOff, radius, 0, Math.PI * 2); ctx.fill();
            }
            // Customer silhouette · 1-2 stick figures in front of cart
            if ((t / 4000 + cart.wx / 100) % 2 < 1.2) {
                ctx.fillStyle = '#3a2418';
                ctx.fillRect(sx - 24, y + 3, 2, 8);
                ctx.beginPath(); ctx.arc(sx - 23, y, 1.6, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    function drawAutoRickshaw(W, groundY) {
        const x = state.autoX;
        if (x < -100 || x > W + 100) return;
        // y is the TOP of the cabin body · wheels at y+20 should land on the
        // road bottom (groundY-20). So y = groundY-40.
        const y = groundY - 40;
        const dir = state.autoDir;   // 1 = facing right
        ctx.save();
        // body · black with brass trim
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, y, 36, 18);                            // main cabin
        ctx.fillRect(x + (dir > 0 ? 32 : -4), y + 4, 8, 14);   // front pod
        // yellow canopy roof · the unmistakable signature
        ctx.fillStyle = '#e8b822';
        ctx.beginPath();
        ctx.moveTo(x - 2,  y);
        ctx.lineTo(x + 38, y);
        ctx.lineTo(x + 34, y - 8);
        ctx.lineTo(x + 2,  y - 8);
        ctx.closePath();
        ctx.fill();
        // windshield · slate
        ctx.fillStyle = '#6a7a82';
        ctx.fillRect(x + (dir > 0 ? 30 : 2), y + 4, 4, 8);
        // wheels · 2 visible
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); ctx.arc(x + 8,  y + 20, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 28, y + 20, 4, 0, Math.PI * 2); ctx.fill();
        // hubcap dots
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(x + 7,  y + 19, 2, 2);
        ctx.fillRect(x + 27, y + 19, 2, 2);
        ctx.restore();
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
        // ── CRICKET ENRICHMENTS ──
        // WICKET-KEEPER behind the stumps, crouching, pads visible
        const wkX = ckx + 21;
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(wkX - 1.5, cky - 9, 3, 4);   // crouch body
        ctx.fillStyle = '#a86434';
        ctx.beginPath(); ctx.arc(wkX, cky - 11, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9d8b0';                 // pads (cream)
        ctx.fillRect(wkX - 2, cky - 5, 1.5, 5);
        ctx.fillRect(wkX + 0.5, cky - 5, 1.5, 5);
        // Gloves
        ctx.fillStyle = '#7a4a26';
        ctx.fillRect(wkX - 3, cky - 7, 1.5, 1.5);
        ctx.fillRect(wkX + 1.5, cky - 7, 1.5, 1.5);

        // UMPIRE in white coat with raised finger (OUT!) · stands at non-striker end
        const umpX = ckx - 22;
        ctx.fillStyle = '#e9d8b0';                 // white coat
        ctx.fillRect(umpX - 2, cky - 13, 4, 9);
        ctx.fillStyle = '#a86434';                 // head
        ctx.beginPath(); ctx.arc(umpX, cky - 15, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1208';                 // hat brim
        ctx.fillRect(umpX - 2.5, cky - 16, 5, 1);
        // Raised finger (out signal)
        ctx.strokeStyle = '#a86434'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(umpX + 1.5, cky - 11);
        ctx.lineTo(umpX + 3.5, cky - 16); ctx.stroke();

        // SCOREBOARD · small panel above the action with runs/wickets · animated
        const sbX = ckx + 5, sbY = cky - 32;
        ctx.fillStyle = '#3a2418';
        ctx.fillRect(sbX - 10, sbY, 22, 11);       // panel body
        ctx.fillStyle = '#c89a5a';                  // brass trim
        ctx.fillRect(sbX - 10, sbY, 22, 1);
        ctx.fillStyle = '#e9d8b0';                  // score text
        ctx.font = '5px monospace'; ctx.textAlign = 'center';
        const runs = (87 + Math.floor((t * 0.0008)) % 13);   // slow ticker 87-100
        ctx.fillText(`${runs}/3`, sbX, sbY + 6);
        ctx.font = '3px monospace';
        ctx.fillText('IND', sbX, sbY + 10);
        ctx.textAlign = 'start';

        // SLIP CORDON · 3 fielders crouched between keeper and gully
        for (let i = 0; i < 3; i++) {
            const slipX = ckx + 27 + i * 4;
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(slipX - 1, cky - 8, 2, 3);
            ctx.fillStyle = '#a86434';
            ctx.beginPath(); ctx.arc(slipX, cky - 9.5, 1, 0, Math.PI * 2); ctx.fill();
        }

        // BOUNDARY ROPE · thin curving line at the edge of the field
        ctx.strokeStyle = '#d4b48a'; ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(ckx - 36, cky + 4);
        ctx.quadraticCurveTo(ckx, cky + 6, ckx + 36, cky + 4);
        ctx.stroke();

        // PAVILION · small triangular tent behind the action
        const pavX = ckx + 38, pavY = cky - 3;
        ctx.fillStyle = '#a4332e';
        ctx.beginPath();
        ctx.moveTo(pavX - 7, pavY);
        ctx.lineTo(pavX + 7, pavY);
        ctx.lineTo(pavX,      pavY - 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#7a221c';
        ctx.fillRect(pavX - 7, pavY, 14, 1);    // ground line
        ctx.fillStyle = '#e9d8b0';               // flag
        ctx.fillRect(pavX - 0.5, pavY - 12, 1, 3);
        const flagWave = Math.sin(t * 0.01) * 1.5;
        ctx.fillRect(pavX, pavY - 12, 3, 1);

        // BAT SWING · subtle motion blur arc when batsman just hit
        const swingPhase = (t * 0.001) % 4;
        if (swingPhase < 0.5) {
            ctx.strokeStyle = 'rgba(122, 74, 38, 0.4)'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(bsx - 3, cky - 12, 4, Math.PI * 1.5, Math.PI * 2);
            ctx.stroke();
        }

        // FOUR/SIX SIGNAL · brief text indicator above scoreboard, cycles
        const sixPhase = (t * 0.00015) % 1;
        if (sixPhase < 0.15) {
            ctx.fillStyle = '#e9d8b0';
            ctx.font = 'bold 6px serif'; ctx.textAlign = 'center';
            ctx.fillText('SIX!', sbX, sbY - 3);
            ctx.textAlign = 'start';
        } else if (sixPhase > 0.5 && sixPhase < 0.65) {
            ctx.fillStyle = '#d4a653';
            ctx.font = 'bold 6px serif'; ctx.textAlign = 'center';
            ctx.fillText('FOUR!', sbX, sbY - 3);
            ctx.textAlign = 'start';
        }

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

        // 104 FM marquee · clipped to building width (56px) to prevent overflow
        ctx.save();
        ctx.beginPath();
        ctx.rect(px - 28, gY - 20, 56, 12);
        ctx.clip();
        ctx.font = 'bold 5px monospace';
        ctx.textAlign = 'left';
        const scroll = (t * 0.05) % 60;
        ctx.fillStyle = `rgba(255, 200, 160, ${a * 0.85})`;
        // Draw the marquee text twice so it scrolls seamlessly through the clip
        const marqueeText = '· FEVER 104 FM · FEVER 104 FM ';
        ctx.fillText(marqueeText, px - 28 - scroll, gY - 11);
        ctx.fillText(marqueeText, px - 28 - scroll + 60, gY - 11);
        ctx.restore();
        ctx.textAlign = 'start';

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
    // ── 4-key-pose walk cycle table (agent-researched) ──
    // contact / recoil / passing / high-point — angles in DEGREES, hipBob in PX
    const WALK_KEYS = [
        { frontThigh:  30, frontKnee:   0, backThigh: -30, backKnee:  15, hipBob:  0, armFront: -28, armBack:  28 }, // contact
        { frontThigh:  15, frontKnee:  25, backThigh: -15, backKnee:  45, hipBob:  3, armFront: -18, armBack:  18 }, // recoil
        { frontThigh:   0, frontKnee:   5, backThigh:   0, backKnee:  60, hipBob: -1, armFront:   0, armBack:   0 }, // passing
        { frontThigh: -10, frontKnee:   5, backThigh:  25, backKnee:   0, hipBob: -3, armFront:  28, armBack: -28 }, // high-point
    ];
    function sampleWalkPose(p01, amp) {
        const f = p01 * 4;
        const i = Math.floor(f) % 4;
        const j = (i + 1) % 4;
        const t = f - Math.floor(f);
        const ease = 0.5 - 0.5 * Math.cos(t * Math.PI);
        const a = WALK_KEYS[i], b = WALK_KEYS[j];
        const lerp = (x, y) => (x + (y - x) * ease) * amp;
        return {
            frontThigh: lerp(a.frontThigh, b.frontThigh),
            frontKnee:  lerp(a.frontKnee,  b.frontKnee),
            backThigh:  lerp(a.backThigh,  b.backThigh),
            backKnee:   lerp(a.backKnee,   b.backKnee),
            armFront:   lerp(a.armFront,   b.armFront),
            armBack:    lerp(a.armBack,    b.armBack),
        };
    }
    // Vertical reach of a leg given thigh + knee angles · used to anchor hip
    // to ground so the character's feet never float.
    function legVerticalReach(thighDeg, kneeDeg) {
        const THIGH = 13, SHIN = 13;
        const t = (90 - thighDeg) * Math.PI / 180;
        const s = (90 - (thighDeg + kneeDeg)) * Math.PI / 180;
        return Math.sin(t) * THIGH + Math.sin(s) * SHIN;
    }
    // Rotated rectangle helper · gives limbs volume + 1-px shadow line
    function drawLimbSegment(x1, y1, x2, y2, w, fill, shade) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.1) return;
        const ang = Math.atan2(dy, dx);
        ctx.save();
        // Pixel-snap origin for crisp limb edges
        ctx.translate(Math.round(x1), Math.round(y1));
        ctx.rotate(ang);
        ctx.fillStyle = fill;
        ctx.fillRect(0, -w / 2, len, w);
        // 1-px shadow line (back side)
        ctx.fillStyle = shade;
        ctx.fillRect(0, w / 2 - 1, len, 1);
        // 1-px outline (front side · darker)
        ctx.fillStyle = '#1a0e08';
        ctx.fillRect(0, -w / 2, len, 0.6);
        ctx.restore();
    }
    function drawLeg(hipX, hipY, thighDeg, kneeDeg, pant, pantShade, shoe, shoeDark) {
        const t = (90 - thighDeg) * Math.PI / 180;     // 0° = straight down
        const THIGH = 13, SHIN = 13;
        const kneeX = hipX + Math.cos(t) * THIGH;
        const kneeY = hipY + Math.sin(t) * THIGH;
        const s = (90 - (thighDeg + kneeDeg)) * Math.PI / 180;
        const footX = kneeX + Math.cos(s) * SHIN;
        const footY = kneeY + Math.sin(s) * SHIN;
        drawLimbSegment(hipX, hipY, kneeX, kneeY, 3.5, pant, pantShade);
        drawLimbSegment(kneeX, kneeY, footX, footY, 3, pant, pantShade);
        ctx.fillStyle = shoe;
        ctx.fillRect(footX - 1, footY - 1, 5, 2);
        ctx.fillStyle = shoeDark;
        ctx.fillRect(footX - 1, footY + 1, 5, 1);
    }
    function drawArm(shoulderX, shoulderY, armDeg, sleeve, skin) {
        const ARM = 14;
        const t = (90 + armDeg) * Math.PI / 180;
        const handX = shoulderX + Math.cos(t) * ARM;
        const handY = shoulderY + Math.sin(t) * ARM;
        drawLimbSegment(shoulderX, shoulderY, handX, handY, 3, sleeve, '#4a5a3a');
        // Hand · small skin-tone block at end
        ctx.fillStyle = skin;
        ctx.fillRect(handX - 1, handY - 1, 2, 3);
    }

    /** Character height growth · school child (0.62×) → PU teen (0.78×)
     *  → engineering young adult (0.90×) → working adult (1.00×). Scale is
     *  applied around the foot anchor so the character grows UPWARD as
     *  they age, never floating off the ground. */
    function characterScale(playerX) {
        // Anchor stages at chapter boundaries · smoothstep between
        if (playerX < 1100)      return lerpScale(0.62, 0.78, playerX / 1100);   // ITICS rising into CMR
        else if (playerX < 1700) return lerpScale(0.78, 0.88, (playerX - 1100) / 600); // CMR → DSCE
        else if (playerX < 2500) return lerpScale(0.88, 1.0,  (playerX - 1700) / 800); // DSCE → working adult
        else                     return 1.0;
    }
    function lerpScale(a, b, t) {
        const c = Math.max(0, Math.min(1, t));
        const e = c * c * (3 - 2 * c);   // smoothstep
        return a + (b - a) * e;
    }

    function drawWalker(cx, footY, phase, amp, lean, bob) {
        ctx.save();
        // ── PIXEL-CRISP RENDERING ──
        ctx.imageSmoothingEnabled = false;
        cx = Math.round(cx);
        footY = Math.round(footY);
        // ── BASE SIZE SCALE-UP ──
        // 1.75× larger than original · gives face features + accessory detail
        // enough screen real estate to actually read at normal viewing scale.
        // All other character geometry (head, torso, limbs, accessories)
        // inherits this uniform scale around the foot anchor.
        const BASE_SCALE = 1.75;
        ctx.translate(cx, footY);
        ctx.scale(BASE_SCALE, BASE_SCALE);
        ctx.translate(-cx, -footY);
        // Per-chapter growth (school → adult) layers on TOP of base scale
        const growth = characterScale(state.playerX);
        if (growth !== 1.0) {
            ctx.translate(cx, footY);
            ctx.scale(growth, growth);
            ctx.translate(-cx, -footY);
        }
        // ── FRESHENED PALETTE · crisper warm-toned brown ──
        const SK   = '#b58660';      // skin · brighter warm tan (was #a47a52)
        const SK_SHADE = '#8a5e3a';
        const SK_HIGHLIGHT = '#d8a878';   // cheek highlight pixel
        const HAIR = '#1a0e08';      // deeper near-black (was #1f1208)
        const TEE  = '#7a8a6a';
        const TEE_SHADE = '#556248';
        const JEAN = '#3a4258';
        const JEAN_SHADE = '#252a3a';
        const SHOE = '#d4b48a';
        const SHOE_DARK = '#5a3a22';
        const BAG  = '#3a2418';
        const OUTLINE = '#1a0e08';   // crisp 1-pixel character outline

        // Normalize phase to [0, 1)
        const p01 = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
        const pose = sampleWalkPose(p01, Math.max(0.15, amp));

        const TORSO_H = 18, NECK_H = 1, HEAD_R = 4.5;
        const cosL = Math.cos(lean), sinL = Math.sin(lean);
        const hipX = cx;
        // ── GEOMETRIC GROUND-ANCHOR ──
        // Compute both legs' vertical reach, anchor hip so the longer-reaching
        // (planted) leg's foot always touches ground. Natural hip-bob emerges
        // from the math: legs splay → reach shrinks → hip lowers; legs straight
        // → reach extends → hip rises. No more floating.
        const frontReach = legVerticalReach(pose.frontThigh, pose.frontKnee);
        const backReach  = legVerticalReach(pose.backThigh,  pose.backKnee);
        const grounded   = Math.max(frontReach, backReach);
        const hipY       = footY - grounded - 1 + bob;   // -1 for shoe height
        const torsoTopX = hipX + sinL * TORSO_H;
        const torsoTopY = hipY - cosL * TORSO_H;
        const neckY     = torsoTopY - NECK_H;
        const headCx    = torsoTopX + sinL * (HEAD_R + 1);
        const headCy    = neckY - HEAD_R;
        const shoulderL = { x: torsoTopX - 5 * cosL, y: torsoTopY + 2 };
        const shoulderR = { x: torsoTopX + 5 * cosL, y: torsoTopY + 2 };

        // ── BACK leg drawn first (so front overlaps) ──
        drawLeg(hipX - 2, hipY, pose.backThigh, pose.backKnee, JEAN, JEAN_SHADE, SHOE, SHOE_DARK);
        // ── BACK arm ──
        drawArm(shoulderL.x, shoulderL.y, pose.armBack, TEE, SK);

        // ── TORSO · pixel-snapped + 1-px outline for crisp silhouette ──
        const HX = Math.round(hipX);
        const HY = Math.round(hipY);
        ctx.fillStyle = TEE;
        ctx.fillRect(HX - 5, HY - TORSO_H, 11, TORSO_H);
        // 1-pixel outline · top/sides only (bottom hides under jeans)
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(HX - 5, HY - TORSO_H, 11, 1);          // top edge
        ctx.fillRect(HX - 5, HY - TORSO_H, 1, TORSO_H);     // left edge
        ctx.fillRect(HX + 5, HY - TORSO_H, 1, TORSO_H);     // right edge
        // Shadow column (right side, just inside outline)
        ctx.fillStyle = TEE_SHADE;
        ctx.fillRect(HX + 4, HY - TORSO_H + 1, 1, TORSO_H - 1);
        ctx.fillRect(HX - 5, HY - 4, 11, 2);                 // hem shadow
        // Sleeve caps (filled with tee color + outlined)
        ctx.fillStyle = TEE;
        ctx.fillRect(HX - 7, HY - TORSO_H + 1, 2, 5);
        ctx.fillRect(HX + 5, HY - TORSO_H + 1, 2, 5);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(HX - 7, HY - TORSO_H + 1, 1, 5);        // left sleeve outline
        ctx.fillRect(HX + 6, HY - TORSO_H + 1, 1, 5);        // right sleeve outline

        // ── PELVIS / waistband ──
        ctx.fillStyle = JEAN_SHADE;
        ctx.fillRect(hipX - 5, hipY - 1, 11, 2);

        // ── FRONT leg ──
        drawLeg(hipX + 2, hipY, pose.frontThigh, pose.frontKnee, JEAN, JEAN_SHADE, SHOE, SHOE_DARK);
        // ── FRONT arm ──
        drawArm(shoulderR.x, shoulderR.y, pose.armFront, TEE, SK);

        // ── NECK ──
        ctx.fillStyle = SK_SHADE;
        ctx.fillRect(headCx - 1.5, neckY - 1, 3, 2);

        // ── HEAD · pixel-snapped rect for crisp edges ──
        const HEAD_X = Math.round(headCx);
        const HEAD_Y = Math.round(headCy);
        // 8×9 head as filled rect (crisper than ellipse at this scale)
        ctx.fillStyle = SK;
        ctx.fillRect(HEAD_X - 4, HEAD_Y - 4, 8, 9);
        // Soften corners with pixel notches
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(HEAD_X - 4, HEAD_Y - 4, 1, 1);     // top-left corner
        ctx.fillRect(HEAD_X + 3, HEAD_Y - 4, 1, 1);     // top-right corner
        ctx.fillRect(HEAD_X - 4, HEAD_Y + 4, 1, 1);     // bot-left
        ctx.fillRect(HEAD_X + 3, HEAD_Y + 4, 1, 1);     // bot-right
        // Skin shading · right cheek darker
        ctx.fillStyle = SK_SHADE;
        ctx.fillRect(HEAD_X + 2, HEAD_Y - 3, 1, 8);
        // Highlight · left cheek bone
        ctx.fillStyle = SK_HIGHLIGHT;
        ctx.fillRect(HEAD_X - 3, HEAD_Y - 2, 1, 2);
        // Jaw shadow line (under chin)
        ctx.fillStyle = SK_SHADE;
        ctx.fillRect(HEAD_X - 3, HEAD_Y + 5, 6, 1);
        // ── FACE FEATURES · crisp 1-pixel dots ──
        // Eyes · two dark pixels with white sclera highlights
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(HEAD_X - 2, HEAD_Y, 1, 1);     // left eye
        ctx.fillRect(HEAD_X + 1, HEAD_Y, 1, 1);     // right eye
        // Eyebrows · 2-pixel strokes above each eye
        ctx.fillRect(HEAD_X - 3, HEAD_Y - 1, 2, 1); // left brow
        ctx.fillRect(HEAD_X + 1, HEAD_Y - 1, 2, 1); // right brow
        // Nose · 1-pixel shadow tip
        ctx.fillStyle = SK_SHADE;
        ctx.fillRect(HEAD_X, HEAD_Y + 1, 1, 2);
        // Mouth · 2-pixel subtle line
        ctx.fillStyle = SK_SHADE;
        ctx.fillRect(HEAD_X - 1, HEAD_Y + 3, 2, 1);

        // ── LAPTOP SLING (the techie signal) · diagonal strap + hip bag ──
        ctx.strokeStyle = BAG;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shoulderL.x, shoulderL.y);
        ctx.lineTo(hipX + 8, hipY - 8);
        ctx.stroke();
        ctx.fillStyle = BAG;
        ctx.fillRect(hipX + 4, hipY - 10, 10, 8);     // bag body
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(hipX + 4, hipY - 10, 10, 1);     // bag top edge
        // Strap buckle dot
        ctx.fillStyle = '#c89a5a';
        ctx.fillRect(hipX + 6, hipY - 8, 1, 1);

        // ── HAIR · pixel-snapped short crop ──
        ctx.fillStyle = HAIR;
        // Top hair block (3-pixel-tall slab on top of head)
        ctx.fillRect(HEAD_X - 4, HEAD_Y - 5, 8, 3);
        // Forward fringe · slight wave on top
        ctx.fillRect(HEAD_X - 2, HEAD_Y - 6, 4, 1);
        ctx.fillRect(HEAD_X - 1, HEAD_Y - 7, 3, 1);
        // Side temples (above ears)
        ctx.fillRect(HEAD_X - 4, HEAD_Y - 2, 1, 2);
        ctx.fillRect(HEAD_X + 3, HEAD_Y - 2, 1, 2);
        // Hair highlight · 1-px lighter strand
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(HEAD_X - 2, HEAD_Y - 5, 3, 1);

        // STAGE-SPECIFIC OVERLAYS · evolve with life phase
        // School (< 1100m): RED backpack overrides laptop sling
        // College (1100-2500m): baseball cap + laptop sling
        // Adult (>= 2500m): standard look + laptop sling
        const stage = state.playerX < 1100 ? 'school'
                    : state.playerX < 2500 ? 'college'
                    : 'adult';

        if (stage === 'school') {
            // ── ITICS SCHOOLBOY ──
            // Full uniform makeover · white shirt + navy shorts + striped tie
            // + tucked-in detail + red school bag + lunch tiffin + name badge.
            const UNIFORM_WHITE = '#e9d8b0';   // cream-white shirt
            const UNIFORM_NAVY  = '#2a3a5a';   // navy shorts/tie
            const TIE_STRIPE    = '#a4332e';   // school stripe accent

            // 1. SHIRT recolor · overpaint TEE rect with school-uniform white
            ctx.fillStyle = UNIFORM_WHITE;
            ctx.fillRect(hipX - 5, hipY - TORSO_H, 11, TORSO_H);
            ctx.fillStyle = '#c0b090';                // soft shadow column
            ctx.fillRect(hipX + 4, hipY - TORSO_H, 1, TORSO_H);
            // Shirt collar V-notch
            ctx.fillStyle = '#c0b090';
            ctx.beginPath();
            ctx.moveTo(hipX - 2, hipY - TORSO_H);
            ctx.lineTo(hipX,     hipY - TORSO_H + 3);
            ctx.lineTo(hipX + 2, hipY - TORSO_H);
            ctx.closePath(); ctx.fill();
            // Sleeve caps
            ctx.fillStyle = UNIFORM_WHITE;
            ctx.fillRect(hipX - 7, hipY - TORSO_H + 1, 2, 5);
            ctx.fillRect(hipX + 5, hipY - TORSO_H + 1, 2, 5);

            // 2. SCHOOL TIE · navy with red diagonal stripes hanging down chest
            ctx.fillStyle = UNIFORM_NAVY;
            ctx.fillRect(hipX - 1, hipY - TORSO_H + 2, 2, TORSO_H - 4);
            ctx.fillStyle = TIE_STRIPE;
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(hipX - 1, hipY - TORSO_H + 4 + i * 5, 2, 1);
            }
            // Tie knot
            ctx.fillStyle = UNIFORM_NAVY;
            ctx.fillRect(hipX - 1.5, hipY - TORSO_H + 1, 3, 2);

            // 3. NAME BADGE · tiny cream rectangle on left chest
            ctx.fillStyle = UNIFORM_WHITE;
            ctx.fillRect(hipX - 4, hipY - TORSO_H + 6, 3, 2);
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(hipX - 3, hipY - TORSO_H + 7, 1, 0.5);

            // 4. NAVY SHORTS · recolor pelvis + add waistband
            ctx.fillStyle = UNIFORM_NAVY;
            ctx.fillRect(hipX - 5, hipY - 2, 11, 4);
            ctx.fillStyle = '#1a2230';                // belt shadow
            ctx.fillRect(hipX - 5, hipY - 2, 11, 1);

            // 5. MESSY HAIR TUFT · 2 spikes
            ctx.fillStyle = '#1f1208';
            ctx.fillRect(headCx - 1.5, headCy - HEAD_R - 2.5, 1.5, 2);
            ctx.fillRect(headCx + 0.5, headCy - HEAD_R - 2.2, 1.5, 1.8);

            // 6. RED SCHOOL BAG · bigger + visible buckle + zip + side pocket
            const bagX = hipX - 9;
            const bagY = hipY - TORSO_H + 1;
            ctx.fillStyle = '#a4332e';
            ctx.fillRect(bagX, bagY, 11, 16);
            ctx.fillStyle = '#7a221c';                // top flap
            ctx.fillRect(bagX, bagY, 11, 3);
            ctx.fillRect(bagX, bagY + 12, 11, 1);     // bottom seam
            // Buckle
            ctx.fillStyle = '#c89a5a';
            ctx.fillRect(bagX + 4, bagY + 2, 3, 1.5);
            // Vertical zip
            ctx.strokeStyle = '#5a1a15'; ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(bagX + 5.5, bagY + 4);
            ctx.lineTo(bagX + 5.5, bagY + 12);
            ctx.stroke();
            // Side pocket
            ctx.fillStyle = '#7a221c';
            ctx.fillRect(bagX, bagY + 7, 2, 4);
            // Strap loops over both shoulders
            ctx.strokeStyle = '#7a221c'; ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(shoulderL.x - 2, shoulderL.y); ctx.lineTo(bagX + 2, bagY + 3);
            ctx.moveTo(shoulderR.x - 2, shoulderR.y); ctx.lineTo(bagX + 9, bagY + 3);
            ctx.stroke();

            // 7. LUNCH TIFFIN · stainless-steel box in right hand
            const tiffinX = hipX + 9;
            const tiffinY = hipY - 5;
            ctx.fillStyle = '#c0c0c0';                // brushed steel
            ctx.fillRect(tiffinX, tiffinY, 6, 5);
            ctx.fillStyle = '#8a8a8a';
            ctx.fillRect(tiffinX, tiffinY + 4, 6, 1);  // bottom shadow
            ctx.fillStyle = '#a0a0a0';
            ctx.fillRect(tiffinX, tiffinY, 6, 1);      // lid
            // Carry handle
            ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(tiffinX + 3, tiffinY - 1, 2, Math.PI, 2 * Math.PI);
            ctx.stroke();

            // 8. WHITE CANVAS SHOES · overpaint sneakers
            ctx.fillStyle = '#e9d8b0';
            ctx.fillRect(hipX - 4, footY - 2, 5, 2);   // approximate left foot
            ctx.fillRect(hipX,     footY - 2, 5, 2);   // approximate right foot
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(hipX - 4, footY, 5, 1);
            ctx.fillRect(hipX,     footY, 5, 1);
        } else if (stage === 'college') {
            // ── DSCE ENGINEERING STUDENT ──
            // Faded denim + tee with DSCE accent + over-ear headphones around
            // neck + lanyard ID badge + rolled-up notebook under arm + watch.
            const TEE_COLOR     = '#3a5a4a';   // muted forest-green DSCE tee
            const TEE_SHADE     = '#2a4035';
            const JEAN_COLOR    = '#3a4258';   // faded indigo
            const HEADPHONE_BAND= '#c47540';   // DSCE orange accent
            const LANYARD       = '#c47540';
            const NOTEBOOK_RED  = '#a4332e';

            // 1. TEE recolor with DSCE accent stripe at hem
            ctx.fillStyle = TEE_COLOR;
            ctx.fillRect(hipX - 5, hipY - TORSO_H, 11, TORSO_H);
            ctx.fillStyle = TEE_SHADE;
            ctx.fillRect(hipX + 4, hipY - TORSO_H, 1, TORSO_H);
            // Accent stripe near hem (DSCE orange)
            ctx.fillStyle = HEADPHONE_BAND;
            ctx.fillRect(hipX - 5, hipY - 5, 11, 1);
            // Sleeve caps
            ctx.fillStyle = TEE_COLOR;
            ctx.fillRect(hipX - 7, hipY - TORSO_H + 1, 2, 5);
            ctx.fillRect(hipX + 5, hipY - TORSO_H + 1, 2, 5);

            // 2. FADED JEANS · overpaint legs with proper denim variation
            // (the drawLeg base already uses JEAN palette; this adds knee wear)
            ctx.fillStyle = '#4a5570';                // faded knee patch hint
            ctx.fillRect(hipX - 4, hipY + 6, 2, 3);
            ctx.fillRect(hipX + 2, hipY + 6, 2, 3);

            // 3. HEADPHONES around neck · over-ear band + 2 cups
            ctx.fillStyle = '#1a1208';                // band
            ctx.fillRect(headCx - HEAD_R, neckY + 1, HEAD_R * 2, 1.2);
            ctx.fillStyle = HEADPHONE_BAND;           // orange accent stripe
            ctx.fillRect(headCx - HEAD_R, neckY + 1, HEAD_R * 2, 0.5);
            // Earcups · one on each side of neck
            ctx.fillStyle = '#1a1208';
            ctx.fillRect(headCx - HEAD_R - 1.5, neckY + 1, 1.8, 3);
            ctx.fillRect(headCx + HEAD_R - 0.3, neckY + 1, 1.8, 3);
            // Cup centers
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(headCx - HEAD_R - 1, neckY + 2, 1, 1.5);
            ctx.fillRect(headCx + HEAD_R + 0.2, neckY + 2, 1, 1.5);

            // 4. LANYARD with ID badge hanging at chest
            ctx.strokeStyle = LANYARD; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(shoulderL.x - 1, shoulderL.y + 1);
            ctx.lineTo(hipX - 1, hipY - 8);
            ctx.moveTo(shoulderR.x - 1, shoulderR.y + 1);
            ctx.lineTo(hipX + 1, hipY - 8);
            ctx.stroke();
            ctx.fillStyle = '#e9d8b0';                // ID card
            ctx.fillRect(hipX - 2, hipY - 8, 4, 3.5);
            ctx.fillStyle = '#3a2418';                // photo block on card
            ctx.fillRect(hipX - 1.5, hipY - 7.5, 1.5, 1.5);
            ctx.fillStyle = '#c47540';                // DSCE color strip on card
            ctx.fillRect(hipX - 2, hipY - 5.5, 4, 0.6);

            // 5. ROLLED NOTEBOOK under right arm · cylinder of paper
            const nbX = hipX + 7;
            const nbY = hipY - 10;
            ctx.fillStyle = NOTEBOOK_RED;
            ctx.fillRect(nbX, nbY, 2, 9);             // notebook cover
            ctx.fillStyle = '#e9d8b0';                // paper edge
            ctx.fillRect(nbX + 1, nbY + 1, 1, 7);
            ctx.fillStyle = '#7a221c';
            ctx.fillRect(nbX, nbY, 2, 0.8);           // top binding
            ctx.fillRect(nbX, nbY + 8.2, 2, 0.8);     // bottom binding

            // 6. SLIGHT FACIAL HAIR · faint stubble (5 dots on jawline)
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(headCx - 2, headCy + 2.8, 1, 0.6);
            ctx.fillRect(headCx,     headCy + 3.2, 1, 0.6);
            ctx.fillRect(headCx + 1, headCy + 2.8, 1, 0.6);

            // 7. WATCH on left wrist · small square + strap
            ctx.fillStyle = '#3a2418';
            ctx.fillRect(hipX - 9, hipY - 7, 1.5, 1.5);
        }
        // Adult: no extra headgear · clean professional look
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
        // Player is normally fixed at 32% of viewport (camera follows them).
        // During end-cinematic the camera is LOCKED — playerX keeps growing
        // while cameraX holds, so screen-x = playerX - lockedCameraX, which
        // makes the GT visibly translate rightward and exit the viewport.
        const cx = state.lockedCameraX !== null
            ? (state.playerX - state.lockedCameraX)
            : W * 0.32;
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
            // proximity SFX · fires near-landmark sounds (cinema audience,
            // stadium roar, market chatter, cricket bat crack, office keys)
            tickProximitySFX();

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
                    // CHAPTER-ENTRY STING · fire a one-shot procedural SFX for
                    // this chapter (school bell, study scratch, engineering bell,
                    // radio static, keyboard, AI shimmer, engine rev, chime).
                    try { playChapterSting(ch.id); } catch (_) {}
                    // STAGE-COMPLETION VIDEO · play a 5s AI-generated montage
                    // of the activities in this stage. Graceful no-op if the
                    // MP4 file isn't present (e.g. user hasn't run the build script).
                    setTimeout(() => { try { playStageVideo(ch.id, ch.label); } catch (_) {} }, 1600);
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
            if ($scoreBeats) $scoreBeats.textContent = state.discoveredBeats.size + ' / ' + BEATS.length;
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
            // Slower than gut-feel: 80 → 320 px/s over 3s, ease-out cubic.
            // At 200→900 the GT exited the 1280-wide viewport in ~1.5s —
            // too fast for the eye to register as "driving away" instead of
            // "object disappeared." Slower curve gives ~600px of visible
            // motion across 3 seconds, which lands as a real departure.
            if (state.endingCinematic) {
                state.cinematicT += dt;
                const tSec = state.cinematicT / 1000;
                const ease = 1 - Math.pow(1 - Math.min(1, tSec / 3), 3);
                const speed = 80 + 240 * ease;
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
                // After 5s, transition to end card (was 3.5 — longer breathing room)
                if (state.cinematicT > 5000) {
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

        // Peek animation · brief camera lean-forward during 0-700ms window.
        // Eases out-then-in (ease-in-out sine peak at 350ms) for natural feel.
        let peekOffset = 0;
        if (state.peekT > 0) {
            state.peekT = Math.max(0, state.peekT - dt);
            const t = 1 - state.peekT / 700;          // 0 → 1
            const easeOut = Math.sin(t * Math.PI);    // 0 at start/end, 1 at peak
            peekOffset = easeOut * 110;               // up to 110px forward
        }
        // camera · player anchored at 32% from left, OR locked during cinematic
        const cameraX = state.lockedCameraX !== null
            ? state.lockedCameraX
            : (state.playerX - W * 0.32 + peekOffset);

        // life-progress 0..1 · drives the time-of-day sky gradient.
        // World ends at the last chapter + 150. Clamp so we don't NaN.
        const worldEnd = CHAPTERS[CHAPTERS.length - 1].x + 150;
        const progress = Math.max(0, Math.min(1, state.playerX / worldEnd));

        // particles update (gravity, drag, fade)
        updateParticles(dt);
        updateFireworks(dt);
        updateFlights(dt);
        updateBirds(dt);

        // screen-shake decay
        if (state.shake.t > 0) {
            state.shake.t -= dt;
            if (state.shake.t < 0) { state.shake.t = 0; state.shake.amp = 0; }
        }

        // ── BANGALORE AMBIENCE · updates ──
        if (!state.paused && !state.ended) {
            // current bloom (used by petals + chapter lookup) follows player
            const currentBloom = bloomForWorldX(state.playerX);

            // 1. AMBIENT FLOWERING-PETAL FALL · cap at 14 on-screen, gentle wind drift
            if (state.petals.length < 14 && Math.random() < 0.04) {
                state.petals.push({
                    x:  Math.random() * W,
                    y:  -10,
                    vx: 20 + Math.random() * 30,   // wind drifts right
                    vy: 25 + Math.random() * 25,
                    life: 1,
                    color: currentBloom,
                });
            }
            for (let i = state.petals.length - 1; i >= 0; i--) {
                const p = state.petals[i];
                p.x += p.vx * dt / 1000;
                p.y += p.vy * dt / 1000;
                // gentle vertical wobble
                p.x += Math.sin(state.elapsedMs / 400 + i) * 0.3;
                if (p.y > H + 10 || p.x > W + 30) state.petals.splice(i, 1);
            }

            // 2. AUTO RICKSHAW · yellow-and-black 3-wheeler crosses every ~25s
            if (state.elapsedMs > state.autoNextAt) {
                state.autoDir = Math.random() < 0.5 ? 1 : -1;
                state.autoX = state.autoDir === 1 ? -120 : W + 120;
                state.autoNextAt = state.elapsedMs + 22000 + Math.random() * 18000;
            }
            if (state.autoX > -200 && state.autoX < W + 200) {
                state.autoX += state.autoDir * 85 * dt / 1000;  // ~85 px/s screen-space
            }

            // 2.5 ROAD TRAFFIC · spawn vehicles passing on the asphalt
            if (state.elapsedMs > state.trafficNextAt) {
                const kinds = ['hatchback', 'hatchback', 'motorbike', 'motorbike',
                               'bmtc_bus', 'lorry'];   // hatchbacks + motorbikes more common
                const kind = kinds[(Math.random() * kinds.length) | 0];
                const dir = Math.random() < 0.5 ? 1 : -1;
                const speedMap = { hatchback: 90, motorbike: 120, bmtc_bus: 65, lorry: 55 };
                const speed = speedMap[kind] + (Math.random() - 0.5) * 20;
                state.traffic.push({
                    kind, dir, speed,
                    x: dir > 0 ? -60 : (W + 60),
                });
                state.trafficNextAt = state.elapsedMs + 1800 + Math.random() * 2800;
            }
            for (let i = state.traffic.length - 1; i >= 0; i--) {
                const v = state.traffic[i];
                v.x += v.dir * v.speed * dt / 1000;
                if (v.x < -120 || v.x > W + 120) state.traffic.splice(i, 1);
            }

            // 3. MONSOON RAIN BURST · ramps up over 800ms, sustains, decays
            if (state.elapsedMs > state.rainNextAt) {
                state.rainIntensity = 1;
                state.rainNextAt = state.elapsedMs + 65000 + Math.random() * 35000;
                // Thunder SFX with rain burst · ambient soundscape match
                try { playBeatSFX('monsoon_thunder'); } catch (_) {}
            }
            // decay rain intensity over ~12s (sustain ~8s, fade 4s)
            if (state.rainIntensity > 0) {
                state.rainIntensity = Math.max(0, state.rainIntensity - dt / 12000);
            }
            // spawn rain streaks proportional to intensity
            const rainSpawn = Math.floor(state.rainIntensity * 6);
            for (let i = 0; i < rainSpawn; i++) {
                state.rain.push({
                    x: Math.random() * (W + 200) - 100,
                    y: -20,
                    vy: 900 + Math.random() * 200,
                    vx: 180,
                    len: 14 + Math.random() * 10,
                });
            }
            for (let i = state.rain.length - 1; i >= 0; i--) {
                const r = state.rain[i];
                r.x += r.vx * dt / 1000;
                r.y += r.vy * dt / 1000;
                if (r.y > H + 10) state.rain.splice(i, 1);
            }
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
        // ── Strict far→near depth stack · clean layer ordering ──
        // 0.10 — back ridge mountains (farthest land)
        drawBackRidge(W, horizonY, cameraX);
        // 0.20 — distant hills
        drawDistHills(W, horizonY, cameraX);
        // 0.30 — skyline silhouettes (Vidhana Soudha, Bangalore Palace, etc.)
        drawSkyline(W, horizonY, cameraX);
        // ATMOSPHERIC HAZE · only fades the distant layers above this line
        drawAtmosphericHaze(W, horizonY);
        // 0.32 — distant tree canopy band
        drawDistantCanopy(W, horizonY, groundY, cameraX);
        // 0.35 — kites floating high (only ITICS+CMR)
        drawKites(W, horizonY, cameraX);
        // 0.25 — fireworks over Vidhana Soudha (only ITICS+CMR)
        drawFireworks(W, horizonY, cameraX);
        // 0.05 — flights crossing the upper sky band (always)
        drawFlights(W, horizonY);
        // 0.30 — bird flocks in V-formation (always)
        drawBirds(W, horizonY);
        // 0.35 — raintree fillers between skyline and infrastructure
        drawRaintrees(W, horizonY, groundY, cameraX);
        // 0.40 — bridges (road infrastructure)
        drawBridges(W, horizonY, cameraX);
        // 0.45 — metro viaduct + train (passes OVER bridges where they overlap)
        drawMetroViaduct(W, horizonY, cameraX);
        drawMetroTrain(W, horizonY, cameraX);
        // GROUND plane · separates background bands from foreground
        drawGround(W, H, horizonY, groundY, cameraX);
        // 0.40 — utility poles + wires (closer than bridges, in front of ground)
        drawPowerLines(W, horizonY, cameraX);
        // 0.45 — holiday props (beach, mountain, etc.)
        drawHolidayProps(W, horizonY, groundY, cameraX);
        // 0.50 — palm crowns
        drawPalms(W, horizonY, groundY, cameraX);
        // 0.50 — mid-band trees + telegraph poles (bloom canopy)
        drawMidProps(W, horizonY, groundY, cameraX);
        // 0.55 — Bangalore road surface (asphalt + markings + speed bumps + zebras)
        drawRoad(W, horizonY, groundY, cameraX);
        // Street food carts · stationary roadside vendors (KR Market + Indiranagar)
        drawStreetFoodCarts(W, groundY, cameraX);
        // 1.00 (screen-space) — traffic vehicles on the road
        drawRoadTraffic(W, groundY);
        // 1.00 (screen-space) — auto rickshaw crossing (drawn over traffic)
        drawAutoRickshaw(W, groundY);
        // 1.00 — chapter markers (closest band before player)
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
        // ambient flowering petals · screen-space (no parallax), foreground sheet
        if (state.petals.length > 0) {
            for (const pt of state.petals) {
                ctx.fillStyle = pt.color;
                ctx.fillRect(pt.x, pt.y, 4, 4);
            }
        }
        // monsoon rain streaks · diagonal, very thin alpha
        if (state.rainIntensity > 0 || state.rain.length > 0) {
            ctx.strokeStyle = `rgba(180, 200, 220, ${0.35})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const r of state.rain) {
                ctx.moveTo(r.x, r.y);
                ctx.lineTo(r.x - r.vx * r.len / 900, r.y - r.len);
            }
            ctx.stroke();
            // wet-sheen overlay on the ground · darken ground band when raining
            if (state.rainIntensity > 0.1) {
                ctx.fillStyle = `rgba(20, 30, 40, ${state.rainIntensity * 0.18})`;
                ctx.fillRect(0, 0, W, H);
            }
        }
        ctx.restore();

        // "the journey continues" tooltip · positioned ABOVE the smoke cloud
        // (was previously inside it — text got visually swallowed by the
        // particle density). Now sits at H*0.35 (upper-middle of screen),
        // larger font, stronger halo. Fade timing extended to match the
        // longer 5s cinematic.
        if (state.endingCinematic) {
            const tSec = state.cinematicT / 1000;
            let textAlpha = 0;
            if      (tSec >= 1.5 && tSec < 2.3) textAlpha = (tSec - 1.5) / 0.8;      // fade in (800ms)
            else if (tSec >= 2.3 && tSec < 4.3) textAlpha = 1;                        // hold (2s)
            else if (tSec >= 4.3 && tSec < 4.8) textAlpha = 1 - (tSec - 4.3) / 0.5;   // fade out (500ms)
            if (textAlpha > 0.02) {
                ctx.save();
                const tx = W * 0.5;
                const ty = H * 0.35;                       // upper-middle, ABOVE smoke
                const drift = (tSec - 1.5) * 3;            // slow upward drift
                const wobble = Math.sin(tSec * 1.4) * 2;   // gentle horizontal sway
                // Heavy halo behind text so it reads regardless of sky color
                const halo = ctx.createRadialGradient(tx + wobble, ty - drift, 0, tx + wobble, ty - drift, 300);
                halo.addColorStop(0,    `rgba(15, 10, 6, ${0.75 * textAlpha})`);
                halo.addColorStop(0.5,  `rgba(15, 10, 6, ${0.40 * textAlpha})`);
                halo.addColorStop(1,    `rgba(15, 10, 6, 0)`);
                ctx.fillStyle = halo;
                ctx.fillRect(tx - 300 + wobble, ty - drift - 120, 600, 240);
                // Main text · italic serif, LARGER (was 26px → 36px)
                ctx.fillStyle = `rgba(248, 232, 200, ${textAlpha})`;
                ctx.font = 'italic 36px "IM Fell English", "Cinzel", serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Subtle text-shadow via offset draw
                ctx.fillStyle = `rgba(20, 14, 8, ${textAlpha * 0.7})`;
                ctx.fillText('the journey continues', tx + wobble + 2, ty - drift + 2);
                ctx.fillStyle = `rgba(248, 232, 200, ${textAlpha})`;
                ctx.fillText('the journey continues', tx + wobble, ty - drift);
                // Brass ellipsis below
                ctx.fillStyle = `rgba(212, 166, 83, ${textAlpha * 0.85})`;
                ctx.font = '18px "IM Fell English", serif';
                ctx.fillText('…', tx + wobble, ty - drift + 36);
                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
                ctx.restore();
            }
        }

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
