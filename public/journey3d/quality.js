// === public/journey3d/quality.js ===
// journey v3 — pure quality-tier selection. NO `three` import.
//
// Picks 'high' | 'medium' | 'low' from device capabilities so main.js can
// scale renderer settings (pixel ratio, shadow map size, light count). The
// inputs are plain values so this is trivially unit-testable in Node.
//
// Authored as plain declarations + a trailing `export` so the test can eval it
// after stripping the export line.

/**
 * @param {object} caps
 * @param {number} caps.maxTextureSize  gl.getParameter(MAX_TEXTURE_SIZE), e.g. 4096
 * @param {number} [caps.deviceMemory]  navigator.deviceMemory in GB (may be undefined)
 * @param {boolean} caps.isMobile       coarse pointer / mobile UA
 * @param {number} caps.dpr             window.devicePixelRatio
 * @returns {'high'|'medium'|'low'}
 */
function pickTier(caps) {
  const maxTex = Number(caps && caps.maxTextureSize) || 0;
  const isMobile = !!(caps && caps.isMobile);
  // deviceMemory is non-standard / absent on many browsers; treat unknown as "ample".
  const mem = caps && typeof caps.deviceMemory === 'number' ? caps.deviceMemory : 8;

  // Anything that can't even do 2k textures, or is very memory-starved, is low.
  if (maxTex < 4096 || mem <= 2) return 'low';

  // Mobile never gets the full tier — it caps at medium even on strong phones.
  if (isMobile) {
    if (maxTex >= 8192 && mem >= 4) return 'medium';
    return 'low';
  }

  // Desktop: a capable GPU + enough memory earns the full tier.
  if (maxTex >= 8192 && mem >= 4) return 'high';
  return 'medium';
}

/**
 * Concrete renderer knobs for a tier. Mobile-friendly caps are baked in here
 * so main.js just reads them; dpr is clamped per the spec (≤1.5 on mobile).
 * @param {'high'|'medium'|'low'} tier
 * @param {number} rawDpr  window.devicePixelRatio
 * @param {boolean} isMobile
 */
function tierSettings(tier, rawDpr, isMobile) {
  const dpr = Number(rawDpr) || 1;
  const base = {
    high:   { pixelRatio: Math.min(dpr, 2),   shadows: true,  shadowMapSize: 2048, fillLight: true },
    medium: { pixelRatio: Math.min(dpr, 1.5), shadows: true,  shadowMapSize: 1024, fillLight: true },
    low:    { pixelRatio: Math.min(dpr, 1.5), shadows: false, shadowMapSize: 512,  fillLight: false },
  };
  const out = base[tier] || base.medium;
  // Spec: cap devicePixelRatio ≤ 1.5 on mobile regardless of tier.
  if (isMobile) out.pixelRatio = Math.min(out.pixelRatio, 1.5);
  return out;
}

export { pickTier, tierSettings };
