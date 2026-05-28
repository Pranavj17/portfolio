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
  scripbox: {
    name: 'THE PEER', sprite: '🧑‍💻',
    open: 'show me the MCP protocol again.',
    choices: [
      { label: 'stdio json-rpc', reply: 'okay. and tools/list versus prompts/list?' },
      { label: "it's simpler than it sounds", reply: 'every server reviewer in the catalog said the same thing.' },
    ],
    close: 'send the PR. ship the page. refresh seventeen times.',
  },
  now: {
    name: 'THE SELF · FUTURE', sprite: '🪞',
    open: 'still here?',
    choices: [
      { label: 'always',  reply: 'good. keep claiming the hour.' },
      { label: 'for now', reply: 'for now is enough. it always was.' },
    ],
    close: "the day belongs to whoever claims the first hour. you're claiming yours.",
  },
  sakha: {
    name: 'THE TECH LEAD', sprite: '🧑‍🔧',
    open: 'five interviews. tell me about the last one.',
    choices: [
      { label: 'ran out of time',              reply: 'time runs out on everyone. you came back. that\'s the part.' },
      { label: 'over-prepared the wrong part', reply: 'every junior does. mine was hash maps. yours?' },
    ],
    close: 'monday at nine. wear something with a collar.',
  },
  college: {
    name: 'THE TRIPLE-RIDER', sprite: '🛵',
    open: 'you walking again?',
    choices: [
      { label: 'saving bus fare', reply: 'lend me ten then. tomorrow\'s my treat.' },
      { label: 'lost my pass',    reply: 'same. third time this month. hop on.' },
    ],
    close: 'next class is on the other side. hold on tight.',
  },
};
