/* ============================================================
   NEO-ROBO - Features Extension (Part 1 & Part 2)
   This file ADDS new features on top of the existing engine
   WITHOUT modifying any of the original game.js / ui.js code.

   It hooks into the engine by:
     • Monkey-patching Game.update / Game.render / Game.startGame
       / Game.playerHit / Game.gameOver / Game.spawnBoss / UI.updateHUD
     • Adding new UI elements (already declared in index.html)
     • Adding a new collectible (shield point)
     • Adding the Supersonic button + cooldown
     • Adding boss DANGER warning, death blink, fade transitions
     • Replacing the point-based level-up with a card-selection system
   ============================================================ */

(function () {
    'use strict';

    // -------------------------------------------------------
    // 0. FEATURE CONFIG (easy to tune)
    // -------------------------------------------------------
    const FEATURE = {
        // Bars / stats
        BASE_MAX_HEALTH: 100,
        BASE_MAX_ENERGY: 100,
        SHIELD_RATIO: 1 / 3,           // shield max = 1/3 of player max health

        // Shield collectible
        SHIELD_PACK_SIZE: 40,
        SHIELD_PACK_SPAWN_CHANCE: 0.10, // per generated segment

        // Supersonic
        SUPERSONIC_THRESHOLD: 70,      // energy >= 70 required
        SUPERSONIC_COOLDOWN_MS: 30000, // 30s
        SUPERSONIC_SIZE_MUL: 4,
        SUPERSONIC_DAMAGE_MUL: 3,
        SUPERSONIC_SPEED_DIV: 4,
        SUPERSONIC_ENERGY_COST: 70,

        // Boss
        MAIN_BOSS_INTERVAL_MS: 150000, // 2 min 30 s
        WARNING_LEAD_MS: 5000,         // warning starts 5s before
        WARNING_DURATION_MS: 3000,     // and lasts 3s

        // Death / blink
        DEATH_BLINK_MS: 3000,
        MAIN_BOSS_DEATH_PAUSE_MS: 2000,
        DEATH_FADE_MS: 900,

        // Level-up
        LEVEL_UP_STEP: 500             // every 500 points
    };

    // -------------------------------------------------------
    // 1. CARD REGISTRY (read from <template id="card-registry">)
    //    Each entry: { id, category, name, desc, icon, accent, apply(state) }
    // -------------------------------------------------------
    const CARD_REGISTRY = [];

    function buildCardRegistry() {
        const tpl = document.getElementById('card-registry');
        if (!tpl) return;
        const nodes = tpl.content.querySelectorAll('.card-template');
        nodes.forEach(node => {
            const id   = node.dataset.id;
            const cat  = node.dataset.category;
            const name = node.dataset.name;
            const desc = node.dataset.desc;
            const icon = node.dataset.icon;
            const accent = node.dataset.accent || '#ffffff';
            CARD_REGISTRY.push({ id, category: cat, name, desc, icon, accent, apply: CARD_EFFECTS[id] });
        });
    }

    // -------------------------------------------------------
    // 2. CARD EFFECTS (modular - all values in one place)
    // -------------------------------------------------------
    const CARD_EFFECTS = {
        // ===== A: HEALTH =====
        'A1': () => { // Health Refill: restore 50% of current max health
            const s = FX.state;
            s.health = Math.min(s.maxHealth, s.health + Math.round(s.maxHealth * 0.5));
        },
        'A2': () => { // +10% Max HP
            const s = FX.state;
            s.maxHealth = Math.round(s.maxHealth * 1.10);
            s.health = Math.min(s.maxHealth, s.health + Math.round(s.maxHealth * 0.10));
        },
        'A3': () => { // +30% Max HP, -10% damage taken
            const s = FX.state;
            s.maxHealth = Math.round(s.maxHealth * 1.30);
            s.health = Math.min(s.maxHealth, s.health + Math.round(s.maxHealth * 0.30));
            s.damageReduction = Math.min(0.85, s.damageReduction + 0.10);
        },

        // ===== B: SHIELD =====
        'B1': () => { // Basic shield activator
            FX.activateShield();
        },
        'B2': () => { // Shield activator + 10% shield cap
            const s = FX.state;
            s.shieldCapMul *= 1.10;
            FX.activateShield();
        },
        'B3': () => { // Shield activator + 30% shield cap + -10% damage
            const s = FX.state;
            s.shieldCapMul *= 1.30;
            s.damageReduction = Math.min(0.85, s.damageReduction + 0.10);
            FX.activateShield();
        },

        // ===== C: DAMAGE =====
        'C1': () => { // +30% Sonic dmg, -10% max HP
            const s = FX.state;
            s.sonicDamageMul *= 1.30;
            s.maxHealth = Math.max(20, Math.round(s.maxHealth * 0.90));
            s.health = Math.min(s.health, s.maxHealth);
        },
        'C2': () => { // +10% Supersonic dmg
            const s = FX.state;
            s.supersonicDamageMul *= 1.10;
        },
        'C3': () => { // +30% Supersonic dmg, -10% max HP
            const s = FX.state;
            s.supersonicDamageMul *= 1.30;
            s.maxHealth = Math.max(20, Math.round(s.maxHealth * 0.90));
            s.health = Math.min(s.health, s.maxHealth);
        },
        'C4': () => { // Supersonic CD -30%
            const s = FX.state;
            s.supersonicCooldownMul *= 0.70;
        },

        // ===== D: ENERGY =====
        'D1': () => { // +10% Max Energy
            const s = FX.state;
            s.maxEnergy = Math.round(s.maxEnergy * 1.10);
        },
        'D2': () => { // +30% Max Energy, -10% max HP
            const s = FX.state;
            s.maxEnergy = Math.round(s.maxEnergy * 1.30);
            s.maxHealth = Math.max(20, Math.round(s.maxHealth * 0.90));
            s.health = Math.min(s.health, s.maxHealth);
        },
        'D3': () => { // +10% Energy regen
            const s = FX.state;
            s.energyRegenMul *= 1.10;
        },
        'D4': () => { // +30% Energy regen, -10% max HP
            const s = FX.state;
            s.energyRegenMul *= 1.30;
            s.maxHealth = Math.max(20, Math.round(s.maxHealth * 0.90));
            s.health = Math.min(s.health, s.maxHealth);
        }
    };

    // -------------------------------------------------------
    // 3. FEATURE STATE  (shared mutable state used by patches)
    // -------------------------------------------------------
    const FX = {
        state: null,
        dom: {},
        ready: false,

        resetState() {
            this.state = {
                // Stats with multipliers
                maxHealth: FEATURE.BASE_MAX_HEALTH,
                health:    FEATURE.BASE_MAX_HEALTH,
                maxEnergy: FEATURE.BASE_MAX_ENERGY,
                energyRegenMul: 1.0,
                damageReduction: 0.0,          // 0..0.85
                sonicDamageMul: 1.0,
                supersonicDamageMul: 1.0,
                supersonicCooldownMul: 1.0,

                // Shield
                shieldActive: false,
                shieldHealth: 0,
                shieldMaxHealth: 0,
                shieldCapMul: 1.0,
                shieldHitFlashTimer: 0,        // in update ticks

                // Supersonic
                supersonicCooldownLeft: 0,     // ms remaining
                supersonicReady: true,

                // Boss spawn override
                customMainBossTimer: 0,        // ms
                warningActive: false,
                warningTimer: 0,
                warningTriggered: false,       // for the current cycle
                bossDeathPauseTimer: 0,        // freeze gameplay after main boss dies

                // Level-up
                level: 1,
                nextLevelAt: FEATURE.LEVEL_UP_STEP,
                levelUpPending: false,

                // Death animation
                deathBlinkTimer: 0,            // ms remaining
                deathPhase: 'none',            // 'none' | 'blinking' | 'fade-in' | 'fade-out' | 'done'
                deathFadeTimer: 0,

                // Shield pack collectibles
                shieldPacks: [],

                // HUD value animations (smooth display)
                displayedHealth: FEATURE.BASE_MAX_HEALTH,
                displayedEnergy: FEATURE.BASE_MAX_ENERGY,
                displayedShield: 0,
            };
        },

        activateShield() {
            const s = this.state;
            s.shieldMaxHealth = Math.round(s.maxHealth * FEATURE.SHIELD_RATIO * s.shieldCapMul);
            s.shieldHealth = s.shieldMaxHealth;
            s.shieldActive = true;
        }
    };

    // -------------------------------------------------------
    // 4. INIT & DOM HOOKS  (run on DOMContentLoaded - before main.js Game.start)
    // -------------------------------------------------------
    function initFeatures() {
        if (FX.ready) return;
        FX.dom = {
            healthFill:   document.getElementById('health-fill'),
            energyFill:   document.getElementById('energy-fill'),
            shieldFill:   document.getElementById('shield-fill'),
            healthValue:  document.getElementById('health-value'),
            energyValue:  document.getElementById('energy-value'),
            shieldValue:  document.getElementById('shield-value'),
            shieldGroup:  document.getElementById('shield-bar-group'),

            supersonicBtn: document.getElementById('btn-supersonic'),
            supersonicCD:  document.getElementById('supersonic-cooldown'),

            dangerOverlay: document.getElementById('danger-warning'),
            deathFade:     document.getElementById('death-fade'),

            levelUpOverlay: document.getElementById('levelup-overlay'),
            levelUpCards:   document.getElementById('levelup-cards'),
            levelUpSub:     document.getElementById('levelup-subtitle'),

            levelCounter: document.getElementById('level-counter')
        };

        FX.resetState();
        buildCardRegistry();
        setupSupersonicButton();
        FX.ready = true;
    }

    // Run on DOM ready (before main.js triggers Game.start)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFeatures);
    } else {
        initFeatures();
    }

    // -------------------------------------------------------
    // 5. SUPERSONIC BUTTON
    // -------------------------------------------------------
    function setupSupersonicButton() {
        const btn = FX.dom.supersonicBtn;
        if (!btn) return;
        const fire = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            tryFireSupersonic();
        };
        btn.addEventListener('click', fire);
        btn.addEventListener('touchstart', fire, { passive: false });

        // keyboard shortcut
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyG' && Game.state === 'playing') {
                tryFireSupersonic();
            }
        });
    }

    function tryFireSupersonic() {
        const s = FX.state;
        if (!s) return;
        if (Game.state !== 'playing') return;
        if (s.supersonicCooldownLeft > 0) return;
        if (Game.energy < FEATURE.SUPERSONIC_THRESHOLD) return;

        // Consume energy
        Game.energy = Math.max(0, Game.energy - FEATURE.SUPERSONIC_ENERGY_COST);

        // Create supersonic wave: 4x larger, 3x damage, 1/4 speed
        const p = Game.player;
        if (!p) return;
        const dir = p.facingRight ? 1 : -1;
        const baseW = (typeof CONFIG !== 'undefined') ? CONFIG.SONIC_WAVE_WIDTH : 25;
        const baseH = (typeof CONFIG !== 'undefined') ? CONFIG.SONIC_WAVE_HEIGHT : 25;
        const baseSpd = (typeof CONFIG !== 'undefined') ? CONFIG.SONIC_WAVE_SPEED : 14;
        const w = baseW * FEATURE.SUPERSONIC_SIZE_MUL;
        const h = baseH * FEATURE.SUPERSONIC_SIZE_MUL;
        const speed = baseSpd / FEATURE.SUPERSONIC_SPEED_DIV;

        Game.sonicWaves.push({
            x: p.x + (p.facingRight ? p.w : -w),
            y: p.y + p.h * 0.35 - (h - baseH) * 0.5,
            w: w, h: h,
            vx: speed * dir,
            life: 280,                         // longer life because slower
            dir: dir,
            isSupersonic: true,
            damage: (Game.sonicDamage || 1) * FEATURE.SUPERSONIC_DAMAGE_MUL * s.supersonicDamageMul
        });

        // Start cooldown
        s.supersonicCooldownLeft = FEATURE.SUPERSONIC_COOLDOWN_MS * s.supersonicCooldownMul;

        if (typeof AudioManager !== 'undefined') AudioManager.play('victory');
    }

    function updateSupersonicUI(dt) {
        const s = FX.state;
        const btn = FX.dom.supersonicBtn;
        const cdEl = FX.dom.supersonicCD;
        if (!btn || !s) return;

        if (s.supersonicCooldownLeft > 0) {
            s.supersonicCooldownLeft = Math.max(0, s.supersonicCooldownLeft - dt);
            btn.disabled = true;
            btn.classList.remove('ready');
            cdEl.textContent = Math.ceil(s.supersonicCooldownLeft / 1000) + 's';
        } else {
            const energyReady = Game.energy >= FEATURE.SUPERSONIC_THRESHOLD;
            btn.disabled = !energyReady;
            btn.classList.toggle('ready', energyReady);
            cdEl.textContent = '';
        }
    }

    // -------------------------------------------------------
    // 6. SHIELD COLLECTIBLE - spawn + render + collection
    // -------------------------------------------------------
    function maybeSpawnShieldPackForSegment(segStart, platW, mainTop) {
        if (Math.random() < FEATURE.SHIELD_PACK_SPAWN_CHANCE) {
            FX.state.shieldPacks.push({
                x: segStart + platW * (0.25 + Math.random() * 0.5),
                y: mainTop - 55,
                size: FEATURE.SHIELD_PACK_SIZE,
                collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }
    }

    function updateShieldPacks() {
        if (!Game.player || !FX.state) return;
        const p = Game.player;
        const packs = FX.state.shieldPacks;
        for (const sp of packs) {
            if (!sp.collected && Game.circleRectOverlap(sp.x, sp.y, sp.size / 2, p)) {
                sp.collected = true;
                FX.activateShield();
                Game.spawnParticles(sp.x, sp.y, '#5bf9f8', 8);
                if (typeof AudioManager !== 'undefined') AudioManager.play('click');
            }
        }
        // cleanup off-screen / collected
        const cleanX = Game.cameraX - Game.vw;
        FX.state.shieldPacks = packs.filter(sp => !sp.collected && sp.x > cleanX);
    }

    function drawShieldPack(ctx, x, y, size) {
        const glow = Math.sin(Game.animFrame * 0.08 + 3) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = '#5bf9f8';
        ctx.shadowBlur = 14 * glow;
        // Shield body
        ctx.fillStyle = '#5bf9f8';
        ctx.beginPath();
        const s = size * 0.5;
        ctx.moveTo(x, y - s);
        ctx.bezierCurveTo(x + s, y - s, x + s, y + s * 0.2, x, y + s);
        ctx.bezierCurveTo(x - s, y + s * 0.2, x - s, y - s, x, y - s);
        ctx.closePath();
        ctx.fill();
        // Inner highlight
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x - s * 0.15, y - s * 0.15, s * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Cross emblem
        ctx.strokeStyle = '#0a3a3a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x, y + s * 0.4);
        ctx.moveTo(x - s * 0.35, y); ctx.lineTo(x + s * 0.35, y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // -------------------------------------------------------
    // 7. SHIELD OVERLAY around the player
    // -------------------------------------------------------
    function drawShieldOverlay(ctx) {
        const s = FX.state;
        if (!s || !s.shieldActive || !Game.player) return;
        const p = Game.player;
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const radius = Math.max(p.w, p.h) * 0.78;

        // Base opacity is low - middle is very transparent so character is clearly visible
        let baseAlpha = 0.10;
        // Hit flash: temporarily increase opacity
        if (s.shieldHitFlashTimer > 0) {
            const t = s.shieldHitFlashTimer / 30; // 30 ticks
            baseAlpha = 0.10 + 0.55 * t;
        }

        ctx.save();
        // Outer (sides) ring is more pronounced - we achieve "more opaque on left/right"
        // using an elliptical radial gradient stretched horizontally.
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
        grad.addColorStop(0.00, `rgba(91, 249, 248, ${baseAlpha * 0.15})`);   // middle: very transparent
        grad.addColorStop(0.55, `rgba(91, 249, 248, ${baseAlpha * 0.55})`);
        grad.addColorStop(0.90, `rgba(91, 249, 248, ${baseAlpha * 1.5})`);    // outer: more pronounced
        grad.addColorStop(1.00, `rgba(91, 249, 248, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.05, radius * 1.10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Side accents (left & right) - subtle vertical bands of slightly higher opacity
        const sideAlpha = baseAlpha * 1.4;
        const sideGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
        sideGrad.addColorStop(0.00, `rgba(91, 249, 248, ${sideAlpha})`);
        sideGrad.addColorStop(0.50, `rgba(91, 249, 248, 0)`);
        sideGrad.addColorStop(1.00, `rgba(91, 249, 248, ${sideAlpha})`);
        ctx.fillStyle = sideGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.05, radius * 1.10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (s.shieldHitFlashTimer > 0) s.shieldHitFlashTimer--;
    }

    // -------------------------------------------------------
    // 8. PATCH: Game.startGame  -> reset all feature state
    // -------------------------------------------------------
    const _startGame = Game.startGame.bind(Game);
    Game.startGame = function () {
        _startGame();
        FX.resetState();
        // Sync Game's working values with our maxes (kept in [0..max])
        Game.health = FX.state.maxHealth;
        Game.energy = FX.state.maxEnergy;
        // Reset boss spawn timer & disable old in-engine system by using huge interval
        Game.mainBossSpawnTimer = 0;
        Game.miniBossSpawnTimer = 0;
        FX.state.customMainBossTimer = 0;
        // Hide overlays
        FX.dom.shieldGroup.style.display = 'none';
        FX.dom.dangerOverlay.classList.remove('active');
        FX.dom.deathFade.classList.remove('fade-in', 'fade-out');
        FX.dom.levelUpOverlay.classList.remove('active');
        // Reset level display
        if (FX.dom.levelCounter) FX.dom.levelCounter.textContent = 'LV.1';
        // Reset supersonic button
        FX.dom.supersonicBtn.disabled = true;
        FX.dom.supersonicBtn.classList.remove('ready');
        FX.dom.supersonicCD.textContent = '';
    };

    // -------------------------------------------------------
    // 9. PATCH: Game.spawnBoss  -> override main boss interval
    //    The original engine uses CONFIG.MAIN_BOSS_SPAWN_INTERVAL (120 s).
    //    We override the main-boss timer with our 2:30 timing AND inject
    //    the 5-second-lead warning sequence.
    //    Mini-bosses still spawn via the original 40s timer.
    // -------------------------------------------------------
    // Suppress the engine's automatic main-boss spawns by intercepting spawnBoss
    // We'll let mini-boss spawnBoss(false) calls through, but ignore engine-driven main
    // boss spawns and instead drive them ourselves through customMainBossTimer.
    // Strategy: hook update() AFTER the engine runs to fix mainBossSpawnTimer drift
    // and drive our own warning + spawn.

    function tickMainBossSchedule(dt) {
        const s = FX.state;
        if (!s) return;
        // Engine's mainBossSpawnTimer accumulates with dt; if it reaches the engine's
        // threshold (120000 ms), engine will spawn. We want 150000 ms.
        // Simplest: keep it BELOW the engine threshold permanently by clamping it,
        // and use our own timer to schedule.
        if (Game.mainBossSpawnTimer > 100000) Game.mainBossSpawnTimer = 0;

        if (Game.state !== 'playing') return;
        s.customMainBossTimer += dt;

        const warningStart = FEATURE.MAIN_BOSS_INTERVAL_MS - FEATURE.WARNING_LEAD_MS;
        const warningEnd   = warningStart + FEATURE.WARNING_DURATION_MS;
        // Trigger warning sequence
        if (!s.warningTriggered && s.customMainBossTimer >= warningStart) {
            s.warningTriggered = true;
            s.warningActive = true;
            s.warningTimer = FEATURE.WARNING_DURATION_MS;
            FX.dom.dangerOverlay.classList.add('active');
        }

        // Update warning countdown
        if (s.warningActive) {
            s.warningTimer -= dt;
            if (s.warningTimer <= 0) {
                s.warningActive = false;
                FX.dom.dangerOverlay.classList.remove('active');
            }
        }

        // Spawn main boss at interval and reset
        if (s.customMainBossTimer >= FEATURE.MAIN_BOSS_INTERVAL_MS) {
            s.customMainBossTimer = 0;
            s.warningTriggered = false;
            Game.spawnBoss(true); // engine-defined main boss spawn
        }
    }

    // -------------------------------------------------------
    // 10. PATCH: Game.playerHit  -> route damage through shield + reduction
    // -------------------------------------------------------
    const _playerHit = Game.playerHit.bind(Game);
    Game.playerHit = function (damage) {
        const s = FX.state;
        if (!s || !Game.player) { _playerHit(damage); return; }
        if (Game.player.invincible) return;

        // Apply permanent damage reduction
        let dmg = damage * (1 - s.damageReduction);

        // Shield absorbs first
        if (s.shieldActive && s.shieldHealth > 0) {
            const absorbed = Math.min(s.shieldHealth, dmg);
            s.shieldHealth -= absorbed;
            dmg -= absorbed;
            s.shieldHitFlashTimer = 30; // ~0.5s flash
            // Particles for shield impact
            Game.spawnParticles(Game.player.x + Game.player.w / 2, Game.player.y + Game.player.h / 2, '#5bf9f8', 10);
            if (s.shieldHealth <= 0) {
                s.shieldActive = false;
                s.shieldHealth = 0;
                Game.spawnParticles(Game.player.x + Game.player.w / 2, Game.player.y + Game.player.h / 2, '#5bf9f8', 18);
            }
        }

        if (dmg > 0) {
            Game.health = Math.max(0, Game.health - dmg);
            Game.player.invincible = true;
            Game.player.invTimer = 60;
            Game.spawnParticles(Game.player.x + Game.player.w / 2, Game.player.y + Game.player.h / 2, '#ff2244', 6);
            if (Game.health <= 0) {
                Game.health = 0;
                triggerPlayerDeathSequence();
            }
        } else {
            // Even if fully absorbed, give brief i-frames so the player isn't combo-stunlocked
            Game.player.invincible = true;
            Game.player.invTimer = 30;
        }
    };

    // -------------------------------------------------------
    // 11. PATCH: Game.gameOver - we hijack it so death animation plays FIRST
    // -------------------------------------------------------
    const _gameOver = Game.gameOver.bind(Game);
    Game.gameOver = function () {
        if (FX.state && FX.state.deathPhase === 'none') {
            triggerPlayerDeathSequence();
            return; // suppress immediate game-over screen; we trigger it after fade
        }
        _gameOver();
    };

    function triggerPlayerDeathSequence() {
        const s = FX.state;
        if (!s || s.deathPhase !== 'none') return;
        s.deathPhase = 'blinking';
        s.deathBlinkTimer = FEATURE.DEATH_BLINK_MS;
        // Freeze gameplay
        Game.state = 'paused';
        if (typeof AudioManager !== 'undefined') {
            AudioManager.pauseMusic();
        }
    }

    function updateDeathSequence(dt) {
        const s = FX.state;
        if (!s) return;

        if (s.deathPhase === 'blinking') {
            s.deathBlinkTimer -= dt;
            if (s.deathBlinkTimer <= 0) {
                s.deathPhase = 'fade-in';
                FX.dom.deathFade.classList.add('fade-in');
                s.deathFadeTimer = FEATURE.DEATH_FADE_MS;
            }
        } else if (s.deathPhase === 'fade-in') {
            s.deathFadeTimer -= dt;
            if (s.deathFadeTimer <= 0) {
                // Show game over screen and start fading back out
                s.deathPhase = 'fade-out';
                s.deathFadeTimer = FEATURE.DEATH_FADE_MS;
                // call original gameOver to show screen (sets state='gameover', shows screen)
                _gameOver();
                // start fade-out from white
                FX.dom.deathFade.classList.remove('fade-in');
                FX.dom.deathFade.classList.add('fade-out');
            }
        } else if (s.deathPhase === 'fade-out') {
            s.deathFadeTimer -= dt;
            if (s.deathFadeTimer <= 0) {
                s.deathPhase = 'done';
                FX.dom.deathFade.classList.remove('fade-out');
                FX.dom.deathFade.classList.remove('fade-in');
            }
        }
    }

    // Track bosses being defeated for blink + main boss pause
    function trackBossDeaths(dt) {
        const s = FX.state;
        if (!s) return;
        // Apply blink animation: any boss with hitFlash works for blinking visual already.
        // We add a custom "dying" timer to bosses just-killed.
        for (const b of Game.bosses) {
            if (!b.alive && !b._deathHandled) {
                b._deathHandled = true;
                b._dyingTimer = FEATURE.DEATH_BLINK_MS;   // 3s blink
                if (b.isMainBoss) {
                    s.bossDeathPauseTimer = FEATURE.MAIN_BOSS_DEATH_PAUSE_MS;
                }
            }
        }
        // Tick boss death pause
        if (s.bossDeathPauseTimer > 0) {
            s.bossDeathPauseTimer -= dt;
            // Pause game flow during this window (dim + freeze)
            if (s.bossDeathPauseTimer > 0 && Game.state === 'playing') {
                Game._mainBossDeathPause = true;
                Game.state = 'paused';
            } else if (s.bossDeathPauseTimer <= 0 && Game._mainBossDeathPause) {
                Game._mainBossDeathPause = false;
                Game.state = 'playing';
            }
        }
        // Tick boss dying timers (visual blink only)
        for (const b of Game.bosses) {
            if (b._dyingTimer != null && b._dyingTimer > 0) {
                b._dyingTimer -= dt;
            }
        }
    }

    // -------------------------------------------------------
    // 12. LEVEL-UP SYSTEM
    // -------------------------------------------------------
    function checkLevelUp() {
        const s = FX.state;
        if (!s || s.levelUpPending) return;
        if (Game.points >= s.nextLevelAt) {
            s.levelUpPending = true;
            s.level += 1;
            s.nextLevelAt += FEATURE.LEVEL_UP_STEP;
            showLevelUpCards();
        }
        if (FX.dom.levelCounter) FX.dom.levelCounter.textContent = 'LV.' + s.level;
        // Sync to Game.playerLevel so existing HUD updateHUD path keeps showing it
        Game.playerLevel = s.level;
    }

    function pickRandomCardFromCategory(cat) {
        const pool = CARD_REGISTRY.filter(c => c.category === cat);
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function pickThreeCards() {
        // Strict anti-duplication: three DIFFERENT categories
        const cats = ['A', 'B', 'C', 'D'];
        // Shuffle
        for (let i = cats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cats[i], cats[j]] = [cats[j], cats[i]];
        }
        const chosen = cats.slice(0, 3);
        return chosen.map(c => pickRandomCardFromCategory(c));
    }

    function showLevelUpCards() {
        const overlay = FX.dom.levelUpOverlay;
        const container = FX.dom.levelUpCards;
        if (!overlay || !container) return;
        container.innerHTML = '';
        const cards = pickThreeCards();
        FX.dom.levelUpSub.textContent = 'LEVEL ' + FX.state.level + '  ·  CHOOSE YOUR UPGRADE';

        cards.forEach(card => {
            const el = document.createElement('div');
            el.className = 'upgrade-card cat-' + card.category;
            el.dataset.cardId = card.id;
            el.style.color = card.accent;
            el.innerHTML = `
                <div class="card-icon" style="color:${card.accent}">${card.icon}</div>
                <div class="card-cat">CATEGORY ${card.category}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-desc">${card.desc}</div>
                <div class="card-pick">PICK</div>
            `;
            const choose = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                applyCard(card);
            };
            el.addEventListener('click', choose);
            el.addEventListener('touchend', choose, { passive: false });
            container.appendChild(el);
        });
        overlay.classList.add('active');
        // Pause game during selection
        Game._levelUpPaused = true;
        if (Game.state === 'playing') Game.state = 'paused';
        if (typeof AudioManager !== 'undefined') {
            AudioManager.pauseMusic();
            AudioManager.play('victory');
        }
    }

    function applyCard(card) {
        if (!card || !card.apply) return;
        card.apply();
        // Make sure health & energy don't exceed new caps
        const s = FX.state;
        Game.health = Math.min(s.maxHealth, Game.health);
        Game.energy = Math.min(s.maxEnergy, Game.energy);

        FX.dom.levelUpOverlay.classList.remove('active');
        s.levelUpPending = false;
        Game._levelUpPaused = false;
        if (Game.state === 'paused' && FX.state.deathPhase === 'none' && FX.state.bossDeathPauseTimer <= 0) {
            Game.state = 'playing';
            if (typeof AudioManager !== 'undefined') AudioManager.resumeMusic();
        }
        if (typeof AudioManager !== 'undefined') AudioManager.play('click');
    }

    // Disable the engine's legacy automatic level-up bonus by neutralizing it
    // each frame (it modifies sonicDamage / levelUpAnim / playerLevel automatically).
    function neutralizeLegacyLevelUp() {
        // Suppress the in-game LEVEL UP text animation
        Game.levelUpAnim = null;
        // Reset sonicDamage to baseline (we use multipliers from cards instead)
        const s = FX.state;
        if (s) {
            Game.sonicDamage = 1 * s.sonicDamageMul;
            Game.playerLevel = s.level;
        }
    }

    // -------------------------------------------------------
    // 13. PATCH: Game.update  -> wrap with our hooks
    // -------------------------------------------------------
    const _update = Game.update.bind(Game);
    Game.update = function (dt) {
        // If level-up modal is open, freeze the game state
        if (Game._levelUpPaused || (FX.state && FX.state.deathPhase !== 'none' && FX.state.deathPhase !== 'done')) {
            // tick death sequence even when paused
            updateDeathSequence(dt);
            return;
        }
        if (Game._mainBossDeathPause) {
            // Tick blink timers + spawn timer pause; game frozen
            trackBossDeaths(dt);
            return;
        }

        // Apply energy regen multiplier  ---  the engine adds ENERGY_REGEN_RATE every update.
        // Pre-bump energy by the EXTRA amount so total regen = base * mul.
        if (FX.state && FX.state.energyRegenMul !== 1.0 && Game.state === 'playing') {
            const extra = CONFIG.ENERGY_REGEN_RATE * (FX.state.energyRegenMul - 1.0);
            Game.energy = Math.min(FX.state.maxEnergy, Game.energy + extra);
        }

        // Apply sonic damage multiplier just before the original update consumes Game.sonicDamage
        if (FX.state) Game.sonicDamage = 1 * FX.state.sonicDamageMul;

        // ---- Pull SUPERSONIC waves OUT of the array so the engine doesn't process them.
        //      We handle their physics + collisions ourselves below, with the proper damage.
        const ssWaves = [];
        if (Game.sonicWaves && Game.sonicWaves.length) {
            const remaining = [];
            for (const w of Game.sonicWaves) {
                if (w.isSupersonic) ssWaves.push(w);
                else remaining.push(w);
            }
            Game.sonicWaves = remaining;
        }

        // Process supersonic waves manually (pierce-through, custom damage)
        if (Game.state === 'playing') processSupersonicWaves(ssWaves);

        _update(dt);

        // Restore surviving supersonic waves so they keep rendering next frame
        for (const w of ssWaves) {
            if (w.life > 0 && w.x > Game.cameraX - 300 && w.x < Game.cameraX + Game.vw + 300) {
                Game.sonicWaves.push(w);
            }
        }

        // Clamp Game.health / energy to new caps
        if (FX.state) {
            if (Game.health > FX.state.maxHealth) Game.health = FX.state.maxHealth;
            if (Game.energy > FX.state.maxEnergy) Game.energy = FX.state.maxEnergy;
        }

        // Our extensions: only tick game-progress logic while truly playing
        neutralizeLegacyLevelUp();
        if (Game.state === 'playing') {
            tickMainBossSchedule(dt);
            updateShieldPacks();
            checkLevelUp();
        }
        trackBossDeaths(dt);
        updateSupersonicUI(dt);
        updateDeathSequence(dt);
    };

    // -------------------------------------------------------
    // 14. PATCH: Game.generateSegment  -> add shield pack spawn
    // -------------------------------------------------------
    const _generateSegment = Game.generateSegment.bind(Game);
    Game.generateSegment = function () {
        const segStart = this.worldEndX;
        const mainTop = this.mainPlatTop;
        const _segIdx = this.segmentIndex;
        _generateSegment();
        // Spawn shield pack on main platform area (use computed last segment)
        if (_segIdx > 0) {
            // Find platW used in this segment
            const pmImg = ImageSizes['platform_main.png'];
            const imgRatio = pmImg ? (pmImg.w / pmImg.h) : (1920 / 300);
            const platW = PLAT_MAIN_H * imgRatio;
            maybeSpawnShieldPackForSegment(segStart, platW, mainTop);
        }
    };

    // -------------------------------------------------------
    // 15. PATCH: Game.render  -> draw shield pack, shield overlay, blink, supersonic wave
    // -------------------------------------------------------
    function drawSupersonicWave(ctx, sw) {
        ctx.save();
        const cx = sw.x + sw.w / 2;
        const cy = sw.y + sw.h / 2;
        const lifeRef = 280;
        ctx.globalAlpha = Math.min(sw.life / lifeRef * 2, 1.0);
        // Outer red shockwave
        const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, sw.w * 0.55);
        outer.addColorStop(0,    'rgba(255, 255, 200, 0.75)');
        outer.addColorStop(0.25, 'rgba(255, 100, 60, 0.75)');
        outer.addColorStop(0.6,  'rgba(255, 34, 68, 0.55)');
        outer.addColorStop(1,    'rgba(180, 0, 30, 0)');
        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.ellipse(cx, cy, sw.w * 0.55, sw.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hot inner core
        const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, sw.w * 0.22);
        inner.addColorStop(0,    'rgba(255, 255, 255, 0.95)');
        inner.addColorStop(0.55, 'rgba(255, 200, 60, 0.6)');
        inner.addColorStop(1,    'rgba(255, 100, 0, 0)');
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.ellipse(cx, cy, sw.w * 0.22, sw.h * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Lightning rings
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, sw.w * 0.45, sw.h * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    const _render = Game.render.bind(Game);
    Game.render = function () {
        _render();

        // After original render, we draw additional layers in world space (need camera transform)
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(-this.cameraX, 0);

        // Shield packs
        if (FX.state) {
            for (const sp of FX.state.shieldPacks) {
                if (sp.collected) continue;
                const bob = Math.sin(this.animFrame * 0.05 + sp.bobOffset) * 6;
                drawShieldPack(ctx, sp.x, sp.y + bob, sp.size);
            }
        }

        // Draw supersonic waves (custom visual)
        for (const w of Game.sonicWaves) {
            if (w.isSupersonic) drawSupersonicWave(ctx, w);
        }

        // Shield overlay on player (only when active)
        drawShieldOverlay(ctx);

        // Boss blink-on-death visual (apply blink overlay onto dying bosses by redrawing flash)
        for (const b of Game.bosses) {
            if (!b.alive && b._dyingTimer != null && b._dyingTimer > 0) {
                // Pulse a bright rectangle blink over the boss location
                const blink = Math.floor(b._dyingTimer / 100) % 2 === 0;
                if (blink) {
                    ctx.save();
                    ctx.globalAlpha = 0.6;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(b.x, b.y, b.w, b.h);
                    ctx.restore();
                }
            }
        }

        ctx.restore();

        // Player blink on dying (screen-space, after restore)
        if (FX.state && FX.state.deathPhase === 'blinking' && Game.player) {
            const t = FX.state.deathBlinkTimer;
            const blink = Math.floor(t / 120) % 2 === 0;
            if (blink) {
                ctx.save();
                ctx.translate(-this.cameraX, 0);
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(Game.player.x, Game.player.y, Game.player.w, Game.player.h);
                ctx.restore();
            }
        }

        // Main-boss-death screen dim (similar to pause)
        if (FX.state && FX.state.bossDeathPauseTimer > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(0, 0, this.vw, this.vh);
            ctx.restore();
        }
    };

    // -------------------------------------------------------
    // 16. PATCH: UI.updateHUD -> drive numerical sub-texts, shield bar visibility
    // -------------------------------------------------------
    const _updateHUD = UI.updateHUD.bind(UI);
    UI.updateHUD = function (health, energy, points, gameTimer, highScore) {
        const s = FX.state;
        if (!s) { _updateHUD(health, energy, points, gameTimer, highScore); return; }

        // Recompute bar widths in % relative to OUR maxes (not the engine's hard-coded 100)
        const hPct = Math.max(0, Math.min(100, (Game.health / s.maxHealth) * 100));
        const ePct = Math.max(0, Math.min(100, (Game.energy / s.maxEnergy) * 100));

        // Call original (sets things like points, timer, level counter, highscore)
        _updateHUD(hPct, ePct, points, gameTimer, highScore);

        // Override level counter to OUR level (since we suppress engine's playerLevel)
        FX.dom.levelCounter.textContent = 'LV.' + s.level;

        // Animate displayed numerical values smoothly
        s.displayedHealth = smoothToward(s.displayedHealth, Game.health, 0.25);
        s.displayedEnergy = smoothToward(s.displayedEnergy, Game.energy, 0.25);
        s.displayedShield = smoothToward(s.displayedShield, s.shieldHealth, 0.25);
        FX.dom.healthValue.textContent = Math.round(s.displayedHealth) + ' / ' + s.maxHealth;
        FX.dom.energyValue.textContent = Math.round(s.displayedEnergy) + ' / ' + s.maxEnergy;

        // Shield bar visibility
        if (s.shieldActive && s.shieldHealth > 0) {
            FX.dom.shieldGroup.style.display = '';
            const sPct = Math.max(0, Math.min(100, (s.shieldHealth / s.shieldMaxHealth) * 100));
            FX.dom.shieldFill.style.width = sPct + '%';
            FX.dom.shieldValue.textContent = Math.round(s.displayedShield) + ' / ' + s.shieldMaxHealth;
        } else {
            FX.dom.shieldGroup.style.display = 'none';
        }

        // Bump visual on change
        bumpIfChanged(FX.dom.healthValue, Math.round(s.displayedHealth));
        bumpIfChanged(FX.dom.energyValue, Math.round(s.displayedEnergy));
        bumpIfChanged(FX.dom.shieldValue, Math.round(s.displayedShield));
    };

    function smoothToward(curr, target, t) {
        return curr + (target - curr) * t;
    }

    const _lastVals = {};
    function bumpIfChanged(el, val) {
        if (!el) return;
        if (_lastVals[el.id] !== val) {
            _lastVals[el.id] = val;
            el.classList.remove('bump');
            // restart animation
            void el.offsetWidth;
            el.classList.add('bump');
            setTimeout(() => el.classList.remove('bump'), 180);
        }
    }

    // -------------------------------------------------------
    // 17. SUPERSONIC wave processor (pierce-through, custom dmg)
    // -------------------------------------------------------
    function processSupersonicWaves(ssWaves) {
        for (const w of ssWaves) {
            w.x += w.vx;
            w.life--;
            if (w.life <= 0) continue;
            if (w.x < Game.cameraX - 400 || w.x > Game.cameraX + Game.vw + 400) {
                w.life = 0;
                continue;
            }
            if (!w._hitSet) w._hitSet = new Set();

            // Damage normal enemies (instant-kill, pierce - one hit per enemy)
            for (const e of Game.enemies) {
                if (e.alive && !w._hitSet.has(e) && Game.rectsOverlap(w, e)) {
                    w._hitSet.add(e);
                    e.alive = false;
                    Game.points += 25;
                    Game.spawnParticles(e.x + e.w / 2, e.y, '#ff3344', 12);
                    if (typeof AudioManager !== 'undefined') AudioManager.play('click');
                }
            }
            // Damage flying enemies
            for (const fe of Game.flyingEnemies) {
                if (fe.alive && !w._hitSet.has(fe) && Game.rectsOverlap(w, fe)) {
                    w._hitSet.add(fe);
                    fe.alive = false;
                    Game.points += 30;
                    Game.spawnParticles(fe.x + fe.w / 2, fe.y, '#ff3344', 12);
                    if (typeof AudioManager !== 'undefined') AudioManager.play('click');
                }
            }
            // Damage bosses (one-hit-per-boss per wave; wave pierces through)
            for (const b of Game.bosses) {
                if (b.alive && !w._hitSet.has(b) && Game.rectsOverlap(w, b)) {
                    w._hitSet.add(b);
                    b.health -= (w.damage != null ? w.damage : 3);
                    b.hitFlash = 10;
                    Game.spawnParticles(b.x + b.w / 2, b.y, '#ff3344', 18);
                    if (typeof AudioManager !== 'undefined') AudioManager.play('click');
                    if (b.health <= 0) {
                        b.alive = false;
                        Game.bossesDefeated++;
                        Game.points += b.isMainBoss ? 500 : 200;
                        Game.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffcc00', b.isMainBoss ? 35 : 20);
                        if (typeof AudioManager !== 'undefined') AudioManager.play('victory');
                    }
                }
            }
        }
    }

    // -------------------------------------------------------
    // 18. Tweak invincibility window on shield hits so player isn't stunlocked
    // -------------------------------------------------------
    // (already handled in playerHit patch)

    // Expose for debugging (optional)
    window.NeoRoboFX = { FEATURE, FX, CARD_REGISTRY };

    console.log('🛡 NEO-ROBO features extension loaded (shield, supersonic, danger, cards, death FX)');
})();
