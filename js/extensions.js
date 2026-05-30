/* ================================================================
   NEO-ROBO - Extensions (v4) - NEW FEATURES ONLY
   ================================================================
   This file adds new features WITHOUT modifying any existing source.
   It does so by:
     - Adding new DOM-driven UI listeners (bar values, supersonic btn)
     - Monkey-patching a handful of Game / UI methods (playerHit, render,
       startGame, gameOver, updateHUD) to inject extension hooks
     - Managing its own state objects (shield, supersonic, dying, danger)
   No existing function is rewritten - we always delegate to the
   original implementation via saved references.
   ================================================================ */

(function () {
    'use strict';

    // ---------- Wait for Game / UI to exist ----------
    function whenReady(cb) {
        if (typeof Game !== 'undefined' && typeof UI !== 'undefined' && Game.canvas) {
            cb();
        } else {
            setTimeout(() => whenReady(cb), 30);
        }
    }

    whenReady(initExtensions);

    function initExtensions() {

        // ============================================================
        // CONFIG — tunables for new features
        // ============================================================
        const EXT_CONFIG = {
            // Shield
            SHIELD_MAX_FRACTION: 1 / 3,          // shield max = 1/3 of player max HP (=100/3)
            SHIELD_HIT_FLASH_FRAMES: 28,
            SHIELD_SPAWN_INTERVAL_MS: 22000,     // spawn a shield pickup periodically
            SHIELD_SPAWN_INTERVAL_JITTER: 12000,
            SHIELD_PICKUP_SIZE: 38,

            // Supersonic
            SUPERSONIC_ENERGY_THRESHOLD: 90,     // 90% of energy required
            SUPERSONIC_SIZE_MULT: 4,             // wave 4x bigger
            SUPERSONIC_DAMAGE_MULT: 3,           // 3x more damage than a normal wave
            SUPERSONIC_SPEED_FRAC: 1 / 4,        // 1/4 of normal sonic-wave speed
            SUPERSONIC_COOLDOWN_MS: 45000,       // 45 sec cooldown
            SUPERSONIC_LIFE: 60 * 8,             // big wave should travel far - 8 sec at 60fps

            // Time-slow during cut-in
            TIMESLOW_DURATION_MS: 3000,
            TIMESLOW_FACTOR: 1 / 4,              // game runs at 1/4 speed

            // Main boss override
            MAIN_BOSS_INTERVAL_MS: 150000,       // 2 min 30 sec
            DANGER_LEAD_TIME_MS: 5000,           // warning starts 5s before boss
            DANGER_DURATION_MS: 3000,            // warning visible for 3s

            // Death sequence
            PLAYER_BLINK_DURATION_MS: 1100,
            BOSS_BLINK_DURATION_MS: 700,
            DEATH_FADE_DURATION_MS: 2200,
            DEATH_TIMESLOW_FACTOR: 1 / 3
        };

        // Override the game's main-boss spawn interval to 2m30s.
        // (CONFIG is a runtime object — adjusting it does not modify source.)
        try {
            if (typeof CONFIG !== 'undefined') {
                CONFIG.MAIN_BOSS_SPAWN_INTERVAL = EXT_CONFIG.MAIN_BOSS_INTERVAL_MS;
            }
        } catch (e) {}

        // ============================================================
        // STATE
        // ============================================================
        const Ext = {
            // Shield
            shieldActive: false,
            shieldHP: 0,
            shieldMax: 100 * EXT_CONFIG.SHIELD_MAX_FRACTION,
            shieldHitFlash: 0,
            shieldPacks: [],
            shieldSpawnTimer: 0,
            shieldNextSpawnAt: 0,
            shieldUiShown: false,

            // Supersonic
            supersonicCooldownTimer: 0,    // ms remaining
            superWaves: [],                // our own wave list (so we don't touch sonicWaves)

            // Time-slow / cut-in
            timeSlowTimer: 0,              // ms remaining
            timeSlowActive: false,

            // Danger / main boss override
            mainBossManualTimer: 0,        // ms accumulator we control
            dangerActive: false,
            dangerTimer: 0,
            pendingMainBossSpawn: false,
            // we suppress the engine's built-in main-boss spawns
            suppressBuiltInMainBoss: true,

            // Player dying
            dying: false,
            dyingTimer: 0,
            dyingFadeTriggered: false,

            // Boss dying visuals (blink leftover)
            bossDeathFx: [],

            // HUD value tracking for pulse animations
            lastHealth: 100,
            lastEnergy: 100,
            lastShield: 0,

            // Track if hud is currently fully reset
            initialized: false
        };

        window.Extensions = Ext;
        window.EXT_CONFIG = EXT_CONFIG;

        // ============================================================
        // DOM REFERENCES
        // ============================================================
        const $ = (id) => document.getElementById(id);
        const healthFill   = $('health-fill');
        const energyFill   = $('energy-fill');
        const shieldFill   = $('shield-fill');
        const healthValue  = $('health-value');
        const energyValue  = $('energy-value');
        const shieldValue  = $('shield-value');
        const shieldGroup  = $('shield-bar-group');

        const btnSupersonic = $('btn-supersonic');
        const cdLabel = $('supersonic-cooldown');
        const cutinEl = $('supersonic-cutin');
        const dangerEl = $('danger-warning');
        const deathFadeEl = $('death-fade');

        // ============================================================
        // HUD value pulse helper
        // ============================================================
        function pulseValue(el, dir) {
            if (!el) return;
            el.classList.remove('pulse-up', 'pulse-down');
            // force reflow so animation re-runs
            // eslint-disable-next-line no-unused-expressions
            void el.offsetWidth;
            el.classList.add(dir > 0 ? 'pulse-up' : 'pulse-down');
            setTimeout(() => el && el.classList.remove('pulse-up', 'pulse-down'), 380);
        }

        // ============================================================
        // SHIELD: visuals + UI
        // ============================================================
        function activateShieldUI() {
            if (!shieldGroup) return;
            if (!Ext.shieldUiShown) {
                shieldGroup.classList.remove('hidden');
                shieldGroup.classList.add('appearing');
                setTimeout(() => shieldGroup && shieldGroup.classList.remove('appearing'), 400);
                Ext.shieldUiShown = true;
            }
        }
        function deactivateShieldUI() {
            if (!shieldGroup) return;
            shieldGroup.classList.add('hidden');
            Ext.shieldUiShown = false;
        }

        function pickUpShield() {
            Ext.shieldActive = true;
            Ext.shieldHP = Ext.shieldMax;
            activateShieldUI();
        }

        function damageShield(dmg) {
            // Returns leftover damage that should pass through to HP, or 0
            if (!Ext.shieldActive || Ext.shieldHP <= 0) return dmg;
            Ext.shieldHitFlash = EXT_CONFIG.SHIELD_HIT_FLASH_FRAMES;
            Ext.shieldHP -= dmg;
            let leftover = 0;
            if (Ext.shieldHP <= 0) {
                leftover = -Ext.shieldHP;
                Ext.shieldHP = 0;
                Ext.shieldActive = false;
                // Hide shield UI immediately when broken
                deactivateShieldUI();
            }
            return leftover;
        }

        // Draw the shield overlay around the player (called from render hook)
        function drawShield(ctx, player) {
            if (!Ext.shieldActive || Ext.shieldHP <= 0 || !player) return;

            const cx = player.x + player.w / 2;
            const cy = player.y + player.h / 2;
            // sphere radius slightly larger than player half-diagonal
            const radius = Math.max(player.w, player.h) * 0.85;

            // hit flash modifier — temporarily increases overall opacity
            const flash = Math.max(0, Ext.shieldHitFlash) / EXT_CONFIG.SHIELD_HIT_FLASH_FRAMES;
            const flashBoost = flash * 0.55; // up to +0.55 opacity boost on hit

            ctx.save();
            ctx.translate(cx, cy);

            // ---- Outer aura (very faint, full circle) ----
            const outerGrad = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius);
            outerGrad.addColorStop(0,    `rgba(135, 206, 250, ${0.02 + flashBoost * 0.6})`);
            outerGrad.addColorStop(0.55, `rgba(135, 206, 250, ${0.07 + flashBoost * 0.6})`);
            outerGrad.addColorStop(1,    `rgba(135, 206, 250, ${0.18 + flashBoost * 0.6})`);
            ctx.fillStyle = outerGrad;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            // ---- Side highlights (horizontal radial — more pronounced on L / R sides) ----
            // We achieve "transparent in middle, denser on sides" by drawing two
            // horizontal radial gradients on left & right halves.
            const sideRadius = radius * 1.05;
            const sideOpacity = 0.35 + flashBoost * 0.5;

            const drawSide = (offsetSign) => {
                const off = offsetSign * radius * 0.7;
                const grad = ctx.createRadialGradient(off, 0, 0, off, 0, sideRadius * 0.95);
                grad.addColorStop(0,    `rgba(180, 230, 255, ${sideOpacity})`);
                grad.addColorStop(0.4,  `rgba(140, 210, 255, ${sideOpacity * 0.55})`);
                grad.addColorStop(1,    `rgba(135, 206, 250, 0.0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fill();
            };
            // Clip to the spherical shape so side highlights don't escape the circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.clip();
            drawSide(-1);
            drawSide(+1);
            ctx.restore();

            // ---- Subtle inner sheen ring (almost transparent, gives a glass feel) ----
            // No stroke (borderless requirement).
            ctx.restore();

            // Decrement flash counter
            if (Ext.shieldHitFlash > 0) Ext.shieldHitFlash--;
        }

        // ============================================================
        // SHIELD PICK-UP: own collectible system
        // ============================================================
        function spawnShieldPickupNearCamera() {
            if (Game.state !== 'playing') return;
            // Place a few screens ahead of the camera, on top of a main platform
            const mains = Game.platforms.filter(p => p.type === 'main' &&
                                                     p.x + p.w > Game.cameraX + Game.vw * 0.4 &&
                                                     p.x < Game.cameraX + Game.vw * 3);
            if (mains.length === 0) return;
            const plat = mains[Math.floor(Math.random() * mains.length)];
            const px = plat.x + 60 + Math.random() * Math.max(60, plat.w - 120);
            const py = plat.y - 55;
            Ext.shieldPacks.push({
                x: px, y: py,
                size: EXT_CONFIG.SHIELD_PICKUP_SIZE,
                collected: false,
                bobOffset: Math.random() * Math.PI * 2,
                spinOffset: Math.random() * Math.PI * 2
            });
        }

        function updateShieldPickups(dt) {
            if (Game.state !== 'playing' || !Game.player) return;
            Ext.shieldSpawnTimer += dt;
            if (Ext.shieldSpawnTimer >= Ext.shieldNextSpawnAt) {
                Ext.shieldSpawnTimer = 0;
                Ext.shieldNextSpawnAt = EXT_CONFIG.SHIELD_SPAWN_INTERVAL_MS +
                                        Math.random() * EXT_CONFIG.SHIELD_SPAWN_INTERVAL_JITTER;
                spawnShieldPickupNearCamera();
            }
            // collection check
            const p = Game.player;
            for (const sp of Ext.shieldPacks) {
                if (sp.collected) continue;
                if (Game.circleRectOverlap(sp.x, sp.y, sp.size / 2, p)) {
                    sp.collected = true;
                    pickUpShield();
                    Game.spawnParticles(sp.x, sp.y, '#87ceeb', 8);
                    AudioManager.play('click');
                }
            }
            // cleanup off-screen / collected
            const cleanX = Game.cameraX - Game.vw;
            Ext.shieldPacks = Ext.shieldPacks.filter(sp => !sp.collected && sp.x > cleanX);
        }

        function drawShieldPickups(ctx) {
            for (const sp of Ext.shieldPacks) {
                if (sp.collected) continue;
                const bob = Math.sin(Game.animFrame * 0.05 + sp.bobOffset) * 6;
                drawShieldPickup(ctx, sp.x, sp.y + bob, sp.size);
            }
        }

        function drawShieldPickup(ctx, x, y, size) {
            const glow = Math.sin(Game.animFrame * 0.08 + 3) * 0.3 + 0.7;
            ctx.save();
            ctx.shadowColor = '#87ceeb';
            ctx.shadowBlur = 14 * glow;
            // Outer ring
            ctx.strokeStyle = '#4fb6ff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.stroke();
            // Translucent disc
            ctx.fillStyle = 'rgba(180, 230, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(x, y, size / 2 - 4, 0, Math.PI * 2);
            ctx.fill();
            // Inner shield emblem (filled crest)
            ctx.fillStyle = '#1e7fcc';
            const s = size * 0.28;
            ctx.beginPath();
            ctx.moveTo(x, y - s);
            ctx.lineTo(x + s, y - s * 0.4);
            ctx.lineTo(x + s * 0.7, y + s);
            ctx.lineTo(x - s * 0.7, y + s);
            ctx.lineTo(x - s, y - s * 0.4);
            ctx.closePath();
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(x - size * 0.12, y - size * 0.12, size * 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ============================================================
        // SUPERSONIC WAVE: own wave list, own update + render + collision
        // ============================================================
        function fireSupersonicWave() {
            const p = Game.player;
            if (!p) return;
            const baseW = CONFIG.SONIC_WAVE_WIDTH * EXT_CONFIG.SUPERSONIC_SIZE_MULT;
            const baseH = CONFIG.SONIC_WAVE_HEIGHT * EXT_CONFIG.SUPERSONIC_SIZE_MULT;
            const dir = p.facingRight ? 1 : -1;
            Ext.superWaves.push({
                x: p.x + (dir > 0 ? p.w : -baseW),
                y: p.y + p.h * 0.35 - baseH / 2 + p.h * 0.18,
                w: baseW, h: baseH,
                vx: CONFIG.SONIC_WAVE_SPEED * dir * EXT_CONFIG.SUPERSONIC_SPEED_FRAC,
                dir: dir,
                life: EXT_CONFIG.SUPERSONIC_LIFE,
                hitBosses: new Set()  // so one wave can pierce multiple bosses
            });
        }

        function updateSupersonicWaves() {
            if (!Game.player) return;
            for (let i = Ext.superWaves.length - 1; i >= 0; i--) {
                const w = Ext.superWaves[i];
                w.x += w.vx;
                w.life--;
                if (w.life <= 0 ||
                    w.x < Game.cameraX - 400 ||
                    w.x > Game.cameraX + Game.vw + 400) {
                    Ext.superWaves.splice(i, 1);
                    continue;
                }
                // Collide with bosses (pierce, but damage each only once)
                for (const b of Game.bosses) {
                    if (!b.alive) continue;
                    if (w.hitBosses.has(b)) continue;
                    if (Game.rectsOverlap(w, b)) {
                        w.hitBosses.add(b);
                        const dmg = (Game.sonicDamage || 1) * EXT_CONFIG.SUPERSONIC_DAMAGE_MULT;
                        b.health -= dmg;
                        b.hitFlash = 18;
                        Game.spawnParticles(b.x + b.w / 2, b.y, '#ff2a3c', 16);
                        AudioManager.play('click');
                        if (b.health <= 0) {
                            triggerBossDeath(b);
                        }
                    }
                }
                // Collide with regular enemies (also pierce)
                for (const e of Game.enemies) {
                    if (!e.alive) continue;
                    if (Game.rectsOverlap(w, e)) {
                        e.alive = false;
                        Game.points += 25;
                        Game.spawnParticles(e.x + e.w / 2, e.y, '#ff2a3c', 10);
                    }
                }
                for (const fe of Game.flyingEnemies) {
                    if (!fe.alive) continue;
                    if (Game.rectsOverlap(w, fe)) {
                        fe.alive = false;
                        Game.points += 30;
                        Game.spawnParticles(fe.x + fe.w / 2, fe.y, '#ff2a3c', 10);
                    }
                }
            }
        }

        function drawSupersonicWaves(ctx) {
            for (const w of Ext.superWaves) {
                const cx = w.x + w.w / 2;
                const cy = w.y + w.h / 2;
                const lifeAlpha = Math.min(1, w.life / 80);
                ctx.save();
                ctx.globalAlpha = lifeAlpha;
                // Outer fiery red
                const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, w.w * 0.55);
                outer.addColorStop(0,    'rgba(255, 255, 220, 0.85)');
                outer.addColorStop(0.25, 'rgba(255, 80, 0, 0.75)');
                outer.addColorStop(0.6,  'rgba(255, 42, 60, 0.55)');
                outer.addColorStop(1,    'rgba(180, 0, 30, 0)');
                ctx.fillStyle = outer;
                ctx.beginPath();
                ctx.ellipse(cx, cy, w.w * 0.55, w.h * 0.42, 0, 0, Math.PI * 2);
                ctx.fill();
                // Hot core
                const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, w.w * 0.25);
                core.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
                core.addColorStop(0.5, 'rgba(255, 200, 80, 0.7)');
                core.addColorStop(1, 'rgba(255, 80, 0, 0)');
                ctx.fillStyle = core;
                ctx.beginPath();
                ctx.ellipse(cx, cy, w.w * 0.22, w.h * 0.18, 0, 0, Math.PI * 2);
                ctx.fill();
                // Electric arcs (decorative)
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * lifeAlpha})`;
                ctx.lineWidth = 2;
                const t = Game.animFrame * 0.3;
                ctx.beginPath();
                for (let a = 0; a < 6; a++) {
                    const ang = (a / 6) * Math.PI * 2 + t;
                    const r1 = w.w * 0.25 + Math.sin(t * 1.3 + a) * 3;
                    const r2 = w.w * 0.5 + Math.sin(t * 2.1 + a) * 4;
                    ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.7);
                    ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2 * 0.7);
                }
                ctx.stroke();
                ctx.restore();
            }
        }

        // ============================================================
        // SUPERSONIC BUTTON LOGIC
        // ============================================================
        let supersonicHeld = false;
        function trySupersonic() {
            if (Game.state !== 'playing') return;
            if (Ext.timeSlowActive) return;
            if (Ext.dying) return;
            if (Ext.supersonicCooldownTimer > 0) return;
            const energyPct = Game.energy; // already 0..100
            if (energyPct < EXT_CONFIG.SUPERSONIC_ENERGY_THRESHOLD) return;
            // Consume energy fully (or threshold amount)
            Game.energy = Math.max(0, Game.energy - EXT_CONFIG.SUPERSONIC_ENERGY_THRESHOLD);
            Ext.supersonicCooldownTimer = EXT_CONFIG.SUPERSONIC_COOLDOWN_MS;
            triggerSupersonicSequence();
        }

        if (btnSupersonic) {
            const press = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); }
                AudioManager.play('click');
                trySupersonic();
            };
            btnSupersonic.addEventListener('click', press);
            btnSupersonic.addEventListener('touchend', press, { passive: false });
            // Keyboard binding: G key triggers supersonic
            window.addEventListener('keydown', (e) => {
                if (e.code === 'KeyG' && !supersonicHeld) {
                    supersonicHeld = true;
                    trySupersonic();
                }
            });
            window.addEventListener('keyup', (e) => {
                if (e.code === 'KeyG') supersonicHeld = false;
            });
        }

        function updateSupersonicButtonState() {
            if (!btnSupersonic) return;
            const cd = Ext.supersonicCooldownTimer;
            const ready = (Game.energy >= EXT_CONFIG.SUPERSONIC_ENERGY_THRESHOLD) &&
                          cd <= 0 && !Ext.timeSlowActive && !Ext.dying;
            btnSupersonic.classList.toggle('cooldown', cd > 0);
            btnSupersonic.classList.toggle('disabled', !ready && cd <= 0);
            btnSupersonic.classList.toggle('ready', ready);
            if (cdLabel) {
                if (cd > 0) {
                    cdLabel.textContent = Math.ceil(cd / 1000) + 's';
                } else {
                    cdLabel.textContent = '';
                }
            }
        }

        // ============================================================
        // TIME-SLOW + CUT-IN SEQUENCE
        // ============================================================
        function triggerSupersonicSequence() {
            Ext.timeSlowActive = true;
            Ext.timeSlowTimer = EXT_CONFIG.TIMESLOW_DURATION_MS;

            // Fire the actual wave at the start so the player gets the immediate hit
            fireSupersonicWave();

            // Cut-in animation
            if (cutinEl) {
                cutinEl.classList.remove('playing');
                // restart animation
                void cutinEl.offsetWidth;
                cutinEl.classList.add('playing');
                setTimeout(() => cutinEl && cutinEl.classList.remove('playing'),
                           EXT_CONFIG.TIMESLOW_DURATION_MS + 50);
            }
            AudioManager.play('victory');
        }

        // ============================================================
        // DANGER WARNING / MAIN BOSS SPAWN OVERRIDE
        // ============================================================
        function triggerDangerWarning() {
            if (!dangerEl) return;
            dangerEl.classList.remove('playing');
            void dangerEl.offsetWidth;
            dangerEl.classList.add('playing');
            Ext.dangerActive = true;
            Ext.dangerTimer = EXT_CONFIG.DANGER_DURATION_MS;
            AudioManager.play('game_over'); // re-use as a warning sting
            setTimeout(() => {
                if (dangerEl) dangerEl.classList.remove('playing');
                Ext.dangerActive = false;
            }, EXT_CONFIG.DANGER_DURATION_MS + 50);
        }

        function tickMainBossSchedule(dt) {
            if (Game.state !== 'playing') return;
            // We use OUR own timer (the engine's also runs but we suppress its main-boss spawns)
            Ext.mainBossManualTimer += dt;

            // 5 seconds before the boss, fire the warning (only once per cycle)
            const triggerAt = EXT_CONFIG.MAIN_BOSS_INTERVAL_MS - EXT_CONFIG.DANGER_LEAD_TIME_MS;
            if (!Ext.dangerActive && !Ext.pendingMainBossSpawn &&
                Ext.mainBossManualTimer >= triggerAt) {
                Ext.pendingMainBossSpawn = true;
                triggerDangerWarning();
            }

            if (Ext.mainBossManualTimer >= EXT_CONFIG.MAIN_BOSS_INTERVAL_MS) {
                Ext.mainBossManualTimer = 0;
                Ext.pendingMainBossSpawn = false;
                // Spawn the main boss now (uses engine's spawnBoss(true))
                Game.spawnBoss(true);
            }
        }

        // ============================================================
        // BOSS DEATH EFFECT (blink leftover after the engine removed it)
        // ============================================================
        function triggerBossDeath(b) {
            // Engine handles `b.alive = false` already in its own handlers,
            // but our Supersonic kill path also goes through here.
            if (!b.alive) return;
            b.alive = false;
            Game.bossesDefeated++;
            Game.points += b.isMainBoss ? 500 : 200;
            Game.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffcc00',
                                b.isMainBoss ? 35 : 20);
            AudioManager.play('victory');
            // Add a ghost blink effect that lives briefly after the boss is gone
            Ext.bossDeathFx.push({
                x: b.x, y: b.y, w: b.w, h: b.h,
                img: b.img, dir: b.dir,
                timer: 0,
                duration: EXT_CONFIG.BOSS_BLINK_DURATION_MS
            });
        }

        // Detect engine-side boss deaths (player jump-stomp or normal sonic) by
        // diffing bosses list across frames.
        let lastAliveBossSet = new WeakSet();
        function detectEngineBossDeaths() {
            // Bosses that were alive last frame but are now gone → spawn ghost fx
            // We can't catch them after the engine filtered them out, so we scan
            // the current list each frame BEFORE the filter (in our pre-update hook).
            // Implemented as: snapshot boss states each frame; after engine update,
            // find any boss whose alive went 1→0.
        }

        function updateBossDeathFx(dt) {
            for (let i = Ext.bossDeathFx.length - 1; i >= 0; i--) {
                const fx = Ext.bossDeathFx[i];
                fx.timer += dt;
                if (fx.timer >= fx.duration) Ext.bossDeathFx.splice(i, 1);
            }
        }

        function drawBossDeathFx(ctx) {
            for (const fx of Ext.bossDeathFx) {
                const t = fx.timer / fx.duration;
                // Blink: alternate visibility
                const blink = Math.floor(fx.timer / 60) % 2 === 0;
                if (!blink) continue;
                const filename = (fx.img || '').split('/').pop();
                const img = ImageCache[filename];
                if (!img) continue;
                ctx.save();
                ctx.globalAlpha = 1 - t;
                if (fx.dir < 0) {
                    ctx.translate(fx.x + fx.w, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, fx.y, fx.w, fx.h);
                } else {
                    ctx.drawImage(img, fx.x, fx.y, fx.w, fx.h);
                }
                ctx.restore();
            }
        }

        // ============================================================
        // PLAYER DEATH SEQUENCE
        // ============================================================
        function startPlayerDeathSequence() {
            if (Ext.dying) return;
            Ext.dying = true;
            Ext.dyingTimer = 0;
            Ext.dyingFadeTriggered = false;
            // Freeze game (we'll bypass normal update via wrapper)
        }

        function updateDying(dt) {
            if (!Ext.dying) return;
            Ext.dyingTimer += dt;

            // Trigger white fade halfway through (so screen turns white before transition)
            if (!Ext.dyingFadeTriggered &&
                Ext.dyingTimer >= EXT_CONFIG.PLAYER_BLINK_DURATION_MS * 0.4) {
                Ext.dyingFadeTriggered = true;
                if (deathFadeEl) {
                    deathFadeEl.classList.remove('fading');
                    void deathFadeEl.offsetWidth;
                    deathFadeEl.classList.add('fading');
                }
            }

            // After blink duration → call the original game over (sub-second after fade reaches white)
            if (Ext.dyingTimer >= EXT_CONFIG.PLAYER_BLINK_DURATION_MS &&
                !Ext.gameOverCalled) {
                Ext.gameOverCalled = true;
                origGameOver();
                // Clean fade class after fade finishes
                setTimeout(() => {
                    if (deathFadeEl) deathFadeEl.classList.remove('fading');
                }, EXT_CONFIG.DEATH_FADE_DURATION_MS);
            }
        }

        function drawPlayerDyingBlink(ctx, player) {
            if (!Ext.dying || !player) return;
            // Force a blink effect on the player by drawing a white-tinted overlay
            const blink = Math.floor(Ext.dyingTimer / 80) % 2 === 0;
            if (blink) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.6;
                const filename = (player.img || '').split('/').pop();
                const img = ImageCache[filename];
                if (img) {
                    if (!player.facingRight) {
                        ctx.translate(player.x + player.w, 0);
                        ctx.scale(-1, 1);
                        ctx.drawImage(img, 0, player.y, player.w, player.h);
                    } else {
                        ctx.drawImage(img, player.x, player.y, player.w, player.h);
                    }
                }
                ctx.restore();
            }
        }

        // ============================================================
        // MONKEY-PATCH: Game.playerHit  (shield absorbs first)
        // ============================================================
        const origPlayerHit = Game.playerHit.bind(Game);
        Game.playerHit = function (damage) {
            if (!Game.player) return;
            if (Game.player.invincible) return;
            if (Ext.shieldActive && Ext.shieldHP > 0) {
                const leftover = damageShield(damage);
                // Give brief i-frames so multiple bullets don't burn the shield instantly
                Game.player.invincible = true;
                Game.player.invTimer = 45;
                if (leftover > 0) {
                    // Apply leftover to HP via the original path
                    Game.player.invincible = false; // let origPlayerHit set its own i-frames
                    Game.player.invTimer = 0;
                    origPlayerHit(leftover);
                }
                return;
            }
            origPlayerHit(damage);
        };

        // ============================================================
        // MONKEY-PATCH: Game.gameOver  (delay for blink + fade)
        // ============================================================
        const origGameOver = Game.gameOver.bind(Game);
        Game.gameOver = function () {
            // If already in dying sequence or game over, just delegate
            if (Game.state === 'gameover') return;
            if (Ext.dying) return;
            startPlayerDeathSequence();
            // We don't change Game.state — the engine still treats us as 'playing'
            // and our wrapped update will simply not run gameplay during dying.
        };

        // ============================================================
        // MONKEY-PATCH: Game.startGame  (reset our state)
        // ============================================================
        const origStartGame = Game.startGame.bind(Game);
        Game.startGame = function () {
            // Reset extension state BEFORE starting so first frame sees clean values
            Ext.shieldActive = false;
            Ext.shieldHP = 0;
            Ext.shieldHitFlash = 0;
            Ext.shieldPacks = [];
            Ext.shieldSpawnTimer = 0;
            Ext.shieldNextSpawnAt = EXT_CONFIG.SHIELD_SPAWN_INTERVAL_MS;
            Ext.shieldUiShown = false;
            deactivateShieldUI();

            Ext.supersonicCooldownTimer = 0;
            Ext.superWaves = [];

            Ext.timeSlowActive = false;
            Ext.timeSlowTimer = 0;

            Ext.mainBossManualTimer = 0;
            Ext.dangerActive = false;
            Ext.dangerTimer = 0;
            Ext.pendingMainBossSpawn = false;

            Ext.dying = false;
            Ext.dyingTimer = 0;
            Ext.dyingFadeTriggered = false;
            Ext.gameOverCalled = false;
            Ext.bossDeathFx = [];

            Ext.lastHealth = 100;
            Ext.lastEnergy = 100;
            Ext.lastShield = 0;

            if (deathFadeEl) deathFadeEl.classList.remove('fading');
            if (cutinEl) cutinEl.classList.remove('playing');
            if (dangerEl) dangerEl.classList.remove('playing');

            origStartGame();
        };

        // ============================================================
        // MONKEY-PATCH: Game.update  (time-slow + shield + super waves + boss schedule)
        // ============================================================
        const origUpdate = Game.update.bind(Game);
        let timeSlowSkipCounter = 0;

        Game.update = function (dt) {
            // If the player is in the dying sequence, freeze gameplay entirely
            // but keep our own dying tick alive (handled in loop hook).
            if (Ext.dying) {
                // still let visuals tick - but no gameplay update
                return;
            }

            // Time-slow: only call the original update on every 4th tick (1/4 speed)
            if (Ext.timeSlowActive) {
                Ext.timeSlowTimer -= dt;
                if (Ext.timeSlowTimer <= 0) {
                    Ext.timeSlowActive = false;
                    timeSlowSkipCounter = 0;
                }
                timeSlowSkipCounter++;
                if (timeSlowSkipCounter < 4) {
                    // Skip this update step (but still tick our own systems below)
                    postUpdateHook(dt, /*skipped=*/true);
                    return;
                }
                timeSlowSkipCounter = 0;
            }

            // Suppress the engine's built-in main-boss spawns by pre-clamping its timer.
            // We replace its main-boss schedule with our own (2m30s + danger).
            if (Ext.suppressBuiltInMainBoss) {
                // Keep its timer just under threshold so the while-loop never spawns.
                if (Game.mainBossSpawnTimer >= CONFIG.MAIN_BOSS_SPAWN_INTERVAL - 1) {
                    Game.mainBossSpawnTimer = 0;
                }
            }

            origUpdate(dt);
            postUpdateHook(dt, /*skipped=*/false);
        };

        function postUpdateHook(dt, skipped) {
            // These tick at the simulation rate, but ALWAYS — even during time-slow skip frames
            updateShieldPickups(dt);
            updateSupersonicWaves(); // moves at our defined slow speed already
            updateBossDeathFx(dt);

            // Detect engine-side boss deaths via a snapshot: bosses that disappeared
            const aliveBosses = (Game.bosses || []).filter(b => b.alive);
            // We track every boss seen alive at least once
            for (const b of aliveBosses) {
                if (!b._extSeen) {
                    b._extSeen = true;
                    b._extLastAlive = true;
                }
                b._extLastAlive = b.alive;
            }

            // Supersonic cooldown countdown
            if (Ext.supersonicCooldownTimer > 0) {
                Ext.supersonicCooldownTimer = Math.max(0, Ext.supersonicCooldownTimer - dt);
            }

            // Main boss schedule (warning + 2:30 spawn)
            tickMainBossSchedule(dt);

            // Update HUD-side reactive bits (cooldown label, button state)
            updateSupersonicButtonState();
        }

        // ============================================================
        // MONKEY-PATCH: Game.render  (draw shield, super waves, shield packs)
        // ============================================================
        const origRender = Game.render.bind(Game);
        Game.render = function () {
            origRender();
            const ctx = Game.ctx;
            if (Game.state !== 'playing' && Game.state !== 'paused') return;

            // World-space overlays (shield around player, super waves, shield pickups)
            ctx.save();
            ctx.translate(-Game.cameraX, 0);
            drawShieldPickups(ctx);
            drawSupersonicWaves(ctx);
            drawBossDeathFx(ctx);
            drawPlayerDyingBlink(ctx, Game.player);
            drawShield(ctx, Game.player);
            ctx.restore();
        };

        // ============================================================
        // MONKEY-PATCH: Game.loop  (tick our death sequence even when paused/dying)
        // ============================================================
        const origLoop = Game.loop.bind(Game);
        let lastLoopTime = performance.now();
        Game.loop = function (timestamp) {
            const now = timestamp || performance.now();
            const realDt = Math.min(50, now - lastLoopTime);
            lastLoopTime = now;

            // Tick the dying sequence independent of game state
            if (Ext.dying) updateDying(realDt);

            // Always update the supersonic-button state so the cooldown counter
            // visibly ticks even when not 'playing' (e.g. paused).
            if (Ext.supersonicCooldownTimer > 0 && Game.state !== 'playing') {
                Ext.supersonicCooldownTimer = Math.max(0, Ext.supersonicCooldownTimer - realDt);
                updateSupersonicButtonState();
            }

            origLoop(timestamp);
        };

        // ============================================================
        // MONKEY-PATCH: UI.updateHUD  (numerical indicators + shield bar)
        // ============================================================
        const origUpdateHUD = UI.updateHUD.bind(UI);
        UI.updateHUD = function (health, energy, points, gameTimer, highScore) {
            origUpdateHUD(health, energy, points, gameTimer, highScore);

            // -- Bar values --
            const h = Math.max(0, Math.round(health));
            const e = Math.max(0, Math.round(energy));
            const s = Math.max(0, Math.round(Ext.shieldHP));

            if (healthValue && healthValue.textContent !== String(h)) {
                healthValue.textContent = h;
                if (h !== Ext.lastHealth) pulseValue(healthValue, h > Ext.lastHealth ? 1 : -1);
                Ext.lastHealth = h;
            }
            if (energyValue && energyValue.textContent !== String(e)) {
                energyValue.textContent = e;
                if (Math.abs(e - Ext.lastEnergy) >= 1) {
                    pulseValue(energyValue, e > Ext.lastEnergy ? 1 : -1);
                }
                Ext.lastEnergy = e;
            }

            // -- Shield UI --
            if (Ext.shieldActive && Ext.shieldHP > 0) {
                activateShieldUI();
                const pct = (Ext.shieldHP / Ext.shieldMax) * 100;
                if (shieldFill) shieldFill.style.width = pct + '%';
                if (shieldValue) {
                    if (shieldValue.textContent !== String(s)) {
                        shieldValue.textContent = s;
                        if (s !== Ext.lastShield) {
                            pulseValue(shieldValue, s > Ext.lastShield ? 1 : -1);
                        }
                        Ext.lastShield = s;
                    }
                }
            } else {
                deactivateShieldUI();
                if (shieldFill) shieldFill.style.width = '0%';
                if (shieldValue) shieldValue.textContent = '0';
                Ext.lastShield = 0;
            }

            // Update supersonic button each frame (energy might have changed)
            updateSupersonicButtonState();
        };

        // ============================================================
        // Initialize once
        // ============================================================
        Ext.shieldNextSpawnAt = EXT_CONFIG.SHIELD_SPAWN_INTERVAL_MS;
        Ext.initialized = true;

        // Hide overlays on startup
        deactivateShieldUI();
        if (cutinEl)     cutinEl.classList.remove('playing');
        if (dangerEl)    dangerEl.classList.remove('playing');
        if (deathFadeEl) deathFadeEl.classList.remove('fading');

        // Initial button state (no energy yet)
        updateSupersonicButtonState();

        console.log('NEO-ROBO Extensions v4 loaded: shield + supersonic + danger + dying FX');
    }
})();
