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
            selection: document.getElementById('selection-screen'),
            loading: document.getElementById('loading-screen'),
            hud: document.getElementById('game-hud'),
            pause: document.getElementById('pause-menu'),
            gameover: document.getElementById('gameover-screen'),
            victory: document.getElementById('victory-screen')
        };
        
        this.setupStartScreen();
        this.setupSelectionScreen();
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
        
        const goToSelection = () => {
            AudioManager.init();
            AudioManager.play('click');
            this.showScreen('selection');
            this.initRobotSelection();
        };
        
        startBtn.addEventListener('click', goToSelection);
        startBtn.addEventListener('touchend', (e) => { e.preventDefault(); goToSelection(); });
        pressText.addEventListener('click', goToSelection);
        
        window.addEventListener('keydown', (e) => {
            if (Game.state === 'start' && (e.code === 'Enter' || e.code === 'Space')) {
                e.preventDefault();
                goToSelection();
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
            this.showLoadingScreen();
        };
        confirmBtn.addEventListener('click', confirm);
        confirmBtn.addEventListener('touchend', (e) => { e.preventDefault(); confirm(); });
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
    updateHUD(health, energy, points) {
        document.getElementById('health-fill').style.width = health + '%';
        document.getElementById('energy-fill').style.width = energy + '%';
        document.getElementById('points-counter').textContent = points;
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
    showGameOver(points) {
        document.getElementById('final-score').textContent = 'SCORE: ' + points;
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
