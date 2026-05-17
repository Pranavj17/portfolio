/**
 * journey/data.js — chapter + vehicle data + achievements. Timeline
 * extended (Apr 2026) to include pre-DSCE schooling: ITICS through 2013,
 * CMR National Public School junior college 2013–2015, then DSCE engineering.
 *
 * Palette flipped to RED-DEAD-REDEMPTION earth tones (mahogany, gold,
 * dust-rust, faded-blue) — replacing the previous neon synthwave colors.
 * The aesthetic shift: dusty plains and engraved title plates, not
 * cyberpunk neon. Same data shape; only colors moved.
 */

export const CHAPTERS = [
    { id: 'itics',    label: 'ITICS',              period: 'until 2013',           z:  30, color: 0xa8b87a, lootIcon: '🏫', lootColor: 0xa8b87a },
    { id: 'cmr',      label: 'CMR NATIONAL',       period: '2013 — 2015',          z:  90, color: 0x5e7a8a, lootIcon: '📐', lootColor: 0x5e7a8a },
    { id: 'college',  label: 'D.S.C.E.',           period: '2015 — 2019',          z: 150, color: 0xc47540, lootIcon: '📜', lootColor: 0xc47540 },
    { id: 'fever104', label: 'FEVER 104 FM',       period: 'mar — may 2019',       z: 210, color: 0xb84c32, lootIcon: '🎙️', lootColor: 0xb84c32 },
    { id: 'sakha',    label: 'SAKHA GLOBAL',       period: 'jul 2019 — sep 2022',  z: 270, color: 0xc9a151, lootIcon: '💜', lootColor: 0xc9a151 },
    { id: 'scripbox', label: 'SCRIPBOX',           period: 'sep 2022 — present',   z: 330, color: 0x7a9a8a, lootIcon: '🏅', lootColor: 0x7a9a8a },
    { id: 'vwgt',     label: 'THE GT',              period: 'nov 16, 2025',         z: 400, color: 0xa4332e, lootIcon: '🔑', lootColor: 0xa4332e },
    { id: 'now',      label: 'NOW',                 period: '2026 — present',       z: 470, color: 0xe6c285, lootIcon: '🏆', lootColor: 0xe6c285 },
];

export const VEHICLES = {
    walk:  { speed: 0.18, label: 'ON FOOT',     sub: 'school years',      icon: '🎒', tint: 0xa8b87a },
    cycle: { speed: 0.26, label: 'BICYCLE',     sub: 'engineering days',  icon: '🚲', tint: 0xc47540 },
    alto:  { speed: 0.34, label: 'MARUTI ALTO', sub: 'first job · 2019',  icon: '🚗', tint: 0xc9a151 },
    vw:    { speed: 0.46, label: 'VW VIRTUS GT', sub: '1.5 TSI · turbo',  icon: '🏎️', tint: 0xa4332e },
};

/** z-positions at which the player auto-upgrades to the next vehicle.
 *  Walking covers ITICS + CMR (school years). Bicycle starts at DSCE
 *  (engineering · the era of the campus-bicycle commute). Alto starts
 *  at SAKHA (first paycheck → first car). VW after collecting GT loot. */
export const VEHICLE_THRESHOLDS = { cycle: 130, alto: 240 };

export const CHAPTER_ACHIEVEMENTS = {
    itics:    'school-1',
    cmr:      'school-2',
    college:  'first-steps',
    fever104: 'fever-104',
    sakha:    'first-job',
    scripbox: 'mcp-catalog',
    vwgt:     'got-the-gt',
    now:      'journey-end',
};

export const ACHIEVEMENTS = {
    'school-1':     { title: 'ITICS',                 sub: 'where it began',                 icon: '🏫' },
    'school-2':     { title: 'CMR NATIONAL',          sub: 'pre-university · 2013–2015',     icon: '📐' },
    'first-steps':  { title: 'D.S.C.E.',              sub: 'mechanical engineering · 2015–2019', icon: '🎓' },
    'on-cycle':     { title: 'ON TWO WHEELS',         sub: 'engineering · bicycle days',     icon: '🚲' },
    'fever-104':    { title: 'ON AIR · 104 FM',       sub: '3-month producer stint',         icon: '🎙️' },
    'first-job':    { title: 'FIRST JOB · ALTO',      sub: 'maruti alto · jul 2019',         icon: '🚗' },
    'mcp-catalog':  { title: 'ANTHROPIC CATALOG',     sub: 'mcp-server-graylog · PR #2913',  icon: '🏅' },
    'got-the-gt':   { title: 'GOT THE GT',            sub: 'vw virtus gt · nov 16, 2025',    icon: '🏎️' },
    'journey-end':  { title: 'JOURNEY COMPLETE',      sub: '8 chapters · 13 years',          icon: '🏆' },
};

export const VEHICLE_ACHIEVEMENTS = {
    cycle: 'on-cycle',
    alto:  'first-job',
    vw:    'got-the-gt',
};
