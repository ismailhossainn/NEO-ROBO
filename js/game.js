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
    JUMP_FORCE: -16.2,       // Was -13.5 → -13.5 × 1.2 = -16.2
    DOUBLE_JUMP_FORCE: -13.8, // Was -11.5 → -11.5 × 1.2 = -13.8
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
    BOSS_POINTS_INTERVAL: 500,
    MAIN_BOSS_POINTS_INTERVAL: 2000,
    MAIN_BOSS_SCALE: 3.0,
    MAIN_BOSS_HEALTH: 8,
    GOLD_SIZE: 40,
    HEALTH_SIZE: 34,
    GOLD_POINTS: 10,
    SONIC_WAVE_SPEED: 14,
    SONIC_WAVE_WIDTH: 50,
    SONIC_WAVE_HEIGHT: 25,
    SONIC_ENERGY_COST: 15,
    ENERGY_REGEN_RATE: 0.08,
    CAMERA_LOCK_DISTANCE: 600,
    SCROLL_THRESHOLD: 0.35,
    GAP_MIN: 140,
    GAP_MAX: 250,
    SEGMENT_LENGTH: 1920,
    LEVEL_UP_POINTS: 2500,
    BOSS_SONIC_SPEED: 2.5,
    BOSS_SONIC_INTERVAL: 3000,
    BOSS_SONIC_WIDTH: 200,
    BOSS_SONIC_HEIGHT: 100,
    BOSS_SONIC_DAMAGE: 15,
    BOSS_SONIC_LIFE: 180,
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
    sonicWaves: [],
    particles: [],
    boss: null,
    bossActive: false,
    lastBossAt: 0,
    lastMainBossAt: 0,
    bossesDefeated: 0,
    bossSonicWaves: [],
    points: 0,
    gameTimer: 0,
    health: 100,
    energy: 100,
    playerLevel: 1,
    sonicDamage: 1,
    lastLevelUpAt: 0,
    levelUpAnim: null,
    worldEndX: 0,
    segmentIndex: 0,
    keys: {},
    touchState: { left: false, right: false, jump: false, sonic: false },
    lastTime: 0,
    deltaTime: 0,
    animFrame: 0,
    mainPlatTop: 0,
    mainPlatBot: 0,

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.updateCanvasSize();
        this.setupInput();
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
        this.sonicWaves = [];
        this.particles = [];
        this.worldEndX = 0;
        this.segmentIndex = 0;
        this.boss = null;
        this.bossActive = false;
        this.lastBossAt = 0;
        this.lastMainBossAt = 0;
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
        
        // Get full image width for platform_main.png
        const pmImg = ImageSizes['platform_main.png'];
        const imgRatio = pmImg ? (pmImg.w / pmImg.h) : (1920/300);
        const platW = mainH * imgRatio; // Full width of one platform_main.png
        
        // Variable gap: 0px (no gap) to 550px, favoring around 400px
        // 30% chance of no gap, 70% chance of gap between 200-550px
        let gapW = 0;
        if (Math.random() < 0.7) {
            gapW = 150 + Math.random() * 250; // 150-400px gap                                 { GAP SIZE }
        }
        
        // Place one complete platform
        this.platforms.push({ type: 'main', x: segStart, y: mainTop, w: platW, h: mainH, tier: 1 });
        
        // Update world end to after platform + gap
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
        const by = this.mainPlatTop + CONFIG.GROUND_ON_MAIN - bh;
        const availableRobots = ASSETS.robots.filter((_, i) => i !== this.selectedRobot);
        const bossRobot = availableRobots[Math.floor(Math.random() * availableRobots.length)];
        this.boss = {
            x: this.cameraX + this.vw + 80,
            y: by, w: bw, h: bh,
            health: health, maxHealth: health,
            speed: isMainBoss ? 2.0 : 2.5, dir: -1, alive: true,
            img: bossRobot.img, name: bossRobot.name,
            isMainBoss: isMainBoss,
            attackTimer: 0, hitFlash: 0, groundY: by,
            sonicTimer: isMainBoss ? 0 : -1
        };
        this.bossActive = true;
        AudioManager.play(bossRobot.sound);
    },

    update(dt) {
        if (this.state !== 'playing') return;
        this.animFrame++;
        this.gameTimer += dt;
        const moveLeft = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchState.left;
        const moveRight = this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchState.right;
        const jumpPressed = this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW'] || this.touchState.jump;
        const sonicPressed = this.keys['KeyF'] || this.keys['KeyX'] || this.touchState.sonic;
        const p = this.player;

        p.vx = 0;
        if (moveLeft)  { p.vx = -CONFIG.MOVE_SPEED; p.facingRight = false; }
        if (moveRight) { p.vx =  CONFIG.MOVE_SPEED; p.facingRight = true; }

        if (jumpPressed && !this._jumpHeld) {
            if (p.jumps < p.maxJumps) {
                p.vy = (p.jumps === 0 ? CONFIG.JUMP_FORCE : CONFIG.DOUBLE_JUMP_FORCE);
                p.onGround = false;
                p.jumps++;
                AudioManager.play('jump');
            }
        }
        this._jumpHeld = jumpPressed;

        if (sonicPressed && !this._sonicHeld && this.energy >= CONFIG.SONIC_ENERGY_COST) {
            this.energy -= CONFIG.SONIC_ENERGY_COST;
            const dir = p.facingRight ? 1 : -1;
            this.sonicWaves.push({
                x: p.x + (p.facingRight ? p.w : -CONFIG.SONIC_WAVE_WIDTH),
                y: p.y + p.h * 0.35,
                w: CONFIG.SONIC_WAVE_WIDTH, h: CONFIG.SONIC_WAVE_HEIGHT,
                vx: CONFIG.SONIC_WAVE_SPEED * dir, life: 70, dir: dir
            });
        }
        this._sonicHeld = sonicPressed;

        p.vy += CONFIG.GRAVITY;
        if (p.vy > CONFIG.MAX_FALL_SPEED) p.vy = CONFIG.MAX_FALL_SPEED;
        p.x += p.vx;
        p.y += p.vy;
        // Player can't go below world start
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
            this.gameOver();
            return;
        }

        // Camera follows player - unlocked (can go forward and backward)
        const scrollRightX = this.cameraX + this.vw * CONFIG.SCROLL_THRESHOLD;
        const scrollLeftX = this.cameraX + this.vw * (1.0 - CONFIG.SCROLL_THRESHOLD);
        if (p.x > scrollRightX) {
            const diff = p.x - scrollRightX;
            this.cameraX += diff * 0.12;
        } else if (p.x < this.cameraX + this.vw * 0.25) {
            const diff = (this.cameraX + this.vw * 0.25) - p.x;
            this.cameraX -= diff * 0.12;
        }
        // Don't let camera go below 0
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

        if (this.bossActive && this.boss && this.boss.alive) {
            const b = this.boss;
            if (b.x + b.w/2 > p.x + p.w/2) { b.x -= b.speed; b.dir = -1; }
            else { b.x += b.speed; b.dir = 1; }
            b.y = b.groundY;
            if (b.hitFlash > 0) b.hitFlash--;
            // Main Boss sonic wave attack every 3 seconds
            if (b.isMainBoss && b.sonicTimer >= 0) {
                b.sonicTimer += dt;
                if (b.sonicTimer >= CONFIG.BOSS_SONIC_INTERVAL) {
                    b.sonicTimer = 0;
                    const bDir = b.dir; // shoot toward player
                    this.bossSonicWaves.push({
                        x: b.x + (bDir > 0 ? b.w : -CONFIG.BOSS_SONIC_WIDTH),
                        y: b.y + b.h * 0.3,
                        w: CONFIG.BOSS_SONIC_WIDTH, h: CONFIG.BOSS_SONIC_HEIGHT,
                        vx: CONFIG.BOSS_SONIC_SPEED * bDir,
                        life: CONFIG.BOSS_SONIC_LIFE, dir: bDir
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
                        b.alive = false; this.bossActive = false;
                        this.bossesDefeated++;
                        this.points += b.isMainBoss ? 500 : 200;
                        this.spawnParticles(b.x + b.w/2, b.y + b.h/2, '#ffcc00', b.isMainBoss ? 35 : 20);
                        AudioManager.play('victory');
                        this.bossSonicWaves = []; // clear boss waves on death
                    }
                } else {
                    this.playerHit(b.isMainBoss ? 25 : 20);
                }
            }
        }

        // Update boss sonic waves
        for (let i = this.bossSonicWaves.length - 1; i >= 0; i--) {
            const bsw = this.bossSonicWaves[i];
            bsw.x += bsw.vx; bsw.life--;
            if (bsw.life <= 0 || bsw.x < this.cameraX - 300 || bsw.x > this.cameraX + this.vw + 300) {
                this.bossSonicWaves.splice(i, 1); continue;
            }
            // Hit player
            if (!p.invincible && this.rectsOverlap(bsw, p)) {
                this.playerHit(CONFIG.BOSS_SONIC_DAMAGE);
                this.spawnParticles(p.x + p.w/2, p.y + p.h/2, '#ff4400', 10);
                this.bossSonicWaves.splice(i, 1);
            }
        }

        if (!this.bossActive && this.points > 0) {
            // Check for MAIN BOSS first (every 2000 points)
            const nextMain = Math.floor(this.points / CONFIG.MAIN_BOSS_POINTS_INTERVAL) * CONFIG.MAIN_BOSS_POINTS_INTERVAL;
            if (nextMain > 0 && nextMain > this.lastMainBossAt) {
                this.lastMainBossAt = nextMain;
                this.lastBossAt = nextMain; // also update regular boss tracker to prevent double spawn
                this.spawnBoss(true);
            }
            // Check for regular BOSS (every 500 points, but not at MAIN BOSS intervals)
            else if (this.points >= this.lastBossAt + CONFIG.BOSS_POINTS_INTERVAL) {
                const next = Math.floor(this.points / CONFIG.BOSS_POINTS_INTERVAL) * CONFIG.BOSS_POINTS_INTERVAL;
                if (next > this.lastBossAt && next % CONFIG.MAIN_BOSS_POINTS_INTERVAL !== 0) {
                    this.lastBossAt = next;
                    this.spawnBoss(false);
                }
            }
        }

        for (let i = this.sonicWaves.length - 1; i >= 0; i--) {
            const w = this.sonicWaves[i];
            w.x += w.vx; w.life--;
            if (w.life <= 0 || w.x < this.cameraX - 150 || w.x > this.cameraX + this.vw + 150) {
                this.sonicWaves.splice(i, 1); continue;
            }
            for (const e of this.enemies) {
                if (e.alive && this.rectsOverlap(w, e)) {
                    e.alive = false; this.points += 25;
                    this.spawnParticles(e.x + e.w/2, e.y, '#b400ff', 8);
                    AudioManager.play('click');
                    this.sonicWaves.splice(i, 1); break;
                }
            }
            if (!this.sonicWaves[i]) continue;
            for (const fe of this.flyingEnemies) {
                if (fe.alive && this.rectsOverlap(w, fe)) {
                    fe.alive = false; this.points += 30;
                    this.spawnParticles(fe.x + fe.w/2, fe.y, '#b400ff', 8);
                    AudioManager.play('click');
                    this.sonicWaves.splice(i, 1); break;
                }
            }
            if (!this.sonicWaves[i]) continue;
            if (this.bossActive && this.boss && this.boss.alive && this.rectsOverlap(w, this.boss)) {
                this.boss.health -= this.sonicDamage; this.boss.hitFlash = 10;
                this.spawnParticles(this.boss.x + this.boss.w/2, this.boss.y, '#b400ff', 10);
                AudioManager.play('click');
                this.sonicWaves.splice(i, 1);
                if (this.boss.health <= 0) {
                    this.boss.alive = false; this.bossActive = false;
                    this.bossesDefeated++;
                    this.points += this.boss.isMainBoss ? 500 : 200;
                    this.spawnParticles(this.boss.x + this.boss.w/2, this.boss.y + this.boss.h/2, '#ffcc00', this.boss.isMainBoss ? 35 : 20);
                    AudioManager.play('victory');
                    this.bossSonicWaves = [];
                }
            }
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
                this.health = Math.min(100, this.health + 25);
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

        this.energy = Math.min(100, this.energy + CONFIG.ENERGY_REGEN_RATE);
        if (p.invincible) { p.invTimer--; if (p.invTimer <= 0) p.invincible = false; }

        // Level up check: every 2500 points, repeating continually
        const expectedLevel = Math.floor(this.points / CONFIG.LEVEL_UP_POINTS) + 1;
        if (expectedLevel > this.playerLevel) {
            this.playerLevel = expectedLevel;
            this.sonicDamage = Math.pow(2, this.playerLevel - 1); // 2x each level: 1,2,4,8,16...
            this.levelUpAnim = { timer: 0, duration: 150 }; // ~2.5 seconds at 60fps
            AudioManager.play('victory');
        }
        // Update level-up animation
        if (this.levelUpAnim) {
            this.levelUpAnim.timer++;
            if (this.levelUpAnim.timer >= this.levelUpAnim.duration) {
                this.levelUpAnim = null;
            }
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
        this.platforms = this.platforms.filter(p => p.x + p.w > cleanX);
    },

    render() {
        const ctx = this.ctx;
        const W = this.vw;
        const H = this.vh;
        ctx.clearRect(0, 0, W, H);
        if (this.state !== 'playing' && this.state !== 'paused') return;
        this.drawBackground(ctx, W, H);
        ctx.save();
        ctx.translate(-this.cameraX, 0);
        
        // Draw platforms in layer order: main first, then moving, then static (static on top)
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
        for (const e of this.enemies) { if (e.alive) this.drawEnemy(ctx, e); }
        for (const fe of this.flyingEnemies) { if (fe.alive) this.drawFlyingEnemy(ctx, fe); }
        if (this.bossActive && this.boss && this.boss.alive) this.drawBoss(ctx, this.boss);
        if (this.player) this.drawPlayer(ctx, this.player);
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

        // Draw level-up animation (screen-space, after ctx.restore)
        if (this.levelUpAnim) {
            const la = this.levelUpAnim;
            const progress = la.timer / la.duration;
            // Phase 1: scale in (0-0.15), Phase 2: hold (0.15-0.7), Phase 3: fade out (0.7-1.0)
            let alpha, scale;
            if (progress < 0.15) {
                const t = progress / 0.15;
                alpha = t;
                scale = 0.3 + t * 0.7;
            } else if (progress < 0.7) {
                alpha = 1;
                scale = 1.0 + Math.sin((progress - 0.15) * 6) * 0.05; // subtle pulse
            } else {
                const t = (progress - 0.7) / 0.3;
                alpha = 1 - t;
                scale = 1.0 + t * 0.3;
            }
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const cx = W / 2;
            const cy = H / 2 - 40;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            // "LEVEL UP" text
            ctx.font = 'bold 64px Orbitron';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 30;
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('LEVEL UP!', 0, -30);
            ctx.shadowBlur = 0;
            // Level number
            ctx.font = 'bold 42px Orbitron';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 20;
            ctx.fillText('LEVEL ' + this.playerLevel, 0, 30);
            ctx.shadowBlur = 0;
            // Sonic damage info
            ctx.font = 'bold 22px Orbitron';
            ctx.fillStyle = '#b400ff';
            ctx.shadowColor = '#b400ff';
            ctx.shadowBlur = 12;
            ctx.fillText('SONIC DMG x' + this.sonicDamage, 0, 75);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
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
            
            // For main platforms: only draw complete images, no partial/clipped images
            if (plat.type === 'main') {
                while (drawX + drawW <= endX + 0.1) {  // +0.1 for float tolerance
                    ctx.drawImage(img, drawX, plat.y, drawW, drawH);
                    drawX += drawW;
                }
                // Don't draw partial image at the end - the gap is intentional
            } else {
                // For static and moving platforms, tile normally with clipping
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
            if (b.hitFlash > 0) ctx.globalAlpha = 0.5 + Math.sin(this.animFrame) * 0.5;
            if (b.dir < 0) {
                ctx.translate(b.x + b.w, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, b.y, b.w, b.h);
            } else {
                ctx.drawImage(img, b.x, b.y, b.w, b.h);
            }
            ctx.restore();
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
        // Draw lightning bolt shape
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
        // Inner highlight
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

    drawBossSonicWave(ctx, bsw) {
        ctx.save();
        ctx.globalAlpha = Math.min(bsw.life / 40, 1.0);
        const cx = bsw.x + bsw.w / 2;
        const cy = bsw.y + bsw.h / 2;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, bsw.w * 0.8);
        gradient.addColorStop(0, 'rgba(255, 68, 0, 0.7)');
        gradient.addColorStop(0.4, 'rgba(255, 34, 34, 0.5)');
        gradient.addColorStop(0.7, 'rgba(200, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(cx, cy, bsw.w * 0.5, bsw.h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner hot core
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
        ctx.globalAlpha = sw.life / 70;
        const gradient = ctx.createRadialGradient(
            sw.x + sw.w/2, sw.y + sw.h/2, 0,
            sw.x + sw.w/2, sw.y + sw.h/2, sw.w
        );
        gradient.addColorStop(0, 'rgba(72, 212, 255, 0.5)');
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

    playerHit(damage) {
        if (this.player.invincible) return;
        this.health -= damage;
        this.player.invincible = true;
        this.player.invTimer = 60;
        this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#ff2244', 6);
        if (this.health <= 0) { this.health = 0; this.gameOver(); }
    },

    gameOver() {
        this.state = 'gameover';
        AudioManager.stopMusic();
        AudioManager.play('game_over');
        UI.showGameOver(this.points);
    },

    startGame() {
        this.state = 'playing';
        this.cameraX = 0; this.maxCameraX = 0;
        this.points = 0; this.health = 100; this.energy = 100;
        this.playerLevel = 1; this.sonicDamage = 1; this.lastLevelUpAt = 0;
        this.levelUpAnim = null;
        this.bossSonicWaves = [];
        this.gameTimer = 0;
        this._jumpHeld = false; this._sonicHeld = false;
        this.updateCanvasSize();
        this.generateInitialWorld();
        this.createPlayer();
        AudioManager.playMusic();
    },

    pauseGame() { this.state = 'paused'; AudioManager.pauseMusic(); },
    resumeGame() { this.state = 'playing'; AudioManager.resumeMusic(); },

    loop(timestamp) {
        this.deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.update(this.deltaTime);
        this.render();
        if (this.state === 'playing') UI.updateHUD(this.health, this.energy, this.points, this.gameTimer);
        requestAnimationFrame((t) => this.loop(t));
    },

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }
};