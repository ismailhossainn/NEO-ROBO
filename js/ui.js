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

const UI = {
    screens: {},
    selectedRobot: 0,
    
    init() {
        this.screens = {
            start: document.getElementById('start-screen'),
            register: document.getElementById('register-screen'),
            selection: document.getElementById('selection-screen'),
            guide: document.getElementById('guide-screen'),
            loading: document.getElementById('loading-screen'),
            hud: document.getElementById('game-hud'),
            pause: document.getElementById('pause-menu'),
            gameover: document.getElementById('gameover-screen'),
            victory: document.getElementById('victory-screen')
        };
        
        this.setupStartScreen();
        this.setupRegisterScreen();
        this.setupSelectionScreen();
        this.setupGuideScreen();
        this.setupGameControls();
        this.setupPauseMenu();
        this.setupGameOverScreen();
        this.setupVictoryScreen();
    },
    
    showScreen(name) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        if (this.screens[name]) this.screens[name].classList.add('active');
    },
    
    // ============ START SCREEN ============
    setupStartScreen() {
        const startBtn = document.getElementById('start-btn');
        const pressText = document.getElementById('press-to-start');
        
        // === Mandatory registration BEFORE robot selection ===
        const goNextFromStart = () => {
            AudioManager.init();
            AudioManager.play('click');
            // Always require a fresh registration each session
            this.showRegisterScreen();
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
    
    // ============ REGISTRATION SCREEN ============
    showRegisterScreen() {
        this.showScreen('register');
        const input = document.getElementById('register-name-input');
        const err = document.getElementById('register-error');
        if (input) {
            input.value = '';
            // Focus after the screen transition so mobile keyboards open reliably
            setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);
        }
        if (err) err.textContent = '\u00A0';
    },
    
    setupRegisterScreen() {
        const input = document.getElementById('register-name-input');
        const btn = document.getElementById('register-btn');
        const err = document.getElementById('register-error');
        if (!input || !btn) return;
        
        const showError = (msg) => {
            err.textContent = msg;
            err.classList.remove('shake');
            // restart shake animation
            void err.offsetWidth;
            err.classList.add('shake');
        };
        
        const submit = () => {
            AudioManager.play('click');
            const name = input.value;
            const result = PlayerRegistry.register(name);
            if (!result.ok) {
                showError(result.error);
                input.classList.remove('input-error');
                void input.offsetWidth;
                input.classList.add('input-error');
                return;
            }
            // Success - proceed to robot selection
            err.textContent = '\u00A0';
            this.showScreen('selection');
            this.initRobotSelection();
        };
        
        btn.addEventListener('click', submit);
        btn.addEventListener('touchend', (e) => { e.preventDefault(); submit(); });
        
        // Clear error as the user types
        input.addEventListener('input', () => {
            err.textContent = '\u00A0';
            input.classList.remove('input-error');
        });
        
        // Enter key submits
        input.addEventListener('keydown', (e) => {
            if (e.code === 'Enter') {
                e.preventDefault();
                submit();
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
        
        // Previous slide
        const goPrev = () => {
            AudioManager.play('click');
            if (this.guideCurrentSlide > 0) {
                this.guideCurrentSlide--;
                this.updateGuideSlider();
            }
        };
        prevBtn.addEventListener('click', goPrev);
        prevBtn.addEventListener('touchend', (e) => { e.preventDefault(); goPrev(); });
        
        // Next slide
        const goNext = () => {
            AudioManager.play('click');
            if (this.guideCurrentSlide < this.guideTotalSlides - 1) {
                this.guideCurrentSlide++;
                this.updateGuideSlider();
            }
        };
        nextArrowBtn.addEventListener('click', goNext);
        nextArrowBtn.addEventListener('touchend', (e) => { e.preventDefault(); goNext(); });
        
        // Dot navigation
        dots.forEach((dot) => {
            const goToDot = () => {
                AudioManager.play('click');
                this.guideCurrentSlide = parseInt(dot.dataset.index);
                this.updateGuideSlider();
            };
            dot.addEventListener('click', goToDot);
            dot.addEventListener('touchend', (e) => { e.preventDefault(); goToDot(); });
        });
        
        // NEXT button → go to loading screen
        const goToLoading = () => {
            AudioManager.play('click');
            this.showLoadingScreen();
        };
        nextBtn.addEventListener('click', goToLoading);
        nextBtn.addEventListener('touchend', (e) => { e.preventDefault(); goToLoading(); });
        
        // Keyboard navigation for guide
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
        document.getElementById('health-fill').style.width = health + '%';
        document.getElementById('energy-fill').style.width = energy + '%';
        document.getElementById('points-counter').textContent = points;
        document.getElementById('level-counter').textContent = 'LV.' + (Game.playerLevel || 1);

        // High score (centered, in line with score/health)
        const hsEl = document.getElementById('highscore-counter');
        if (hsEl) hsEl.textContent = (highScore != null ? highScore : (Game.highScore || 0));

        // Update timer display
        const totalSeconds = Math.floor((gameTimer || 0) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timerStr = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        document.getElementById('timer-counter').textContent = timerStr;
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
        if (hsEl) hsEl.textContent = 'HIGH SCORE: ' + hs;
        this.screens.hud.classList.remove('active');
        this.showScreen('gameover');
        // Render scoreboard with auto-scroll & highlight for current player
        this.renderScoreboard();
    },
    
    renderScoreboard() {
        const listEl = document.getElementById('scoreboard-list');
        if (!listEl) return;
        const ranked = (typeof PlayerRegistry !== 'undefined') ? PlayerRegistry.getRanked() : [];
        const currentName = (PlayerRegistry && PlayerRegistry.currentPlayer) ? PlayerRegistry.currentPlayer : null;
        const currentKey = currentName ? currentName.toLowerCase() : null;
        
        listEl.innerHTML = '';
        
        if (ranked.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'sb-empty';
            empty.textContent = 'No pilots registered yet.';
            listEl.appendChild(empty);
            return;
        }
        
        let currentRow = null;
        ranked.forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'scoreboard-row';
            const isMe = currentKey && entry.name.toLowerCase() === currentKey;
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
        
        // Auto-scroll: bring the current player's row to the top of the visible area,
        // then allow the user to scroll manually afterwards.
        if (currentRow) {
            // Defer so layout is ready
            requestAnimationFrame(() => {
                const top = currentRow.offsetTop - 4;
                listEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                // pulse highlight
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
            // Returning home logs the pilot out so the next session must register again
            if (typeof PlayerRegistry !== 'undefined') PlayerRegistry.clearCurrent();
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
