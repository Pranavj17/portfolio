/**
 * Phaser 3 port of /journey — Stage 1 scaffold.
 *
 *   Goal of this stage: validate the game loop, input handling, camera
 *   follow, and parallax pipeline with placeholder rectangles BEFORE
 *   committing to sprite-art download. Once you approve this feel,
 *   Stage 2 swaps the placeholders for CC0 RPG sprite art.
 *
 *   What you should see when this loads:
 *     · A sky gradient + ground band (similar palette to current journey)
 *     · A character (cyan rectangle for now) standing at left-center
 *     · Hold ArrowRight / D / tap-and-hold → character walks forward
 *     · Camera follows the player
 *     · 8 chapter markers (golden flag posts) along the path
 *     · World ends after the 8th chapter
 *
 *   What's intentionally NOT here yet:
 *     · Sprite-based character/vehicle art (Stage 2)
 *     · Vehicle progression (Stage 3)
 *     · Achievement cards / RDR HUD chrome (Stage 3 — DOM overlay)
 */

(() => {
    'use strict';

    // ── world constants · GROUND_Y / HORIZON_Y are derived from actual
    //    viewport height in create() since Phaser.Scale.RESIZE makes the
    //    game canvas exactly match window dimensions (world coords === viewport).
    const WORLD_W   = 6800;             // total horizontal scroll
    const WALK_SPEED = 220;             // px/s — Phaser uses px/s not px/frame
    const CHAPTERS = [
        { x:  500, label: 'ITICS',         color: 0xa8b87a },
        { x: 1200, label: 'CMR NATIONAL',  color: 0x5e7a8a },
        { x: 2000, label: 'D.S.C.E.',      color: 0xc47540 },
        { x: 2800, label: 'FEVER 104 FM',  color: 0xb84c32 },
        { x: 3600, label: 'SAKHA GLOBAL',  color: 0xc9a151 },
        { x: 4400, label: 'SCRIPBOX',      color: 0x7a9a8a },
        { x: 5300, label: 'THE GT',        color: 0xa4332e },
        { x: 6200, label: 'NOW',           color: 0xe6c285 },
    ];

    class JourneyScene extends Phaser.Scene {
        constructor() { super('Journey'); }

        // Stage 1 uses generated textures, not loaded images. preload is empty.
        preload() {}

        create() {
            const { width: viewW, height: viewH } = this.scale;
            // Derive ground/horizon from ACTUAL viewport so the player lands
            // on the visible ground regardless of window size.
            this.groundY  = viewH * 0.82;
            this.horizonY = viewH * 0.58;
            const GROUND_Y  = this.groundY;
            const HORIZON_Y = this.horizonY;
            const WORLD_H   = viewH;

            // ── parallax background layers ──────────────────────────
            const skyGfx = this.add.graphics();
            skyGfx.fillGradientStyle(0x3a2418, 0x3a2418, 0x8a4a26, 0x8a4a26, 1);
            skyGfx.fillRect(0, 0, WORLD_W, HORIZON_Y);
            skyGfx.setScrollFactor(0.1, 0);          // very slow parallax = distant sky

            // distant hills · darker silhouette polygon, slow parallax
            const hillsGfx = this.add.graphics();
            hillsGfx.fillStyle(0x3a2818, 1);
            hillsGfx.beginPath();
            hillsGfx.moveTo(0, HORIZON_Y);
            for (let x = 0; x <= WORLD_W; x += 80) {
                const y = HORIZON_Y + Math.sin(x * 0.003) * 28 + Math.cos(x * 0.007 + 1.3) * 22;
                hillsGfx.lineTo(x, y);
            }
            hillsGfx.lineTo(WORLD_W, HORIZON_Y);
            hillsGfx.closePath();
            hillsGfx.fillPath();
            hillsGfx.setScrollFactor(0.4, 0);

            // ground · dark dirt band
            const groundGfx = this.add.graphics();
            groundGfx.fillGradientStyle(0x7a4a26, 0x7a4a26, 0x3a2010, 0x3a2010, 1);
            groundGfx.fillRect(0, HORIZON_Y, WORLD_W, WORLD_H - HORIZON_Y);
            groundGfx.setScrollFactor(1, 0);

            // path strip · slightly darker line along ground
            const pathGfx = this.add.graphics();
            pathGfx.fillStyle(0x4a2c14, 1);
            pathGfx.fillRect(0, GROUND_Y + 12, WORLD_W, 4);
            pathGfx.setScrollFactor(1, 0);

            // ── chapter landmarks · flag posts ──────────────────────
            for (const ch of CHAPTERS) {
                const pole = this.add.rectangle(ch.x, GROUND_Y - 40, 4, 80, 0x5a3a22);
                const flag = this.add.rectangle(ch.x + 14, GROUND_Y - 60, 22, 14, ch.color);
                pole.setScrollFactor(1, 0);
                flag.setScrollFactor(1, 0);
                const label = this.add.text(ch.x, GROUND_Y + 20, ch.label, {
                    fontFamily: 'Cinzel, serif',
                    fontSize: '13px',
                    color: '#e9d8b0',
                });
                label.setOrigin(0.5, 0);
                label.setScrollFactor(1, 0);
            }

            // ── PLAYER · emoji-based character ──────────────────────
            //   Apple Color Emoji 🚶 renders as the colorful walking-person
            //   glyph via Phaser.Text → canvas fillText. Anchor origin at
            //   feet (0.5, 1) so the emoji's bottom sits on GROUND_Y.
            //   We also flip horizontally when facing-right (emoji walks
            //   left by default in Apple's font).
            this.player = this.add.text(180, GROUND_Y, '🚶', {
                fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif',
                fontSize: '72px',
            });
            this.player.setOrigin(0.5, 1);   // bottom-center anchor → feet on ground
            this.player.setScale(-1, 1);      // flip to face right (emoji default = left)
            this.physics.add.existing(this.player);
            this.player.body.setCollideWorldBounds(true);
            this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

            // camera follow
            this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
            this.cameras.main.startFollow(this.player, true, 0.1, 0);
            this.cameras.main.setDeadzone(viewW * 0.4, viewH);

            // ── input · keyboard + touch-hold ───────────────────────
            this.keys = this.input.keyboard.addKeys('RIGHT,LEFT,D,A');
            this.touchHold = false;
            this.input.on('pointerdown', () => { this.touchHold = true; });
            this.input.on('pointerup',   () => { this.touchHold = false; });
            this.input.on('pointerout',  () => { this.touchHold = false; });

            // ── debug overlay · top-right pill with x position ──────
            this.distText = this.add.text(16, 16, 'DIST 0 M', {
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '14px',
                color: '#bfa56e',
                backgroundColor: 'rgba(20,12,6,0.7)',
                padding: { x: 10, y: 6 },
            });
            this.distText.setScrollFactor(0, 0);    // pinned to camera
            this.distText.setDepth(100);
        }

        update(_t, dt) {
            const movingRight = this.keys.RIGHT.isDown || this.keys.D.isDown || this.touchHold;
            const movingLeft  = this.keys.LEFT.isDown  || this.keys.A.isDown;
            let vx = 0;
            if      (movingRight) vx =  WALK_SPEED;
            else if (movingLeft)  vx = -WALK_SPEED * 0.6;
            this.player.body.setVelocityX(vx);

            // Swap emoji to 🏃 once player passes 800 px (run threshold).
            // Future stages: 🚴 at 1700, 🏍️ at 2500, 🚗 at 3300, 🏎️ at vwgt.
            const wantGlyph = this.player.x >= 800 ? '🏃' : '🚶';
            if (this.player.text !== wantGlyph) this.player.setText(wantGlyph);

            // Facing: flip horizontally when moving-right (or default).
            // When explicitly back-stepping, face left (no flip).
            const facingRight = !(movingLeft && !movingRight);
            this.player.scaleX = facingRight ? -1 : 1;

            // walking bob: tiny vertical wobble while moving sells the gait
            const moving = movingRight || movingLeft;
            this.player.scaleY = moving ? 1 + Math.sin(this.time.now * 0.012) * 0.04 : 1;

            this.distText.setText(`DIST ${Math.round(this.player.x)} M`);
        }
    }

    // ── boot ─────────────────────────────────────────────────────────
    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        backgroundColor: '#1a1410',
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: window.innerWidth,
            height: window.innerHeight,
        },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 } },
        },
        scene: [JourneyScene],
    });
    window.__journeyPhaser = game;
})();
