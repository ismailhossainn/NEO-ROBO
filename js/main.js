/* ========================================
   NEO-ROBO - Main Entry Point (v3)
   Flexible canvas width, fixed 1080 height
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game systems
    Game.init();
    UI.init();
    
    // Start the game loop
    Game.start();
    
    // Prevent default touch behaviors on game container
    const container = document.getElementById('game-container');
    container.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    container.addEventListener('touchstart', (e) => {
        if (e.target === container || e.target.tagName === 'CANVAS') {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Auto-pause on visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && Game.state === 'playing') {
            Game.pauseGame();
            UI.screens.pause.classList.add('active');
        }
    });
    
    // Try to lock orientation to landscape on mobile
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }
    
    // Handle resize - update canvas size (width may change)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            Game.fitToScreen();
        }, 100);
    });
    
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => Game.fitToScreen(), 300);
    });
    
    console.log('🤖 NEO-ROBO v3 initialized! (1080px fixed height, flexible width)');
});
