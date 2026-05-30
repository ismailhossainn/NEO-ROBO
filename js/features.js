/* ==========================================================
   NEO-ROBO - FEATURES (Additive Layer)
   - Shield collectible + bar + bubble overlay
   - Numerical bar indicators with smooth pulse animation
   - Supersonic button & wave (4x size, 3x dmg, 1/4 speed, 30s CD)
   - Boss main spawn @ 2:30, DANGER warning sequence
   - Boss & player blinking death; player fade-in/out
   - Disable legacy auto level-up; new 500-point card system
   This file does NOT modify any existing source files.
   ========================================================== */

(function () {
    'use strict';

    // ---------------------------------------------------------
    // 1. CONFIG OVERRIDES (applied immediately so engine uses them)
    // ---------------------------------------------------------
    // Disable legacy auto level-up: original check is points / LEVEL_UP_POINTS
    CONFIG.LEVEL_UP_POINTS = Number.MAX_SAFE_INTEGER;
    // Main boss every 2 minutes 30 seconds
    CONFIG.MAIN_BOSS_SPAWN_INTERVAL = 150000;

    // ---------------------------------------------------------
    // 2. CARD REGISTRY (centralized & easy to modify)
    //    Each card has: id, category, name, desc, icon, apply(features, game)
    // ---------------------------------------------------------
    const CARD_REGISTRY = [
        // ---------- Category A — Health Cards ----------
        {
            id: 'A1', category: 'A', name: 'Health Refill', icon: '❤',
            desc: "Instantly restores 50% of the player's current health pool.",
            apply: (F, G) => {
                G.health = Math.min(F.maxHealth, G.health + F.maxHealth * 0.5);
            }
        },
        {
            id: 'A2', category: 'A', name: 'Increased Health Capacity',
            icon: '❤', desc: 'Permanently increases Health Capacity by 10%.',
            apply: (F, G) => {
                const oldMax = F.maxHealth;
                F.maxHealth = Math.round(F.maxHealth * 1.10);
                G.health += (F.maxHealth - oldMax); // keep relative fill
            }
        },
        {
            id: 'A3', category: 'A', name: 'Reinforced Health Core',
            icon: '❤',
            desc: 'Permanently increases Health Capacity by 30% and grants a permanent 10% damage reduction.',
            apply: (F, G) => {
                const oldMax = F.maxHealth;
                F.maxHealth = Math.round(F.maxHealth * 1.30);
                G.health += (F.maxHealth - oldMax);
                F.damageReduction = Math.min(0.9, F.damageReduction + 0.10);
            }
        },
        // ---------- Category B — Shield Cards ----------
        {
            id: 'B1', category: 'B', name: 'Basic Shield Activator',
            icon: '🛡',
            desc: 'Instantly deploys a standard protective shield around the player.',
            apply: (F, G) => {
                activateShield();
            }
        },
        {
            id: 'B2', category: 'B', name: 'Reinforced Shield',
            icon: '🛡',
            desc: 'Deploys a shield and increases Shield Health Capacity by 10%.',
            apply: (F, G) => {
                F.shieldCapacityMult = (F.shieldCapacityMult || 1.0) * 1.10;
                activateShield();
            }
        },
        {
            id: 'B3', category: 'B', name: 'Heavy Shield Matrix',
            icon: '🛡',
            desc: 'Deploys a shield, increases Shield Capacity by 30% and grants permanent 10% damage reduction.',
            apply: (F, G) => {
                F.shieldCapacityMult = (F.shieldCapacityMult || 1.0) * 1.30;
                F.damageReduction = Math.min(0.9, F.damageReduction + 0.10);
                activateShield();
            }
        },
        // ---------- Category C — Damage Cards ----------
        {
            id: 'C1', category: 'C', name: 'Sonic Power Surge',
            icon: '🌀',
            desc: 'Permanently increases Sonic Damage by 30%. Health Capacity reduced by 10%.',
            apply: (F, G) => {
                F.sonicDamageMult *= 1.30;
                const oldMax = F.maxHealth;
                F.maxHealth = Math.max(20, Math.round(F.maxHealth * 0.90));
                if (G.health > F.maxHealth) G.health = F.maxHealth;
            }
        },
        {
            id: 'C2', category: 'C', name: 'Supersonic Boost',
            icon: '💥',
            desc: 'Permanently increases Supersonic Damage by 10%.',
            apply: (F, G) => {
                F.superSonicDamageMult *= 1.10;
            }
        },
        {
            id: 'C3', category: 'C', name: 'Supersonic Overload',
            icon: '💥',
            desc: 'Permanently increases Supersonic Damage by 30%. Health Capacity reduced by 10%.',
            apply: (F, G) => {
                F.superSonicDamageMult *= 1.30;
                const oldMax = F.maxHealth;
                F.maxHealth = Math.max(20, Math.round(F.maxHealth * 0.90));
                if (G.health > F.maxHealth) G.health = F.maxHealth;
            }
        },
        {
            id: 'C4', category: 'C', name: 'Rapid Recharge',
            icon: '⏱',
            desc: 'Permanently reduces Supersonic Cooldown by 30%.',
            apply: (F, G) => {
                F.superSonicCooldown = Math.max(3000, Math.round(F.superSonicCooldown * 0.70));
            }
        },
        // ---------- Category D — Energy Cards ----------
        {
            id: 'D1', category: 'D', name: 'Increased Energy Capacity',
            icon: '⚡',
            desc: 'Permanently increases Energy Capacity by 10%.',
            apply: (F, G) => {
                const oldMax = F.maxEnergy;
                F.maxEnergy = Math.round(F.maxEnergy * 1.10);
                G.energy += (F.maxEnergy - oldMax);
            }
        },
        {
            id: 'D2', category: 'D', name: 'Expanded Energy Cells',
            icon: '⚡',
            desc: 'Permanently increases Energy Capacity by 30%. Health Capacity reduced by 10%.',
            apply: (F, G) => {
                const oldMaxE = F.maxEnergy;
                F.maxEnergy = Math.round(F.maxEnergy * 1.30);
                G.energy += (F.maxEnergy - oldMaxE);
                F.maxHealth = Math.max(20, Math.round(F.maxHealth * 0.90));
                if (G.health > F.maxHealth) G.health = F.maxHealth;
            }
        },
        {
            id: 'D3', category: 'D', name: 'Energy Refill Speed',
            icon: '⚡',
            desc: 'Permanently increases Energy regeneration speed by 10%.',
            apply: (F, G) => {
                F.energyRegenMult *= 1.10;
            }
        },
        {
            id: 'D4', category: 'D', name: 'Energy Refill Speed+',
            icon: '⚡',
            desc: 'Permanently increases Energy regen speed by 30%. Health Capacity reduced by 10%.',
            apply: (F, G) => {
                F.energyRegenMult *= 1.30;
                F.maxHealth = Math.max(20, Math.round(F.maxHealth * 0.90));
                if (G.health > F.maxHealth) G.health = F.maxHealth;
            }
        },
    ];

    // ---------------------------------------------------------
    // 3. FEATURE STATE
    // ---------------------------------------------------------
    const Features = {
        // Stats (player-controlled, NOT engine-auto)
        maxHealth: 100,
        maxEnergy: 100,
        damageReduction: 0,
        sonicDamageMult: 1.0,
        superSonicDamageMult: 1.0,
        energyRegenMult: 1.0,
        shieldCapacityMult: 1.0,

        // Shield
        shieldActive: false,
        shieldHealth: 0,
        shieldMaxHealth: 0,
        shieldHitFlash: 0,

        // Supersonic
        superSonicCooldown: 30000,
        superSonicCooldownTimer: 0,
        superSonicReady: true,
        superSonicEnergyThreshold: 70,  // requires 70+ energy

        // Level-up
        currentMilestone: 0,
        levelUpPending: false,

        // Boss death anim (overlay state)
        mainBossDying: false,
        mainBossDyingTimer: 0,
        mainBossDyingDuration: 2000,

        // Danger warning
        dangerActive: false,
        dangerTriggeredForCycle: false,
        dangerTimer: 0,
        dangerDuration: 3000,

        // Player death fade
        playerDying: false,
        playerDyingTimer: 0,
        playerDyingDuration: 3000,
        playerDeathCallbackFired: false,

        // Misc
        shieldSpawnTimer: 0,
        prevHealth: 100,
        prevEnergy: 100,
    };
    window.Features = Features;
    window.CARD_REGISTRY = CARD_REGISTRY;

    // ---------------------------------------------------------
    // 4. DOM HELPERS — create the additional HUD elements
    // ---------------------------------------------------------
    function ensureUIElements() {
        // Shield bar group + value labels + wrap structure
        // We're going to wrap existing health/energy bars with the bar-wrap so values fit below

        const hudLeft = document.getElementById('hud-top-left');
        if (!hudLeft) return;

        // Add Shield bar-group (only shows when active)
        if (!document.getElementById('shield-group')) {
            const shieldGroup = document.createElement('div');
            shieldGroup.className = 'hud-bar-group shield-group';
            shieldGroup.id = 'shield-group';
            shieldGroup.innerHTML = `
                <div class="hud-icon shield-icon float-anim">🛡</div>
                <div class="hud-bar-wrap">
                    <div class="hud-bar shield-bar" id="shield-bar-container">
                        <div id="shield-fill" class="bar-fill shield-fill"></div>
                    </div>
                    <div class="hud-bar-value shield-value" id="shield-value">0 / 0</div>
                </div>
            `;
            hudLeft.appendChild(shieldGroup);
        }

        // Wrap health/energy bars so numerical labels sit underneath
        wrapBarWithValue('health-fill', 'health-value', 'health-bar-wrap');
        wrapBarWithValue('energy-fill', 'energy-value', 'energy-bar-wrap');

        // Add Supersonic button above Sonic
        const controlsRight = document.getElementById('controls-right');
        if (controlsRight && !document.getElementById('btn-supersonic')) {
            // Find existing buttons
            const btnJump = document.getElementById('btn-jump');
            const btnSonic = document.getElementById('btn-sonic');

            // Build a stacked column for sonic + supersonic on the right side
            // We keep Jump button as-is (left in row), then a stack
            controlsRight.innerHTML = '';
            controlsRight.appendChild(btnJump);

            const stack = document.createElement('div');
            stack.className = 'sonic-stack';
            const supersonicBtn = document.createElement('button');
            supersonicBtn.id = 'btn-supersonic';
            supersonicBtn.className = 'control-btn action-btn supersonic-btn ready-pulse';
            supersonicBtn.innerHTML = `
                <span class="ss-symbol">✦</span>
                <span class="ss-label">SUPER</span>
                <span class="ss-cooldown" id="ss-cooldown-text">30</span>
            `;
            stack.appendChild(supersonicBtn);
            stack.appendChild(btnSonic);

            controlsRight.appendChild(stack);
        }

        // Danger overlay
        if (!document.getElementById('danger-overlay')) {
            const dangerOverlay = document.createElement('div');
            dangerOverlay.id = 'danger-overlay';
            dangerOverlay.innerHTML = `
                <div class="danger-dim"></div>
                <div class="danger-strip">
                    <div class="danger-text">DANGER</div>
                </div>
            `;
            document.getElementById('game-container').appendChild(dangerOverlay);
        }

        // Boss death dim overlay
        if (!document.getElementById('boss-death-dim')) {
            const bdd = document.createElement('div');
            bdd.id = 'boss-death-dim';
            document.getElementById('game-container').appendChild(bdd);
        }

        // Player death fade overlay (white)
        if (!document.getElementById('player-death-fade')) {
            const pdf = document.createElement('div');
            pdf.id = 'player-death-fade';
            document.getElementById('game-container').appendChild(pdf);
        }

        // Level-up overlay with cards
        if (!document.getElementById('levelup-overlay')) {
            const lvl = document.createElement('div');
            lvl.id = 'levelup-overlay';
            lvl.innerHTML = `
                <div class="levelup-panel">
                    <div class="levelup-title">LEVEL UP!</div>
                    <div class="levelup-sub" id="levelup-sub">CHOOSE YOUR UPGRADE</div>
                    <div class="levelup-cards" id="levelup-cards"></div>
                </div>
            `;
            document.getElementById('game-container').appendChild(lvl);
        }
    }

    // Wraps an existing bar element so its numerical value label is rendered below it.
    function wrapBarWithValue(fillId, valueClass, wrapId) {
        const fill = document.getElementById(fillId);
        if (!fill) return;
        const bar = fill.parentElement;          // .hud-bar
        const group = bar.parentElement;          // .hud-bar-group
        // If already wrapped, skip
        if (group.querySelector('.hud-bar-wrap')) return;

        const wrap = document.createElement('div');
        wrap.className = 'hud-bar-wrap';
        wrap.id = wrapId;
        // Replace bar with wrap > bar + value
        group.replaceChild(wrap, bar);
        wrap.appendChild(bar);
        const v = document.createElement('div');
        v.className = 'hud-bar-value ' + valueClass;
        v.id = fillId.replace('-fill', '-value');
        v.textContent = '0 / 0';
        wrap.appendChild(v);
    }

    // ---------------------------------------------------------
    // 5. SHIELD: activation + UI update
    // ---------------------------------------------------------
    function activateShield() {
        // Shield max = 1/3 of normal max health, scaled by shieldCapacityMult
        Features.shieldMaxHealth = Math.round((Features.maxHealth / 3) * Features.shieldCapacityMult);
        Features.shieldHealth = Features.shieldMaxHealth;
        Features.shieldActive = true;
        updateShieldUI();
    }

    function updateShieldUI() {
        const grp = document.getElementById('shield-group');
        if (!grp) return;
        if (Features.shieldActive && Features.shieldHealth > 0) {
            grp.classList.add('active');
            const fill = document.getElementById('shield-fill');
            const value = document.getElementById('shield-value');
            const pct = (Features.shieldHealth / Features.shieldMaxHealth) * 100;
            if (fill) fill.style.width = pct + '%';
            if (value) value.textContent =
                Math.max(0, Math.ceil(Features.shieldHealth)) + ' / ' + Features.shieldMaxHealth;
        } else {
            grp.classList.remove('active');
        }
    }

    // ---------------------------------------------------------
    // 6. SUPERSONIC button interactions
    // ---------------------------------------------------------
    function setupSupersonicButton() {
        const btn = document.getElementById('btn-supersonic');
        if (!btn) return;
        const fire = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            if (Game.state !== 'playing') return;
            if (!Features.superSonicReady) return;
            if (Game.energy < Features.superSonicEnergyThreshold) return;
            fireSupersonicWave();
        };
        btn.addEventListener('click', fire);
        btn.addEventListener('touchstart', fire, { passive: false });
        // Keyboard: G
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyG' && Game.state === 'playing') {
                if (Features.superSonicReady && Game.energy >= Features.superSonicEnergyThreshold) {
                    fireSupersonicWave();
                }
            }
        });
    }

    function fireSupersonicWave() {
        // Spend energy & start cooldown
        Game.energy = Math.max(0, Game.energy - Features.superSonicEnergyThreshold);
        Features.superSonicReady = false;
        Features.superSonicCooldownTimer = Features.superSonicCooldown;

        const p = Game.player;
        const dir = p.facingRight ? 1 : -1;
        const baseW = CONFIG.SONIC_WAVE_WIDTH;
        const baseH = CONFIG.SONIC_WAVE_HEIGHT;
        // 4x bigger
        const w = baseW * 4;
        const h = baseH * 4;
        // 1/4 speed
        const speed = CONFIG.SONIC_WAVE_SPEED * 0.25;

        if (!Game.superSonicWaves) Game.superSonicWaves = [];
        Game.superSonicWaves.push({
            x: p.x + (p.facingRight ? p.w : -w),
            y: p.y + p.h * 0.35 - (h - baseH) / 2,
            w: w, h: h,
            vx: speed * dir,
            life: 280,           // longer life since slower
            dir: dir,
            // damage handled at hit time
        });
        AudioManager.play('victory');
        updateSupersonicButton();
    }

    function updateSupersonicButton() {
        const btn = document.getElementById('btn-supersonic');
        if (!btn) return;
        const cdText = document.getElementById('ss-cooldown-text');

        const energyOK = Game.energy >= Features.superSonicEnergyThreshold;
        const ready = Features.superSonicReady && energyOK && Game.state === 'playing';

        if (Features.superSonicReady && energyOK) {
            btn.classList.remove('disabled');
            btn.classList.add('ready-pulse');
            if (cdText) cdText.textContent = '';
        } else {
            btn.classList.add('disabled');
            btn.classList.remove('ready-pulse');
            if (!Features.superSonicReady && cdText) {
                const sec = Math.ceil(Features.superSonicCooldownTimer / 1000);
                cdText.textContent = sec + 's';
            } else if (!energyOK && cdText) {
                cdText.textContent = '⚡';
            }
        }
    }

    // ---------------------------------------------------------
    // 7. DANGER WARNING
    // ---------------------------------------------------------
    function triggerDangerWarning() {
        const overlay = document.getElementById('danger-overlay');
        if (!overlay) return;
        // Re-trigger animation
        const strip = overlay.querySelector('.danger-strip');
        if (strip) {
            strip.style.animation = 'none';
            void strip.offsetWidth;  // force reflow
            strip.style.animation = 'dangerStripSlide 3s ease-in-out forwards';
        }
        overlay.classList.add('active');
        Features.dangerActive = true;
        Features.dangerTimer = 0;
    }

    function updateDangerWarning(dt) {
        if (!Features.dangerActive) return;
        Features.dangerTimer += dt;
        if (Features.dangerTimer >= Features.dangerDuration) {
            Features.dangerActive = false;
            const overlay = document.getElementById('danger-overlay');
            if (overlay) overlay.classList.remove('active');
        }
    }

    // ---------------------------------------------------------
    // 8. LEVEL-UP CARDS
    // ---------------------------------------------------------
    function showLevelUpCards() {
        // Pause game
        Game.pauseGame();

        // Pick 3 cards from DIFFERENT categories
        const cards = pickThreeDifferentCategoryCards();

        const cardsContainer = document.getElementById('levelup-cards');
        if (!cardsContainer) return;
        cardsContainer.innerHTML = '';

        const sub = document.getElementById('levelup-sub');
        if (sub) sub.textContent = `MILESTONE ${Features.currentMilestone * 500} POINTS — CHOOSE YOUR UPGRADE`;

        const catLabels = { A: 'HEALTH', B: 'SHIELD', C: 'DAMAGE', D: 'ENERGY' };

        cards.forEach((card) => {
            const el = document.createElement('div');
            el.className = 'levelup-card cat-' + card.category;
            el.innerHTML = `
                <div class="lc-icon">${card.icon}</div>
                <div class="lc-cat">${catLabels[card.category] || ''} — ${card.id}</div>
                <div class="lc-name">${card.name}</div>
                <div class="lc-desc">${card.desc}</div>
                <div class="lc-pick">SELECT</div>
            `;
            const choose = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                AudioManager.play('click');
                card.apply(Features, Game);
                hideLevelUpCards();
            };
            el.addEventListener('click', choose);
            el.addEventListener('touchend', choose, { passive: false });
            cardsContainer.appendChild(el);
        });

        const overlay = document.getElementById('levelup-overlay');
        if (overlay) overlay.classList.add('active');
    }

    function hideLevelUpCards() {
        const overlay = document.getElementById('levelup-overlay');
        if (overlay) overlay.classList.remove('active');
        Features.levelUpPending = false;
        // Update UI to reflect new caps
        updateShieldUI();
        // Resume game
        Game.resumeGame();
    }

    function pickThreeDifferentCategoryCards() {
        const byCat = { A: [], B: [], C: [], D: [] };
        for (const c of CARD_REGISTRY) {
            if (byCat[c.category]) byCat[c.category].push(c);
        }
        // All four categories available — pick 3 unique categories
        const allCats = ['A', 'B', 'C', 'D'].filter(c => byCat[c].length > 0);
        // Shuffle
        for (let i = allCats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCats[i], allCats[j]] = [allCats[j], allCats[i]];
        }
        const pickedCats = allCats.slice(0, 3);
        return pickedCats.map(cat => {
            const pool = byCat[cat];
            return pool[Math.floor(Math.random() * pool.length)];
        });
    }

    // ---------------------------------------------------------
    // 9. SHIELD PACK SPAWNING & COLLECTION
    // ---------------------------------------------------------
    function spawnShieldPack() {
        if (!Game.shieldPacks) Game.shieldPacks = [];
        // Pick a main platform ahead of the player
        const ahead = Game.platforms.filter(pl =>
            pl.type === 'main' &&
            pl.x > Game.cameraX + 200 &&
            pl.x < Game.cameraX + Game.vw + 1200
        );
        if (ahead.length === 0) return;
        const plat = ahead[Math.floor(Math.random() * ahead.length)];
        Game.shieldPacks.push({
            x: plat.x + plat.w * (0.3 + Math.random() * 0.4),
            y: plat.y - 55,
            size: CONFIG.HEALTH_SIZE,
            collected: false,
            bobOffset: Math.random() * Math.PI * 2
        });
    }

    function drawShieldPack(ctx, x, y, size) {
        const glow = Math.sin(Game.animFrame * 0.08 + 3) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = '#5bf9f8'; ctx.shadowBlur = 14 * glow;
        // outer ring
        ctx.strokeStyle = '#84faf9'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.stroke();
        // shield emblem - hexagon-ish circle filled
        ctx.fillStyle = 'rgba(91,249,248,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, size / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        // inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(x - size * 0.1, y - size * 0.1, size * 0.13, 0, Math.PI * 2);
        ctx.fill();
        // shield rune
        ctx.fillStyle = '#0a3a3a';
        ctx.font = 'bold ' + Math.round(size * 0.55) + 'px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', x, y + 1);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ---------------------------------------------------------
    // 10. SHIELD BUBBLE DRAW around player (transparent gradient)
    // ---------------------------------------------------------
    function drawShieldBubble(ctx) {
        if (!Features.shieldActive || Features.shieldHealth <= 0 || !Game.player) return;
        const p = Game.player;
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const r = Math.max(p.w, p.h) * 0.85;

        // Hit-flash bonus opacity
        let hitBoost = 0;
        if (Features.shieldHitFlash > 0) {
            hitBoost = (Features.shieldHitFlash / 500) * 0.35;
        }

        ctx.save();
        // Horizontal gradient: lower opacity center, higher opacity edges
        // We approximate this by drawing a horizontal linear gradient clipped to a circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
        const inner = 0.06 + hitBoost * 0.4;
        const outer = 0.32 + hitBoost;
        grad.addColorStop(0.0, `rgba(91,249,248,${outer.toFixed(3)})`);
        grad.addColorStop(0.25, `rgba(91,249,248,${(inner * 1.4).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(91,249,248,${inner.toFixed(3)})`);
        grad.addColorStop(0.75, `rgba(91,249,248,${(inner * 1.4).toFixed(3)})`);
        grad.addColorStop(1.0, `rgba(91,249,248,${outer.toFixed(3)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

        // Add a subtle radial highlight on top-left for a glassy look (no stroke - borderless)
        const rg = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx - r * 0.4, cy - r * 0.4, r * 0.7);
        rg.addColorStop(0, `rgba(180,253,253,${(0.18 + hitBoost * 0.5).toFixed(3)})`);
        rg.addColorStop(1, 'rgba(180,253,253,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

        ctx.restore();
    }

    // ---------------------------------------------------------
    // 11. CARD-DRIVEN DEATH BLINK (player + bosses) & FADE
    // ---------------------------------------------------------
    // We delay actual removal of bosses by intercepting alive=false transitions.
    // For player death, we play a 3s blink + fade-to-white then fade-out to game over.

    function applyBossDeathEffectInRender(ctx) {
        // Blinking effect for bosses currently in death animation
        // We piggyback on Game.bosses; engine removes them via alive filter
        // Solution: keep them alive=false but skipped by engine; we render here.
        // Trick: track {boss} list separately
        for (const dying of Features.dyingBosses) {
            const b = dying.boss;
            dying.timer += Game.deltaTime || 16.6;
            if (dying.timer >= dying.duration) {
                dying._done = true;
                continue;
            }
            // Blink: show every other 100ms
            const blinkOn = Math.floor(dying.timer / 100) % 2 === 0;
            if (!blinkOn) continue;
            // Draw boss image manually
            const filename = getFilename(b.img);
            const img = ImageCache[filename];
            if (img) {
                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.translate(-Game.cameraX, 0);
                if (b.dir < 0) {
                    ctx.translate(b.x + b.w, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, b.y, b.w, b.h);
                } else {
                    ctx.drawImage(img, b.x, b.y, b.w, b.h);
                }
                ctx.restore();
            }
        }
        Features.dyingBosses = Features.dyingBosses.filter(d => !d._done);
    }

    function watchForBossDeaths() {
        // Called each frame: detect newly dead bosses
        for (const b of Game.bosses) {
            if (!b.alive && !b._featureDeathRegistered) {
                b._featureDeathRegistered = true;
                Features.dyingBosses.push({
                    boss: { ...b },     // copy snapshot
                    timer: 0,
                    duration: 3000,
                    isMain: b.isMainBoss
                });
                if (b.isMainBoss) {
                    // 2-second game pause-like dim + boss death anim stays normal
                    Features.mainBossDying = true;
                    Features.mainBossDyingTimer = 0;
                }
            }
        }
    }

    function updateMainBossDimOverlay(dt) {
        if (!Features.mainBossDying) {
            const dim = document.getElementById('boss-death-dim');
            if (dim) dim.classList.remove('active');
            return;
        }
        Features.mainBossDyingTimer += dt;
        const dim = document.getElementById('boss-death-dim');
        if (dim) dim.classList.add('active');
        if (Features.mainBossDyingTimer >= Features.mainBossDyingDuration) {
            Features.mainBossDying = false;
            if (dim) dim.classList.remove('active');
        }
    }

    // Player death sequence: 3s blink + white fade in/out → real game over
    function triggerPlayerDeathSequence(callback) {
        if (Features.playerDying) return;
        Features.playerDying = true;
        Features.playerDyingTimer = 0;
        Features.playerDeathCallbackFired = false;
        Features._gameOverCallback = callback;

        // Trigger fade-in (to white)
        const fade = document.getElementById('player-death-fade');
        if (fade) {
            fade.classList.add('active');
            // Force reflow then fade in
            void fade.offsetWidth;
            setTimeout(() => fade.classList.add('fade-in'), 50);
        }
    }

    function updatePlayerDeathSequence(dt) {
        if (!Features.playerDying) return;
        Features.playerDyingTimer += dt;
        // After 3s of blink+fade-in, trigger real game over (fade-out happens on game-over screen)
        if (!Features.playerDeathCallbackFired && Features.playerDyingTimer >= Features.playerDyingDuration) {
            Features.playerDeathCallbackFired = true;
            const cb = Features._gameOverCallback;
            // Fade back out (white → game over) just before showing screen
            const fade = document.getElementById('player-death-fade');
            if (fade) fade.classList.remove('fade-in');
            setTimeout(() => {
                if (cb) cb();
                if (fade) {
                    fade.classList.remove('active');
                }
                Features.playerDying = false;
            }, 800);
        }
    }

    // Render-time player blinking effect during death
    function applyPlayerBlinkRender() {
        // Achieved by toggling player.invincible-like flash; we directly hide canvas player
        // by drawing a transparent rect over it isn't easy → instead increase player.invTimer
        // so engine's existing blink logic shows it.
        if (Features.playerDying && Game.player) {
            Game.player.invincible = true;
            Game.player.invTimer = 999;
        }
    }

    // ---------------------------------------------------------
    // 12. SUPERSONIC WAVE update & render
    // ---------------------------------------------------------
    function updateSuperSonicWaves(dt) {
        if (!Game.superSonicWaves) Game.superSonicWaves = [];
        for (let i = Game.superSonicWaves.length - 1; i >= 0; i--) {
            const w = Game.superSonicWaves[i];
            w.x += w.vx; w.life--;
            if (w.life <= 0 || w.x < Game.cameraX - 600 || w.x > Game.cameraX + Game.vw + 600) {
                Game.superSonicWaves.splice(i, 1); continue;
            }
            // Hit enemies
            for (const e of Game.enemies) {
                if (e.alive && Game.rectsOverlap(w, e)) {
                    e.alive = false; Game.points += 25;
                    Game.spawnParticles(e.x + e.w / 2, e.y, '#ff2244', 12);
                }
            }
            // Hit flying enemies
            for (const fe of Game.flyingEnemies) {
                if (fe.alive && Game.rectsOverlap(w, fe)) {
                    fe.alive = false; Game.points += 30;
                    Game.spawnParticles(fe.x + fe.w / 2, fe.y, '#ff2244', 12);
                }
            }
            // Hit bosses — supersonic does 3x normal damage
            for (const b of Game.bosses) {
                if (!b.alive) continue;
                if (Game.rectsOverlap(w, b)) {
                    const dmg = 3 * Features.sonicDamageMult * Features.superSonicDamageMult;
                    b.health -= dmg;
                    b.hitFlash = 10;
                    Game.spawnParticles(b.x + b.w / 2, b.y, '#ff2244', 15);
                    if (b.health <= 0) {
                        b.alive = false;
                        Game.bossesDefeated++;
                        Game.points += b.isMainBoss ? 500 : 200;
                        Game.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffcc00', b.isMainBoss ? 35 : 20);
                        AudioManager.play('victory');
                    }
                }
            }
        }
    }

    function drawSuperSonicWaves(ctx) {
        if (!Game.superSonicWaves) return;
        for (const w of Game.superSonicWaves) {
            ctx.save();
            ctx.globalAlpha = Math.min(w.life / 70, 1.0);
            const cx = w.x + w.w / 2;
            const cy = w.y + w.h / 2;
            // Outer red flame
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, w.w * 0.55);
            gradient.addColorStop(0.0, 'rgba(255, 255, 220, 0.85)');
            gradient.addColorStop(0.3, 'rgba(255, 80, 30, 0.8)');
            gradient.addColorStop(0.7, 'rgba(255, 34, 68, 0.55)');
            gradient.addColorStop(1.0, 'rgba(180, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(cx, cy, w.w * 0.55, w.h * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Inner core
            const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, w.w * 0.22);
            inner.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            inner.addColorStop(0.5, 'rgba(255, 220, 100, 0.7)');
            inner.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = inner;
            ctx.beginPath();
            ctx.ellipse(cx, cy, w.w * 0.22, w.h * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Ring
            ctx.strokeStyle = 'rgba(255, 100, 50, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(cx, cy, w.w * 0.5, w.h * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    // ---------------------------------------------------------
    // 13. HOOK: wrap Game.update
    // ---------------------------------------------------------
    const originalUpdate = Game.update.bind(Game);
    Game.update = function (dt) {
        // While player is dying or level-up overlay is open, do not advance gameplay
        if (Features.playerDying) {
            updatePlayerDeathSequence(dt);
            return;
        }

        // Update danger/main-boss timing BEFORE original update so that danger triggers in time
        // (We check using Game.mainBossSpawnTimer)
        if (Game.state === 'playing') {
            // Compute time until next main boss spawn
            const timeUntilBoss = CONFIG.MAIN_BOSS_SPAWN_INTERVAL - Game.mainBossSpawnTimer;
            if (timeUntilBoss <= 5000 && timeUntilBoss > 2000 && !Features.dangerTriggeredForCycle) {
                Features.dangerTriggeredForCycle = true;
                triggerDangerWarning();
            }
            if (timeUntilBoss > 5500) {
                Features.dangerTriggeredForCycle = false;
            }
        }

        // Apply sonic damage multiplier BEFORE running original update,
        // so player-fired sonic waves hit bosses with correct damage value.
        Game.sonicDamage = 1 * Features.sonicDamageMult;

        originalUpdate(dt);

        // Re-cap health/energy to feature maxima (engine still uses 100 internally)
        if (Game.health > Features.maxHealth) Game.health = Features.maxHealth;
        if (Game.energy > Features.maxEnergy) Game.energy = Features.maxEnergy;

        // Apply extra energy regen (engine already adds the base rate)
        if (Features.energyRegenMult > 1.0 && Game.state === 'playing') {
            const extra = CONFIG.ENERGY_REGEN_RATE * (Features.energyRegenMult - 1.0);
            Game.energy = Math.min(Features.maxEnergy, Game.energy + extra);
        }

        // Re-affirm sonic damage & display level (engine may have touched playerLevel)
        Game.sonicDamage = 1 * Features.sonicDamageMult;
        Game.playerLevel = 1 + Features.currentMilestone;  // for display

        // Watch for new boss deaths (set up blink anim + main-boss dim)
        watchForBossDeaths();
        updateMainBossDimOverlay(dt);
        updateDangerWarning(dt);

        // Shield: tick hit flash decay
        if (Features.shieldHitFlash > 0) {
            Features.shieldHitFlash -= dt;
            if (Features.shieldHitFlash < 0) Features.shieldHitFlash = 0;
        }

        // Spawn shield collectibles periodically
        if (Game.state === 'playing') {
            Features.shieldSpawnTimer += dt;
            if (Features.shieldSpawnTimer >= 12000) {
                Features.shieldSpawnTimer = 0;
                if (!Game.shieldPacks) Game.shieldPacks = [];
                if (Game.shieldPacks.filter(s => !s.collected).length < 2) {
                    spawnShieldPack();
                }
            }
            // Collect shield packs
            if (Game.shieldPacks) {
                const p = Game.player;
                for (const sp of Game.shieldPacks) {
                    if (!sp.collected && Game.circleRectOverlap(sp.x, sp.y, sp.size / 2, p)) {
                        sp.collected = true;
                        activateShield();
                        Game.spawnParticles(sp.x, sp.y, '#5bf9f8', 8);
                        AudioManager.play('click');
                    }
                }
                const cleanX = Game.cameraX - Game.vw;
                Game.shieldPacks = Game.shieldPacks.filter(s => !s.collected && s.x > cleanX);
            }
        }

        // Supersonic update
        updateSuperSonicWaves(dt);

        // Supersonic cooldown
        if (!Features.superSonicReady) {
            Features.superSonicCooldownTimer -= dt;
            if (Features.superSonicCooldownTimer <= 0) {
                Features.superSonicCooldownTimer = 0;
                Features.superSonicReady = true;
            }
        }
        updateSupersonicButton();

        // Check level-up milestone (every 500 points)
        if (Game.state === 'playing' && !Features.levelUpPending) {
            const milestone = Math.floor(Game.points / 500);
            if (milestone > Features.currentMilestone) {
                Features.currentMilestone = milestone;
                Features.levelUpPending = true;
                showLevelUpCards();
            }
        }
    };

    // ---------------------------------------------------------
    // 14. HOOK: wrap Game.render to add shield, shield packs, supersonic waves, boss-death blink
    // ---------------------------------------------------------
    const originalRender = Game.render.bind(Game);
    Game.render = function () {
        originalRender();
        // ctx is in screen space here; for world-space drawings translate by cameraX
        if (this.state !== 'playing' && this.state !== 'paused') return;

        const ctx = this.ctx;
        ctx.save();
        ctx.translate(-this.cameraX, 0);

        // Draw shield packs (world space)
        if (this.shieldPacks) {
            for (const sp of this.shieldPacks) {
                if (sp.collected) continue;
                const bob = Math.sin(this.animFrame * 0.05 + sp.bobOffset) * 6;
                drawShieldPack(ctx, sp.x, sp.y + bob, sp.size);
            }
        }

        // Draw supersonic waves
        drawSuperSonicWaves(ctx);

        // Draw shield bubble around player (world space) - drawn LAST so it overlays player
        drawShieldBubble(ctx);

        ctx.restore();

        // Render dying bosses (world space, handled inside applyBossDeathEffectInRender)
        applyBossDeathEffectInRender(ctx);

        // Player blink during dying sequence
        applyPlayerBlinkRender();
    };

    // ---------------------------------------------------------
    // 15. HOOK: wrap Game.playerHit for shield absorption + dmg reduction
    // ---------------------------------------------------------
    Game.playerHit = function (damage) {
        if (this.player.invincible) return;
        if (Features.playerDying) return;

        // Apply damage reduction
        const effective = damage * (1 - Features.damageReduction);

        // Shield absorbs first
        if (Features.shieldActive && Features.shieldHealth > 0) {
            Features.shieldHealth -= effective;
            Features.shieldHitFlash = 500;
            this.player.invincible = true;
            this.player.invTimer = 60;
            this.spawnParticles(this.player.x + this.player.w / 2,
                                this.player.y + this.player.h / 2, '#5bf9f8', 8);
            if (Features.shieldHealth <= 0) {
                Features.shieldHealth = 0;
                Features.shieldActive = false;
                this.spawnParticles(this.player.x + this.player.w / 2,
                                    this.player.y + this.player.h / 2, '#84faf9', 20);
            }
            updateShieldUI();
            return;
        }

        // Normal damage
        this.health -= effective;
        this.player.invincible = true;
        this.player.invTimer = 60;
        this.spawnParticles(this.player.x + this.player.w / 2,
                            this.player.y + this.player.h / 2, '#ff2244', 6);
        if (this.health <= 0) {
            this.health = 0;
            this.gameOver();
        }
    };

    // ---------------------------------------------------------
    // 16. HOOK: wrap Game.gameOver for fade & blink sequence
    // ---------------------------------------------------------
    const originalGameOver = Game.gameOver.bind(Game);
    Game.gameOver = function () {
        if (Features.playerDying) return; // already in sequence
        // Switch state to a quasi-paused so game logic pauses while we play the death anim
        this.state = 'paused';
        triggerPlayerDeathSequence(() => {
            originalGameOver();
        });
    };

    // ---------------------------------------------------------
    // 17. HOOK: wrap Game.startGame to reset feature state
    // ---------------------------------------------------------
    const originalStartGame = Game.startGame.bind(Game);
    Game.startGame = function () {
        Features.maxHealth = 100;
        Features.maxEnergy = 100;
        Features.damageReduction = 0;
        Features.sonicDamageMult = 1.0;
        Features.superSonicDamageMult = 1.0;
        Features.energyRegenMult = 1.0;
        Features.shieldCapacityMult = 1.0;
        Features.shieldActive = false;
        Features.shieldHealth = 0;
        Features.shieldMaxHealth = 0;
        Features.shieldHitFlash = 0;
        Features.superSonicCooldown = 30000;
        Features.superSonicCooldownTimer = 0;
        Features.superSonicReady = true;
        Features.currentMilestone = 0;
        Features.levelUpPending = false;
        Features.mainBossDying = false;
        Features.mainBossDyingTimer = 0;
        Features.dangerActive = false;
        Features.dangerTriggeredForCycle = false;
        Features.dangerTimer = 0;
        Features.playerDying = false;
        Features.playerDyingTimer = 0;
        Features.playerDeathCallbackFired = false;
        Features.shieldSpawnTimer = 0;
        Features.dyingBosses = [];
        this.shieldPacks = [];
        this.superSonicWaves = [];

        // Hide all overlays
        const overlays = ['danger-overlay', 'boss-death-dim', 'player-death-fade', 'levelup-overlay'];
        overlays.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active');
                el.classList.remove('fade-in');
            }
        });

        originalStartGame();
        updateShieldUI();
        updateSupersonicButton();
    };

    // ---------------------------------------------------------
    // 18. HOOK: wrap UI.updateHUD to display numerical indicators
    // ---------------------------------------------------------
    const originalUpdateHUD = UI.updateHUD.bind(UI);
    UI.updateHUD = function (health, energy, points, gameTimer, highScore) {
        originalUpdateHUD(health, energy, points, gameTimer, highScore);

        // Numerical indicators
        const hv = document.getElementById('health-value');
        const ev = document.getElementById('energy-value');
        if (hv) {
            const newText = Math.max(0, Math.ceil(health)) + ' / ' + Features.maxHealth;
            if (hv.textContent !== newText) {
                hv.textContent = newText;
                pulseEl(hv);
            }
        }
        if (ev) {
            const newText = Math.max(0, Math.ceil(energy)) + ' / ' + Features.maxEnergy;
            if (ev.textContent !== newText) {
                ev.textContent = newText;
                pulseEl(ev);
            }
        }
        updateShieldUI();
    };

    function pulseEl(el) {
        el.classList.remove('pulse');
        // restart animation
        void el.offsetWidth;
        el.classList.add('pulse');
    }

    // ---------------------------------------------------------
    // 19. INIT: build DOM elements once UI is ready
    // ---------------------------------------------------------
    function initFeatures() {
        ensureUIElements();
        setupSupersonicButton();
        Features.dyingBosses = [];
        // Initialize values
        updateShieldUI();
        updateSupersonicButton();
        const hv = document.getElementById('health-value');
        const ev = document.getElementById('energy-value');
        if (hv) hv.textContent = '100 / 100';
        if (ev) ev.textContent = '100 / 100';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Give main.js / UI.init a chance to run first
            setTimeout(initFeatures, 0);
        });
    } else {
        setTimeout(initFeatures, 0);
    }

    console.log('✨ NEO-ROBO Features layer loaded.');
})();
