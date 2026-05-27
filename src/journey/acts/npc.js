// === src/journey/acts/npc.js ===
/**
 * Act II NPC encounter. Renders open line, then choices. Player taps a
 * choice → reply replaces the line, choices clear, "tap to continue"
 * appears. Tap anywhere → close line → onDone(choiceIdx).
 *
 * Phase machine: choose → reply → close → done. `clickChoice` runs in
 * the capture phase and stops propagation so the same click cannot also
 * trigger `clickAdvance` in the bubble phase. A `done` flag guards
 * against rapid double-clicks calling onDone twice.
 */
function presentNpc(chapterId, onDone) {
  const data = NPCS[chapterId] ?? NPCS.__placeholder;
  const overlay = document.getElementById('v2-npc');
  const $sprite = document.getElementById('v2-npc-sprite');
  const $name   = document.getElementById('v2-npc-name');
  const $line   = document.getElementById('v2-npc-line');
  const $choices = document.getElementById('v2-npc-choices');
  if (!overlay) { onDone(null); return; }

  $sprite.textContent = data.sprite;
  $name.textContent = data.name;
  $line.textContent = data.open;
  $choices.innerHTML = data.choices
    .map((c, i) => `<button class="v2-npc-choice" data-idx="${i}">${c.label}</button>`)
    .join('');
  overlay.setAttribute('aria-hidden', 'false');

  let phase = 'choose';  // choose → reply → close → done
  let pickedIdx = null;
  let done = false;

  function clickChoice(e) {
    const btn = e.target.closest('.v2-npc-choice');
    if (!btn || phase !== 'choose') return;
    // Stop the same click from advancing the reply→close transition.
    e.stopPropagation();
    pickedIdx = parseInt(btn.dataset.idx, 10);
    $line.textContent = data.choices[pickedIdx].reply;
    $choices.innerHTML = `<div class="v2-cutscene-cta">▸ tap to continue ▸</div>`;
    phase = 'reply';
  }
  function clickAdvance(e) {
    if (phase === 'reply') {
      $line.textContent = data.close;
      $choices.innerHTML = `<div class="v2-cutscene-cta">▸ tap to leave ▸</div>`;
      phase = 'close';
      return;
    }
    if (phase === 'close') {
      if (done) return;
      done = true;
      phase = 'done';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeEventListener('click', clickChoice, true);
      overlay.removeEventListener('click', clickAdvance);
      onDone(pickedIdx);
    }
  }
  overlay.addEventListener('click', clickChoice, true);
  overlay.addEventListener('click', clickAdvance);
}
