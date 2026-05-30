// === src/journey/acts/culmination.js ===
/**
 * Act III culmination card. Shows the chapter's closing paragraph, then on
 * tap chains into the existing v1 stage-video player if available.
 * Falls back to immediate onDone if neither overlay nor stage-video exists.
 */
function showCulmination(chapterId, chapterLabel, onDone) {
  const text = CULMINATIONS[chapterId] ?? CULMINATIONS.__placeholder ?? '';
  const $overlay = document.getElementById('v2-culmination');
  const $text = document.getElementById('v2-culmination-text');
  if (!$overlay || !$text) { onDone(); return; }
  $text.textContent = text;
  $overlay.setAttribute('aria-hidden', 'false');

  function dismiss() {
    $overlay.removeEventListener('click', dismiss);
    $overlay.setAttribute('aria-hidden', 'true');
    // Chain into the v1 stage-video player. It lives inside v1's IIFE and is
    // only reachable through the bridge — the old `typeof playStageVideo` sniff
    // resolved to this module's own name (a no-op), so the video never played.
    const playVid = window.__journeyV1Bridge && window.__journeyV1Bridge.playStageVideo;
    if (typeof playVid === 'function') {
      try { playVid(chapterId, chapterLabel); } catch (_) {}
    }
    onDone();
  }
  $overlay.addEventListener('click', dismiss);
}
