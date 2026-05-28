// === src/journey/acts/cutscene.js ===
/**
 * Act I cutscene player. Fades lines in one-by-one, dismisses on tap or
 * after durationMs. Calls onDismiss() exactly once.
 *
 * Browser-only: touches DOM. Reduced-motion mode displays all lines at
 * once with no animation-delay and shortens the auto-dismiss timer.
 */

// Pure helper · tested independently in tests/unit/cutscene.test.js.
function isReducedMotion(win) {
  if (!win || typeof win.matchMedia !== 'function') return false;
  try { return !!win.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_) { return false; }
}

function playCutscene(chapterId, intertitle, onDismiss) {
  const data = CUTSCENES[chapterId] ?? CUTSCENES.__placeholder;
  const overlay = document.getElementById('v2-cutscene');
  const actEl   = document.getElementById('v2-cutscene-act');
  const linesEl = document.getElementById('v2-cutscene-lines');
  if (!overlay || !actEl || !linesEl) {
    onDismiss();
    return;
  }
  const reduced = isReducedMotion(window);
  actEl.textContent = intertitle?.act ? `${intertitle.act} · ${intertitle.title ?? ''}` : '';
  linesEl.innerHTML = data.lines
    .map((t, i) => `<div class="v2-line" style="${reduced ? '' : `animation-delay:${i * 0.7}s`}">${t}</div>`)
    .join('');
  overlay.setAttribute('aria-hidden', 'false');

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('click', dismiss);
    onDismiss();
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(); } }
  overlay.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey, true);
  // Auto-dismiss: 3000ms cap under reduced-motion (so the user isn't
  // stuck reading the same card for the full content duration).
  const effectiveDuration = reduced ? Math.min(data.durationMs, 3000) : data.durationMs;
  setTimeout(dismiss, effectiveDuration);
}
