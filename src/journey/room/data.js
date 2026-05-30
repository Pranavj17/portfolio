// === src/journey/room/data.js ===
/**
 * Memory Room content + procedural layout.
 *
 * A room is mostly GENERATED, not hand-placed: the memory objects come from the
 * chapter's quest beats (QUESTS, already in the bundle) and are enriched at open
 * time from v1's authored beat lore (window.__journey.BEATS — each beat carries
 * { title, lore, hint:<emoji> }). So a memory card shows the real title, the real
 * prose, and the real emoji with zero duplication. Per-chapter we only author the
 * era palette + a title; layout is computed. That keeps all 8 rooms consistent
 * and cheap to maintain while still feeling individually art-directed via colour.
 */

// Per-era tint over the shared sepia base. Every value stays in the RDR palette.
const ROOM_META = {
  __default: {
    title: 'A MEMORY', subtitle: '',
    palette: { wall1: '#3a2616', wall2: '#180f07', floor: '#0f0a05', accent: '#d4a653', frame: '#5a2e1a' },
    light: { x: 200, y: 150, w: 300, warmth: 1 }, motes: 26,
  },
  itics:    { title: 'ITICS', subtitle: 'until 2013 · the first bell',
    palette: { wall1: '#3a2716', wall2: '#1a1108', floor: '#100a05', accent: '#d4a653', frame: '#5a2e1a' },
    light: { x: 200, y: 150, w: 320, warmth: 1.05 }, motes: 30 },
  cmr:      { title: 'CMR NATIONAL', subtitle: '2013–2015 · the pressure cooker',
    palette: { wall1: '#2a2418', wall2: '#120f08', floor: '#0c0905', accent: '#c9b58c', frame: '#4a2a18' },
    light: { x: 175, y: 130, w: 240, warmth: 0.82 }, motes: 22 },
  college:  { title: 'D.S.C.E.', subtitle: '2015–2019 · triples & three-bus commutes',
    palette: { wall1: '#33291a', wall2: '#16100a', floor: '#0e0a05', accent: '#c47540', frame: '#5a3018' },
    light: { x: 210, y: 160, w: 300, warmth: 0.95 }, motes: 28 },
  fever104: { title: 'FEVER 104 FM', subtitle: 'Mar–May 2019 · the soundproof room',
    palette: { wall1: '#3a1e16', wall2: '#190d08', floor: '#0f0805', accent: '#e0a35a', frame: '#5a2618' },
    light: { x: 190, y: 150, w: 280, warmth: 1.1 }, motes: 24 },
  sakha:    { title: 'SAKHA GLOBAL', subtitle: '2019–2022 · the first paycheck',
    palette: { wall1: '#2e2a1e', wall2: '#15120b', floor: '#0d0a06', accent: '#d4a653', frame: '#534127' },
    light: { x: 205, y: 150, w: 300, warmth: 0.98 }, motes: 26 },
  scripbox: { title: 'SCRIPBOX', subtitle: '2022–present · a protocol no one had heard of',
    palette: { wall1: '#2b2c20', wall2: '#121309', floor: '#0b0c06', accent: '#e6c285', frame: '#4d4327' },
    light: { x: 200, y: 140, w: 300, warmth: 1.0 }, motes: 28 },
  vwgt:     { title: 'THE GT', subtitle: 'Nov 16 2025 · one signature',
    palette: { wall1: '#332014', wall2: '#160c06', floor: '#0e0805', accent: '#e6c285', frame: '#5a3016' },
    light: { x: 210, y: 150, w: 320, warmth: 1.08 }, motes: 30 },
  now:      { title: 'NOW', subtitle: '2026–present · still building',
    palette: { wall1: '#3d2c18', wall2: '#1c1206', floor: '#100a05', accent: '#f0c060', frame: '#5a3a1a' },
    light: { x: 220, y: 140, w: 340, warmth: 1.15 }, motes: 32 },
};

// Fallback emoji if a beat has no hint and isn't found in v1 BEATS.
const MEMORY_FALLBACK_ICON = '🖼️';

/** Look up a chapter's authored beat lore from v1 (window.__journey.BEATS). */
function lookupBeat(chapterId, beatId) {
  const all = (typeof window !== 'undefined' && window.__journey && window.__journey.BEATS) || [];
  const full = chapterId + '-' + beatId;
  return all.find(b => b.id === full || b.id === beatId) || null;
}

function humanize(id) {
  return String(id).replace(/[-_]/g, ' ');
}

/** Distribute N memory frames across the back/mid wall in a gentle zig-zag arc. */
function layoutMemories(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    out.push({
      x: 300 + t * 430,            // 300 → 730 across the wall
      y: 258 + (i % 2) * 74,       // zig-zag two rows
      depth: 0.48 + t * 0.22,      // far-left → nearer-right
      w: 116, h: 150,
    });
  }
  return out;
}

/**
 * Build the full room descriptor for a chapter. Memory props are generated from
 * QUESTS[chapterId].beats and enriched from v1 BEATS; the four fixtures
 * (projector / arcade / journal / exit) and the window are fixed furniture.
 */
function buildRoom(chapterId) {
  const meta = ROOM_META[chapterId] || ROOM_META.__default;
  const beats = (typeof QUESTS !== 'undefined' && QUESTS[chapterId] && QUESTS[chapterId].beats) || [];
  const slots = layoutMemories(beats.length);

  const props = [];

  // Window — the light source, far back, non-interactable.
  props.push({ id: 'window', kind: 'decor', draw: 'window',
    x: meta.light.x, y: meta.light.y, depth: 0.04, w: meta.light.w, h: meta.light.w * 0.9 });

  // Projector screen — plays the chapter's stage video (far wall).
  props.push({ id: 'screen', kind: 'video', draw: 'screen', icon: '▶',
    x: 510, y: 150, depth: 0.18, w: 270, h: 150, title: 'the reel' });

  // Memory frames — one per quest beat, enriched from authored lore.
  beats.forEach((beatId, i) => {
    const beat = lookupBeat(chapterId, beatId);
    const s = slots[i];
    props.push({
      id: beatId, kind: 'memory', draw: 'frame', beat: beatId,
      x: s.x, y: s.y, depth: s.depth, w: s.w, h: s.h,
      icon: (beat && beat.hint) || MEMORY_FALLBACK_ICON,
      title: (beat && beat.title) || humanize(beatId),
      body: (beat && beat.lore) || 'a memory from this chapter.',
    });
  });

  // Arcade cabinet — replays the chapter's mini-game (foreground left).
  props.push({ id: 'arcade', kind: 'minigame', draw: 'arcade', icon: '🕹',
    x: 150, y: 432, depth: 0.9, w: 150, h: 196,
    title: (typeof MINIGAMES !== 'undefined' && MINIGAMES[chapterId] && MINIGAMES[chapterId].label) || 'replay' });

  // Journal — the culmination paragraph (foreground right).
  props.push({ id: 'journal', kind: 'culmination', draw: 'journal', icon: '📖',
    x: 848, y: 470, depth: 0.92, w: 150, h: 120, title: 'the page',
    body: (typeof CULMINATIONS !== 'undefined' && (CULMINATIONS[chapterId] || CULMINATIONS.__placeholder)) || '' });

  // Exit door — back to the overworld (right wall).
  props.push({ id: 'exit', kind: 'exit', draw: 'door', icon: '→',
    x: 940, y: 332, depth: 0.42, w: 132, h: 300, title: 'step back out' });

  return {
    chapterId,
    title: meta.title,
    subtitle: meta.subtitle,
    palette: meta.palette,
    light: meta.light,
    moteCount: meta.motes,
    props,
  };
}
