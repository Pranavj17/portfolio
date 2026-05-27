#!/usr/bin/env node
/**
 * Concat src/journey/**\/*.js into public/journey-v2.js wrapped in one IIFE.
 * Manifest order matters — declarations later in the manifest may reference
 * declarations earlier. Keep `core.js` first and `bootstrap.js` last.
 */
const fs = require('fs');
const path = require('path');

const MANIFEST = [
  'src/journey/core.js',
  'src/journey/state/persistence.js',
  'src/journey/state/phase.js',
  'src/journey/state/store.js',
  'src/journey/data/cutscenes.js',
  'src/journey/data/culminations.js',
  'src/journey/world/npcs.js',
  'src/journey/ui/input.js',
  'src/journey/ui/hud.js',
  'src/journey/acts/cutscene.js',
  'src/journey/acts/npc.js',
  'src/journey/acts/quest.js',
  'src/journey/acts/minigame.js',
  'src/journey/acts/minigames/mock-test.js',
  'src/journey/acts/culmination.js',
  'src/journey/bootstrap.js',
];

const ROOT = __dirname;
const OUT = path.join(ROOT, 'public', 'journey-v2.js');

const parts = ['(() => {', `'use strict';`];
for (const rel of MANIFEST) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    // Skip missing files so the harness builds even before all tasks land.
    parts.push(`// === ${rel} === (missing — skipped)`);
    continue;
  }
  const banner = `// === ${rel} ===`;
  parts.push(banner);
  let src = fs.readFileSync(abs, 'utf8');
  // Strip a leading duplicate banner if the source file starts with one
  // — the bundler emits the canonical banner above.
  if (src.startsWith(banner + '\n')) src = src.slice(banner.length + 1);
  parts.push(src);
}
parts.push('})();');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n\n'));
console.log(`wrote ${OUT} (${parts.length - 3} sources)`);
