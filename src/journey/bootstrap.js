// === src/journey/bootstrap.js ===
/**
 * Exposes v2 internals on window.__journeyV2 for integration tests and
 * for the v1 game loop to call into during Phase 2 wiring.
 */
window.__journeyV2 = {
  playCutscene,
  presentNpc,
  initMinigame,
  showCulmination,
  store: createChapterStore(window.localStorage),
  // exposed for the chapter-flow polling
  detectActiveV2Chapter,
  startChapterFlow,
  // Memory Room API (Phase R)
  openMemoryRoom,
  closeMemoryRoom,
  isRoomOpen,
  buildRoom,
  openRoomPicker,
  closeRoomPicker,
};

// Memory-Rooms picker button — always visible once v2 is loaded so the rooms
// are discoverable from anywhere, not just by stumbling onto the in-world door.
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

// Start polling for v2 chapter entry. The v1 bundle (journey.js) is NOT
// loaded under ?v=2 — that's by design for Phase 2 vertical slice. v2 also
// has to draw its own minimal "is the player in CMR?" check, so the bridge
// below is filled by an inline patch in journey.html.
setInterval(tickChapterFlow, 250);
