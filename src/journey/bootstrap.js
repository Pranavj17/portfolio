// === src/journey/bootstrap.js ===
/**
 * Wires v2 to the page: exposes the API on window.__journeyV2, shows the
 * one-time onboarding intro card, wires the always-visible "memory rooms"
 * picker button, and starts the STEP-INSIDE prompt poll.
 *
 * v1 (journey.js) owns the world + walking and populates window.__journeyV1Bridge
 * from inside its IIFE; v2 reads from it. The room IS the milestone now — there
 * is no walk-by vignette layer.
 */
window.__journeyV2 = {
  initMinigame,
  store: createChapterStore(window.localStorage),
  // chapter detection + prompt poll
  detectActiveV2Chapter,
  tickChapterFlow,
  // Memory Room API
  openMemoryRoom,
  closeMemoryRoom,
  isRoomOpen,
  buildRoom,
  openRoomPicker,
  closeRoomPicker,
};

// Onboarding intro card — shown once per browser (localStorage flag). Two lines:
// what this is + how to move, then "tap to begin". Dismiss writes the flag so
// returning visitors go straight to the walk.
(function wireIntroCard() {
  const intro = document.getElementById('v2-intro');
  if (!intro) return;
  let seen = false;
  try { seen = !!window.localStorage.getItem('journey_intro_seen'); } catch (_) {}
  if (seen) { intro.setAttribute('aria-hidden', 'true'); return; }
  intro.setAttribute('aria-hidden', 'false');
  const dismiss = () => {
    intro.setAttribute('aria-hidden', 'true');
    try { window.localStorage.setItem('journey_intro_seen', '1'); } catch (_) {}
    intro.removeEventListener('click', dismiss);
  };
  intro.addEventListener('click', dismiss);
})();

// Memory-Rooms picker button — always visible once v2 is loaded so the rooms
// are discoverable from anywhere, not just by stumbling onto the prompt.
(function wireRoomsButton() {
  const btn = document.getElementById('v2-rooms-btn');
  if (btn) { btn.setAttribute('aria-hidden', 'false'); btn.onclick = openRoomPicker; }
  const picker = document.getElementById('v2-rooms-picker');
  if (picker) {
    picker.addEventListener('click', (e) => { if (e.target === picker) closeRoomPicker(); });
    const close = document.getElementById('v2-rooms-close');
    if (close) close.onclick = closeRoomPicker;
  }
})();

// Poll for the milestone band → STEP-INSIDE prompt. The bridge is filled by
// v1's IIFE; until then detectActiveV2Chapter returns null and the prompt stays
// hidden.
setInterval(tickChapterFlow, 250);
