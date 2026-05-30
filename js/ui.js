/* ========================================
   NEO-ROBO - UI Manager (v4)
   - Legacy registration removed (anonymous pilot only)
   - HUD bar value indicators (animated)
   - Shield bar (dynamic, only when shield active)
   - Supersonic button (with cooldown UI)
   - Level-up card overlay (data-driven from LEVELUP_CARDS)
   ======================================== */

const ROBOT_COLORS = {
    'MRK-069': { primary: '#be774d', light: '#ce9979', dark: '#855335', glow: 'rgba(190, 119, 77, 0.8)' },
    'MRK-301': { primary: '#ffd264', light: '#ffdd8a', dark: '#b29346', glow: 'rgba(255, 210, 100, 0.8)' },
    'MRK-608': { primary: '#5bf9f8', light: '#84faf9', dark: '#3faead', glow: 'rgba(91, 249, 248, 0.8)' },
    'MRK-720': { primary: '#f4f4f4', light: '#f6f6f6', dark: '#aaaaaa', glow: 'rgba(244, 244, 244, 0.8)' },
    'MRK-830': { primary: '#2e4646', light: '#627474', dark: '#203131', glow: 'rgba(46, 70, 70, 0.8)' }
};

const UI = {
    screens: {},
    selectedRobot: 0,
    // Smooth-animated displayed values (lerped toward real values each frame)
    _dispHealth: 100,
    _dispEnergy: 100,
    _dispShield: 0,

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
        Object.values(this.screens).forEach(s => { if (s) s.classList.remove('active'); });
        if (this.screens[name]) this.screens[name].classList.add('active');
    },

    setupStartScreen() {
        const startBtn = document.getElementById('start-btn');
        const pressText = document.getElementById('press-to-start');

        const goNextFromStart = () => {
            AudioManager.init();
            AudioManager.play('click');
            // Legacy register screen removed — go straight to robot selection.
            try { PlayerRegistry.ensureAnonymousPilot(); } catch (e) {}
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
        imgs.forEach((img, i) => { img.classList.toggle('active', i === this.guideCurrentSlide); });
        dots.forEach((dot, i) => { dot.classList.toggle('active', i === this.guideCurrentSlide); });
    },

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

        // Supersonic uses a click trigger (single-shot activation, not a hold).
        const triggerSupersonic = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            if (Game.state !== 'playing') return;
            if (typeof Game.tryTriggerSupersonic === 'function') {
                Game.tryTriggerSupersonic();
            }
        };
        btnSupersonic.addEventListener('click', triggerSupersonic);
        btnSupersonic.addEventListener('touchend', triggerSupersonic);

        // Keyboard hotkey for Supersonic = G
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyG' && Game.state === 'playing') {
                if (typeof Game.tryTriggerSupersonic === 'function') Game.tryTriggerSupersonic();
            }
        });

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

    // Lerp helper for smooth bar / number animation
    _lerp(a, b, t) { return a + (b - a) * t; },

    updateHUD(health, energy, points, gameTimer, highScore) {
        // Smoothly animate displayed values toward target
        this._dispHealth = this._lerp(this._dispHealth, health, 0.18);
        this._dispEnergy = this._lerp(this._dispEnergy, energy, 0.22);
        const targetShield = Game.shieldActive ? Game.shieldHealth : 0;
        this._dispShield = this._lerp(this._dispShield, targetShield, 0.22);

        // Snap close-enough values
        if (Math.abs(this._dispHealth - health) < 0.05) this._dispHealth = health;
        if (Math.abs(this._dispEnergy - energy) < 0.05) this._dispEnergy = energy;
        if (Math.abs(this._dispShield - targetShield) < 0.05) this._dispShield = targetShield;

        document.getElementById('health-fill').style.width = Math.max(0, this._dispHealth) + '%';
        document.getElementById('energy-fill').style.width = Math.max(0, this._dispEnergy) + '%';

        const healthVal = document.getElementById('health-value');
        const energyVal = document.getElementById('energy-value');
        if (healthVal) healthVal.textContent = Math.max(0, Math.round(this._dispHealth));
        if (energyVal) energyVal.textContent = Math.max(0, Math.round(this._dispEnergy));

        // Shield bar — dynamically shown / hidden
        const shieldGroup = document.getElementById('shield-bar-group');
        const shieldFill  = document.getElementById('shield-fill');
        const shieldVal   = document.getElementById('shield-value');
        if (shieldGroup) {
            if (Game.shieldActive && Game.shieldHealth > 0) {
                shieldGroup.style.display = '';
                const maxShield = Game.shieldMax || 1;
                const pct = Math.max(0, Math.min(100, (this._dispShield / maxShield) * 100));
                if (shieldFill) shieldFill.style.width = pct + '%';
                if (shieldVal)  shieldVal.textContent = Math.max(0, Math.round(this._dispShield));
            } else {
                shieldGroup.style.display = 'none';
            }
        }

        document.getElementById('points-counter').textContent = points;
        document.getElementById('level-counter').textContent = 'LV.' + (Game.playerLevel || 1);

        const hsEl = document.getElementById('highscore-counter');
        if (hsEl) hsEl.textContent = (highScore != null ? highScore : (Game.highScore || 0));

        const totalSeconds = Math.floor((gameTimer || 0) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timerStr = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        document.getElementById('timer-counter').textContent = timerStr;

        // Update supersonic button state (energy gate + cooldown)
        this._updateSupersonicButton(energy);
    },

    _updateSupersonicButton(energy) {
        const btn = document.getElementById('btn-supersonic');
        const cdEl = document.getElementById('supersonic-cd');
        if (!btn) return;
        const ready = (energy >= (Game.SUPERSONIC_ENERGY_THRESHOLD || 80)) && (Game.supersonicCooldown || 0) <= 0;
        btn.dataset.disabled = ready ? 'false' : 'true';
        if ((Game.supersonicCooldown || 0) > 0) {
            cdEl.textContent = Math.ceil(Game.supersonicCooldown / 1000) + 's';
            cdEl.style.display = '';
        } else {
            cdEl.textContent = '';
            cdEl.style.display = 'none';
        }
    },

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

    showGameOver(points, highScore) {
        document.getElementById('final-score').textContent = 'SCORE: ' + points;
        const hs = (highScore != null) ? highScore : (Game.highScore || 0);
        const hsEl = document.getElementById('final-highscore');
        if (hsEl) hsEl.textContent = 'SESSION HIGH SCORE: ' + hs;
        this.screens.hud.classList.remove('active');
        this.showScreen('gameover');
        this.renderScoreboard();
    },

    async renderScoreboard() {
        const listEl = document.getElementById('scoreboard-list');
        if (!listEl) return;

        listEl.innerHTML = '<div class="sb-empty">Loading global leaderboard...</div>';

        let ranked;
        try {
            ranked = await PlayerRegistry.getRanked();
        } catch (e) {
            console.error('Leaderboard fetch error:', e);
            ranked = [];
        }

        const currentName = (PlayerRegistry && PlayerRegistry.currentPlayer) ? PlayerRegistry.currentPlayer : null;
        const currentKey = currentName ? currentName.toLowerCase() : null;

        listEl.innerHTML = '';

        if (!ranked || ranked.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'sb-empty';
            empty.textContent = 'No scores yet.';
            listEl.appendChild(empty);
            return;
        }

        let currentRow = null;
        ranked.forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'scoreboard-row';
            const isMe = currentKey && entry.name && entry.name.toLowerCase() === currentKey;
            if (isMe) row.classList.add('me');
            if (entry.rank === 1) row.classList.add('rank-1');
            else if (entry.rank === 2) row.classList.add('rank-2');
            else if (entry.rank === 3) row.classList.add('rank-3');

            const rankCell = document.createElement('span');
            rankCell.className = 'sb-col sb-rank';
            rankCell.textContent = '#' + entry.rank;

            const nameCell = document.createElement('span');
            nameCell.className = 'sb-col sb-name';
            nameCell.textContent = entry.name + (isMe ? ' (YOU)' : '');

            const scoreCell = document.createElement('span');
            scoreCell.className = 'sb-col sb-score';
            scoreCell.textContent = entry.highScore;

            row.appendChild(rankCell);
            row.appendChild(nameCell);
            row.appendChild(scoreCell);
            listEl.appendChild(row);

            if (isMe && !currentRow) currentRow = row;
        });

        if (currentRow) {
            requestAnimationFrame(() => {
                const top = currentRow.offsetTop - 4;
                listEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                currentRow.classList.add('pulse');
                setTimeout(() => currentRow.classList.remove('pulse'), 2400);
            });
        } else {
            listEl.scrollTop = 0;
        }
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
    },

    // ================== LEVEL-UP CARD OVERLAY ==================
    setupLevelUpOverlay() {
        // No persistent setup needed beyond holding a reference to the overlay.
        this._levelupOverlay = document.getElementById('levelup-overlay');
    },

    /**
     * Shows the level-up overlay with 3 cards drawn from 3 DIFFERENT categories.
     * Populated from the LEVELUP_CARDS registry defined in game.js, so values
     * can be tweaked in one centralized place.
     */
    showLevelUpOverlay() {
        const overlay = this._levelupOverlay || document.getElementById('levelup-overlay');
        if (!overlay) return;
        const host = document.getElementById('levelup-cards');
        const tpl  = document.getElementById('levelup-card-template');
        if (!host || !tpl) return;

        // Pick 3 cards from 3 different categories
        const picks = this._pickLevelUpCards();
        host.innerHTML = '';

        picks.forEach(card => {
            const node = tpl.content.firstElementChild.cloneNode(true);
            node.dataset.cardId = card.id;
            node.querySelector('.levelup-card-cat').textContent = card.category;
            node.querySelector('.levelup-card-id').textContent = card.id;
            node.querySelector('.levelup-card-icon').textContent = card.icon;
            node.querySelector('.levelup-card-name').textContent = card.name;
            node.querySelector('.levelup-card-desc').textContent = card.description;
            node.classList.add('cat-' + card.category.toLowerCase());

            const pickBtn = node.querySelector('.levelup-card-pick');
            const choose = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                AudioManager.play('click');
                try { card.apply(Game); } catch (err) { console.warn('Card apply failed:', err); }
                this.hideLevelUpOverlay();
                Game.resumeFromLevelUp();
            };
            pickBtn.addEventListener('click', choose);
            pickBtn.addEventListener('touchend', choose);
            node.addEventListener('click', (e) => {
                // Whole card clickable as a fallback
                if (e.target === pickBtn) return;
                choose(e);
            });

            host.appendChild(node);
        });

        overlay.classList.add('active');
    },

    hideLevelUpOverlay() {
        const overlay = this._levelupOverlay || document.getElementById('levelup-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    /**
     * Strict anti-duplication: 3 cards from 3 distinct categories (A/B/C/D).
     */
    _pickLevelUpCards() {
        const all = (typeof LEVELUP_CARDS !== 'undefined') ? LEVELUP_CARDS : [];
        if (!all.length) return [];
        // Group by category
        const byCat = {};
        all.forEach(c => {
            if (!byCat[c.category]) byCat[c.category] = [];
            byCat[c.category].push(c);
        });
        const cats = Object.keys(byCat);
        // Shuffle categories, take 3 (or as many as available)
        for (let i = cats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cats[i], cats[j]] = [cats[j], cats[i]];
        }
        const chosenCats = cats.slice(0, 3);
        // Pick one random card per chosen category
        return chosenCats.map(cat => {
            const pool = byCat[cat];
            return pool[Math.floor(Math.random() * pool.length)];
        });
    }
};
