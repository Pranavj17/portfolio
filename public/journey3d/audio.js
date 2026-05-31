// === public/journey3d/audio.js ===
// journey v3 — procedural WebAudio engine. The single biggest "alive" win.
// Browser-dependent (WebAudio + DOM); the per-era chord/timbre data it plays
// comes from the PURE, unit-tested mood.js. EVERYTHING is wrapped so a missing
// or throwing WebAudio API can never break the game — audio just goes silent.
//
// Signal chain:
//   [ pad oscillators ] -> padGain -.
//   [ footsteps / sfx ] -> sfxGain --+-> master -> reverb (Convolver) -> dest
//                                     `------------------------------> dry ----^
//
// The AudioContext MUST be created/resumed from a user gesture (autoplay
// policy). main.js calls start() from the "enter the hall" click.

import { audioMood, chordFreqs } from './mood.js';

const MASTER_LEVEL = 0.25;     // tasteful + low, per spec
const PAD_VOICE_LEVEL = 0.10;  // per-oscillator level (chords stack)
const FOOTSTEP_STRIDE = 1.9;   // metres walked per footstep
const LS_MUTE_KEY = 'journey3d-muted';

export class AudioEngine {
  /** @param {{ isMobile?:boolean, reducedMotion?:boolean }} [opts] */
  constructor(opts = {}) {
    this.isMobile = !!opts.isMobile;
    this.reducedMotion = !!opts.reducedMotion;
    this.tier = this.isMobile ? 'low' : 'high'; // simplify on mobile

    this.ctx = null;
    this.ready = false;
    this.muted = this._loadMuted();

    this.padVoices = [];       // { osc, gain }
    this.padFilter = null;
    this.padLfo = null;
    this.currentMood = null;   // id of the era whose chord is playing

    this._walkAccum = 0;
    this._noiseBuffer = null;
  }

  // --- mute persistence -----------------------------------------------------
  _loadMuted() {
    try { return window.localStorage.getItem(LS_MUTE_KEY) === '1'; }
    catch (e) { return false; }
  }
  _saveMuted() {
    try { window.localStorage.setItem(LS_MUTE_KEY, this.muted ? '1' : '0'); }
    catch (e) { /* private mode — ignore */ }
  }
  isMuted() { return this.muted; }

  /** Toggle mute; ramps master gain. Returns the new muted state. */
  toggleMute() {
    this.muted = !this.muted;
    this._saveMuted();
    this._applyMasterLevel();
    return this.muted;
  }

  _applyMasterLevel() {
    if (!this.ready) return;
    try {
      const t = this.ctx.currentTime;
      const target = this.muted ? 0.0001 : MASTER_LEVEL;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(target, t, 0.08);
    } catch (e) { /* never break */ }
  }

  // --- boot (from a user gesture) ------------------------------------------
  /** Create + resume the AudioContext and build the master/reverb/pad chain. */
  start() {
    if (this.ready) { this._resume(); return true; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();

      // master gain → reverb (wet) + dry → destination
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0.0001 : MASTER_LEVEL;

      const dry = this.ctx.createGain();
      dry.gain.value = 0.82;
      const wet = this.ctx.createGain();
      wet.gain.value = this.isMobile ? 0.0 : 0.4; // skip convolver on mobile (cheaper)

      this.master.connect(dry).connect(this.ctx.destination);
      if (!this.isMobile) {
        const reverb = this.ctx.createConvolver();
        reverb.buffer = this._makeImpulse(2.4, 2.6);
        this.master.connect(reverb).connect(wet).connect(this.ctx.destination);
      }

      // sub-buses
      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0.9;
      this.padGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);

      // a shared lowpass + slow LFO that the pad sings through (evolving timbre)
      this.padFilter = this.ctx.createBiquadFilter();
      this.padFilter.type = 'lowpass';
      this.padFilter.frequency.value = 800;
      this.padFilter.Q.value = 0.8;
      this.padFilter.connect(this.padGain);

      this.padLfo = this.ctx.createOscillator();
      this.padLfo.frequency.value = 0.07; // very slow breathing of the cutoff
      this.padLfoGain = this.ctx.createGain();
      this.padLfoGain.gain.value = 260;
      this.padLfo.connect(this.padLfoGain).connect(this.padFilter.frequency);
      this.padLfo.start();

      this._noiseBuffer = this._makeNoise(0.4);

      this.ready = true;
      this._resume();
      return true;
    } catch (e) {
      this.ready = false;
      return false;
    }
  }

  _resume() {
    try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    catch (e) { /* ignore */ }
  }

  // --- procedural impulse / noise buffers ----------------------------------
  /** Exponentially-decaying stereo noise = a simple, cheap reverb tail. */
  _makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // --- the living ambient score --------------------------------------------
  /**
   * Shift the drone chord/timbre to a given era id (null = the hall mood).
   * Cross-fades the existing voices out and the new chord in over ~1.4s so the
   * transition is a swell, not a cut.
   */
  setMood(id) {
    if (!this.ready) return;
    if (this.currentMood === id && this.padVoices.length) return;
    this.currentMood = id;
    try {
      const m = audioMood(id);
      const freqs = chordFreqs(id);
      const now = this.ctx.currentTime;

      // fade + stop old voices
      for (const v of this.padVoices) {
        try {
          v.gain.gain.cancelScheduledValues(now);
          v.gain.gain.setTargetAtTime(0.0001, now, 0.5);
          v.osc.stop(now + 2.0);
        } catch (e) { /* ignore */ }
      }
      this.padVoices = [];

      // retune the shared filter toward the era cutoff
      this.padFilter.frequency.cancelScheduledValues(now);
      this.padFilter.frequency.setTargetAtTime(m.cutoff, now, 0.8);

      // build new chord — one oscillator per ratio, slightly detuned for warmth
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = m.wave;
        osc.frequency.value = f;
        osc.detune.value = (i - freqs.length / 2) * 4 + (Math.random() * 4 - 2);
        const g = this.ctx.createGain();
        g.gain.value = 0.0001;
        osc.connect(g).connect(this.padFilter);
        osc.start();
        const level = PAD_VOICE_LEVEL * (m.gain || 1) * (this.reducedMotion ? 0.8 : 1);
        g.gain.setTargetAtTime(level, now, 1.4);
        this.padVoices.push({ osc, gain: g });
      });
    } catch (e) { /* never break */ }
  }

  // --- footsteps ------------------------------------------------------------
  /**
   * Accumulate walk distance; emit a filtered-noise footstep each stride.
   * @param {number} distanceMoved  metres travelled this frame
   */
  stepWalk(distanceMoved) {
    if (!this.ready || this.muted || !(distanceMoved > 0)) return;
    this._walkAccum += distanceMoved;
    if (this._walkAccum >= FOOTSTEP_STRIDE) {
      this._walkAccum = 0;
      this._footstep();
    }
  }

  _footstep() {
    try {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 140 + Math.random() * 90; // soft footfall thud
      bp.Q.value = 1.1;
      const g = this.ctx.createGain();
      const peak = (this.reducedMotion ? 0.08 : 0.16) * (0.8 + Math.random() * 0.4);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      src.connect(bp).connect(g).connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.2);
    } catch (e) { /* ignore */ }
  }

  // --- interaction sounds ---------------------------------------------------
  /** A warm bell/chime + gentle swell — fired when a memory "plays". */
  chime() {
    if (!this.ready || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const partials = [1, 2.01, 3.0, 4.2];
      partials.forEach((mult, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 523.25 * mult; // C5 + inharmonic partials = bell
        const g = this.ctx.createGain();
        const peak = 0.18 / (i + 1);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(peak, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8 + i * 0.3);
        osc.connect(g).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 2.6);
      });
    } catch (e) { /* ignore */ }
  }

  /** A soft UI tick for prompts / card open-close. */
  tick() {
    if (!this.ready || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 880;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.07, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(g).connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.12);
    } catch (e) { /* ignore */ }
  }

  /** A low whoosh on entering a room. */
  whoosh() {
    if (!this.ready || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._makeNoise(0.9);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(180, now);
      lp.frequency.linearRampToValueAtTime(900, now + 0.35);
      lp.frequency.linearRampToValueAtTime(220, now + 0.85);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      src.connect(lp).connect(g).connect(this.sfxGain);
      src.start(now); src.stop(now + 0.95);
    } catch (e) { /* ignore */ }
  }

  /** A gentle gain swell on the pad — used during the "play memory" beat. */
  swell(up) {
    if (!this.ready) return;
    try {
      const now = this.ctx.currentTime;
      const target = up ? 1.5 : 0.9;
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.setTargetAtTime(target, now, 0.3);
    } catch (e) { /* ignore */ }
  }
}
