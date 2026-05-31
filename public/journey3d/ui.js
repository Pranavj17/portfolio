// === public/journey3d/ui.js ===
// journey v3 — DOM overlay UI: branded loading screen, reticle + inspect
// prompt, memory-card overlay, objective HUD, mobile joystick hint, and the
// vignette + film-grain overlay (cheap CSS, not a GL pass). No three import,
// but DOM-dependent so browser-verified (not unit-tested).
//
// All UI lives in a single high-z-index root appended to <body>, ignoring the
// leftover v1/v2 DOM in the page.

const CSS = `
#j3d-root, #j3d-root * { box-sizing: border-box; }
#j3d-root {
  position: fixed; inset: 0; z-index: 999999;
  font-family: Georgia, "Times New Roman", serif; color: #f0e2c2;
  pointer-events: none; user-select: none; -webkit-user-select: none;
}
#j3d-canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; z-index: 999990; background: #0a0703; }
#j3d-vignette {
  position: fixed; inset: 0; z-index: 999995; pointer-events: none;
  box-shadow: inset 0 0 240px 80px rgba(0,0,0,0.85);
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(20,10,2,0.45) 100%);
}
#j3d-grain {
  position: fixed; inset: 0; z-index: 999996; pointer-events: none; opacity: 0.06;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
#j3d-grain.animate { animation: j3dgrain 0.4s steps(2) infinite; }
@keyframes j3dgrain { 0%{transform:translate(0,0)} 50%{transform:translate(-4px,3px)} 100%{transform:translate(3px,-2px)} }
#j3d-reticle {
  position: fixed; left: 50%; top: 50%; z-index: 999997; transform: translate(-50%,-50%);
  width: 8px; height: 8px; border: 1.5px solid rgba(240,226,194,0.6); border-radius: 50%;
  transition: width .12s, height .12s, border-color .12s;
}
#j3d-reticle.hot { width: 16px; height: 16px; border-color: #f0c060; }
#j3d-prompt {
  position: fixed; left: 50%; top: calc(50% + 28px); z-index: 999997; transform: translateX(-50%);
  background: rgba(12,8,4,0.78); border: 1px solid rgba(240,192,96,0.4); border-radius: 8px;
  padding: 8px 16px; font-size: 16px; letter-spacing: 0.4px; opacity: 0; transition: opacity .15s;
  white-space: nowrap;
}
#j3d-prompt.show { opacity: 1; }
#j3d-objective {
  position: fixed; left: 16px; top: 16px; z-index: 999997;
  background: rgba(12,8,4,0.7); border: 1px solid rgba(240,192,96,0.3); border-radius: 8px;
  padding: 10px 14px; font-size: 14px; max-width: 60vw; line-height: 1.4;
}
#j3d-objective .lbl { color: #f0c060; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
#j3d-loading {
  position: fixed; inset: 0; z-index: 1000000; background: radial-gradient(ellipse at center, #1a1108 0%, #0a0703 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: auto; transition: opacity .6s; text-align: center; padding: 24px;
}
#j3d-loading.hide { opacity: 0; pointer-events: none; }
#j3d-loading h1 { font-size: clamp(28px,6vw,52px); margin: 0 0 8px; color: #f0c060; letter-spacing: 2px; text-shadow: 0 0 30px rgba(240,192,96,0.4); }
#j3d-loading p { color: #c9b58c; margin: 4px 0; font-size: 16px; }
#j3d-loadbar { margin-top: 22px; width: min(280px,70vw); height: 3px; background: rgba(240,226,194,0.15); border-radius: 2px; overflow: hidden; }
#j3d-loadbar > i { display: block; height: 100%; width: 30%; background: #f0c060; animation: j3dload 1.1s ease-in-out infinite; }
@keyframes j3dload { 0%{margin-left:-30%} 100%{margin-left:100%} }
#j3d-enter {
  margin-top: 26px; pointer-events: auto; cursor: pointer; background: transparent;
  border: 1px solid #f0c060; color: #f0c060; border-radius: 24px; padding: 12px 28px;
  font-family: inherit; font-size: 16px; letter-spacing: 1px; display: none;
}
#j3d-enter.show { display: inline-block; }
#j3d-card {
  position: fixed; inset: 0; z-index: 999998; display: none; align-items: center; justify-content: center;
  background: rgba(6,4,2,0.72); pointer-events: auto; padding: 24px;
}
#j3d-card.show { display: flex; }
#j3d-card .panel {
  max-width: 520px; width: 100%; background: linear-gradient(180deg, #211509, #150d05);
  border: 1px solid rgba(240,192,96,0.4); border-radius: 14px; padding: 28px 30px;
  box-shadow: 0 0 60px rgba(0,0,0,0.7);
}
#j3d-card .icon { font-size: 44px; margin-bottom: 8px; }
#j3d-card h2 { margin: 0 0 12px; color: #f0c060; font-size: 26px; }
#j3d-card p { margin: 0 0 18px; color: #e8d9b8; line-height: 1.6; font-size: 17px; }
#j3d-card button {
  pointer-events: auto; cursor: pointer; background: #f0c060; border: none; color: #1a1108;
  border-radius: 22px; padding: 10px 24px; font-family: inherit; font-size: 15px; font-weight: 700;
}
#j3d-controls-hint {
  position: fixed; right: 16px; bottom: 16px; z-index: 999997; font-size: 12px; color: #c9b58c;
  background: rgba(12,8,4,0.6); border-radius: 8px; padding: 8px 12px; line-height: 1.5; text-align: right;
}
#j3d-joystick {
  position: fixed; left: 32px; bottom: 32px; z-index: 999997; width: 96px; height: 96px;
  border-radius: 50%; border: 2px solid rgba(240,226,194,0.3); background: rgba(12,8,4,0.4);
  display: none; pointer-events: none;
}
#j3d-joystick.show { display: block; }
`;

export class UI {
  constructor(opts = {}) {
    this.isMobile = !!opts.isMobile;
    this.reducedMotion = !!opts.reducedMotion;
    this._build();
  }

  _build() {
    const style = document.createElement('style');
    style.id = 'j3d-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'j3d-root';
    root.innerHTML = `
      <div id="j3d-vignette"></div>
      <div id="j3d-grain" class="${this.reducedMotion ? '' : 'animate'}"></div>
      <div id="j3d-reticle"></div>
      <div id="j3d-prompt"></div>
      <div id="j3d-objective"><span class="lbl">objective</span><div id="j3d-obj-text">—</div></div>
      <div id="j3d-joystick"></div>
      <div id="j3d-controls-hint"></div>
      <div id="j3d-card"><div class="panel">
        <div class="icon" id="j3d-card-icon"></div>
        <h2 id="j3d-card-title"></h2>
        <p id="j3d-card-body"></p>
        <button id="j3d-card-close">close</button>
      </div></div>
      <div id="j3d-loading">
        <h1>the journey, in 3D</h1>
        <p>pranav jagadish</p>
        <p style="opacity:.7;font-size:14px">building the hall…</p>
        <div id="j3d-loadbar"><i></i></div>
        <button id="j3d-enter">enter the hall ↵</button>
      </div>
    `;
    document.body.appendChild(root);

    this.root = root;
    this.reticle = root.querySelector('#j3d-reticle');
    this.prompt = root.querySelector('#j3d-prompt');
    this.objective = root.querySelector('#j3d-obj-text');
    this.loading = root.querySelector('#j3d-loading');
    this.enterBtn = root.querySelector('#j3d-enter');
    this.card = root.querySelector('#j3d-card');
    this.cardIcon = root.querySelector('#j3d-card-icon');
    this.cardTitle = root.querySelector('#j3d-card-title');
    this.cardBody = root.querySelector('#j3d-card-body');
    this.joystick = root.querySelector('#j3d-joystick');
    this.hint = root.querySelector('#j3d-controls-hint');

    this.hint.innerHTML = this.isMobile
      ? 'left: move · right: look<br>tap a glowing object to inspect'
      : 'WASD / arrows · mouse look<br>E or click to inspect · Esc to release';
    if (this.isMobile) this.joystick.classList.add('show');

    root.querySelector('#j3d-card-close').addEventListener('click', () => this.hideCard());
  }

  // --- loading screen -------------------------------------------------------
  showEnter(onEnter) {
    this.enterBtn.classList.add('show');
    this.loading.querySelectorAll('p')[1].textContent = 'ready';
    this.enterBtn.addEventListener('click', () => {
      this.hideLoading();
      onEnter();
    }, { once: true });
  }

  hideLoading() {
    this.loading.classList.add('hide');
    setTimeout(() => { this.loading.style.display = 'none'; }, 650);
  }

  // --- reticle + prompt -----------------------------------------------------
  showPrompt(active, label) {
    if (active) {
      this.prompt.textContent = label || '⌖ inspect';
      this.prompt.classList.add('show');
      this.reticle.classList.add('hot');
    } else {
      this.prompt.classList.remove('show');
      this.reticle.classList.remove('hot');
    }
  }
  hidePrompt() { this.showPrompt(false); }

  // --- objective HUD --------------------------------------------------------
  setObjective(text) { this.objective.textContent = text; }

  // --- memory card ----------------------------------------------------------
  showCard({ icon, title, body }, onClose) {
    this.cardIcon.textContent = icon || '🖼️';
    this.cardTitle.textContent = title || '';
    this.cardBody.textContent = body || '';
    this.card.classList.add('show');
    this._cardOnClose = onClose || null;
  }
  hideCard() {
    this.card.classList.remove('show');
    if (this._cardOnClose) { const f = this._cardOnClose; this._cardOnClose = null; f(); }
  }
  isCardOpen() { return this.card.classList.contains('show'); }

  fail(msg) {
    this.loading.innerHTML = `<h1 style="color:#e08a5a">couldn't start</h1><p>${msg || 'WebGL unavailable'}</p>`;
    this.loading.classList.remove('hide');
    this.loading.style.display = 'flex';
  }
}
