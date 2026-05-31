// === public/journey3d/data.js ===
// journey v3 — chapter content as plain data. NO `three` import.
//
// Transcribed (byte-faithful where it matters) from the existing v1/v2 sources:
//   - chapter order + ids ......... src/journey/acts/quest.js (QUESTS)
//   - beat titles + lore .......... public/journey.js (BEATS, `ch:'<id>'`)
//   - culmination lines ........... src/journey/data/culminations.js
//   - palettes + memory icons ..... src/journey/room/data.js (ROOM_META, MEMORY_ICONS)
//
// Internal chapter ids match the v1/v2 sources EXACTLY (`college` = DSCE,
// `vwgt` = THE GT) so we can re-use that data verbatim; `label`/`years` carry
// the display copy. Ordered chronologically: the 8 doors, entrance → end.
//
// This file is an ES module (it `export`s at the bottom) but is authored as
// plain declarations so the unit test can `eval` it after stripping the export
// line. Keep it three-free + side-effect-free.

const CHAPTERS = [
  {
    id: 'itics',
    label: 'ITICS',
    years: 'until 2013 · the first bell',
    palette: { wall1: '#3a2716', wall2: '#1a1108', floor: '#100a05', accent: '#d4a653', frame: '#5a2e1a' },
    beats: [
      { id: 'football-match', title: 'Football match', lore: 'Intra and inter-school competitions. Played striker.', icon: '⚽' },
      { id: 'cricket-match', title: 'Cricket match', lore: 'Played district level for Karnataka. CSK fan since I could pronounce Dhoni.', icon: '🏏' },
      { id: 'sports-day', title: 'Sports day', lore: 'Great fun. Won.', icon: '🏅' },
      { id: 'assembly-stage', title: 'Morning assembly', lore: 'Every day at 8:30 AM. Lined up, sang, marched in.', icon: '🎤' },
    ],
    culmination: 'the years that taught you how to lose without breaking. cricket whites, scuffed knees, the morning bell that never asked twice.',
  },
  {
    id: 'cmr',
    label: 'CMR NATIONAL',
    years: '2013–2015 · the pressure cooker',
    palette: { wall1: '#2a2418', wall2: '#120f08', floor: '#0c0905', accent: '#c9b58c', frame: '#4a2a18' },
    beats: [
      { id: 'tuition-rush', title: 'Tuition rush', lore: 'Went for IIT JEE.', icon: '🛺' },
      { id: 'mock-test', title: 'Mock test', lore: "Didn't study. Walked in, did what I could, walked out. The rank list came back unkind. Useful data.", icon: '📝' },
      { id: 'study-lamp', title: 'Study lamp', lore: 'Had room lights. Late nights.', icon: '🪔' },
      { id: 'first-crush', title: 'First crush', lore: 'Yes — at tuition. Sat two rows behind. Borrowed her highlighter once. Returned it. That was the entire courtship.', icon: '🌹' },
    ],
    culmination: "the year you stopped sleeping. you didn't crack JEE. you also didn't break. that turned out to be the more useful skill.",
  },
  {
    id: 'college',
    label: 'D.S.C.E.',
    years: '2015–2019 · triples & three-bus commutes',
    palette: { wall1: '#33291a', wall2: '#16100a', floor: '#0e0a05', accent: '#c47540', frame: '#5a3018' },
    beats: [
      { id: 'bosch-intern', title: 'BOSCH intern', lore: 'Two months at BOSCH. ID badge, cafeteria coupons, a project mentor who let me touch real CAD files. First taste of "work" with a paycheck.', icon: '🔧' },
      { id: 'abb-intern', title: 'ABB intern', lore: 'Switched gears to ABB the next summer. Industrial automation, programmable logic controllers, the smell of solder. Learned that mechanical and software are the same hand on different keyboards.', icon: '⚙️' },
      { id: 'fest-stage', title: 'Fest stage', lore: 'Great fun. Did a dance in the fest.', icon: '🎸' },
      { id: 'convocation', title: 'Convocation', lore: 'Black robes, mortarboard, four years compressed into one walk across the stage. Parents in the front row · the only audience that mattered.', icon: '🎓' },
    ],
    culmination: "four years of triples and three-bus commutes. you didn't graduate top of class. you graduated knowing what real work felt like before anyone paid you for it.",
  },
  {
    id: 'fever104',
    label: 'FEVER 104 FM',
    years: 'Mar–May 2019 · the soundproof room',
    palette: { wall1: '#3a1e16', wall2: '#190d08', floor: '#0f0805', accent: '#e0a35a', frame: '#5a2618' },
    beats: [
      { id: 'headphones', title: 'Headphones', lore: 'Heavy Shure SM7B-style cans. First time wearing them felt like the city had been turned down. The booth went quiet; the script got louder.', icon: '🎧' },
      { id: 'script-binder', title: 'Script binder', lore: 'Spiral-bound, half-typed, half-marked-up in pen. Every shift you took notes for the next person. Whoever came after you was your future self.', icon: '📋' },
      { id: 'sound-engineer', title: 'Sound engineer', lore: 'Fader by fader. Three months learning what dB ducking actually feels like. Started calling commercials by their cue numbers.', icon: '🎚️' },
      { id: 'trainee-cert', title: 'Trainee cert', lore: 'FEVER 104 FM · Trainee Producer · Mar–May 2019. Framed. On the bookshelf. Still there.', icon: '📜' },
    ],
    culmination: "three months in a soundproof room. you learned that a producer's whole craft is silence — choosing what NOT to play, what to fade, what to ride. everything later is a version of this.",
  },
  {
    id: 'sakha',
    label: 'SAKHA GLOBAL',
    years: '2019–2022 · the first paycheck',
    palette: { wall1: '#2e2a1e', wall2: '#15120b', floor: '#0d0a06', accent: '#d4a653', frame: '#534127' },
    beats: [
      { id: 'interview-day', title: 'Interview day', lore: 'Crazy feeling — first interview cracked, after 5 failed attempts.', icon: '🤝' },
      { id: 'first-paycheck', title: 'First paycheck', lore: 'Bought a watch and a saree — for dad and mum. The leftover went toward groceries. Felt like the whole month\'s effort sat in two gift boxes.', icon: '💰' },
      { id: 'wfh-covid', title: 'WFH · COVID', lore: 'March 2020. Office shut overnight. Working from a corner of the bedroom, slack down for the first 2 weeks of every month. Shipped 11 PRs in March alone.', icon: '🏠' },
      { id: 'late-night-coding', title: 'Late-night coding', lore: 'Yes — was passionate.', icon: '🌙' },
    ],
    culmination: "three years and one pandemic. you bought a watch for dad and a saree for mum from your first paycheck. by the time covid ended you had shipped enough PRs that the team's git log read like your handwriting.",
  },
  {
    id: 'scripbox',
    label: 'SCRIPBOX',
    years: '2022–present · a protocol no one had heard of',
    palette: { wall1: '#2b2c20', wall2: '#121309', floor: '#0b0c06', accent: '#e6c285', frame: '#4d4327' },
    beats: [
      { id: 'pr-review', title: 'PR review', lore: 'Reading other people\'s code became the fastest way to read other people\'s minds. Approve, comment, request changes · all forms of "I see you."', icon: '🔀' },
      { id: 'anthropic-catalog', title: 'Anthropic catalog', lore: 'PR #2913 · mcp-server-graylog landed in the Anthropic MCP catalog. Refreshed the page seventeen times to make sure it was real. Sent the link to four people who never asked.', icon: '📚' },
      { id: 'claude-code', title: 'Claude Code', lore: 'Best AI skill I\'ve learnt as of now — for me.', icon: '🤖' },
      { id: 'whiteboard', title: 'Whiteboard', lore: 'Gave knowledge transfer on things I learn — with my peers.', icon: '📊' },
      { id: 'anthropic-talk', title: 'Anthropic talk', lore: 'Success.', icon: '🎙️' },
    ],
    culmination: "the catalog page that wouldn't stop reloading. you sent the link to four people who never asked. for the first time the work didn't just pay — it was seen by a name you'd only ever read in papers.",
  },
  {
    id: 'vwgt',
    label: 'THE GT',
    years: 'Nov 16 2025 · one signature',
    palette: { wall1: '#332014', wall2: '#160c06', floor: '#0e0805', accent: '#e6c285', frame: '#5a3016' },
    beats: [
      { id: 'test-drive', title: 'Test drive', lore: '1.5 TSI turbo on the Outer Ring Road · 35 minutes that decided the next five years of EMIs. The salesperson knew before I did.', icon: '🚗' },
      { id: 'documents-signing', title: 'Documents', lore: 'Loan papers, RC application, insurance form, accessory list · all signed in 40 minutes. Ten years of saving became one signature.', icon: '✍️' },
      { id: 'keys-handover', title: 'Keys handover', lore: 'Wooden tray, rose petals, metallic key. November 16, 2025. Garland on the bonnet. The salesperson actually clapped.', icon: '🔑' },
      { id: 'first-drive-out', title: 'First drive out', lore: 'Out of the showroom, garland still on. Three lefts and onto the open road. The car was lighter than the moment.', icon: '🛣️' },
    ],
    culmination: '1.5 TSI · turbo · november 16. ten years of saving became one signature. the salesperson clapped. you drove out with the garland still on the bonnet and three lefts of empty road ahead.',
  },
  {
    id: 'now',
    label: 'NOW',
    years: '2026–present · still building',
    palette: { wall1: '#3d2c18', wall2: '#1c1206', floor: '#100a05', accent: '#f0c060', frame: '#5a3a1a' },
    beats: [
      { id: 'morning-routine', title: 'Morning routine', lore: 'Filter coffee · phone face-down · 30 minutes of reading before the first slack ping. The day belongs to whoever claims the first hour.', icon: '☕' },
      { id: 'code-flow', title: 'Code flow', lore: 'Multi-monitor, terminal warmth, mechanical click. Two hours that feel like ten minutes. The kind of focus you save up for.', icon: '💻' },
      { id: 'anthropic-goal', title: 'Anthropic goal', lore: 'AI Engineer at Anthropic. The north star since Dario\'s Senate testimony at midnight Bangalore time. Working backwards from there every day.', icon: '🎯' },
      { id: 'forward-horizon', title: 'Forward horizon', lore: 'Walking confidently toward what\'s next. The destination is foggy · the direction is clear · the legs already know what to do.', icon: '🌅' },
    ],
    culmination: 'morning coffee · terminal warmth · two hours that feel like ten minutes. the day belongs to whoever claims the first hour. you\'re claiming yours.',
  },
];

/** All chapter ids in chronological order. */
function chapterIds() {
  return CHAPTERS.map(c => c.id);
}

/** Look up a chapter by id (or null). */
function chapterById(id) {
  return CHAPTERS.find(c => c.id === id) || null;
}

/** Total number of memory beats across all chapters. */
function totalMemoryCount() {
  return CHAPTERS.reduce((n, c) => n + c.beats.length, 0);
}

export { CHAPTERS, chapterIds, chapterById, totalMemoryCount };
