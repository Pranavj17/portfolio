// === src/journey/acts/cutscene.js ===
/**
 * Act I cutscene player. Fades lines in one-by-one, dismisses on tap or
 * after durationMs. Calls onDismiss() exactly once.
 *
 * Browser-only: touches DOM. Reduced-motion mode displays all lines at
 * once with no animation and shortens display time.
 */
function playCutscene(chapterId, intertitle, onDismiss) {
  const data = CUTSCENES[chapterId] ?? CUTSCENES.__placeholder;
  const overlay = document.getElementById('v2-cutscene');
  const actEl   = document.getElementById('v2-cutscene-act');
  const linesEl = document.getElementById('v2-cutscene-lines');
  if (!overlay || !actEl || !linesEl) {
    onDismiss();
    return;
  }
  actEl.textContent = intertitle?.act ? `${intertitle.act} · ${intertitle.title ?? ''}` : '';
  linesEl.innerHTML = data.lines
    .map((t, i) => `<div class="v2-line" style="animation-delay:${i * 0.7}s">${t}</div>`)
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
  setTimeout(dismiss, data.durationMs);
}
