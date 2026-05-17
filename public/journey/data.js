/**
 * journey/data.js — pure data constants. No DOM, no Three.js. Imported by
 * every other module that needs the chapter/vehicle definitions. Keeping
 * these together means content edits live in one obvious place, separated
 * from rendering / state machinery.
 */

export const CHAPTERS = [
    { id: 'college',  label: 'CHAPTER 1 · D.S.C.E.',     period: '2015 — 2019',          z:  30, color: 0x6dffa6, lootIcon: '📜', lootColor: 0x6dffa6 },
    { id: 'fever104', label: 'CHAPTER 2 · FEVER 104 FM', period: 'mar — may 2019',       z:  90, color: 0xff3b8a, lootIcon: '🎙️', lootColor: 0xff3b8a },
    { id: 'sakha',    label: 'CHAPTER 3 · SAKHA GLOBAL', period: 'jul 2019 — sep 2022',  z: 160, color: 0xb48cff, lootIcon: '💜', lootColor: 0xb48cff },
    { id: 'scripbox', label: 'CHAPTER 4 · SCRIPBOX',     period: 'sep 2022 — present',   z: 230, color: 0x5ad8ff, lootIcon: '🏅', lootColor: 0x5ad8ff },
    { id: 'vwgt',     label: 'CHAPTER 5 · THE GT',        period: 'nov 16, 2025',         z: 290, color: 0xff5e5e, lootIcon: '🔑', lootColor: 0xff5e5e },
    { id: 'now',      label: 'CHAPTER 6 · NOW',           period: '2026 — present',       z: 360, color: 0xffd47a, lootIcon: '🏆', lootColor: 0xffd47a },
];

export const VEHICLES = {
    walk:  { speed: 0.18, label: 'ON FOOT',      sub: 'with backpack',     icon: '🎒', tint: 0x6dffa6 },
    cycle: { speed: 0.26, label: 'BICYCLE',      sub: 'college days',      icon: '🚲', tint: 0x5ad8ff },
    alto:  { speed: 0.34, label: 'MARUTI ALTO',  sub: 'commute · 2019–25', icon: '🚗', tint: 0xffd47a },
    vw:    { speed: 0.46, label: 'VW VIRTUS GT',  sub: '1.5 TSI · turbo',  icon: '🏎️', tint: 0xff5e5e },
};

/** z-positions at which the player auto-upgrades to the next vehicle */
export const VEHICLE_THRESHOLDS = { cycle: 60, alto: 130 };

/** chapter-id → achievement-id mapping (collected → popup) */
export const CHAPTER_ACHIEVEMENTS = {
    college:  'first-steps',
    fever104: 'fever-104',
    sakha:    'first-job',
    scripbox: 'mcp-catalog',
    vwgt:     'got-the-gt',
    now:      'journey-end',
};

/** named achievements with display copy */
export const ACHIEVEMENTS = {
    'first-steps':  { title: 'FIRST STEPS',         sub: 'walking with that backpack',     icon: '👣' },
    'on-cycle':     { title: 'ON TWO WHEELS',       sub: 'college bicycle unlocked',       icon: '🚲' },
    'fever-104':    { title: 'ON AIR · 104 FM',     sub: '3-month producer stint',         icon: '🎙️' },
    'first-job':    { title: 'FIRST JOB · ALTO',    sub: 'maruti alto · jul 2019',         icon: '🚗' },
    'mcp-catalog':  { title: 'ANTHROPIC CATALOG',   sub: 'mcp-server-graylog · PR #2913',  icon: '🏅' },
    'got-the-gt':   { title: 'GOT THE GT',          sub: 'vw virtus gt · nov 16, 2025',    icon: '🏎️' },
    'journey-end':  { title: 'JOURNEY COMPLETE',    sub: '6 chapters · 11 years',          icon: '🏆' },
};

/** vehicle change → achievement id (fires on first transition into each) */
export const VEHICLE_ACHIEVEMENTS = {
    cycle: 'on-cycle',
    alto:  'first-job',
    vw:    'got-the-gt',
};
