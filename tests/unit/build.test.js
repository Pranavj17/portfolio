const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'public', 'journey-v2.js');

test('committed bundle matches a fresh build (run `npm run build:v2` if this fails)', () => {
  const committedExists = fs.existsSync(OUT);
  const committed = committedExists ? fs.readFileSync(OUT, 'utf8') : null;
  execSync('node build.js', { cwd: ROOT });
  const fresh = fs.readFileSync(OUT, 'utf8');
  // Always restore so the test is idempotent (doesn't dirty the working tree)
  if (committedExists) fs.writeFileSync(OUT, committed);
  assert.ok(committedExists, 'public/journey-v2.js must be committed');
  assert.strictEqual(fresh, committed,
    'bundle drift detected — run `npm run build:v2` and commit the result');
});

test('bundle has the IIFE wrapper structure', () => {
  if (!fs.existsSync(OUT)) execSync('node build.js', { cwd: ROOT });
  const out = fs.readFileSync(OUT, 'utf8');
  assert.match(out, /^\(\(\) => \{/, 'must start with IIFE open');
  assert.match(out, /\}\)\(\);\s*$/, 'must end with IIFE close');
  assert.match(out, /'use strict';/);
  assert.match(out, /\/\/ === src\/journey\/core\.js ===/, 'must include core.js marker');
});
