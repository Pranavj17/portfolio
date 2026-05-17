/**
 * journey/hud.js — DOM overlay updates: chapter banner, progress strip,
 * vehicle card, achievement popup stack. All elements live in journey.html
 * and are looked up once at module load (cached) so the animation loop
 * never pays for repeated document.getElementById calls.
 *
 * Performance: every function here is constant-time. The only allocation
 * inside an animation-frame-friendly call is showAchievement's createElement,
 * which only fires on transitions (not per frame).
 */
import { CHAPTERS, VEHICLES, ACHIEVEMENTS } from './data.js';

// cached DOM lookups · resolved once, mutated in place forever after.
// chapter banner removed in v20260518-3 · achievement card handles all
// milestone-announcement copy now (one impact moment, not two competing).
const $vehicleIcon   = document.getElementById('vehicle-icon');
const $vehicleLabel  = document.getElementById('vehicle-label');
const $vehicleSub    = document.getElementById('vehicle-sub');
const $vehicleCard   = document.getElementById('vehicle-card');
const $achStack      = document.getElementById('achievement-stack');
const $progress      = document.getElementById('progress-strip');
const $end           = document.getElementById('end');

// build the progress dots once · 6 children, never change count
const dots = [];
if ($progress) {
    CHAPTERS.forEach((_, i) => {
        const d = document.createElement('span');
        d.className = 'dot';
        d.dataset.idx = i;
        $progress.appendChild(d);
        dots.push(d);
    });
}

// updateBanner removed · chapter title no longer rendered in the HUD.
// The big-smash achievement card carries chapter announcements instead.

export function updateProgress(currentIdx, collected) {
    for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.classList.remove('done', 'current');
        if (collected.has(CHAPTERS[i].id)) d.classList.add('done');
        if (i === currentIdx)              d.classList.add('current');
    }
}

export function updateVehicleCard(vehicleId) {
    if (!$vehicleIcon) return;
    const v = VEHICLES[vehicleId];
    if (!v) return;
    $vehicleIcon.textContent  = v.icon;
    $vehicleLabel.textContent = v.label;
    $vehicleSub.textContent   = v.sub;
    if ($vehicleCard) {
        $vehicleCard.style.borderColor = '#' + v.tint.toString(16).padStart(6, '0');
    }
}

/** show an achievement popup · slides via the CSS animation and removes
 *  itself after the CSS animation completes (3.3s). Tracks "seen" state
 *  externally via the achievementsSet so repeat calls no-op. */
export function showAchievement(achievementId, achievementsSet) {
    if (!$achStack || !achievementId) return;
    if (achievementsSet && achievementsSet.has(achievementId)) return;
    if (achievementsSet) achievementsSet.add(achievementId);

    const a = ACHIEVEMENTS[achievementId];
    if (!a) return;

    const el = document.createElement('div');
    el.className = 'achievement';
    el.innerHTML = `
        <span class="a-icon">${a.icon}</span>
        <div class="a-text">
            <span class="a-tag">▸ ACHIEVEMENT</span>
            <span class="a-title">${a.title}</span>
            <span class="a-sub">${a.sub}</span>
        </div>`;
    $achStack.appendChild(el);
    // matches the CSS @keyframes iconSmash / textSettle total = 2800ms
    setTimeout(() => el.remove(), 2900);
}

export function showEndCard() {
    if ($end) $end.hidden = false;
}
