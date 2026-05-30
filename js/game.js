/* ========================================
   NEO-ROBO - Game Engine (v3)
   Height FIXED 1080px, width FLEXIBLE
   Sprites 1.5x, Boss 2x
   No blur/transparency on backgrounds
   ======================================== */

// ============ ASSET DEFINITIONS ============
const ASSETS = {
    bg_sky: 'assets/images/bg_sky.png',
    city_far: 'assets/images/city_far.png',
    city_mid: 'assets/images/city_mid.png',
    platform_main: 'assets/images/platform_main.png',
    platform_static: 'assets/images/platform_static.png',
    platform_moving: 'assets/images/platform_moving.png',
    flying_enemy: 'assets/images/flying_enemy.png',
    robots: [
        { name: 'MRK-069', img: 'assets/images/robots/mrk_069.png', sound: 'mrk_069', color: '#BE774D' },
        { name: 'MRK-301', img: 'assets/images/robots/mrk_301.png', sound: 'mrk_301', color: '#FFD264' },
        { name: 'MRK-608', img: 'assets/images/robots/mrk_608.png', sound: 'mrk_608', color: '#5BF9F8' },
        { name: 'MRK-720', img: 'assets/images/robots/mrk_720.png', sound: 'mrk_720', color: '#F4F4F4' },
        { name: 'MRK-830', img: 'assets/images/robots/mrk_830.png', sound: 'mrk_830', color: '#2E4646' }
    ]
};

// Helper to get filename from path
function getFilename(path) {
    return path.split('/').pop();
}

// ============ GAME CONFIG ============
const CONFIG = {
    DESIGN_HEIGHT: 1080,
    PLATFORM_MAIN_BOTTOM_GAP: 104,
    PLATFORM_STATIC_ABOVE_MAIN: 78,
    PLATFORM_MOVING_ABOVE_MAIN: 190,
    GROUND_ON_MAIN: 55,
    GROUND_ON_STATIC: 25,
    GROUND_ON_MOVING: 25,
    GRAVITY: 0.55,
    JUMP_FORCE: -16.2,
    DOUBLE_JUMP_FORCE: -13.8,
    MOVE_SPEED: 5,
    MAX_FALL_SPEED: 14,
    MOVING_PLATFORM_RANGE: 190,
    MOVING_PLATFORM_SPEED: 0.7,
    PLAYER_WIDTH: 120,
    PLAYER_HEIGHT: 158,
    ENEMY_WIDTH: 120,
    ENEMY_HEIGHT: 158,
    ENEMY_SPEED: 1.8,
    FLYING_ENEMY_WIDTH: 82,
    FLYING_ENEMY_HEIGHT: 82,
    FLYING_ENEMY_RANGE: 150,
    BOSS_SCALE: 2.0,
    BOSS_HEALTH: 5,
    MINI_BOSS_SPAWN_INTERVAL: 40000,           // 40 seconds
    MAIN_BOSS_SPAWN_INTERVAL: 150000,          // 2 minutes 30 seconds (changed from 2 min)
    MAIN_BOSS_WARNING_LEAD: 5000,              // Warning starts 5s before spawn
    MAIN_BOSS_WARNING_DURATION: 3000,          // Warning visible for 3s
    MAIN_BOSS_DEFEAT_PAUSE: 2000,              // 2-second pause when main boss dies
    BOSS_DYING_DURATION: 3000,                 // 3-second blink/dying effect
    MAIN_BOSS_SCALE: 3.0,
    MAIN_BOSS_HEALTH: 8,
    BOSS_FLOAT_HEIGHT: 0,
    BOSS_GAP_RISE: 50,
    GOLD_SIZE: 40,
    HEALTH_SIZE: 34,
    SHIELD_SIZE: 38,
    GOLD_POINTS: 10,
    // ----- Normal Sonic -----
    SONIC_WAVE_SPEED: 14,
    SONIC_WAVE_WIDTH: 25,
    SONIC_WAVE_HEIGHT: 25,
    SONIC_ENERGY_COST: 5,
    // ----- Supersonic (4x size, 3x damage, 1/4 speed, requires energy >= 70) -----
    SUPERSONIC_ENERGY_THRESHOLD: 70,
    SUPERSONIC_ENERGY_COST: 70,
    SUPERSONIC_WAVE_SIZE_MULT: 4,
    SUPERSONIC_WAVE_SPEED_DIV: 4,
    SUPERSONIC_DAMAGE_MULT: 0,
    SUPERSONIC_COOLDOWN_MS: 30000,             // 30 seconds (changed from 45)
    ENERGY_REGEN_RATE: 0.08,
    CAMERA_LOCK_DISTANCE: 600,
    SCROLL_THRESHOLD: 0.35,
    GAP_MIN: 140,
    GAP_MAX: 250,
    SEGMENT_LENGTH: 1920,
    LEVEL_UP_POINTS: 1000,                      // Level up every 500 points (changed from 2000)
    FIXED_DT: 1000 / 60,
    BOSS_SONIC_SPEED: 5.5,
    BOSS_SONIC_INTERVAL: 3000,
    BOSS_SONIC_WIDTH: 100,
    BOSS_SONIC_HEIGHT: 100,
    BOSS_SONIC_DAMAGE: 15,
    BOSS_SONIC_LIFE: 180,
    MINI_BOSS_SONIC_INTERVAL: 3000,
    MINI_BOSS_SONIC_SPEED: 5.0,
    MINI_BOSS_SONIC_DAMAGE: 10,
    MINI_BOSS_SONIC_LIFE: 150,
    PLAYER_BASE_MAX_HEALTH: 100,
    PLAYER_BASE_MAX_ENERGY: 100,
    SHIELD_HEALTH_RATIO: 1 / 3,                // Max shield = 1/3 of max health
};

// ============ IMAGE LOADER ============
const ImageCache = {};
const ImageSizes = {};

function loadImage(src) {
    return new Promise((resolve) => {
        const filename = getFilename(src);
        if (ImageCache[filename]) { resolve(ImageCache[filename]); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ImageCache[filename] = img;
            ImageSizes[filename] = { w: img.naturalWidth, h: img.naturalHeight };
            resolve(img);
        };
        img.onerror = () => { console.warn('Failed to load:', src); resolve(null); };
        img.src = src;
    });
}

async function preloadAllAssets() {
    const promises = [
        loadImage(ASSETS.bg_sky),
        loadImage(ASSETS.city_far),
        loadImage(ASSETS.city_mid),
        loadImage(ASSETS.platform_main),
        loadImage(ASSETS.platform_static),
        loadImage(ASSETS.platform_moving),
        loadImage(ASSETS.flying_enemy),
    ];
    ASSETS.robots.forEach(r => promises.push(loadImage(r.img)));
    await Promise.all(promises);
}

// ============ PLATFORM DIMENSIONS (1.5x) ============
let PLAT_MAIN_H = 300;
let PLAT_MAIN_W = 1920;
let PLAT_STATIC_H = 120;
let PLAT_STATIC_W = 675;
let PLAT_MOVING_H = 90;
let PLAT_MOVING_W = 385;

function computePlatformDimensions() {
    const pmImg = ImageSizes['platform_main.png'];
    if (pmImg) {
        PLAT_MAIN_H = 300;
        PLAT_MAIN_W = PLAT_MAIN_H * (pmImg.w / pmImg.h);
    }
    const psImg = ImageSizes['platform_static.png'];
    if (psImg) {
        PLAT_STATIC_H = 120;
        PLAT_STATIC_W = PLAT_STATIC_H * (psImg.w / psImg.h);
    }
    const pmvImg = ImageSizes['platform_moving.png'];
    if (pmvImg) {
        PLAT_MOVING_H = 90;
        PLAT_MOVING_W = PLAT_MOVING_H * (pmvImg.w / pmvImg.h);
    }
}

// ============ GAME STATE ============
const Game = {
    canvas: null,
    ctx: null,
    vw: 1920,
    vh: 1080,
    state: 'start',
    selectedRobot: 0,
    cameraX: 0,
    maxCameraX: 0,
    player: null,
    platforms: [],
    enemies: [],
    flyingEnemies: [],
    golds: [],
    healthPacks: [],
    energyPacks: [],
    shieldPacks: [],                       // NEW: shield collectibles
    sonicWaves: [],
    particles: [],
    bosses: [],
    miniBossSpawnTimer: 0,
    mainBossSpawnTimer: 0,
    bossesDefeated: 0,
    bossSonicWaves: [],
    playerHasMoved: false,
    points: 0,
    highScore: 0,
    gameTimer: 0,

    // --- Player stats (max values can be modified by level-up cards) ---
    maxHealth: 100,
    maxEnergy: 100,
    health: 100,
    energy: 100,
    damageReduction: 0,                    // 0..1, fraction reduced from incoming damage

    // --- Shield system ---
    maxShield: 0,
    shield: 0,
    shieldActive: false,
    shieldHitFlash: 0,                     // frames of bumped opacity after shield hit

    // --- Supersonic ---
    supersonicCooldownMs: 0,               // remaining ms of cooldown
    supersonicCooldownDuration: 30000,     // dynamic (reduced by C10 card)
    supersonicDamageMult: 1,               // base 1, increased by C8/C9 cards
    sonicDamageMult: 1,                    // base 1, increased by C7 card
    energyRegenMult: 1,                    // base 1, increased by D13/D14 cards

    playerLevel: 1,
    sonicDamage: 1,
    lastLevelUpAt: 0,
    levelUpAnim: null,
    pendingLevelUps: 0,                    // queue of level-ups waiting for card selection
    awaitingCardChoice: false,

    // --- Boss warning ---
    bossWarningActive: false,
    bossWarningTimeLeft: 0,                // ms remaining in 3-sec strip
    bossWarningPending: false,             // true between -5s and -2s (counting down silently)
    bossWarningSpawnIn: 0,                 // ms until actual main-boss spawn (when pending)

    // --- Main boss defeated pause ---
    mainBossDefeatPauseLeft: 0,            // ms of dim-pause after main boss dies

    // --- Player death fade ---
    playerDying: false,
    playerDyingTimer: 0,                   // ms elapsed during dying blink (3s)
    playerFadePhase: 'none',               // 'none' | 'in' | 'hold' | 'out'
    playerFadeTimer: 0,
    deathPending: false,                   // set true when health hits 0 → triggers fade sequence

    worldEndX: 0,
    segmentIndex: 0,
    keys: {},
    touchState: { left: false, right: false, jump: false, sonic: false, supersonic: false },
    lastTime: 0,
    deltaTime: 0,
    accumulator: 0,
    animFrame: 0,
    mainPlatTop: 0,
    mainPlatBot: 0,

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.updateCanvasSize();
        this.setupInput();
        this.highScore = 0;
    },

    updateCanvasSize() {
        const screenW = window.innerWidth || document.documentElement.clientWidth;
        const screenH = window.innerHeight || document.documentElement.clientHeight;
        const aspect = screenW / screenH;
        this.vh = CONFIG.DESIGN_HEIGHT;
        this.vw = Math.round(this.vh * aspect);
        this.canvas.width = this.vw;
        this.canvas.height = this.vh;
        this.mainPlatBot = this.vh - CONFIG.PLATFORM_MAIN_BOTTOM_GAP;
        this.mainPlatTop = this.mainPlatBot - PLAT_MAIN_H;
        const rect = this.canvas.getBoundingClientRect();
        this._canvasRect = rect;
        this._scaleX = this.vw / rect.width;
        this._scaleY = this.vh / rect.height;
    },

    fitToScreen() {
        this.updateCanvasSize();
    },

    screenToVirtual(screenX, screenY) {
        const rect = this._canvasRect || this.canvas.getBoundingClientRect();
        return {
            x: (screenX - rect.left) * (this.vw / rect.width),
            y: (screenY - rect.top) * (this.vh / rect.height)
        };
    },

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    },

    generateInitialWorld() {
        this.platforms = [];
        this.enemies = [];
        this.flyingEnemies = [];
        this.golds = [];
        this.healthPacks = [];
        this.energyPacks = [];
        this.shieldPacks = [];
        this.sonicWaves = [];
        this.particles = [];
        this.worldEndX = 0;
        this.segmentIndex = 0;
        this.bosses = [];
        this.miniBossSpawnTimer = 0;
        this.mainBossSpawnTimer = 0;
        this.bossesDefeated = 0;
        this.bossSonicWaves = [];
        computePlatformDimensions();
        this.mainPlatBot = this.vh - CONFIG.PLATFORM_MAIN_BOTTOM_GAP;
        this.mainPlatTop = this.mainPlatBot - PLAT_MAIN_H;
        for (let i = 0; i < 5; i++) {
            this.generateSegment();
        }
    },

    generateSegment() {
        const segStart = this.worldEndX;
        const mainTop = this.mainPlatTop;
        const mainH = PLAT_MAIN_H;
        
        const pmImg = ImageSizes['platform_main.png'];
        const imgRatio = pmImg ? (pmImg.w / pmImg.h) : (1920/300);
        const platW = mainH * imgRatio;
        
        let gapW = 0;
        if (Math.random() < 0.7) {
            gapW = 150 + Math.random() * 250;
        }
        
        this.platforms.push({ type: 'main', x: segStart, y: mainTop, w: platW, h: mainH, tier: 1 });
        this.worldEndX = segStart + platW + gapW;

        if (this.segmentIndex > 0 && Math.random() < 0.65) {
            const sW = PLAT_STATIC_W;
            const sH = PLAT_STATIC_H;
            const sTop = mainTop - CONFIG.PLATFORM_STATIC_ABOVE_MAIN - sH;
            const sX = segStart + (platW - sW) * (0.15 + Math.random() * 0.7);
            this.platforms.push({ type: 'static', x: sX, y: sTop, w: sW, h: sH, tier: 2 });
            if (Math.random() < 0.45) {
                this.spawnEnemyOnPlatform(sX, sTop, sW, sH, 2);
            }
            if (Math.random() < 0.7) {
                const gc = 2 + Math.floor(Math.random() * 3);
                for (let g = 0; g < gc; g++) {
                    this.golds.push({
                        x: sX + 40 + g * 50, y: sTop - 35,
                        size: CONFIG.GOLD_SIZE, collected: false,
                        bobOffset: Math.random() * Math.PI * 2
                    });
                }
            }
        }

        if (this.segmentIndex > 1 && Math.random() < 0.5) {
            const mW = PLAT_MOVING_W;
            const mH = PLAT_MOVING_H;
            const mBaseTop = mainTop - CONFIG.PLATFORM_MOVING_ABOVE_MAIN - mH;
            const mX = segStart + (platW - mW) * (0.1 + Math.random() * 0.8);
            this.platforms.push({
                type: 'moving', x: mX, y: mBaseTop, w: mW, h: mH, tier: 3,
                baseY: mBaseTop, moveDir: 1, moveOffset: 0
            });
            if (Math.random() < 0.6) {
                for (let g = 0; g < 3; g++) {
                    this.golds.push({
                        x: mX + 30 + g * 50, y: mBaseTop - 260,
                        size: CONFIG.GOLD_SIZE, collected: false,
                        bobOffset: Math.random() * Math.PI * 2
                    });
                }
            }
        }

        if (this.segmentIndex > 0 && Math.random() < 0.55) {
            this.spawnEnemyOnPlatform(segStart, mainTop, platW, mainH, 1);
        }

        if (this.segmentIndex > 0 && Math.random() < 0.4) {
            const flyX = segStart + platW * (0.2 + Math.random() * 0.6);
            const flyY = mainTop - 180 - Math.random() * 200;
            this.flyingEnemies.push({
                x: flyX, y: flyY, baseY: flyY,
                w: CONFIG.FLYING_ENEMY_WIDTH, h: CONFIG.FLYING_ENEMY_HEIGHT,
                moveDir: 1, alive: true, bobOffset: Math.random() * Math.PI * 2
            });
        }

        if (Math.random() < 0.55) {
            const goldStart = segStart + 120;
            const gc = 3 + Math.floor(Math.random() * 5);
            for (let g = 0; g < gc; g++) {
                this.golds.push({
                    x: goldStart + g * 55, y: mainTop - 30,
                    size: CONFIG.GOLD_SIZE, collected: false,
                    bobOffset: Math.random() * Math.PI * 2
                });
            }
        }

        if (Math.random() < 0.12) {
            this.healthPacks.push({
                x: segStart + platW * (0.3 + Math.random() * 0.4),
                y: mainTop - 55,
                size: CONFIG.HEALTH_SIZE, collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }

        if (Math.random() < 0.15) {
            this.energyPacks.push({
                x: segStart + platW * (0.2 + Math.random() * 0.5),
                y: mainTop - 55,
                size: CONFIG.HEALTH_SIZE, collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }

        // NEW: Shield collectibles (rarer than health/energy)
        if (Math.random() < 0.10) {
            this.shieldPacks.push({
                x: segStart + platW * (0.25 + Math.random() * 0.5),
                y: mainTop - 60,
                size: CONFIG.SHIELD_SIZE, collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }

        this.segmentIndex++;
    },

    spawnEnemyOnPlatform(platX, platTop, platW, platH, tier) {
        const ew = CONFIG.ENEMY_WIDTH;
        const eh = CONFIG.ENEMY_HEIGHT;
        const availableRobots = ASSETS.robots.filter((_, i) => i !== this.selectedRobot);
        const enemyRobot = availableRobots[Math.floor(Math.random() * availableRobots.length)];
        let groundOffset;
        if (tier === 1) groundOffset = CONFIG.GROUND_ON_MAIN;
        else if (tier === 2) groundOffset = CONFIG.GROUND_ON_STATIC;
        else groundOffset = CONFIG.GROUND_ON_MOVING;
        const ey = platTop + groundOffset - eh;
        this.enemies.push({
            x: platX + platW * 0.5, y: ey,
            w: ew, h: eh, speed: CONFIG.ENEMY_SPEED, dir: 1,
            platX: platX, platW: platW,
            alive: true, img: enemyRobot.img,
            tier: tier, groundY: ey
        });
    },

    createPlayer() {
        const pw = CONFIG.PLAYER_WIDTH;
        const ph = CONFIG.PLAYER_HEIGHT;
        const py = this.mainPlatTop + CONFIG.GROUND_ON_MAIN - ph;
        this.player = {
            x: 120, y: py, w: pw, h: ph,
            vx: 0, vy: 0,
            onGround: true, jumps: 0, maxJumps: 2,
            facingRight: true,
            img: ASSETS.robots[this.selectedRobot].img,
            invincible: false, invTimer: 0,
            walkTimer: 0, currentPlatform: null
        };
    },

    spawnBoss(isMainBoss = false) {
        const scale = isMainBoss ? CONFIG.MAIN_BOSS_SCALE : CONFIG.BOSS_SCALE;
        const baseHealth = isMainBoss ? CONFIG.MAIN_BOSS_HEALTH : CONFIG.BOSS_HEALTH;
        const health = Math.round(baseHealth * Math.pow(1.2, this.bossesDefeated));
        const bw = 80 * scale;
        const bh = 105 * scale;
        const surfaceY = this.mainPlatTop + CONFIG.GROUND_ON_MAIN;
        const baseFloatY = surfaceY - bh - CONFIG.BOSS_FLOAT_HEIGHT;
        const fromRight = 1;
        const spawnX = this.cameraX + this.vw + 80 + Math.random() * 200;
        const availableRobots = ASSETS.robots.filter((_, i) => i !== this.selectedRobot);
        const bossRobot = availableRobots[Math.floor(Math.random() * availableRobots.length)];
        const boss = {
            x: spawnX,
            y: baseFloatY, w: bw, h: bh,
            health: health, maxHealth: health,
            speed: isMainBoss ? 2.0 : 2.5,
            dir: fromRight > 0 ? -1 : 1,
            alive: true,
            img: bossRobot.img, name: bossRobot.name,
            isMainBoss: isMainBoss,
            attackTimer: 0, hitFlash: 0,
            baseFloatY: baseFloatY,
            gapState: 'normal',
            sonicTimer: 0,
            // NEW: dying state — when health hits 0 the boss enters a 3-second blink before being removed
            dying: false,
            dyingTimer: 0
        };
        this.bosses.push(boss);
        AudioManager.play(bossRobot.sound);
    },

    hasGroundUnder(x) {
        for (const plat of this.platforms) {
            if (plat.type !== 'main') continue;
            if (x >= plat.x && x <= plat.x + plat.w) return true;
        }
        return false;
    },

    // ============ DAMAGE ROUTING (shield absorbs first) ============
    applyDamageToPlayer(damage) {
        if (this.player && this.player.invincible) return;
        // Apply damage reduction (from level-up cards)
        let dmg = damage * (1 - (this.damageReduction || 0));
        if (this.shieldActive && this.shield > 0) {
            // Shield absorbs first
            const absorbed = Math.min(this.shield, dmg);
            this.shield -= absorbed;
            dmg -= absorbed;
            this.shieldHitFlash = 18; // ~0.3s flash at 60fps
            if (this.shield <= 0) {
                this.shield = 0;
                this.shieldActive = false;
            }
        }
        if (dmg > 0) {
            this.health -= dmg;
            if (this.health <= 0) {
                this.health = 0;
                this.beginPlayerDeath();
            }
        }
        if (this.player) {
            this.player.invincible = true;
            this.player.invTimer = 60;
        }
        this.spawnParticles(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ff2244', 6);
    },

    // ============ CARD EFFECTS ============
    applyCardEffect(effectKey) {
        const PCT = (n) => 1 + n / 100;
        switch (effectKey) {
            // ---- Category A: Health ----
            case 'health_refill_50':
                // "Restore 50% of current health pool" — restore by 50% of max HP
                this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.5);
                break;
            case 'health_max_plus_10': {
                const old = this.maxHealth;
                this.maxHealth = Math.round(this.maxHealth * PCT(10));
                this.health += (this.maxHealth - old);
                break;
            }
            case 'health_max_plus_30_dr10': {
                const old = this.maxHealth;
                this.maxHealth = Math.round(this.maxHealth * PCT(30));
                this.health += (this.maxHealth - old);
                this.damageReduction = Math.min(0.9, (this.damageReduction || 0) + 0.10);
                break;
            }
            // ---- Category B: Shield ----
            case 'shield_basic':
                // Deploy default shield: max shield = 1/3 of max HP, fill it
                this.maxShield = Math.max(this.maxShield, Math.round(this.maxHealth * CONFIG.SHIELD_HEALTH_RATIO));
                this.shield = this.maxShield;
                this.shieldActive = true;
                break;
            case 'shield_plus_10':
                this.maxShield = Math.round(Math.max(this.maxShield, this.maxHealth * CONFIG.SHIELD_HEALTH_RATIO) * PCT(10));
                this.shield = this.maxShield;
                this.shieldActive = true;
                break;
            case 'shield_plus_30_dr10':
                this.maxShield = Math.round(Math.max(this.maxShield, this.maxHealth * CONFIG.SHIELD_HEALTH_RATIO) * PCT(30));
                this.shield = this.maxShield;
                this.shieldActive = true;
                this.damageReduction = Math.min(0.9, (this.damageReduction || 0) + 0.10);
                break;
            // ---- Category C: Damage ----
            case 'sonic_dmg_plus_30_hp_minus_10':
                this.sonicDamageMult *= PCT(30);
                this._scaleMaxHealth(0.90);
                break;
            case 'super_dmg_plus_10':
                this.supersonicDamageMult *= PCT(10);
                break;
            case 'super_dmg_plus_30_hp_minus_10':
                this.supersonicDamageMult *= PCT(30);
                this._scaleMaxHealth(0.90);
                break;
            case 'super_cd_minus_30':
                this.supersonicCooldownDuration = Math.max(2000, this.supersonicCooldownDuration * 0.70);
                break;
            // ---- Category D: Energy ----
            case 'energy_max_plus_10': {
                const old = this.maxEnergy;
                this.maxEnergy = Math.round(this.maxEnergy * PCT(10));
                this.energy += (this.maxEnergy - old);
                break;
            }
            case 'energy_max_plus_30_hp_minus_10': {
                const old = this.maxEnergy;
                this.maxEnergy = Math.round(this.maxEnergy * PCT(30));
                this.energy += (this.maxEnergy - old);
                this._scaleMaxHealth(0.90);
                break;
            }
            case 'energy_regen_plus_10':
                this.energyRegenMult *= PCT(10);
                break;
            case 'energy_regen_plus_30_hp_minus_10':
                this.energyRegenMult *= PCT(30);
                this._scaleMaxHealth(0.90);
                break;
        }
        // Clamp values after card effect
        this.health = Math.min(this.health, this.maxHealth);
        this.energy = Math.min(this.energy, this.maxEnergy);
        if (this.shield > this.maxShield) this.shield = this.maxShield;
    },

    _scaleMaxHealth(factor) {
        const old = this.maxHealth;
        this.maxHealth = Math.max(10, Math.round(this.maxHealth * factor));
        const ratio = this.maxHealth / old;
        this.health = Math.max(1, Math.round(this.health * ratio));
    },

    // ============ LEVEL-UP CARD FLOW ============
    triggerLevelUpCardSelection() {
        // Pause + show card selection via UI
        this.awaitingCardChoice = true;
        this.state = 'levelup';
        AudioManager.pauseMusic();
        AudioManager.play('victory');
        if (typeof UI !== 'undefined' && UI.showLevelUpCards) {
            UI.showLevelUpCards();
        }
    },

    onCardChosen(effectKey) {
        this.applyCardEffect(effectKey);
        this.playerLevel++;
        // Hide UI, resume
        if (typeof UI !== 'undefined' && UI.hideLevelUpCards) {
            UI.hideLevelUpCards();
        }
        this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
        if (this.pendingLevelUps > 0) {
            // Chain another card selection if multiple levels triggered at once
            this.triggerLevelUpCardSelection();
        } else {
            this.awaitingCardChoice = false;
            this.state = 'playing';
            AudioManager.resumeMusic();
        }
    },

    // ============ MAIN BOSS WARNING SEQUENCE ============
    _updateBossWarning(dt) {
        // bossWarningPending = true between -5s and -2s (silent count down)
        // bossWarningActive  = true during the 3-second visible warning
        if (this.bossWarningPending) {
            this.bossWarningSpawnIn -= dt;
            if (this.bossWarningSpawnIn <= CONFIG.MAIN_BOSS_WARNING_DURATION) {
                // Start the visible warning now (3 seconds before actual spawn)
                this.bossWarningActive = true;
                this.bossWarningTimeLeft = CONFIG.MAIN_BOSS_WARNING_DURATION;
                this.bossWarningPending = false;
                if (typeof UI !== 'undefined' && UI.showDangerWarning) UI.showDangerWarning();
            }
        }
        if (this.bossWarningActive) {
            this.bossWarningTimeLeft -= dt;
            if (this.bossWarningTimeLeft <= 0) {
                this.bossWarningActive = false;
                this.bossWarningTimeLeft = 0;
                if (typeof UI !== 'undefined' && UI.hideDangerWarning) UI.hideDangerWarning();
                // Spawn the main boss now
                this.spawnBoss(true);
            }
        }
    },

    // ============ PLAYER DEATH SEQUENCE ============
    beginPlayerDeath() {
        if (this.playerDying || this.deathPending) return;
        this.playerDying = true;
        this.playerDyingTimer = 0;
        this.deathPending = true;
        this.state = 'dying';
        AudioManager.stopMusic();
    },

    _updatePlayerDying(dt) {
        if (!this.playerDying) return;
        this.playerDyingTimer += dt;
        if (this.playerDyingTimer >= CONFIG.BOSS_DYING_DURATION) {
            // Begin white-fade transition to game over
            this.playerDying = false;
            this.playerFadePhase = 'in';
            this.playerFadeTimer = 0;
            if (typeof UI !== 'undefined' && UI.startWhiteFade) UI.startWhiteFade();
        }
    },

    _updatePlayerFade(dt) {
        if (this.playerFadePhase === 'none') return;
        this.playerFadeTimer += dt;
        // Phases: in (0-600ms), hold (600-900ms), out (900-1500ms)
        if (this.playerFadePhase === 'in' && this.playerFadeTimer >= 600) {
            this.playerFadePhase = 'hold';
            this.playerFadeTimer = 0;
            // While at full-white, switch to gameover screen
            this.finishGameOver();
        } else if (this.playerFadePhase === 'hold' && this.playerFadeTimer >= 300) {
            this.playerFadePhase = 'out';
            this.playerFadeTimer = 0;
            if (typeof UI !== 'undefined' && UI.endWhiteFade) UI.endWhiteFade();
        } else if (this.playerFadePhase === 'out' && this.playerFadeTimer >= 600) {
            this.playerFadePhase = 'none';
            this.playerFadeTimer = 0;
        }
    },

    update(dt) {
        // ===== Handle main-boss-defeat pause (game darkens for 2 seconds) =====
        if (this.mainBossDefeatPauseLeft > 0) {
            this.mainBossDefeatPauseLeft -= dt;
            // During this pause, bosses' dying-blink animation still progresses,
            // but no gameplay logic runs.
            for (const b of this.bosses) {
                if (b.dying) {
                    b.dyingTimer += dt;
                    if (b.dyingTimer >= CONFIG.BOSS_DYING_DURATION) {
                        b.alive = false;
                    }
                }
            }
            if (this.mainBossDefeatPauseLeft <= 0) {
                this.mainBossDefeatPauseLeft = 0;
                if (typeof UI !== 'undefined' && UI.hideDimOverlay) UI.hideDimOverlay();
            }
            return;
        }

        // ===== Handle level-up card selection (game paused) =====
        if (this.state === 'levelup' || this.awaitingCardChoice) {
            return;
        }

        // ===== Handle player dying / fade (no movement) =====
        if (this.state === 'dying') {
            this._updatePlayerDying(dt);
            this._updatePlayerFade(dt);
            return;
        }
        if (this.playerFadePhase !== 'none') {
            this._updatePlayerFade(dt);
            return;
        }

        if (this.state !== 'playing') return;
        this.animFrame++;
        this.gameTimer += dt;

        // ===== Supersonic cooldown ticking =====
        if (this.supersonicCooldownMs > 0) {
            this.supersonicCooldownMs -= dt;
            if (this.supersonicCooldownMs < 0) this.supersonicCooldownMs = 0;
        }

        // ===== Boss warning sequence =====
        this._updateBossWarning(dt);

        const moveLeft = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchState.left;
        const moveRight = this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchState.right;
        const jumpPressed = this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW'] || this.touchState.jump;
        const sonicPressed = this.keys['KeyF'] || this.keys['KeyX'] || this.touchState.sonic;
        const supersonicPressed = this.keys['KeyG'] || this.touchState.supersonic;
        const p = this.player;

        p.vx = 0;
        this.playerHasMoved = false;
        if (moveLeft)  { p.vx = -CONFIG.MOVE_SPEED; p.facingRight = false; this.playerHasMoved = true; }
        if (moveRight) { p.vx =  CONFIG.MOVE_SPEED; p.facingRight = true;  this.playerHasMoved = true; }

        if (jumpPressed && !this._jumpHeld) {
            if (p.jumps < p.maxJumps) {
                p.vy = (p.jumps === 0 ? CONFIG.JUMP_FORCE : CONFIG.DOUBLE_JUMP_FORCE);
                p.onGround = false;
                p.jumps++;
                AudioManager.play('jump');
            }
        }
        this._jumpHeld = jumpPressed;

        // ===== Normal SONIC =====
        if (sonicPressed && !this._sonicHeld && this.energy >= CONFIG.SONIC_ENERGY_COST) {
            this.energy -= CONFIG.SONIC_ENERGY_COST;
            const dir = p.facingRight ? 1 : -1;
            this.sonicWaves.push({
                x: p.x + (p.facingRight ? p.w : -CONFIG.SONIC_WAVE_WIDTH),
                y: p.y + p.h * 0.35,
                w: CONFIG.SONIC_WAVE_WIDTH, h: CONFIG.SONIC_WAVE_HEIGHT,
                vx: CONFIG.SONIC_WAVE_SPEED * dir, life: 70, dir: dir,
                damage: this.sonicDamage * this.sonicDamageMult,
                isSupersonic: false
            });
        }
        this._sonicHeld = sonicPressed;

        // ===== SUPERSONIC =====
        if (supersonicPressed && !this._supersonicHeld
            && this.supersonicCooldownMs <= 0
            && this.energy >= CONFIG.SUPERSONIC_ENERGY_THRESHOLD)
        {
            this.energy -= CONFIG.SUPERSONIC_ENERGY_COST;
            const dir = p.facingRight ? 1 : -1;
            const w = CONFIG.SONIC_WAVE_WIDTH * CONFIG.SUPERSONIC_WAVE_SIZE_MULT;
            const h = CONFIG.SONIC_WAVE_HEIGHT * CONFIG.SUPERSONIC_WAVE_SIZE_MULT;
            this.sonicWaves.push({
                x: p.x + (p.facingRight ? p.w : -w),
                y: p.y + p.h * 0.5 - h / 2,
                w: w, h: h,
                vx: (CONFIG.SONIC_WAVE_SPEED / CONFIG.SUPERSONIC_WAVE_SPEED_DIV) * dir,
                life: 240, dir: dir,
                damage: this.sonicDamage * this.supersonicDamageMult * CONFIG.SUPERSONIC_DAMAGE_MULT,
                isSupersonic: true
            });
            this.supersonicCooldownMs = this.supersonicCooldownDuration;
            AudioManager.play('victory');
        }
        this._supersonicHeld = supersonicPressed;

        p.vy += CONFIG.GRAVITY;
        if (p.vy > CONFIG.MAX_FALL_SPEED) p.vy = CONFIG.MAX_FALL_SPEED;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = 0;

        p.onGround = false;
        p.currentPlatform = null;
        for (const plat of this.platforms) {
            let groundOff;
            if (plat.tier === 1) groundOff = CONFIG.GROUND_ON_MAIN;
            else if (plat.tier === 2) groundOff = CONFIG.GROUND_ON_STATIC;
            else groundOff = CONFIG.GROUND_ON_MOVING;
            const surfaceY = plat.y + groundOff;
            const landY = surfaceY - p.h;
            if (p.vy >= 0 &&
                p.x + p.w > plat.x + 8 && p.x < plat.x + plat.w - 8 &&
                p.y + p.h >= surfaceY - 6 && p.y + p.h <= surfaceY + p.vy + 12) {
                p.y = landY;
                p.vy = 0;
                p.onGround = true;
                p.jumps = 0;
                p.currentPlatform = plat;
                break;
            }
        }

        if (p.y > this.vh + 80) {
            this.beginPlayerDeath();
            return;
        }

        const scrollRightX = this.cameraX + this.vw * CONFIG.SCROLL_THRESHOLD;
        if (p.x > scrollRightX) {
            const diff = p.x - scrollRightX;
            this.cameraX += diff * 0.12;
        } else if (p.x < this.cameraX + this.vw * 0.25) {
            const diff = (this.cameraX + this.vw * 0.25) - p.x;
            this.cameraX -= diff * 0.12;
        }
        if (this.cameraX < 0) this.cameraX = 0;

        if (this.cameraX + this.vw * 2.5 > this.worldEndX) {
            this.generateSegment();
        }

        for (const plat of this.platforms) {
            if (plat.type === 'moving') {
                plat.moveOffset += CONFIG.MOVING_PLATFORM_SPEED * plat.moveDir;
                if (plat.moveOffset > CONFIG.MOVING_PLATFORM_RANGE) {
                    plat.moveOffset = CONFIG.MOVING_PLATFORM_RANGE;
                    plat.moveDir = -1;
                } else if (plat.moveOffset < 0) {
                    plat.moveOffset = 0;
                    plat.moveDir = 1;
                }
                const oldY = plat.y;
                plat.y = plat.baseY - plat.moveOffset;
                if (p.currentPlatform === plat) {
                    p.y += plat.y - oldY;
                }
            }
        }

        for (const e of this.enemies) {
            if (!e.alive) continue;
            e.x += e.speed * e.dir;
            if (e.x <= e.platX + 10) e.dir = 1;
            else if (e.x + e.w >= e.platX + e.platW - 10) e.dir = -1;
            if (!p.invincible && this.rectsOverlap(p, e)) {
                if (p.vy > 0 && p.y + p.h - 12 < e.y + e.h * 0.5) {
                    e.alive = false;
                    p.vy = CONFIG.JUMP_FORCE * 0.7;
                    this.points += 25;
                    this.spawnParticles(e.x + e.w/2, e.y, '#ff6600', 8);
                    AudioManager.play('click');
                } else {
                    this.playerHit(10);
                }
            }
        }

        for (const fe of this.flyingEnemies) {
            if (!fe.alive) continue;
            fe.bobOffset += 0.03;
            fe.y = fe.baseY + Math.sin(fe.bobOffset) * CONFIG.FLYING_ENEMY_RANGE;
            if (!p.invincible && this.rectsOverlap(p, fe)) {
                if (p.vy > 0 && p.y + p.h - 10 < fe.y + fe.h * 0.5) {
                    fe.alive = false;
                    p.vy = CONFIG.JUMP_FORCE * 0.7;
                    this.points += 30;
                    this.spawnParticles(fe.x + fe.w/2, fe.y, '#00ffcc', 8);
                    AudioManager.play('click');
                } else {
                    this.playerHit(10);
                }
            }
        }

        // ===== BOSSES =====
        for (const b of this.bosses) {
            if (!b.alive) continue;

            // Boss in dying state: blink-only, no gameplay
            if (b.dying) {
                b.dyingTimer += dt;
                if (b.dyingTimer >= CONFIG.BOSS_DYING_DURATION) {
                    b.alive = false;
                }
                continue;
            }

            const playerAboveBoss =
                p.x + p.w > b.x && p.x < b.x + b.w &&
                p.y + p.h <= b.y;

            if (playerAboveBoss && !this.playerHasMoved) {
                b.x += b.speed * b.dir;
            } else {
                if (b.x + b.w / 2 > p.x + p.w / 2) { b.dir = -1; b.x -= b.speed; }
                else                                { b.dir =  1; b.x += b.speed; }
            }

            const surfaceY = this.mainPlatTop + CONFIG.GROUND_ON_MAIN;
            const baseFloatY = surfaceY - b.h - CONFIG.BOSS_FLOAT_HEIGHT;
            b.baseFloatY = baseFloatY;
            const gapFloatY = baseFloatY - CONFIG.BOSS_GAP_RISE;
            const sampleXs = [b.x + 4, b.x + b.w / 2, b.x + b.w - 4];
            let groundBelow = false;
            for (const sx of sampleXs) {
                if (this.hasGroundUnder(sx)) { groundBelow = true; break; }
            }
            const liftSpeed = 3;
            if (!groundBelow) {
                if (b.gapState === 'normal') b.gapState = 'rising';
                if (b.gapState === 'rising' || b.gapState === 'descending') {
                    if (b.y > gapFloatY) b.y = Math.max(gapFloatY, b.y - liftSpeed);
                    if (b.y <= gapFloatY + 0.5) { b.y = gapFloatY; b.gapState = 'crossing'; }
                }
                if (b.gapState === 'crossing') b.y = gapFloatY;
            } else {
                if (b.gapState === 'crossing' || b.gapState === 'rising') b.gapState = 'descending';
                if (b.gapState === 'descending') {
                    if (b.y < baseFloatY) b.y = Math.min(baseFloatY, b.y + liftSpeed);
                    if (b.y >= baseFloatY - 0.5) { b.y = baseFloatY; b.gapState = 'normal'; }
                } else {
                    b.y = baseFloatY;
                }
            }

            if (b.hitFlash > 0) b.hitFlash--;

            b.sonicTimer += dt;
            const interval = b.isMainBoss ? CONFIG.BOSS_SONIC_INTERVAL : CONFIG.MINI_BOSS_SONIC_INTERVAL;
            if (b.sonicTimer >= interval) {
                b.sonicTimer = 0;
                const bDir = b.dir;
                if (b.isMainBoss) {
                    this.bossSonicWaves.push({
                        x: b.x + (bDir > 0 ? b.w : -CONFIG.BOSS_SONIC_WIDTH),
                        y: b.y + b.h * 0.3,
                        w: CONFIG.BOSS_SONIC_WIDTH, h: CONFIG.BOSS_SONIC_HEIGHT,
                        vx: CONFIG.BOSS_SONIC_SPEED * bDir,
                        life: CONFIG.BOSS_SONIC_LIFE, dir: bDir,
                        damage: CONFIG.BOSS_SONIC_DAMAGE,
                        isMainBossWave: true
                    });
                } else {
                    const mw = CONFIG.SONIC_WAVE_WIDTH * 1.5;
                    const mh = CONFIG.SONIC_WAVE_HEIGHT * 1.5;
                    this.bossSonicWaves.push({
                        x: b.x + (bDir > 0 ? b.w : -mw),
                        y: b.y + b.h * 0.35,
                        w: mw, h: mh,
                        vx: CONFIG.MINI_BOSS_SONIC_SPEED * bDir,
                        life: CONFIG.MINI_BOSS_SONIC_LIFE, dir: bDir,
                        damage: CONFIG.MINI_BOSS_SONIC_DAMAGE,
                        isMainBossWave: false
                    });
                }
            }

            if (!p.invincible && this.rectsOverlap(p, b)) {
                if (p.vy > 0 && p.y + p.h - 12 < b.y + b.h * 0.4) {
                    b.health--; b.hitFlash = 10;
                    p.vy = CONFIG.JUMP_FORCE * 0.8;
                    this.spawnParticles(b.x + b.w/2, b.y, '#ff3333', 12);
                    AudioManager.play('click');
                    if (b.health <= 0) {
                        this._beginBossDying(b);
                    }
                } else {
                    this.playerHit(b.isMainBoss ? 25 : 20);
                }
            }
        }

        for (let i = this.bossSonicWaves.length - 1; i >= 0; i--) {
            const bsw = this.bossSonicWaves[i];
            bsw.x += bsw.vx; bsw.life--;
            if (bsw.life <= 0 || bsw.x < this.cameraX - 300 || bsw.x > this.cameraX + this.vw + 300) {
                this.bossSonicWaves.splice(i, 1); continue;
            }
            if (!p.invincible && this.rectsOverlap(bsw, p)) {
                this.playerHit(bsw.damage != null ? bsw.damage : CONFIG.BOSS_SONIC_DAMAGE);
                this.spawnParticles(p.x + p.w/2, p.y + p.h/2, '#ff4400', 10);
                this.bossSonicWaves.splice(i, 1);
            }
        }

        // ===== TIME-BASED BOSS SPAWNING =====
        this.miniBossSpawnTimer += dt;
        this.mainBossSpawnTimer += dt;
        while (this.miniBossSpawnTimer >= CONFIG.MINI_BOSS_SPAWN_INTERVAL) {
            this.miniBossSpawnTimer -= CONFIG.MINI_BOSS_SPAWN_INTERVAL;
            this.spawnBoss(false);
        }
        // Trigger main-boss warning 5 seconds before each scheduled spawn.
        // We do NOT spawn the main boss here directly — _updateBossWarning() spawns it
        // exactly when the visible 3-second warning ends.
        if (!this.bossWarningPending && !this.bossWarningActive
            && this.mainBossSpawnTimer >= (CONFIG.MAIN_BOSS_SPAWN_INTERVAL - CONFIG.MAIN_BOSS_WARNING_LEAD))
        {
            // Consume one full main-boss interval and arm the warning
            this.mainBossSpawnTimer -= CONFIG.MAIN_BOSS_SPAWN_INTERVAL;
            this.bossWarningPending = true;
            this.bossWarningSpawnIn = CONFIG.MAIN_BOSS_WARNING_LEAD; // 5s
        }

        for (let i = this.sonicWaves.length - 1; i >= 0; i--) {
            const w = this.sonicWaves[i];
            w.x += w.vx; w.life--;
            if (w.life <= 0 || w.x < this.cameraX - 600 || w.x > this.cameraX + this.vw + 600) {
                this.sonicWaves.splice(i, 1); continue;
            }
            let consumed = false;
            for (const e of this.enemies) {
                if (e.alive && this.rectsOverlap(w, e)) {
                    e.alive = false; this.points += 25;
                    this.spawnParticles(e.x + e.w/2, e.y, '#b400ff', 8);
                    AudioManager.play('click');
                    if (!w.isSupersonic) { this.sonicWaves.splice(i, 1); consumed = true; }
                    break;
                }
            }
            if (consumed) continue;
            for (const fe of this.flyingEnemies) {
                if (fe.alive && this.rectsOverlap(w, fe)) {
                    fe.alive = false; this.points += 30;
                    this.spawnParticles(fe.x + fe.w/2, fe.y, '#b400ff', 8);
                    AudioManager.play('click');
                    if (!w.isSupersonic) { this.sonicWaves.splice(i, 1); consumed = true; }
                    break;
                }
            }
            if (consumed) continue;

            let hitABoss = false;
            for (const b of this.bosses) {
                if (!b.alive || b.dying) continue;
                if (this.rectsOverlap(w, b)) {
                    const dmg = (w.damage != null) ? w.damage : this.sonicDamage;
                    b.health -= dmg; b.hitFlash = 10;
                    this.spawnParticles(b.x + b.w/2, b.y, '#b400ff', 10);
                    AudioManager.play('click');
                    if (b.health <= 0) {
                        this._beginBossDying(b);
                    }
                    if (!w.isSupersonic) { hitABoss = true; break; }
                }
            }
            if (hitABoss) { this.sonicWaves.splice(i, 1); }
        }

        for (const g of this.golds) {
            if (!g.collected && this.circleRectOverlap(g.x, g.y, g.size/2, p)) {
                g.collected = true; this.points += CONFIG.GOLD_POINTS;
                this.spawnParticles(g.x, g.y, '#ffd700', 5);
                AudioManager.play('click');
            }
        }

        for (const hp of this.healthPacks) {
            if (!hp.collected && this.circleRectOverlap(hp.x, hp.y, hp.size/2, p)) {
                hp.collected = true;
                this.health = Math.min(this.maxHealth, this.health + 25);
                this.spawnParticles(hp.x, hp.y, '#ff2244', 5);
                AudioManager.play('click');
            }
        }

        for (const ep of this.energyPacks) {
            if (!ep.collected && this.circleRectOverlap(ep.x, ep.y, ep.size/2, p)) {
                ep.collected = true;
                this.energy = Math.min(this.maxEnergy, this.energy + 30);
                this.spawnParticles(ep.x, ep.y, '#ffcc00', 5);
                AudioManager.play('click');
            }
        }

        // NEW: Collect shield packs
        for (const sp of this.shieldPacks) {
            if (!sp.collected && this.circleRectOverlap(sp.x, sp.y, sp.size/2, p)) {
                sp.collected = true;
                // Activate shield (or top it up if already active)
                if (this.maxShield <= 0) {
                    this.maxShield = Math.round(this.maxHealth * CONFIG.SHIELD_HEALTH_RATIO);
                }
                this.shield = this.maxShield;
                this.shieldActive = true;
                this.spawnParticles(sp.x, sp.y, '#5bf9f8', 8);
                AudioManager.play('click');
            }
        }

        this.energy = Math.min(this.maxEnergy, this.energy + CONFIG.ENERGY_REGEN_RATE * this.energyRegenMult);
        if (p.invincible) { p.invTimer--; if (p.invTimer <= 0) p.invincible = false; }
        if (this.shieldHitFlash > 0) this.shieldHitFlash--;

        // ===== POINT-BASED LEVEL UP (every 500 points) — NEW =====
        // Triggers exactly at every 500-point milestone.
        const expectedLevel = Math.floor(this.points / CONFIG.LEVEL_UP_POINTS) + 1;
        if (expectedLevel > this.playerLevel + this.pendingLevelUps) {
            this.pendingLevelUps += (expectedLevel - this.playerLevel - this.pendingLevelUps);
            this.triggerLevelUpCardSelection();
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2;
            pt.life--; pt.alpha = pt.life / pt.maxLife;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }

        const cleanX = this.cameraX - this.vw;
        this.enemies = this.enemies.filter(e => e.alive && e.x + e.w > cleanX);
        this.flyingEnemies = this.flyingEnemies.filter(e => e.alive && e.x + e.w > cleanX);
        this.golds = this.golds.filter(g => !g.collected || g.x > cleanX);
        this.healthPacks = this.healthPacks.filter(h => !h.collected || h.x > cleanX);
        this.energyPacks = this.energyPacks.filter(e => !e.collected || e.x > cleanX);
        this.shieldPacks = this.shieldPacks.filter(s => !s.collected || s.x > cleanX);
        this.platforms = this.platforms.filter(p => p.x + p.w > cleanX);
        // Keep dying bosses around so the blink can finish
        this.bosses = this.bosses.filter(b => (b.alive || b.dying) && b.x + b.w > cleanX - 400 && b.x < this.cameraX + this.vw + 2000);

        if (this.points > this.highScore) {
            this.highScore = this.points;
        }
    },

    // ============ BOSS DYING ============
    _beginBossDying(b) {
        if (b.dying) return;
        b.dying = true;
        b.dyingTimer = 0;
        this.bossesDefeated++;
        this.points += b.isMainBoss ? 500 : 200;
        this.spawnParticles(b.x + b.w/2, b.y + b.h/2, '#ffcc00', b.isMainBoss ? 35 : 20);
        AudioManager.play('victory');
        // Main-boss defeated → game-wide pause (2s) with dim overlay
        if (b.isMainBoss) {
            this.mainBossDefeatPauseLeft = CONFIG.MAIN_BOSS_DEFEAT_PAUSE;
            if (typeof UI !== 'undefined' && UI.showDimOverlay) UI.showDimOverlay();
        }
    },

    // Backwards-compatible helper (some places still call playerHit)
    playerHit(damage) {
        this.applyDamageToPlayer(damage);
    },

    render() {
        const ctx = this.ctx;
        const W = this.vw;
        const H = this.vh;
        ctx.clearRect(0, 0, W, H);
        if (this.state === 'start' || this.state === 'selection' || this.state === 'guide' || this.state === 'loading') return;
        this.drawBackground(ctx, W, H);
        ctx.save();
        ctx.translate(-this.cameraX, 0);
        
        for (const plat of this.platforms) {
            if (plat.type === 'main') this.drawPlatform(ctx, plat);
        }
        for (const plat of this.platforms) {
            if (plat.type === 'moving') this.drawPlatform(ctx, plat);
        }
        for (const plat of this.platforms) {
            if (plat.type === 'static') this.drawPlatform(ctx, plat);
        }
        
        for (const g of this.golds) {
            if (g.collected) continue;
            const bob = Math.sin(this.animFrame * 0.05 + g.bobOffset) * 6;
            this.drawGold(ctx, g.x, g.y + bob, g.size);
        }
        for (const hp of this.healthPacks) {
            if (hp.collected) continue;
            const bob = Math.sin(this.animFrame * 0.05 + hp.bobOffset) * 6;
            this.drawHealthPack(ctx, hp.x, hp.y + bob, hp.size);
        }
        for (const ep of this.energyPacks) {
            if (ep.collected) continue;
            const bob = Math.sin(this.animFrame * 0.05 + ep.bobOffset) * 6;
            this.drawEnergyPack(ctx, ep.x, ep.y + bob, ep.size);
        }
        for (const sp of this.shieldPacks) {
            if (sp.collected) continue;
            const bob = Math.sin(this.animFrame * 0.05 + sp.bobOffset) * 6;
            this.drawShieldPack(ctx, sp.x, sp.y + bob, sp.size);
        }
        for (const e of this.enemies) { if (e.alive) this.drawEnemy(ctx, e); }
        for (const fe of this.flyingEnemies) { if (fe.alive) this.drawFlyingEnemy(ctx, fe); }
        for (const b of this.bosses) { if (b.alive) this.drawBoss(ctx, b); }
        if (this.player) {
            this.drawPlayer(ctx, this.player);
            // Shield overlay AFTER player
            if (this.shieldActive && this.shield > 0) {
                this.drawShieldOverlay(ctx, this.player);
            }
        }
        for (const sw of this.sonicWaves) this.drawSonicWave(ctx, sw);
        for (const bsw of this.bossSonicWaves) this.drawBossSonicWave(ctx, bsw);
        for (const pt of this.particles) {
            ctx.globalAlpha = pt.alpha;
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    },

    drawBackground(ctx, W, H) {
        const skyImg = ImageCache['bg_sky.png'];
        if (skyImg) {
            const skyH = H;
            const skyW = skyH * (skyImg.naturalWidth / skyImg.naturalHeight);
            for (let x = 0; x < W; x += skyW) {
                ctx.drawImage(skyImg, x, 0, skyW, skyH);
            }
        } else {
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, '#00c8d0');
            grad.addColorStop(0.5, '#2060d0');
            grad.addColorStop(1, '#8030c0');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }
        const farImg = ImageCache['city_far.png'];
        if (farImg) {
            const farH = H;
            const farW = farH * (farImg.naturalWidth / farImg.naturalHeight);
            const farY = H - farH;
            const parallax = this.cameraX * 0.2;
            let startX = -(parallax % farW);
            if (startX > 0) startX -= farW;
            for (let x = startX; x < W + farW; x += farW) {
                ctx.drawImage(farImg, x, farY, farW, farH);
            }
        }
        const midImg = ImageCache['city_mid.png'];
        if (midImg) {
            const midH = H;
            const midW = midH * (midImg.naturalWidth / midImg.naturalHeight);
            const midY = H - midH;
            const parallax = this.cameraX * 0.45;
            let startX = -(parallax % midW);
            if (startX > 0) startX -= midW;
            for (let x = startX; x < W + midW; x += midW) {
                ctx.drawImage(midImg, x, midY, midW, midH);
            }
        }
    },

    drawPlatform(ctx, plat) {
        let filename;
        if (plat.type === 'main') filename = 'platform_main.png';
        else if (plat.type === 'static') filename = 'platform_static.png';
        else filename = 'platform_moving.png';
        const img = ImageCache[filename];
        if (img) {
            const drawH = plat.h;
            const drawW = drawH * (img.naturalWidth / img.naturalHeight);
            let drawX = plat.x;
            const endX = plat.x + plat.w;
            
            if (plat.type === 'main') {
                while (drawX + drawW <= endX + 0.1) {
                    ctx.drawImage(img, drawX, plat.y, drawW, drawH);
                    drawX += drawW;
                }
            } else {
                ctx.save();
                ctx.beginPath();
                ctx.rect(plat.x, plat.y, plat.w, plat.h);
                ctx.clip();
                while (drawX < endX) {
                    ctx.drawImage(img, drawX, plat.y, drawW, drawH);
                    drawX += drawW;
                }
                ctx.restore();
            }
        } else {
            ctx.fillStyle = plat.type === 'main' ? '#556677' : '#668899';
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }
    },

    drawPlayer(ctx, p) {
        // During dying state, blink the player
        if (this.playerDying) {
            // Toggle visibility every ~6 frames for a flashing effect
            if (Math.floor(this.animFrame / 5) % 2 === 0) return;
        }
        if (p.invincible && !this.playerDying && Math.floor(this.animFrame / 4) % 2 === 0) return;
        const filename = getFilename(p.img);
        const img = ImageCache[filename];
        if (img) {
            ctx.save();
            if (!p.facingRight) {
                ctx.translate(p.x + p.w, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, p.y, p.w, p.h);
            } else {
                ctx.drawImage(img, p.x, p.y, p.w, p.h);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#00d4ff';
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
    },

    // === SHIELD OVERLAY === transparent spherical shield with horizontal gradient
    drawShieldOverlay(ctx, p) {
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const radius = Math.max(p.w, p.h) * 0.85;

        // Hit-flash bumps overall opacity briefly
        const hitBoost = this.shieldHitFlash > 0 ? Math.min(0.6, this.shieldHitFlash / 30) : 0;
        const baseAlpha = 0.35 + hitBoost;

        ctx.save();
        ctx.globalAlpha = 1;

        // HORIZONTAL gradient: very low opacity in middle, slightly higher towards left/right outer sides
        const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
        // Outer left: more pronounced
        grad.addColorStop(0.00, `rgba(91, 249, 248, ${0.55 * baseAlpha + hitBoost * 0.4})`);
        grad.addColorStop(0.20, `rgba(91, 249, 248, ${0.30 * baseAlpha + hitBoost * 0.25})`);
        // Middle: very transparent (player remains clearly visible)
        grad.addColorStop(0.50, `rgba(132, 250, 249, ${0.05 * baseAlpha + hitBoost * 0.08})`);
        grad.addColorStop(0.80, `rgba(91, 249, 248, ${0.30 * baseAlpha + hitBoost * 0.25})`);
        // Outer right: more pronounced
        grad.addColorStop(1.00, `rgba(91, 249, 248, ${0.55 * baseAlpha + hitBoost * 0.4})`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        // Spherical (circular) shape
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle outer glow ring (still no stroke / no border) — using a soft radial
        const ringGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius);
        ringGrad.addColorStop(0, 'rgba(91, 249, 248, 0)');
        ringGrad.addColorStop(1, `rgba(91, 249, 248, ${0.20 * baseAlpha + hitBoost * 0.20})`);
        ctx.fillStyle = ringGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    drawEnemy(ctx, e) {
        const filename = getFilename(e.img);
        const img = ImageCache[filename];
        if (img) {
            ctx.save();
            if (e.dir < 0) {
                ctx.translate(e.x + e.w, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, e.y, e.w, e.h);
            } else {
                ctx.drawImage(img, e.x, e.y, e.w, e.h);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(e.x, e.y, e.w, e.h);
        }
    },

    drawFlyingEnemy(ctx, fe) {
        const img = ImageCache['flying_enemy.png'];
        if (img) {
            ctx.drawImage(img, fe.x, fe.y, fe.w, fe.h);
        } else {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(fe.x, fe.y, fe.w, fe.h);
        }
    },

    drawBoss(ctx, b) {
        const filename = getFilename(b.img);
        const img = ImageCache[filename];
        if (img) {
            ctx.save();
            // Dying blink: toggle visibility every ~5 frames
            if (b.dying) {
                if (Math.floor(this.animFrame / 5) % 2 === 0) {
                    ctx.restore();
                    return;
                }
                ctx.globalAlpha = 0.85;
            } else if (b.hitFlash > 0) {
                ctx.globalAlpha = 0.5 + Math.sin(this.animFrame) * 0.5;
            }
            if (b.dir < 0) {
                ctx.translate(b.x + b.w, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, b.y, b.w, b.h);
            } else {
                ctx.drawImage(img, b.x, b.y, b.w, b.h);
            }
            ctx.restore();
            if (!b.dying) {
                const barW = b.w, barH = 10, barX = b.x, barY = b.y - 22;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = '#ff2244';
                ctx.fillRect(barX, barY, barW * (b.health / b.maxHealth), barH);
                ctx.strokeStyle = '#ff6699'; ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barW, barH);
                ctx.font = 'bold 16px Orbitron';
                ctx.fillStyle = '#ff2244'; ctx.textAlign = 'center';
                ctx.shadowColor = '#ff0044'; ctx.shadowBlur = 10;
                const bossLabel = b.isMainBoss ? '⚠ MAIN BOSS ⚠' : `⚠ BOSS: ${b.name} ⚠`;
                if (b.isMainBoss) {
                    ctx.font = 'bold 22px Orbitron';
                    ctx.fillStyle = '#ff4400';
                    ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 15;
                }
                ctx.fillText(bossLabel, b.x + b.w/2, barY - 8);
                ctx.shadowBlur = 0;
            }
        }
    },

    drawGold(ctx, x, y, size) {
        const glow = Math.sin(this.animFrame * 0.1) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12 * glow;
        ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, y, size/2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, size/2 - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(x, y, size/2 - 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff8dc';
        ctx.beginPath();
        ctx.arc(x - size*0.08, y - size*0.08, size*0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    drawHealthPack(ctx, x, y, size) {
        const glow = Math.sin(this.animFrame * 0.08 + 1) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 12 * glow;
        ctx.fillStyle = '#ff2244';
        const s = size * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.3);
        ctx.bezierCurveTo(x, y - s * 0.3, x - s, y - s * 0.3, x - s, y + s * 0.1);
        ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s, x, y + s);
        ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.6, x + s, y + s * 0.1);
        ctx.bezierCurveTo(x + s, y - s * 0.3, x, y - s * 0.3, x, y + s * 0.3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    },
    
    drawEnergyPack(ctx, x, y, size) {
        const glow = Math.sin(this.animFrame * 0.08 + 2) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 14 * glow;
        const s = size * 0.55;
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.1, y - s);
        ctx.lineTo(x - s * 0.5, y + s * 0.1);
        ctx.lineTo(x - s * 0.05, y + s * 0.1);
        ctx.lineTo(x - s * 0.15, y + s);
        ctx.lineTo(x + s * 0.5, y - s * 0.1);
        ctx.lineTo(x + s * 0.05, y - s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff8dc';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.05, y - s * 0.7);
        ctx.lineTo(x - s * 0.3, y + s * 0.1);
        ctx.lineTo(x - s * 0.0, y + s * 0.1);
        ctx.lineTo(x - s * 0.08, y + s * 0.7);
        ctx.lineTo(x + s * 0.3, y - s * 0.1);
        ctx.lineTo(x + s * 0.02, y - s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    // NEW: shield pack — light blue badge/shield icon
    drawShieldPack(ctx, x, y, size) {
        const glow = Math.sin(this.animFrame * 0.08 + 3) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = '#5bf9f8'; ctx.shadowBlur = 14 * glow;
        const s = size * 0.55;
        // Outer shield shape (rounded shield)
        ctx.fillStyle = '#5bf9f8';
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.bezierCurveTo(x + s, y - s, x + s, y, x + s * 0.6, y + s * 0.5);
        ctx.bezierCurveTo(x + s * 0.3, y + s, x, y + s, x, y + s);
        ctx.bezierCurveTo(x, y + s, x - s * 0.3, y + s, x - s * 0.6, y + s * 0.5);
        ctx.bezierCurveTo(x - s, y, x - s, y - s, x, y - s);
        ctx.closePath();
        ctx.fill();
        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(x - s * 0.2, y - s * 0.2, s * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    drawBossSonicWave(ctx, bsw) {
        const lifeRef = bsw.isMainBossWave ? 40 : 30;
        ctx.save();
        ctx.globalAlpha = Math.min(bsw.life / lifeRef, 1.0);
        const cx = bsw.x + bsw.w / 2;
        const cy = bsw.y + bsw.h / 2;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, bsw.w * 0.8);
        gradient.addColorStop(0, 'rgba(255, 68, 0, 0.7)');
        gradient.addColorStop(0.4, 'rgba(255, 34, 34, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(cx, cy, bsw.w * 0.5, bsw.h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bsw.w * 0.25);
        innerGrad.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
        innerGrad.addColorStop(0.5, 'rgba(255, 150, 0, 0.5)');
        innerGrad.addColorStop(1, 'rgba(255, 68, 0, 0)');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, bsw.w * 0.2, bsw.h * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    },

    drawSonicWave(ctx, sw) {
        // Supersonic uses SAME color as normal sonic, but bigger
        ctx.save();
        const lifeRef = sw.isSupersonic ? 240 : 70;
        ctx.globalAlpha = Math.min(sw.life / lifeRef, 1.0);
        const gradient = ctx.createRadialGradient(
            sw.x + sw.w/2, sw.y + sw.h/2, 0,
            sw.x + sw.w/2, sw.y + sw.h/2, sw.w
        );
        gradient.addColorStop(0, 'rgba(72, 212, 255, 0.55)');
        gradient.addColorStop(0.5, 'rgba(92, 142, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(sw.x + sw.w/2, sw.y + sw.h/2, sw.w*0.7, sw.h*0.5, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(sw.x + sw.w/2, sw.y + sw.h/2, sw.w*0.2, sw.h*0.15, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    },

    rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    },

    circleRectOverlap(cx, cy, cr, rect) {
        const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
        const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
        const dx = cx - closestX, dy = cy - closestY;
        return (dx*dx + dy*dy) < (cr*cr);
    },

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 1) * 6,
                size: 3 + Math.random() * 5,
                color, life: 25 + Math.random() * 20,
                maxLife: 45, alpha: 1
            });
        }
    },

    // Called by the white-fade mid-phase to actually switch to the Game Over screen
    finishGameOver() {
        this.state = 'gameover';
        if (this.points > this.highScore) {
            this.highScore = this.points;
        }
        AudioManager.stopMusic();
        AudioManager.play('game_over');
        UI.showGameOver(this.points, this.highScore);
    },

    // Legacy entry-point kept for compatibility (now wires through the dying sequence)
    gameOver() {
        this.beginPlayerDeath();
    },

    startGame() {
        this.state = 'playing';
        this.cameraX = 0; this.maxCameraX = 0;
        this.points = 0;

        // Reset player stat caps + values
        this.maxHealth = CONFIG.PLAYER_BASE_MAX_HEALTH;
        this.maxEnergy = CONFIG.PLAYER_BASE_MAX_ENERGY;
        this.health = this.maxHealth;
        this.energy = this.maxEnergy;
        this.damageReduction = 0;

        // Reset shield
        this.maxShield = 0;
        this.shield = 0;
        this.shieldActive = false;
        this.shieldHitFlash = 0;

        // Reset supersonic + damage multipliers
        this.supersonicCooldownMs = 0;
        this.supersonicCooldownDuration = CONFIG.SUPERSONIC_COOLDOWN_MS;
        this.supersonicDamageMult = 1;
        this.sonicDamageMult = 1;
        this.energyRegenMult = 1;

        this.playerLevel = 1;
        this.sonicDamage = 1;
        this.lastLevelUpAt = 0;
        this.levelUpAnim = null;
        this.pendingLevelUps = 0;
        this.awaitingCardChoice = false;

        // Reset boss warning + main-boss-defeat pause
        this.bossWarningActive = false;
        this.bossWarningPending = false;
        this.bossWarningTimeLeft = 0;
        this.bossWarningSpawnIn = 0;
        this.mainBossDefeatPauseLeft = 0;

        // Reset death-fade state
        this.playerDying = false;
        this.playerDyingTimer = 0;
        this.playerFadePhase = 'none';
        this.playerFadeTimer = 0;
        this.deathPending = false;

        this.bossSonicWaves = [];
        this.gameTimer = 0;
        this.miniBossSpawnTimer = 0;
        this.mainBossSpawnTimer = 0;
        this.accumulator = 0;
        this._jumpHeld = false; this._sonicHeld = false; this._supersonicHeld = false;
        this.updateCanvasSize();
        this.generateInitialWorld();
        this.createPlayer();

        // Reset UI elements
        if (typeof UI !== 'undefined') {
            if (UI.hideDangerWarning) UI.hideDangerWarning();
            if (UI.hideDimOverlay) UI.hideDimOverlay();
            if (UI.endWhiteFade) UI.endWhiteFade();
            if (UI.hideLevelUpCards) UI.hideLevelUpCards();
            if (UI.updateShieldBarVisibility) UI.updateShieldBarVisibility();
            if (UI.updateSupersonicButton) UI.updateSupersonicButton();
        }

        AudioManager.playMusic();
    },

    pauseGame() { this.state = 'paused'; AudioManager.pauseMusic(); },
    resumeGame() { this.state = 'playing'; AudioManager.resumeMusic(); },

    loop(timestamp) {
        let frameTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        if (frameTime > 250) frameTime = 250;
        if (frameTime < 0) frameTime = 0;
        this.deltaTime = frameTime;

        this.accumulator += frameTime;
        const maxCatchUp = CONFIG.FIXED_DT * 5;
        if (this.accumulator > maxCatchUp) this.accumulator = maxCatchUp;

        while (this.accumulator >= CONFIG.FIXED_DT) {
            this.update(CONFIG.FIXED_DT);
            this.accumulator -= CONFIG.FIXED_DT;
        }

        this.render();
        if (this.state === 'playing' || this.state === 'levelup' || this.state === 'dying') {
            UI.updateHUD(this.health, this.energy, this.points, this.gameTimer, this.highScore);
        }
        requestAnimationFrame((t) => this.loop(t));
    },

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }
};
