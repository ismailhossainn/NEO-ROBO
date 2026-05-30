/* ========================================
   NEO-ROBO - Game Engine (v4)
   ADDED in v4:
   - Shield collectible + shield system (1/3 max HP, absorbs first)
   - Supersonic wave button (4x size, 3x dmg, 1/4 speed, 30s cd, 80% energy)
   - Time-slow + cut-in animation (3s) on Supersonic
   - Boss DANGER warning (5s lead, 3s warning)
   - Character defeat blink (3s) + main-boss-defeat 2s freeze
   - Player-death white fade-in/out transition
   - Point-based level-up CARD system (every 500 pts)
     -- old automatic stat scaling DISABLED
   - LEVELUP_CARDS centralized registry (data-driven)
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

function getFilename(path) { return path.split('/').pop(); }

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
    MINI_BOSS_SPAWN_INTERVAL: 40000,
    MAIN_BOSS_SPAWN_INTERVAL: 150000,   // ← 2 minutes 30 seconds (per spec)
    MAIN_BOSS_SCALE: 3.0,
    MAIN_BOSS_HEALTH: 8,
    BOSS_FLOAT_HEIGHT: 0,
    BOSS_GAP_RISE: 50,
    GOLD_SIZE: 40,
    HEALTH_SIZE: 34,
    SHIELD_SIZE: 38,
    GOLD_POINTS: 10,
    SONIC_WAVE_SPEED: 14,
    SONIC_WAVE_WIDTH: 25,
    SONIC_WAVE_HEIGHT: 25,
    SONIC_ENERGY_COST: 15,
    ENERGY_REGEN_RATE: 0.08,
    CAMERA_LOCK_DISTANCE: 600,
    SCROLL_THRESHOLD: 0.35,
    GAP_MIN: 140,
    GAP_MAX: 250,
    SEGMENT_LENGTH: 1920,
    LEVEL_UP_POINTS: 500,               // ← every 500 points triggers card overlay
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

    // ===== SHIELD =====
    PLAYER_MAX_HEALTH: 100,
    SHIELD_MAX_RATIO: 1 / 3,            // shield = 1/3 player max HP

    // ===== SUPERSONIC =====
    SUPERSONIC_ENERGY_THRESHOLD: 80,    // energy ≥ 80% to activate
    SUPERSONIC_COOLDOWN: 30000,         // 30s cooldown
    SUPERSONIC_DAMAGE_MULT: 3,
    SUPERSONIC_SIZE_MULT: 4,
    SUPERSONIC_SPEED_MULT: 0.25,        // 1/4 of normal wave speed
    SUPERSONIC_SLOWMO: 0.25,            // game runs at 1/4 speed
    SUPERSONIC_CUTIN_DURATION: 3000,    // 3s total (slow-mo + cut-in)
    SUPERSONIC_ENERGY_COST: 40,         // base cost; can be free, your call. Set modest.

    // ===== BOSS WARNING =====
    MAIN_BOSS_WARN_LEAD: 5000,          // start warning 5s before spawn
    MAIN_BOSS_WARN_DURATION: 3000,      // warning lasts 3s

    // ===== DEFEAT EFFECT =====
    DEFEAT_BLINK_DURATION: 3000,        // 3s white blink on death (player/boss)
    MAIN_BOSS_DEATH_FREEZE: 2000,       // 2s freeze when MAIN boss defeated
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

/* ============================================================
   LEVEL-UP CARD REGISTRY (centralized, data-driven)
   Edit values / text / effects here and they cascade across the
   entire game. Adding a new card = adding one entry to this list.
   Each card MUST have:
     id, category ('A'|'B'|'C'|'D'), name, description, icon, apply(Game)
   ============================================================ */
const LEVELUP_CARDS = [
    // -------- Category A — HEALTH --------
    {
        id: 'CARD-01', category: 'A',
        icon: '❤',
        name: 'Health Refill (Small)',
        description: 'Instantly restores 30% of your current max health.',
        apply: (G) => { G.health = Math.min(G.maxHealth, G.health + G.maxHealth * 0.30); }
    },
    {
        id: 'CARD-02', category: 'A',
        icon: '❤❤',
        name: 'Health Refill (Medium)',
        description: 'Instantly restores 50% of your current max health.',
        apply: (G) => { G.health = Math.min(G.maxHealth, G.health + G.maxHealth * 0.50); }
    },
    {
        id: 'CARD-03', category: 'A',
        icon: '✚',
        name: 'Max Health Boost & Fortify',
        description: '+30% max health (permanent). +10% damage reduction (permanent).',
        apply: (G) => {
            const oldMax = G.maxHealth;
            G.maxHealth = Math.round(oldMax * 1.30);
            G.health += (G.maxHealth - oldMax);
            G.damageReduction = Math.min(0.9, (G.damageReduction || 0) + 0.10);
        }
    },
    {
        id: 'CARD-04', category: 'A',
        icon: '❣',
        name: 'Max Health Boost',
        description: '+20% max health (permanent).',
        apply: (G) => {
            const oldMax = G.maxHealth;
            G.maxHealth = Math.round(oldMax * 1.20);
            G.health += (G.maxHealth - oldMax);
        }
    },

    // -------- Category B — SHIELD --------
    {
        id: 'CARD-05', category: 'B',
        icon: '🛡',
        name: 'Basic Shield Activator',
        description: 'Instantly deploys a standard protective shield.',
        apply: (G) => { G.activateShield(1.0); }
    },
    {
        id: 'CARD-06', category: 'B',
        icon: '🛡✦',
        name: 'Heavy Shield Overload',
        description: 'Deploys a stronger shield (1.75× capacity) — soaks heavy hits.',
        apply: (G) => { G.activateShield(1.75); }
    },
    {
        id: 'CARD-07', category: 'B',
        icon: '🛡⚙',
        name: 'Shield Efficiency Matrix',
        description: 'Permanent: shields take 40% less damage per hit.',
        apply: (G) => { G.shieldEfficiency = Math.min(0.9, (G.shieldEfficiency || 0) + 0.40); }
    },

    // -------- Category C — SPEED --------
    {
        id: 'CARD-08', category: 'C',
        icon: '➤',
        name: 'Sonic Speed Core',
        description: '+15% movement speed (permanent).',
        apply: (G) => { G.moveSpeedMult = (G.moveSpeedMult || 1) * 1.15; }
    },
    {
        id: 'CARD-09', category: 'C',
        icon: '➤➤',
        name: 'Supersonic Overdrive',
        description: '+25% movement speed (permanent).',
        apply: (G) => { G.moveSpeedMult = (G.moveSpeedMult || 1) * 1.25; }
    },
    {
        id: 'CARD-10', category: 'C',
        icon: '⟲',
        name: 'Kinetic Agility',
        description: 'Tighter control: faster acceleration and 25% lower hit-stun duration.',
        apply: (G) => {
            G.kineticAgility = true;
            G.invFramesMult = Math.min(2, (G.invFramesMult || 1) * 1.25);   // longer i-frames after hit
            G.accelMult = (G.accelMult || 1) * 1.3;
        }
    },

    // -------- Category D — ENERGY --------
    {
        id: 'CARD-11', category: 'D',
        icon: '⚡',
        name: 'Energy Recovery Core',
        description: 'Instantly restores 30% of your energy pool.',
        apply: (G) => { G.energy = Math.min(100, G.energy + 30); }
    },
    {
        id: 'CARD-12', category: 'D',
        icon: '⚡⚡',
        name: 'Energy Recovery Matrix',
        description: 'Instantly restores 50% of your energy pool.',
        apply: (G) => { G.energy = Math.min(100, G.energy + 50); }
    },
    {
        id: 'CARD-13', category: 'D',
        icon: '⚡↻',
        name: 'Energy Refill Speed (T1)',
        description: '+10% passive energy regen (permanent).',
        apply: (G) => { G.energyRegenMult = (G.energyRegenMult || 1) * 1.10; }
    },
    {
        id: 'CARD-14', category: 'D',
        icon: '⚡⇪',
        name: 'Energy Refill Speed (T2)',
        description: '+30% passive energy regen. +10% damage reduction (permanent).',
        apply: (G) => {
            G.energyRegenMult = (G.energyRegenMult || 1) * 1.30;
            G.damageReduction = Math.min(0.9, (G.damageReduction || 0) + 0.10);
        }
    }
];

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
    shieldPacks: [],                // NEW
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

    // Health / energy / shield
    health: 100,
    maxHealth: 100,
    energy: 100,
    shieldActive: false,
    shieldHealth: 0,
    shieldMax: 0,
    shieldHitFlash: 0,              // frames remaining of hit flash

    // Level-up (point-based, manual via cards) — old auto-stat system disabled.
    playerLevel: 1,
    sonicDamage: 1,
    pendingLevelUps: 0,
    isLevelUpPaused: false,

    // Permanent stat multipliers (modified by cards)
    damageReduction: 0,             // 0..0.9
    shieldEfficiency: 0,            // 0..0.9 (40% means shield takes 60% dmg)
    moveSpeedMult: 1,
    energyRegenMult: 1,
    invFramesMult: 1,
    accelMult: 1,
    kineticAgility: false,

    // Supersonic
    SUPERSONIC_ENERGY_THRESHOLD: 80,
    supersonicCooldown: 0,
    cutinAnim: null,                // { elapsed, duration }
    timeSlowFactor: 1,              // 1 = normal, <1 during cutin

    // Boss warning
    bossWarningActive: false,
    bossWarningTimer: 0,            // counts up during 3s warning
    bossWarningArmed: false,        // armed when warn-lead hit, prevents re-arming

    // Main-boss defeat freeze
    mainBossFreezeRemaining: 0,

    // Player death sequence
    deathSequence: null,            // { phase: 'fadeIn'|'hold'|'fadeOut', elapsed, duration }

    // Defeat blink (active for both bosses and player)
    // Each boss carries its own dyingTimer; player uses this:
    playerDyingTimer: 0,

    worldEndX: 0,
    segmentIndex: 0,
    keys: {},
    touchState: { left: false, right: false, jump: false, sonic: false },
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

    fitToScreen() { this.updateCanvasSize(); },

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
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
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
            if (Math.random() < 0.45) this.spawnEnemyOnPlatform(sX, sTop, sW, sH, 2);
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

        // NEW: shield pack (rare, ~10% per segment)
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
            dyingTimer: 0      // counts down during defeat blink (3s)
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

    // ====================================================================
    // SUPERSONIC: button trigger
    // ====================================================================
    tryTriggerSupersonic() {
        if (this.state !== 'playing') return false;
        if (this.cutinAnim) return false;                      // already playing
        if ((this.supersonicCooldown || 0) > 0) return false;
        if (this.energy < CONFIG.SUPERSONIC_ENERGY_THRESHOLD) return false;

        this.energy = Math.max(0, this.energy - CONFIG.SUPERSONIC_ENERGY_COST);
        this.supersonicCooldown = CONFIG.SUPERSONIC_COOLDOWN;
        this.cutinAnim = { elapsed: 0, duration: CONFIG.SUPERSONIC_CUTIN_DURATION };
        this.timeSlowFactor = CONFIG.SUPERSONIC_SLOWMO;

        AudioManager.play('victory');

        // Spawn the supersonic wave NOW (it travels at 1/4 speed during slow-mo,
        // resumes normal feel after cut-in but its world-space speed stays slow per spec).
        const p = this.player;
        const dir = p.facingRight ? 1 : -1;
        const w = CONFIG.SONIC_WAVE_WIDTH * CONFIG.SUPERSONIC_SIZE_MULT;
        const h = CONFIG.SONIC_WAVE_HEIGHT * CONFIG.SUPERSONIC_SIZE_MULT;
        this.sonicWaves.push({
            x: p.x + (p.facingRight ? p.w : -w),
            y: p.y + p.h * 0.35 - (h - CONFIG.SONIC_WAVE_HEIGHT) / 2,
            w: w, h: h,
            vx: CONFIG.SONIC_WAVE_SPEED * CONFIG.SUPERSONIC_SPEED_MULT * dir,
            life: 220, dir: dir,
            isSupersonic: true,
            damageMult: CONFIG.SUPERSONIC_DAMAGE_MULT
        });

        // Show overlays
        const cutin = document.getElementById('supersonic-cutin');
        if (cutin) cutin.classList.add('active');

        return true;
    },

    // ====================================================================
    // SHIELD: activate from card / pickup
    // ====================================================================
    activateShield(multiplier = 1.0) {
        const baseMax = this.maxHealth * CONFIG.SHIELD_MAX_RATIO;
        this.shieldMax = Math.max(this.shieldMax, baseMax * multiplier);
        // If a stronger shield is granted, also top up to full of the new max.
        this.shieldHealth = Math.max(this.shieldHealth, baseMax * multiplier);
        this.shieldActive = true;
    },

    deactivateShield() {
        this.shieldActive = false;
        this.shieldHealth = 0;
        this.shieldMax = 0;
        this.shieldHitFlash = 0;
    },

    // ====================================================================
    // UPDATE
    // ====================================================================
    update(rawDt) {
        if (this.state !== 'playing') return;

        // ----- MAIN-BOSS DEFEAT FREEZE -----
        if (this.mainBossFreezeRemaining > 0) {
            this.mainBossFreezeRemaining -= rawDt;
            // During freeze, only animate dying bosses (so the blink still plays)
            for (const b of this.bosses) {
                if (b.dyingTimer > 0) b.dyingTimer -= rawDt;
            }
            this.animFrame++;
            return;
        }

        // ----- PLAYER DEATH SEQUENCE -----
        if (this.deathSequence) {
            this.deathSequence.elapsed += rawDt;
            this._updateDeathFadeOverlay();
            if (this.deathSequence.elapsed >= this.deathSequence.duration) {
                this._finalizeGameOver();
            }
            return;
        }

        // ----- TIME-SLOW (Supersonic cut-in) -----
        // Cut-in lifetime runs in real-time, but world updates use slowed dt.
        if (this.cutinAnim) {
            this.cutinAnim.elapsed += rawDt;
            if (this.cutinAnim.elapsed >= this.cutinAnim.duration) {
                this.cutinAnim = null;
                this.timeSlowFactor = 1;
                const cutin = document.getElementById('supersonic-cutin');
                if (cutin) cutin.classList.remove('active');
            }
        }

        // Apply slow factor to gameplay dt (but timers like cooldowns still tick in real-time)
        const dt = rawDt * (this.timeSlowFactor || 1);

        this.animFrame++;
        this.gameTimer += dt;

        // Supersonic cooldown ticks in real-time
        if (this.supersonicCooldown > 0) {
            this.supersonicCooldown = Math.max(0, this.supersonicCooldown - rawDt);
        }

        // ----- BOSS WARNING SCHEDULING -----
        // Arm warning 5s before the next main-boss spawn fires.
        const timeUntilMainBoss = CONFIG.MAIN_BOSS_SPAWN_INTERVAL - this.mainBossSpawnTimer;
        if (!this.bossWarningArmed && !this.bossWarningActive &&
            timeUntilMainBoss <= CONFIG.MAIN_BOSS_WARN_LEAD &&
            timeUntilMainBoss > 0) {
            this.bossWarningArmed = true;
            this.bossWarningActive = true;
            this.bossWarningTimer = 0;
            const dw = document.getElementById('danger-warning');
            if (dw) dw.classList.add('active');
            AudioManager.play('click');
        }
        if (this.bossWarningActive) {
            this.bossWarningTimer += rawDt;
            if (this.bossWarningTimer >= CONFIG.MAIN_BOSS_WARN_DURATION) {
                this.bossWarningActive = false;
                const dw = document.getElementById('danger-warning');
                if (dw) dw.classList.remove('active');
            }
        }

        // ----- INPUT -----
        const moveLeft = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchState.left;
        const moveRight = this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchState.right;
        const jumpPressed = this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW'] || this.touchState.jump;
        const sonicPressed = this.keys['KeyF'] || this.keys['KeyX'] || this.touchState.sonic;
        const p = this.player;

        const effectiveMoveSpeed = CONFIG.MOVE_SPEED * (this.moveSpeedMult || 1) * (this.timeSlowFactor || 1);

        p.vx = 0;
        this.playerHasMoved = false;
        if (moveLeft)  { p.vx = -effectiveMoveSpeed; p.facingRight = false; this.playerHasMoved = true; }
        if (moveRight) { p.vx =  effectiveMoveSpeed; p.facingRight = true;  this.playerHasMoved = true; }

        if (jumpPressed && !this._jumpHeld) {
            if (p.jumps < p.maxJumps) {
                // Jump impulse scaled by slow factor so jump arcs look natural during slow-mo
                p.vy = (p.jumps === 0 ? CONFIG.JUMP_FORCE : CONFIG.DOUBLE_JUMP_FORCE) * (this.timeSlowFactor || 1);
                p.onGround = false;
                p.jumps++;
                AudioManager.play('jump');
            }
        }
        this._jumpHeld = jumpPressed;

        // Standard SONIC fire
        if (sonicPressed && !this._sonicHeld && this.energy >= CONFIG.SONIC_ENERGY_COST) {
            this.energy -= CONFIG.SONIC_ENERGY_COST;
            const dir = p.facingRight ? 1 : -1;
            this.sonicWaves.push({
                x: p.x + (p.facingRight ? p.w : -CONFIG.SONIC_WAVE_WIDTH),
                y: p.y + p.h * 0.35,
                w: CONFIG.SONIC_WAVE_WIDTH, h: CONFIG.SONIC_WAVE_HEIGHT,
                vx: CONFIG.SONIC_WAVE_SPEED * dir, life: 70, dir: dir,
                isSupersonic: false, damageMult: 1
            });
        }
        this._sonicHeld = sonicPressed;

        // ----- GRAVITY / MOTION -----
        // Apply slow factor to gravity & vertical velocity proportionally
        p.vy += CONFIG.GRAVITY * (this.timeSlowFactor || 1);
        const maxFall = CONFIG.MAX_FALL_SPEED * (this.timeSlowFactor || 1);
        if (p.vy > maxFall) p.vy = maxFall;
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
                p.y + p.h >= surfaceY - 6 && p.y + p.h <= surfaceY + Math.max(p.vy, 1) + 12) {
                p.y = landY;
                p.vy = 0;
                p.onGround = true;
                p.jumps = 0;
                p.currentPlatform = plat;
                break;
            }
        }

        if (p.y > this.vh + 80) {
            this.gameOver();
            return;
        }

        // Camera
        const scrollRightX = this.cameraX + this.vw * CONFIG.SCROLL_THRESHOLD;
        if (p.x > scrollRightX) {
            const diff = p.x - scrollRightX;
            this.cameraX += diff * 0.12;
        } else if (p.x < this.cameraX + this.vw * 0.25) {
            const diff = (this.cameraX + this.vw * 0.25) - p.x;
            this.cameraX -= diff * 0.12;
        }
        if (this.cameraX < 0) this.cameraX = 0;

        if (this.cameraX + this.vw * 2.5 > this.worldEndX) this.generateSegment();

        for (const plat of this.platforms) {
            if (plat.type === 'moving') {
                plat.moveOffset += CONFIG.MOVING_PLATFORM_SPEED * plat.moveDir * (this.timeSlowFactor || 1);
                if (plat.moveOffset > CONFIG.MOVING_PLATFORM_RANGE) {
                    plat.moveOffset = CONFIG.MOVING_PLATFORM_RANGE;
                    plat.moveDir = -1;
                } else if (plat.moveOffset < 0) {
                    plat.moveOffset = 0;
                    plat.moveDir = 1;
                }
                const oldY = plat.y;
                plat.y = plat.baseY - plat.moveOffset;
                if (p.currentPlatform === plat) p.y += plat.y - oldY;
            }
        }

        // Enemies
        for (const e of this.enemies) {
            if (!e.alive) continue;
            e.x += e.speed * e.dir * (this.timeSlowFactor || 1);
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
            fe.bobOffset += 0.03 * (this.timeSlowFactor || 1);
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
            if (!b.alive) {
                // Dying blink countdown (real-time for visibility, regardless of slow-mo)
                if (b.dyingTimer > 0) b.dyingTimer -= rawDt;
                continue;
            }

            const playerAboveBoss =
                p.x + p.w > b.x && p.x < b.x + b.w && p.y + p.h <= b.y;

            if (playerAboveBoss && !this.playerHasMoved) {
                b.x += b.speed * b.dir * (this.timeSlowFactor || 1);
            } else {
                if (b.x + b.w / 2 > p.x + p.w / 2) { b.dir = -1; b.x -= b.speed * (this.timeSlowFactor || 1); }
                else                                { b.dir =  1; b.x += b.speed * (this.timeSlowFactor || 1); }
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
            const liftSpeed = 3 * (this.timeSlowFactor || 1);
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

            // Boss vs player contact
            if (!p.invincible && this.rectsOverlap(p, b)) {
                if (p.vy > 0 && p.y + p.h - 12 < b.y + b.h * 0.4) {
                    b.health--; b.hitFlash = 10;
                    p.vy = CONFIG.JUMP_FORCE * 0.8;
                    this.spawnParticles(b.x + b.w/2, b.y, '#ff3333', 12);
                    AudioManager.play('click');
                    if (b.health <= 0) this._onBossDefeated(b);
                } else {
                    this.playerHit(b.isMainBoss ? 25 : 20);
                }
            }
        }

        // Update boss waves
        for (let i = this.bossSonicWaves.length - 1; i >= 0; i--) {
            const bsw = this.bossSonicWaves[i];
            bsw.x += bsw.vx * (this.timeSlowFactor || 1);
            bsw.life--;
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
        // Use real-time dt so spawn intervals are real seconds even during slow-mo
        this.miniBossSpawnTimer += rawDt;
        this.mainBossSpawnTimer += rawDt;
        while (this.miniBossSpawnTimer >= CONFIG.MINI_BOSS_SPAWN_INTERVAL) {
            this.miniBossSpawnTimer -= CONFIG.MINI_BOSS_SPAWN_INTERVAL;
            this.spawnBoss(false);
        }
        while (this.mainBossSpawnTimer >= CONFIG.MAIN_BOSS_SPAWN_INTERVAL) {
            this.mainBossSpawnTimer -= CONFIG.MAIN_BOSS_SPAWN_INTERVAL;
            this.spawnBoss(true);
            this.bossWarningArmed = false; // re-arm for next cycle
        }

        // Player sonic waves
        for (let i = this.sonicWaves.length - 1; i >= 0; i--) {
            const w = this.sonicWaves[i];
            // Supersonic wave keeps its slow world-speed regardless of slow-mo so it stays slow
            const dtMul = w.isSupersonic ? 1 : (this.timeSlowFactor || 1);
            w.x += w.vx * dtMul;
            w.life--;
            if (w.life <= 0 || w.x < this.cameraX - 600 || w.x > this.cameraX + this.vw + 600) {
                this.sonicWaves.splice(i, 1); continue;
            }
            const dmgMult = w.damageMult || 1;
            // vs enemies
            for (const e of this.enemies) {
                if (e.alive && this.rectsOverlap(w, e)) {
                    e.alive = false; this.points += 25;
                    this.spawnParticles(e.x + e.w/2, e.y, '#b400ff', 8);
                    AudioManager.play('click');
                    if (!w.isSupersonic) { this.sonicWaves.splice(i, 1); break; }
                }
            }
            if (!this.sonicWaves[i]) continue;
            for (const fe of this.flyingEnemies) {
                if (fe.alive && this.rectsOverlap(w, fe)) {
                    fe.alive = false; this.points += 30;
                    this.spawnParticles(fe.x + fe.w/2, fe.y, '#b400ff', 8);
                    AudioManager.play('click');
                    if (!w.isSupersonic) { this.sonicWaves.splice(i, 1); break; }
                }
            }
            if (!this.sonicWaves[i]) continue;
            let hitABoss = false;
            for (const b of this.bosses) {
                if (!b.alive) continue;
                if (this.rectsOverlap(w, b)) {
                    b.health -= this.sonicDamage * dmgMult;
                    b.hitFlash = 10;
                    this.spawnParticles(b.x + b.w/2, b.y, '#b400ff', 10);
                    AudioManager.play('click');
                    if (b.health <= 0) this._onBossDefeated(b);
                    hitABoss = true;
                    if (!w.isSupersonic) break;
                }
            }
            if (hitABoss && !w.isSupersonic) this.sonicWaves.splice(i, 1);
        }

        // Pickups
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
                this.energy = Math.min(100, this.energy + 30);
                this.spawnParticles(ep.x, ep.y, '#ffcc00', 5);
                AudioManager.play('click');
            }
        }
        // NEW: shield pickups
        for (const sp of this.shieldPacks) {
            if (!sp.collected && this.circleRectOverlap(sp.x, sp.y, sp.size/2, p)) {
                sp.collected = true;
                this.activateShield(1.0);
                this.spawnParticles(sp.x, sp.y, '#36CBFF', 8);
                AudioManager.play('click');
            }
        }

        // Energy regen
        this.energy = Math.min(100, this.energy + CONFIG.ENERGY_REGEN_RATE * (this.energyRegenMult || 1) * (this.timeSlowFactor || 1));

        // I-frames
        if (p.invincible) { p.invTimer--; if (p.invTimer <= 0) p.invincible = false; }
        if (this.shieldHitFlash > 0) this.shieldHitFlash--;

        // ===== POINT-BASED LEVEL UP (card system) =====
        // Old auto stat scaling is DISABLED. We only count milestones and pause for cards.
        const expectedLevel = Math.floor(this.points / CONFIG.LEVEL_UP_POINTS) + 1;
        if (expectedLevel > this.playerLevel) {
            const delta = expectedLevel - this.playerLevel;
            this.pendingLevelUps += delta;
            this.playerLevel = expectedLevel;
        }
        // If we have pending level-ups and we're not already showing the overlay → trigger it.
        if (this.pendingLevelUps > 0 && !this.isLevelUpPaused) {
            this._triggerLevelUpOverlay();
        }

        // Particles
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
        // Keep bosses while their dying-blink is playing so the white blink renders.
        this.bosses = this.bosses.filter(b =>
            (b.alive || (b.dyingTimer > 0)) &&
            b.x + b.w > cleanX - 400 && b.x < this.cameraX + this.vw + 2000
        );

        if (this.points > this.highScore) this.highScore = this.points;
    },

    // ====================================================================
    // BOSS DEFEAT helper
    // ====================================================================
    _onBossDefeated(b) {
        b.alive = false;
        b.dyingTimer = CONFIG.DEFEAT_BLINK_DURATION;   // 3s blink
        this.bossesDefeated++;
        this.points += b.isMainBoss ? 500 : 200;
        this.spawnParticles(b.x + b.w/2, b.y + b.h/2, '#ffcc00', b.isMainBoss ? 35 : 20);
        AudioManager.play('victory');
        if (b.isMainBoss) {
            // 2s game-freeze with dim overlay; blink continues to play (handled in update)
            this.mainBossFreezeRemaining = CONFIG.MAIN_BOSS_DEATH_FREEZE;
            const dw = document.getElementById('death-fade');
            if (dw) {
                dw.classList.add('mainboss-dim');
                setTimeout(() => dw.classList.remove('mainboss-dim'), CONFIG.MAIN_BOSS_DEATH_FREEZE);
            }
        }
    },

    // ====================================================================
    // LEVEL-UP overlay handoff
    // ====================================================================
    _triggerLevelUpOverlay() {
        this.isLevelUpPaused = true;
        this.state = 'levelup';
        AudioManager.pauseMusic();
        if (typeof UI !== 'undefined' && UI.showLevelUpOverlay) UI.showLevelUpOverlay();
    },

    resumeFromLevelUp() {
        if (!this.isLevelUpPaused) return;
        // Decrement pending count and re-trigger if more milestones queued
        this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
        if (this.pendingLevelUps > 0) {
            // Show another card pick immediately (still paused)
            if (typeof UI !== 'undefined' && UI.showLevelUpOverlay) UI.showLevelUpOverlay();
            return;
        }
        this.isLevelUpPaused = false;
        this.state = 'playing';
        AudioManager.resumeMusic();
    },

    // ====================================================================
    // RENDER
    // ====================================================================
    render() {
        const ctx = this.ctx;
        const W = this.vw;
        const H = this.vh;
        ctx.clearRect(0, 0, W, H);
        if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'levelup') return;
        this.drawBackground(ctx, W, H);
        ctx.save();
        ctx.translate(-this.cameraX, 0);

        for (const plat of this.platforms) if (plat.type === 'main')   this.drawPlatform(ctx, plat);
        for (const plat of this.platforms) if (plat.type === 'moving') this.drawPlatform(ctx, plat);
        for (const plat of this.platforms) if (plat.type === 'static') this.drawPlatform(ctx, plat);

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
        for (const e of this.enemies) if (e.alive) this.drawEnemy(ctx, e);
        for (const fe of this.flyingEnemies) if (fe.alive) this.drawFlyingEnemy(ctx, fe);
        for (const b of this.bosses) this.drawBoss(ctx, b);
        if (this.player) this.drawPlayer(ctx, this.player);
        // Draw shield bubble OVER player (after player so it's on top)
        if (this.player && this.shieldActive && this.shieldHealth > 0) {
            this.drawShieldBubble(ctx, this.player);
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
            for (let x = 0; x < W; x += skyW) ctx.drawImage(skyImg, x, 0, skyW, skyH);
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
            for (let x = startX; x < W + farW; x += farW) ctx.drawImage(farImg, x, farY, farW, farH);
        }
        const midImg = ImageCache['city_mid.png'];
        if (midImg) {
            const midH = H;
            const midW = midH * (midImg.naturalWidth / midImg.naturalHeight);
            const midY = H - midH;
            const parallax = this.cameraX * 0.45;
            let startX = -(parallax % midW);
            if (startX > 0) startX -= midW;
            for (let x = startX; x < W + midW; x += midW) ctx.drawImage(midImg, x, midY, midW, midH);
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
        // During death sequence, blink white
        if (this.playerDyingTimer > 0) {
            const flashOn = Math.floor((CONFIG.DEFEAT_BLINK_DURATION - this.playerDyingTimer) / 100) % 2 === 0;
            ctx.save();
            const filename = getFilename(p.img);
            const img = ImageCache[filename];
            if (img) {
                if (!p.facingRight) {
                    ctx.translate(p.x + p.w, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, p.y, p.w, p.h);
                } else {
                    ctx.drawImage(img, p.x, p.y, p.w, p.h);
                }
            }
            if (flashOn) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
            }
            ctx.restore();
            this.playerDyingTimer -= this.deltaTime || 16;
            return;
        }

        if (p.invincible && Math.floor(this.animFrame / 4) % 2 === 0) return;
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
        if (img) ctx.drawImage(img, fe.x, fe.y, fe.w, fe.h);
        else { ctx.fillStyle = '#ff00ff'; ctx.fillRect(fe.x, fe.y, fe.w, fe.h); }
    },

    drawBoss(ctx, b) {
        const filename = getFilename(b.img);
        const img = ImageCache[filename];
        const dying = !b.alive && b.dyingTimer > 0;
        if (img) {
            ctx.save();
            if (b.hitFlash > 0) ctx.globalAlpha = 0.5 + Math.sin(this.animFrame) * 0.5;
            if (b.dir < 0) {
                ctx.translate(b.x + b.w, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, b.y, b.w, b.h);
            } else {
                ctx.drawImage(img, b.x, b.y, b.w, b.h);
            }
            // Dying white blink overlay
            if (dying) {
                const elapsed = CONFIG.DEFEAT_BLINK_DURATION - b.dyingTimer;
                const flashOn = Math.floor(elapsed / 100) % 2 === 0;
                if (flashOn) {
                    ctx.globalAlpha = 0.95;
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.fillStyle = '#ffffff';
                    if (b.dir < 0) ctx.fillRect(0, b.y, b.w, b.h);
                    else            ctx.fillRect(b.x, b.y, b.w, b.h);
                }
            }
            ctx.restore();
            if (b.alive) {
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

    /* === NEW: Shield collectible visual === */
    drawShieldPack(ctx, x, y, size) {
        const glow = Math.sin(this.animFrame * 0.09 + 3) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = '#36CBFF'; ctx.shadowBlur = 14 * glow;
        // Outer ring
        ctx.strokeStyle = '#36CBFF'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, size/2, 0, Math.PI * 2);
        ctx.stroke();
        // Inner glow disc
        const grad = ctx.createRadialGradient(x, y, 0, x, y, size/2);
        grad.addColorStop(0, 'rgba(220,245,255,0.85)');
        grad.addColorStop(0.6, 'rgba(54,203,255,0.45)');
        grad.addColorStop(1, 'rgba(54,203,255,0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, size/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        // Shield emblem
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(size * 0.55) + 'px Orbitron';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🛡', x, y + size * 0.04);
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    /* === NEW: Shield bubble overlay around player ===
       Borderless, transparent gradient: low alpha center, slightly more
       at left/right edges. Hit flash boosts overall opacity briefly. */
    drawShieldBubble(ctx, p) {
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const rx = p.w * 0.85;
        const ry = p.h * 0.62;
        const flashBoost = this.shieldHitFlash > 0 ? (this.shieldHitFlash / 18) : 0;
        // Horizontal gradient: stronger at edges, faint in the middle
        const grad = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
        grad.addColorStop(0.00, `rgba(54, 203, 255, ${0.45 + flashBoost * 0.4})`);
        grad.addColorStop(0.25, `rgba(54, 203, 255, ${0.18 + flashBoost * 0.3})`);
        grad.addColorStop(0.50, `rgba(180, 230, 255, ${0.06 + flashBoost * 0.25})`);
        grad.addColorStop(0.75, `rgba(54, 203, 255, ${0.18 + flashBoost * 0.3})`);
        grad.addColorStop(1.00, `rgba(54, 203, 255, ${0.45 + flashBoost * 0.4})`);
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
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
        ctx.save();
        const lifeRef = sw.isSupersonic ? 220 : 70;
        ctx.globalAlpha = Math.min(1, sw.life / lifeRef * 1.6);
        const cx = sw.x + sw.w / 2;
        const cy = sw.y + sw.h / 2;
        if (sw.isSupersonic) {
            // Bigger red/orange aura (visually distinct supersonic)
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sw.w);
            grad.addColorStop(0, 'rgba(255, 230, 120, 0.85)');
            grad.addColorStop(0.35, 'rgba(255, 80, 40, 0.65)');
            grad.addColorStop(0.7, 'rgba(255, 30, 30, 0.35)');
            grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, sw.w * 0.55, sw.h * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Hot core
            ctx.fillStyle = 'rgba(255,255,240,0.9)';
            ctx.beginPath();
            ctx.ellipse(cx, cy, sw.w * 0.13, sw.h * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, sw.w);
            gradient.addColorStop(0, 'rgba(72, 212, 255, 0.5)');
            gradient.addColorStop(0.5, 'rgba(92, 142, 255, 0.5)');
            gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(cx, cy, sw.w*0.7, sw.h*0.5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(cx, cy, sw.w*0.2, sw.h*0.15, 0, 0, Math.PI*2);
            ctx.fill();
        }
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

    /**
     * Apply damage to the player. Shield absorbs first; remainder goes to health.
     * Honors damageReduction & shieldEfficiency permanent multipliers.
     */
    playerHit(damage) {
        if (this.player.invincible) return;
        // Permanent damage reduction
        let dmg = damage * (1 - (this.damageReduction || 0));

        // Shield absorbs first
        if (this.shieldActive && this.shieldHealth > 0) {
            const shieldDmg = dmg * (1 - (this.shieldEfficiency || 0));
            if (shieldDmg <= this.shieldHealth) {
                this.shieldHealth -= shieldDmg;
                dmg = 0;
            } else {
                dmg = (shieldDmg - this.shieldHealth) / Math.max(0.0001, (1 - (this.shieldEfficiency || 0)));
                this.shieldHealth = 0;
            }
            this.shieldHitFlash = 18;
            // Drop shield if depleted
            if (this.shieldHealth <= 0) this.deactivateShield();
        }

        if (dmg > 0) {
            this.health -= dmg;
            this.player.invincible = true;
            this.player.invTimer = Math.round(60 * (this.invFramesMult || 1));
            this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#ff2244', 6);
        }
        if (this.health <= 0) { this.health = 0; this.gameOver(); }
    },

    gameOver() {
        if (this.deathSequence) return; // already in death sequence
        this.state = 'playing'; // keep ticking the death timer (update guards on state)
        this.playerDyingTimer = CONFIG.DEFEAT_BLINK_DURATION;
        // Start fade-in / fade-out white sequence
        this.deathSequence = {
            elapsed: 0,
            duration: 1800,   // ~1.8s total: 0.9s fade-in to white, 0.9s fade-out to game-over
            phase: 'fadeIn'
        };
        const fade = document.getElementById('death-fade');
        if (fade) fade.classList.add('active');
    },

    _updateDeathFadeOverlay() {
        const fade = document.getElementById('death-fade');
        if (!fade) return;
        const t = Math.min(1, this.deathSequence.elapsed / this.deathSequence.duration);
        // Triangular ramp: 0 → 1 at t=0.5 → 0 at t=1
        const a = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5);
        fade.style.opacity = a.toFixed(3);
    },

    _finalizeGameOver() {
        this.state = 'gameover';
        if (this.points > this.highScore) this.highScore = this.points;
        try {
            if (typeof PlayerRegistry !== 'undefined') {
                const name = PlayerRegistry.currentPlayer || PlayerRegistry.ensureAnonymousPilot();
                PlayerRegistry.recordScore(name, this.points);
            }
        } catch (e) {}
        AudioManager.stopMusic();
        AudioManager.play('game_over');
        const fade = document.getElementById('death-fade');
        if (fade) { fade.classList.remove('active'); fade.style.opacity = '0'; }
        this.deathSequence = null;
        this.playerDyingTimer = 0;
        UI.showGameOver(this.points, this.highScore);
    },

    startGame() {
        this.state = 'playing';
        this.cameraX = 0; this.maxCameraX = 0;
        this.points = 0;
        this.maxHealth = CONFIG.PLAYER_MAX_HEALTH;
        this.health = this.maxHealth;
        this.energy = 100;
        this.playerLevel = 1; this.sonicDamage = 1;
        this.pendingLevelUps = 0; this.isLevelUpPaused = false;
        this.damageReduction = 0;
        this.shieldEfficiency = 0;
        this.moveSpeedMult = 1;
        this.energyRegenMult = 1;
        this.invFramesMult = 1;
        this.accelMult = 1;
        this.kineticAgility = false;
        this.deactivateShield();
        this.supersonicCooldown = 0;
        this.cutinAnim = null;
        this.timeSlowFactor = 1;
        this.bossWarningActive = false;
        this.bossWarningArmed = false;
        this.bossWarningTimer = 0;
        this.mainBossFreezeRemaining = 0;
        this.deathSequence = null;
        this.playerDyingTimer = 0;
        this.bossSonicWaves = [];
        this.gameTimer = 0;
        this.miniBossSpawnTimer = 0;
        this.mainBossSpawnTimer = 0;
        this.accumulator = 0;
        this._jumpHeld = false; this._sonicHeld = false;
        this.updateCanvasSize();
        this.generateInitialWorld();
        this.createPlayer();
        // Clear any leftover overlays
        const cutin = document.getElementById('supersonic-cutin');
        if (cutin) cutin.classList.remove('active');
        const dw = document.getElementById('danger-warning');
        if (dw) dw.classList.remove('active');
        const fade = document.getElementById('death-fade');
        if (fade) { fade.classList.remove('active', 'mainboss-dim'); fade.style.opacity = '0'; }
        if (typeof UI !== 'undefined' && UI.hideLevelUpOverlay) UI.hideLevelUpOverlay();
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
        if (this.state === 'playing' || this.state === 'levelup') {
            UI.updateHUD(this.health, this.energy, this.points, this.gameTimer, this.highScore);
        }
        requestAnimationFrame((t) => this.loop(t));
    },

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }
};

// Expose threshold for UI button gating
Game.SUPERSONIC_ENERGY_THRESHOLD = CONFIG.SUPERSONIC_ENERGY_THRESHOLD;
