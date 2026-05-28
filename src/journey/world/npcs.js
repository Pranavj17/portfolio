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
  cmr: {
    name: 'THE MOTHER', sprite: '👩',
    open: 'you slept four hours.',
    choices: [
      { label: "i'll sleep after JEE", reply: 'you said that yesterday too.' },
      { label: 'tea?',                 reply: 'already on the stove.' },
    ],
    close: 'go. the bus leaves in twelve.',
  },
  itics: {
    name: 'THE FIRST FRIEND', sprite: '🧒',
    open: 'you missed the bus again.',
    choices: [
      { label: 'ran the whole way', reply: 'three kilometres. shoes still untied.' },
      { label: 'took an auto',      reply: 'splurged. mom is going to know.' },
    ],
    close: 'come on. assembly already started.',
  },
};
