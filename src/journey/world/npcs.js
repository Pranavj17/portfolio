// === src/journey/world/npcs.js ===
/**
 * Per-chapter NPC archetype. Each entry:
 *   { name, sprite, open, choices: [{label, reply}], close }
 * Phase 2 populates `cmr`. Other chapters added in Phase 3.
 */
const NPCS = {
  __placeholder: {
    name: 'THE PLACEHOLDER',
    sprite: '🗿',
    open: 'placeholder open line.',
    choices: [
      { label: 'choice a', reply: 'reply a.' },
      { label: 'choice b', reply: 'reply b.' },
    ],
    close: 'go well.',
  },
};
