const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'public', 'journey-v2.js');

test('build.js produces a wrapped IIFE bundle containing all sources', () => {
  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
  execSync('node build.js', { cwd: ROOT });
  const out = fs.readFileSync(OUT, 'utf8');
  assert.match(out, /^\(\(\) => \{/, 'must start with IIFE open');
  assert.match(out, /\}\)\(\);\s*$/, 'must end with IIFE close');
  assert.match(out, /'use strict';/);
  assert.match(out, /\/\/ === src\/journey\/core\.js ===/, 'must include core.js marker');
});
