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
    // Chain into stage video if v1 helper exposed it (it's a top-level
    // function in journey.js; we sniff for it).
    const playVid = window.__playStageVideoV1 || (typeof playStageVideo !== 'undefined' ? playStageVideo : null);
    if (typeof playVid === 'function') {
      try { playVid(chapterId, chapterLabel); } catch (_) {}
    }
    onDone();
  }
  $overlay.addEventListener('click', dismiss);
}
