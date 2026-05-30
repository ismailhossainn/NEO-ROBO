/* ========================================
   NEO-ROBO - UI Manager (v3)
   Energy color per robot
   Flexible canvas support
   ======================================== */

// Robot color mapping for energy bar
const ROBOT_COLORS = {
    'MRK-069': { primary: '#be774d', light: '#ce9979', dark: '#855335', glow: 'rgba(190, 119, 77, 0.8)' },
    'MRK-301': { primary: '#ffd264', light: '#ffdd8a', dark: '#b29346', glow: 'rgba(255, 210, 100, 0.8)' },
    'MRK-608': { primary: '#5bf9f8', light: '#84faf9', dark: '#3faead', glow: 'rgba(91, 249, 248, 0.8)' },
    'MRK-720': { primary: '#f4f4f4', light: '#f6f6f6', dark: '#aaaaaa', glow: 'rgba(244, 244, 244, 0.8)' },
    'MRK-830': { primary: '#2e4646', light: '#627474', dark: '#203131', glow: 'rgba(46, 70, 70, 0.8)' }
};

// ============ CARD REGISTRY ============
// Loaded once from the <template class="card-tpl"> elements in index.html.
// Each entry: { id, category, icon, title, desc, effect }
const CARD_REGISTRY = [];

function loadCardRegistry() {
    const tpls = document.querySelectorAll('#card-registry .card-tpl');
    CARD_REGISTRY.length = 0;
    tpls.forEach(tpl => {
        CARD_REGISTRY.push({
            id: tpl.dataset.id,
            category: tpl.dataset.category,
            icon: tpl.dataset.icon,
            title: tpl.dataset.title,
            desc: tpl.dataset.desc,
            effect: tpl.dataset.effect
        });
    });
}

const UI = {
    screens: {},
    selectedRobot: 0,
    
    init() {
        this.screens = {
            start: document.getElementById('start-screen'),
            selection: document.getElementById('selection-screen'),
            guide: document.getElementById('guide-screen'),
            loading: document.getElementById('loading-screen'),
            hud: document.getElementById('game-hud'),
            pause: document.getElementById('pause-menu'),
            gameover: document.getElementById('gameover-screen'),
            victory: document.getElementById('victory-screen')
        };
        
        // Load card definitions from the modular HTML registry section
        loadCardRegistry();

        this.setupStartScreen();
        this.setupSelectionScreen();
        this.setupGuideScreen();
        this.setupGameControls();
        this.setupPauseMenu();
        this.setupGameOverScreen();
        this.setupVictoryScreen();
        this.setupLevelUpOverlay();
    },
    
    showScreen(name) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        if (this.screens[name]) this.screens[name].classList.add('active');
    },
    
    // ============ START SCREEN ============
    setupStartScreen() {
        const startBtn = document.getElementById('start-btn');
        const pressText = document.getElementById('press-to-start');
        
        // Player registration has been removed — go straight to robot selection.
        const goNextFromStart = () => {
            AudioManager.init();
            AudioManager.play('click');
            this.showScreen('selection');
            this.initRobotSelection();
        };
        
        startBtn.addEventListener('click', goNextFromStart);
        startBtn.addEventListener('touchend', (e) => { e.preventDefault(); goNextFromStart(); });
        pressText.addEventListener('click', goNextFromStart);
        
        window.addEventListener('keydown', (e) => {
            if (Game.state === 'start' && (e.code === 'Enter' || e.code === 'Space')) {
                e.preventDefault();
                goNextFromStart();
            }
        });
    },
    
    // ============ SELECTION SCREEN ============
    initRobotSelection() {
        const carousel = document.getElementById('robot-carousel');
        carousel.innerHTML = '';
        
        ASSETS.robots.forEach((robot, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'robot-thumb' + (index === this.selectedRobot ? ' selected' : '');
            thumb.innerHTML = `<img src="${robot.img}" alt="${robot.name}">`;
            
            const selectThis = () => {
                this.selectRobot(index);
                AudioManager.play('click');
            };
            
            thumb.addEventListener('click', selectThis);
            thumb.addEventListener('touchend', (e) => { e.preventDefault(); selectThis(); });
            carousel.appendChild(thumb);
        });
        
        this.selectRobot(0);
    },
    
    selectRobot(index) {
        this.selectedRobot = index;
        const robot = ASSETS.robots[index];
        
        const img = document.getElementById('selected-robot-img');
        img.src = robot.img;
        img.style.transform = 'scale(0.5) rotate(-10deg)';
        setTimeout(() => { img.style.transform = 'scale(1) rotate(0deg)'; }, 50);
        
        document.getElementById('selected-robot-name').textContent = robot.name;
        
        document.querySelectorAll('.robot-thumb').forEach((thumb, i) => {
            thumb.classList.toggle('selected', i === index);
        });
        
        AudioManager.play(robot.sound);
    },
    
    setupSelectionScreen() {
        const confirmBtn = document.getElementById('confirm-btn');
        const confirm = () => {
            AudioManager.play('click');
            Game.selectedRobot = this.selectedRobot;
            this.applyRobotEnergyColor(this.selectedRobot);
            this.showScreen('guide');
            this.guideCurrentSlide = 0;
            this.updateGuideSlider();
        };
        confirmBtn.addEventListener('click', confirm);
        confirmBtn.addEventListener('touchend', (e) => { e.preventDefault(); confirm(); });
    },
    
    // ============ GUIDE SCREEN ============
    guideCurrentSlide: 0,
    guideTotalSlides: 3,
    
    setupGuideScreen() {
        const prevBtn = document.getElementById('guide-prev-btn');
        const nextArrowBtn = document.getElementById('guide-next-arrow-btn');
        const nextBtn = document.getElementById('guide-next-btn');
        const dots = document.querySelectorAll('.guide-dot');
        
        const goPrev = () => {
            AudioManager.play('click');
            if (this.guideCurrentSlide > 0) {
                this.guideCurrentSlide--;
                this.updateGuideSlider();
            }
        };
        prevBtn.addEventListener('click', goPrev);
        prevBtn.addEventListener('touchend', (e) => { e.preventDefault(); goPrev(); });
        
        const goNext = () => {
            AudioManager.play('click');
            if (this.guideCurrentSlide < this.guideTotalSlides - 1) {
                this.guideCurrentSlide++;
                this.updateGuideSlider();
            }
        };
        nextArrowBtn.addEventListener('click', goNext);
        nextArrowBtn.addEventListener('touchend', (e) => { e.preventDefault(); goNext(); });
        
        dots.forEach((dot) => {
            const goToDot = () => {
                AudioManager.play('click');
                this.guideCurrentSlide = parseInt(dot.dataset.index);
                this.updateGuideSlider();
            };
            dot.addEventListener('click', goToDot);
            dot.addEventListener('touchend', (e) => { e.preventDefault(); goToDot(); });
        });
        
        const goToLoading = () => {
            AudioManager.play('click');
            this.showLoadingScreen();
        };
        nextBtn.addEventListener('click', goToLoading);
        nextBtn.addEventListener('touchend', (e) => { e.preventDefault(); goToLoading(); });
        
        window.addEventListener('keydown', (e) => {
            if (!this.screens.guide.classList.contains('active')) return;
            if (e.code === 'ArrowLeft') { goPrev(); }
            else if (e.code === 'ArrowRight') { goNext(); }
            else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); goToLoading(); }
        });
    },
    
    updateGuideSlider() {
        const imgs = document.querySelectorAll('.guide-img');
        const dots = document.querySelectorAll('.guide-dot');
        
        imgs.forEach((img, i) => {
            img.classList.toggle('active', i === this.guideCurrentSlide);
        });
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.guideCurrentSlide);
        });
    },
    
    // ============ ENERGY BAR COLOR PER ROBOT ============
    applyRobotEnergyColor(robotIndex) {
        const robotName = ASSETS.robots[robotIndex].name;
        const colors = ROBOT_COLORS[robotName] || ROBOT_COLORS['MRK-301'];
        
        const energyFill = document.getElementById('energy-fill');
        const energyBar = document.getElementById('energy-bar-container');
        const energyIcon = document.getElementById('energy-icon');
        
        if (energyFill) {
            energyFill.style.background = `linear-gradient(90deg, ${colors.dark}, ${colors.primary}, ${colors.light})`;
            energyFill.style.boxShadow = `0 0 12px ${colors.glow}, 0 0 4px rgba(255,255,255,0.3)`;
        }
        if (energyBar) {
            energyBar.style.borderColor = `${colors.primary}80`;
            energyBar.style.boxShadow = `0 0 8px ${colors.glow.replace('0.8', '0.4')}`;
        }
        if (energyIcon) {
            energyIcon.style.textShadow = `0 0 8px ${colors.primary}, 0 0 16px ${colors.dark}`;
        }
    },
    
    // ============ LOADING SCREEN ============
    showLoadingScreen() {
        this.showScreen('loading');
        
        const bar = document.getElementById('loading-bar');
        const percent = document.getElementById('loading-percent');
        let progress = 0;
        
        preloadAllAssets();
        
        const loadInterval = setInterval(() => {
            progress += 2 + Math.random() * 4;
            if (progress >= 100) {
                progress = 100;
                clearInterval(loadInterval);
                bar.style.width = '100%';
                percent.textContent = '100%';
                setTimeout(() => this.startGameplay(), 400);
            } else {
                bar.style.width = progress + '%';
                percent.textContent = Math.floor(progress) + '%';
            }
        }, 70);
    },
    
    // ============ GAMEPLAY ============
    startGameplay() {
        this.showScreen('hud');
        Game.startGame();
    },
    
    setupGameControls() {
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');
        const btnSonic = document.getElementById('btn-sonic');
        const btnSupersonic = document.getElementById('btn-supersonic');
        
        const addTouchControl = (element, key) => {
            element.addEventListener('touchstart', (e) => {
                e.preventDefault(); e.stopPropagation();
                Game.touchState[key] = true;
            }, { passive: false });
            element.addEventListener('touchend', (e) => {
                e.preventDefault(); e.stopPropagation();
                Game.touchState[key] = false;
            }, { passive: false });
            element.addEventListener('touchcancel', () => {
                Game.touchState[key] = false;
            });
            
            element.addEventListener('mousedown', (e) => {
                e.preventDefault();
                Game.touchState[key] = true;
            });
            element.addEventListener('mouseup', () => Game.touchState[key] = false);
            element.addEventListener('mouseleave', () => Game.touchState[key] = false);
        };
        
        addTouchControl(btnLeft, 'left');
        addTouchControl(btnRight, 'right');
        addTouchControl(btnJump, 'jump');
        addTouchControl(btnSonic, 'sonic');
        addTouchControl(btnSupersonic, 'supersonic');
        
        // Pause button
        const pauseBtn = document.getElementById('pause-btn');
        const pause = () => {
            if (Game.state === 'playing') {
                AudioManager.play('click');
                Game.pauseGame();
                this.screens.pause.classList.add('active');
            }
        };
        pauseBtn.addEventListener('click', pause);
        pauseBtn.addEventListener('touchend', (e) => { e.preventDefault(); pause(); });
        
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && Game.state === 'playing') pause();
        });
    },
    
    // ============ HUD ============
    updateHUD(health, energy, points, gameTimer, highScore) {
        // Health bar
        const maxH = Game.maxHealth || 100;
        const healthPct = Math.max(0, Math.min(100, (health / maxH) * 100));
        document.getElementById('health-fill').style.width = healthPct + '%';
        const hv = document.getElementById('health-value');
        if (hv) hv.textContent = Math.max(0, Math.round(health)) + ' / ' + Math.round(maxH);

        // Energy bar
        const maxE = Game.maxEnergy || 100;
        const energyPct = Math.max(0, Math.min(100, (energy / maxE) * 100));
        document.getElementById('energy-fill').style.width = energyPct + '%';
        const ev = document.getElementById('energy-value');
        if (ev) ev.textContent = Math.max(0, Math.round(energy)) + ' / ' + Math.round(maxE);

        // Shield bar
        this.updateShieldBarVisibility();
        if (Game.shieldActive && Game.maxShield > 0) {
            const shieldPct = Math.max(0, Math.min(100, (Game.shield / Game.maxShield) * 100));
            const sf = document.getElementById('shield-fill');
            if (sf) sf.style.width = shieldPct + '%';
            const sv = document.getElementById('shield-value');
            if (sv) sv.textContent = Math.max(0, Math.round(Game.shield)) + ' / ' + Math.round(Game.maxShield);
        }

        // Supersonic button state
        this.updateSupersonicButton();

        // Points / level / timer / hi
        document.getElementById('points-counter').textContent = points;
        document.getElementById('level-counter').textContent = 'LV.' + (Game.playerLevel || 1);
        const hsEl = document.getElementById('highscore-counter');
        if (hsEl) hsEl.textContent = (highScore != null ? highScore : (Game.highScore || 0));

        const totalSeconds = Math.floor((gameTimer || 0) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timerStr = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        document.getElementById('timer-counter').textContent = timerStr;
    },

    updateShieldBarVisibility() {
        const grp = document.getElementById('shield-bar-group');
        if (!grp) return;
        if (Game.shieldActive && Game.shield > 0) {
            grp.classList.remove('hidden');
        } else {
            grp.classList.add('hidden');
        }
    },

    updateSupersonicButton() {
        const btn = document.getElementById('btn-supersonic');
        const cdEl = document.getElementById('ssn-cooldown');
        if (!btn) return;
        const onCooldown = Game.supersonicCooldownMs > 0;
        const enoughEnergy = Game.energy >= (CONFIG ? CONFIG.SUPERSONIC_ENERGY_THRESHOLD : 70);
        const enabled = !onCooldown && enoughEnergy;
        btn.disabled = !enabled;
        btn.classList.toggle('cooldown', onCooldown);
        btn.classList.toggle('disabled', !enabled);
        if (cdEl) {
            if (onCooldown) {
                const secs = Math.ceil(Game.supersonicCooldownMs / 1000);
                cdEl.textContent = secs + 's';
            } else {
                cdEl.textContent = '';
            }
        }
    },

    // ============ DANGER WARNING ============
    showDangerWarning() {
        const el = document.getElementById('danger-warning');
        const dim = document.getElementById('dim-overlay');
        if (el) el.classList.add('active');
        if (dim) dim.classList.add('active');
    },
    hideDangerWarning() {
        const el = document.getElementById('danger-warning');
        const dim = document.getElementById('dim-overlay');
        if (el) el.classList.remove('active');
        if (dim) dim.classList.remove('active');
    },

    // ============ DIM OVERLAY (main-boss-defeat 2s pause) ============
    showDimOverlay() {
        const dim = document.getElementById('dim-overlay');
        if (dim) dim.classList.add('active');
    },
    hideDimOverlay() {
        const dim = document.getElementById('dim-overlay');
        if (dim) dim.classList.remove('active');
    },

    // ============ WHITE FADE (player death) ============
    startWhiteFade() {
        const el = document.getElementById('white-fade');
        if (el) { el.classList.add('fade-in'); el.classList.remove('fade-out'); }
    },
    endWhiteFade() {
        const el = document.getElementById('white-fade');
        if (el) { el.classList.remove('fade-in'); el.classList.add('fade-out'); }
        // Clear out fade-out after animation completes
        setTimeout(() => {
            if (el) el.classList.remove('fade-out');
        }, 700);
    },

    // ============ LEVEL-UP CARDS ============
    setupLevelUpOverlay() {
        // Nothing static to wire up here — cards are generated each time
        // showLevelUpCards() is called so the category-anti-duplication
        // filter can pick fresh cards.
    },

    showLevelUpCards() {
        const overlay = document.getElementById('levelup-overlay');
        const container = document.getElementById('levelup-cards');
        if (!overlay || !container) return;

        // ----- Strict category anti-duplication: pick 3 cards from 3 different categories -----
        // Group cards by category
        const byCat = { A: [], B: [], C: [], D: [] };
        CARD_REGISTRY.forEach(c => { if (byCat[c.category]) byCat[c.category].push(c); });
        const available = Object.keys(byCat).filter(k => byCat[k].length > 0);
        // Shuffle available categories
        const cats = available.slice().sort(() => Math.random() - 0.5).slice(0, 3);
        // Pick a random card from each chosen category
        const chosen = cats.map(cat => {
            const list = byCat[cat];
            return list[Math.floor(Math.random() * list.length)];
        });

        // Build DOM
        container.innerHTML = '';
        chosen.forEach(card => {
            const el = document.createElement('button');
            el.className = 'level-card cat-' + card.category;
            el.dataset.effect = card.effect;
            el.innerHTML = `
                <div class="lc-cat">CAT ${card.category}</div>
                <div class="lc-icon">${card.icon}</div>
                <div class="lc-title">${card.title}</div>
                <div class="lc-desc">${card.desc}</div>
                <div class="lc-id">${card.id}</div>
            `;
            const pick = () => {
                AudioManager.play('click');
                Game.onCardChosen(card.effect);
            };
            el.addEventListener('click', pick);
            el.addEventListener('touchend', (e) => { e.preventDefault(); pick(); });
            container.appendChild(el);
        });

        overlay.classList.add('active');
    },

    hideLevelUpCards() {
        const overlay = document.getElementById('levelup-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    // ============ PAUSE MENU ============
    setupPauseMenu() {
        const continueBtn = document.getElementById('continue-btn');
        const exitBtn = document.getElementById('exit-btn');
        
        const resume = () => {
            AudioManager.play('click');
            this.screens.pause.classList.remove('active');
            Game.resumeGame();
        };
        const exit = () => {
            AudioManager.play('click');
            AudioManager.muteAll();
            this.screens.pause.classList.remove('active');
            this.screens.hud.classList.remove('active');
            Game.state = 'start';
            this.showScreen('start');
            AudioManager.unmuteAll();
        };
        
        continueBtn.addEventListener('click', resume);
        continueBtn.addEventListener('touchend', (e) => { e.preventDefault(); resume(); });
        exitBtn.addEventListener('click', exit);
        exitBtn.addEventListener('touchend', (e) => { e.preventDefault(); exit(); });
        
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && Game.state === 'paused') resume();
        });
    },
    
    // ============ GAME OVER ============
    showGameOver(points, highScore) {
        document.getElementById('final-score').textContent = 'SCORE: ' + points;
        const hs = (highScore != null) ? highScore : (Game.highScore || 0);
        const hsEl = document.getElementById('final-highscore');
        if (hsEl) hsEl.textContent = 'SESSION HIGH SCORE: ' + hs;
        this.screens.hud.classList.remove('active');
        this.showScreen('gameover');
    },
    
    setupGameOverScreen() {
        const retryBtn = document.getElementById('retry-btn');
        const homeBtn = document.getElementById('home-btn');
        
        const retry = () => {
            AudioManager.play('click');
            this.applyRobotEnergyColor(Game.selectedRobot);
            this.showScreen('hud');
            Game.startGame();
        };
        const home = () => {
            AudioManager.play('click');
            AudioManager.stopMusic();
            Game.state = 'start';
            this.showScreen('start');
        };
        
        retryBtn.addEventListener('click', retry);
        retryBtn.addEventListener('touchend', (e) => { e.preventDefault(); retry(); });
        homeBtn.addEventListener('click', home);
        homeBtn.addEventListener('touchend', (e) => { e.preventDefault(); home(); });
    },
    
    // ============ VICTORY ============
    showVictory(points) {
        document.getElementById('victory-score').textContent = 'SCORE: ' + points;
        this.screens.hud.classList.remove('active');
        this.showScreen('victory');
    },
    
    setupVictoryScreen() {
        const continueBtn = document.getElementById('victory-continue-btn');
        const cont = () => {
            AudioManager.play('click');
            this.showScreen('hud');
            Game.state = 'playing';
        };
        continueBtn.addEventListener('click', cont);
        continueBtn.addEventListener('touchend', (e) => { e.preventDefault(); cont(); });
    }
};
