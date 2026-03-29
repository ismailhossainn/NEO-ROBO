/* ========================================
   NEO-ROBO Audio System - LOCAL ASSETS
   ======================================== */

const AudioManager = {
    sounds: {},
    bgMusic: null,
    muted: false,
    initialized: false,
    context: null,

    init() {
        if (this.initialized) return;
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('AudioContext not supported');
        }
        this.loadAll();
        this.initialized = true;
    },

    loadAll() {
        // Background music
        this.loadSound('bg_music', 'assets/audio/Background Music.mp3', true);
        
        // UI & Effects
        this.loadSound('click', 'assets/audio/Click Sound.mp3');
        this.loadSound('jump', 'assets/audio/Jump Sound Effect.mp3');
        this.loadSound('victory', 'assets/audio/victory.mp3');
        this.loadSound('game_over', 'assets/audio/Game Over Sound.mp3');
        this.loadSound('robot_walk', 'assets/audio/Robot - Sound Effect.mp3');
        
        // Robot sounds
        this.loadSound('mrk_069', 'assets/audio/Mrk-069 Sound.wav');
        this.loadSound('mrk_301', 'assets/audio/Mrk-301 Sound.wav');
        this.loadSound('mrk_608', 'assets/audio/Mrk-608 Sound.wav');
        this.loadSound('mrk_720', 'assets/audio/Mrk-720 Sound.wav');
        this.loadSound('mrk_830', 'assets/audio/Mrk-830 Sound.wav');
    },

    loadSound(name, url, loop = false) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        audio.loop = loop;
        if (loop) {
            audio.volume = 0.3;
        } else {
            audio.volume = 0.5;
        }
        this.sounds[name] = audio;
        if (loop) this.bgMusic = audio;
    },

    play(name) {
        if (this.muted) return;
        const sound = this.sounds[name];
        if (!sound) return;
        
        if (!sound.loop) {
            // For SFX, clone and play to allow overlapping
            const clone = sound.cloneNode();
            clone.volume = sound.volume;
            clone.play().catch(() => {});
        } else {
            sound.play().catch(() => {});
        }
    },

    stop(name) {
        const sound = this.sounds[name];
        if (!sound) return;
        sound.pause();
        sound.currentTime = 0;
    },

    playMusic() {
        if (this.muted || !this.bgMusic) return;
        this.bgMusic.play().catch(() => {});
    },

    stopMusic() {
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }
    },

    pauseMusic() {
        if (this.bgMusic) {
            this.bgMusic.pause();
        }
    },

    resumeMusic() {
        if (!this.muted && this.bgMusic) {
            this.bgMusic.play().catch(() => {});
        }
    },

    muteAll() {
        this.muted = true;
        this.stopMusic();
        Object.values(this.sounds).forEach(s => {
            s.pause();
            s.currentTime = 0;
        });
    },

    unmuteAll() {
        this.muted = false;
    }
};
