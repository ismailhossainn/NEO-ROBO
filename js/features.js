/* ============================================================
   NEO-ROBO - Features Module (Add-on layer)
   ------------------------------------------------------------
   This file ADDS new features without modifying any existing
   code. It works by:
     • Wrapping (monkey-patching) selected Game / UI methods
     • Injecting new DOM nodes inside #game-hud
     • Injecting a <style> block with new CSS rules

   Features delivered:
     1. Aligned HUD bars (Health / Energy / Shield) + numeric labels
     2. Shield collectible + spherical sky-blue overlay + hit anim
     3. Red "SUPERSONIC" button above the Sonic button (90% energy, 45 s CD)
     4. 3-second time-slow + cut-in "SUPERSONIC WAVE" animation
     5. Main-boss every 2:30 + 3 s DANGER warning strip (5 s pre-spawn)
     6. Blink / slow-down on defeat + white fade on player death
     7. Card-based level-up system (3 unique cards, paused overlay)
   ============================================================ */

(function () {
    'use strict';

    // ───────────────────────────────────────────────────────────
    // 0. CONSTANTS
    // ───────────────────────────────────────────────────────────
    const SHIELD_PACK_SIZE = 38;
    const SHIELD_HIT_FLASH_FRAMES = 22;
    const SUPERSONIC_COOLDOWN_MS = 45000;
    const SUPERSONIC_ENERGY_THRESHOLD = 90;
    const TIME_SLOW_FACTOR = 0.25;
    const TIME_SLOW_DURATION_MS = 3000;
    const CUTIN_DURATION_MS = 3000;
    const DANGER_DURATION_MS = 3000;
    const DANGER_PRE_SPAWN_MS = 5000;  // warning starts this many ms before main boss spawns
    const MAIN_BOSS_INTERVAL_MS = 150000; // 2:30
    const DEATH_FADE_MS = 1500;        // total fade in+out before showing game-over
    const DEFEAT_BLINK_MS = 1200;      // boss/player blink duration on defeat
    const DEFEAT_SLOW_FACTOR = 0.35;   // slight slow-down during defeat blink
    const SKY_BLUE = '#5BC8FF';
    const SKY_BLUE_RGB = '91,200,255';
    const SUPERSONIC_RED = '#ff2244';
    const SUPERSONIC_RED_RGB = '255,34,68';

    // Wait until existing globals exist (DOMContentLoaded fires first; this script is loaded last)
    if (typeof Game === 'undefined' || typeof UI === 'undefined' || typeof CONFIG === 'undefined') {
        console.error('[Features] Required globals missing.');
        return;
    }

    // ───────────────────────────────────────────────────────────
    // 1. CSS injection
    // ───────────────────────────────────────────────────────────
    const css = `
    /* ===== Aligned HUD bars + numeric labels ===== */
    #hud-top-left .hud-bar-group {
        display: grid;
        grid-template-columns: 28px 1fr;
        column-gap: 8px;
        row-gap: 0;
        align-items: center;
    }
    #hud-top-left .hud-bar {
        width: clamp(140px, 18vw, 220px) !important; /* unified width across all 3 */
    }
    #hud-top-left .hud-icon {
        justify-self: center;
    }
    .hud-bar-value {
        grid-column: 2 / 3;
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #cfeaff;
        text-shadow: 0 0 6px rgba(0, 200, 255, 0.6);
        margin-top: 2px;
        margin-bottom: 4px;
        line-height: 1;
        transition: color 0.25s ease, text-shadow 0.25s ease, transform 0.18s ease;
        will-change: transform;
    }
    .hud-bar-value.health-value {
        color: #ffb8c4;
        text-shadow: 0 0 6px rgba(255, 60, 90, 0.65);
    }
    .hud-bar-value.shield-value {
        color: #cfeeff;
        text-shadow: 0 0 6px rgba(${SKY_BLUE_RGB}, 0.75);
    }
    .hud-bar-value.bump {
        transform: scale(1.18);
    }

    /* ===== Shield bar (visible only when active) ===== */
    #shield-bar-group {
        display: none !important;
        opacity: 0;
        transition: opacity 0.4s ease;
    }
    #shield-bar-group.active {
        display: grid !important;
        opacity: 1;
    }
    .shield-bar {
        border-color: rgba(${SKY_BLUE_RGB}, 0.55);
        box-shadow: 0 0 8px rgba(${SKY_BLUE_RGB}, 0.45);
    }
    .shield-fill {
        width: 100%;
        background: linear-gradient(90deg, #2aa6d8, ${SKY_BLUE}, #b9ecff);
        box-shadow: 0 0 12px rgba(${SKY_BLUE_RGB}, 0.8), 0 0 4px rgba(255,255,255,0.3);
    }
    .shield-icon {
        color: ${SKY_BLUE};
        text-shadow: 0 0 8px ${SKY_BLUE}, 0 0 16px #1aa0d0;
    }

    /* ===== Supersonic button (above Sonic) ===== */
    #controls-right {
        align-items: flex-end;
    }
    #btn-supersonic-wrap {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: flex-end;
    }
    .supersonic-btn {
        background: rgba(${SUPERSONIC_RED_RGB}, 0.28);
        border: 2px solid ${SUPERSONIC_RED};
        color: #fff;
        box-shadow: 0 0 14px rgba(${SUPERSONIC_RED_RGB}, 0.55),
                    inset 0 0 12px rgba(${SUPERSONIC_RED_RGB}, 0.3);
        text-shadow: 0 0 6px rgba(255, 100, 120, 0.8);
        position: relative;
        font-size: 0;
    }
    .supersonic-btn.ready {
        animation: ssReadyPulse 1.4s ease-in-out infinite;
    }
    @keyframes ssReadyPulse {
        0%, 100% { box-shadow: 0 0 14px rgba(${SUPERSONIC_RED_RGB}, 0.55),
                                inset 0 0 12px rgba(${SUPERSONIC_RED_RGB}, 0.3); }
        50%      { box-shadow: 0 0 28px rgba(${SUPERSONIC_RED_RGB}, 0.95),
                                inset 0 0 18px rgba(${SUPERSONIC_RED_RGB}, 0.5); }
    }
    .supersonic-btn:active {
        background: rgba(${SUPERSONIC_RED_RGB}, 0.55);
        transform: scale(0.92);
    }
    .supersonic-btn.disabled,
    .supersonic-btn.cooling {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
        animation: none;
    }
    /* Custom symbol inside the button (drawn with pure CSS) */
    .ss-symbol {
        position: relative;
        width: 60%;
        height: 60%;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 0 6px rgba(${SUPERSONIC_RED_RGB}, 0.9));
    }
    .ss-symbol::before {
        content: '';
        position: absolute;
        width: 100%; height: 100%;
        background:
            radial-gradient(circle at 50% 50%, #fff 0%, #fff 14%, transparent 16%),
            conic-gradient(from -90deg,
                ${SUPERSONIC_RED} 0deg 30deg,
                transparent 30deg 90deg,
                ${SUPERSONIC_RED} 90deg 120deg,
                transparent 120deg 180deg,
                ${SUPERSONIC_RED} 180deg 210deg,
                transparent 210deg 270deg,
                ${SUPERSONIC_RED} 270deg 300deg,
                transparent 300deg 360deg);
        -webkit-mask: radial-gradient(circle, #000 60%, transparent 62%);
                mask: radial-gradient(circle, #000 60%, transparent 62%);
    }
    .ss-symbol::after {
        content: '⚡';
        position: relative;
        z-index: 2;
        color: #fff;
        font-size: clamp(20px, 3vh, 30px);
        font-weight: 900;
        line-height: 1;
        text-shadow: 0 0 8px ${SUPERSONIC_RED}, 0 0 14px ${SUPERSONIC_RED};
    }
    .supersonic-cd-ring {
        position: absolute;
        top: -8px; left: -8px;
        width: calc(100% + 16px);
        height: calc(100% + 16px);
        pointer-events: none;
    }
    .supersonic-cd-label {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-weight: 900;
        font-size: clamp(18px, 3vh, 28px);
        color: #fff;
        text-shadow: 0 0 8px ${SUPERSONIC_RED}, 0 0 16px ${SUPERSONIC_RED};
        pointer-events: none;
        z-index: 3;
        display: none;
    }
    .supersonic-btn.cooling .supersonic-cd-label { display: block; }
    .supersonic-btn.cooling .ss-symbol { opacity: 0.25; }

    /* ===== Danger warning ===== */
    #danger-warning {
        position: absolute;
        left: 0; right: 0;
        top: 50%;
        height: 20%;            /* 1/5 of display */
        transform: translateY(-50%) translateX(-110%);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 95;
        background:
            repeating-linear-gradient(45deg,
                #ffd400 0 40px,
                #111 40px 80px);
        border-top: 4px solid #000;
        border-bottom: 4px solid #000;
        box-shadow: 0 0 30px rgba(255, 212, 0, 0.6);
        opacity: 0;
    }
    #danger-warning.active {
        animation: dangerSlide ${DANGER_DURATION_MS}ms cubic-bezier(.2,.8,.2,1) forwards;
    }
    @keyframes dangerSlide {
        0%   { transform: translateY(-50%) translateX(-110%); opacity: 1; }
        18%  { transform: translateY(-50%) translateX(0); opacity: 1; }
        78%  { transform: translateY(-50%) translateX(0); opacity: 1; }
        100% { transform: translateY(-50%) translateX(110%); opacity: 1; }
    }
    #danger-warning .danger-text {
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-weight: 900;
        font-size: 12vh;
        line-height: 1;
        color: ${SUPERSONIC_RED};
        letter-spacing: 8px;
        -webkit-text-stroke: 3px #000;
                text-stroke: 3px #000;
        text-shadow:
            0 0 18px ${SUPERSONIC_RED},
            0 0 36px ${SUPERSONIC_RED},
            4px 4px 0 #000;
        animation: dangerPulse 0.5s ease-in-out infinite alternate;
    }
    @keyframes dangerPulse {
        from { transform: scale(1); }
        to   { transform: scale(1.05); }
    }
    #danger-dim {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.45);
        pointer-events: none;
        opacity: 0;
        z-index: 94;
        transition: opacity 0.25s ease;
    }
    #danger-dim.active { opacity: 1; }

    /* ===== Supersonic cut-in ===== */
    #supersonic-cutin {
        position: absolute;
        left: 0; right: 0;
        top: 50%;
        height: 20%;            /* 1/5 of display */
        transform: translateY(-50%) translateY(100vh);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 96;
        background: rgba(${SUPERSONIC_RED_RGB}, 0.85);
        opacity: 0;
        /* Stroke implemented as outline so it stays solid regardless of background opacity */
        outline: 5px solid #ffffff;
        outline-offset: -5px;
        box-shadow: 0 0 40px rgba(${SUPERSONIC_RED_RGB}, 0.85),
                    inset 0 0 30px rgba(255,255,255,0.15);
    }
    #supersonic-cutin.active {
        animation: ssCutin ${CUTIN_DURATION_MS}ms cubic-bezier(.2,.8,.2,1) forwards;
    }
    @keyframes ssCutin {
        0%   { transform: translateY(-50%) translateY(100vh); opacity: 0.5; }
        18%  { transform: translateY(-50%) translateY(0);     opacity: 0.92; }
        70%  { transform: translateY(-50%) translateY(0);     opacity: 0.92; }
        100% { transform: translateY(-50%) translateY(-130vh); opacity: 0.5; }
    }
    #supersonic-cutin .ss-cutin-text {
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-weight: 900;
        font-size: 11vh;
        line-height: 1;
        color: #fff;
        letter-spacing: 6px;
        -webkit-text-stroke: 3px #000;
                text-stroke: 3px #000;
        text-shadow:
            0 0 18px #fff,
            0 0 36px ${SUPERSONIC_RED},
            4px 4px 0 #000;
    }

    /* ===== Death white fade ===== */
    #death-fade {
        position: absolute; inset: 0;
        background: #ffffff;
        opacity: 0;
        pointer-events: none;
        z-index: 999;
    }
    #death-fade.active {
        animation: deathFadeAnim ${DEATH_FADE_MS}ms ease-in-out forwards;
    }
    @keyframes deathFadeAnim {
        0%   { opacity: 0; }
        50%  { opacity: 1; }
        100% { opacity: 0; }
    }

    /* ===== Defeat slow-down dim ===== */
    #defeat-dim {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.18);
        opacity: 0;
        pointer-events: none;
        z-index: 90;
        transition: opacity 0.2s ease;
    }
    #defeat-dim.active { opacity: 1; }

    /* ===== Level-up card overlay ===== */
    #levelup-overlay {
        position: absolute; inset: 0;
        background: rgba(2, 8, 24, 0.78);
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 22px;
        z-index: 200;
        pointer-events: auto;
        backdrop-filter: blur(2px);
    }
    #levelup-overlay.active { display: flex; }
    #levelup-overlay .lu-title {
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-weight: 900;
        font-size: clamp(28px, 5vh, 52px);
        color: #7DFF3A;
        letter-spacing: 6px;
        text-shadow: 0 0 14px #7DFF3A, 0 0 30px #39ff14;
        animation: luTitlePulse 1.4s ease-in-out infinite;
    }
    @keyframes luTitlePulse {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.04); }
    }
    #levelup-overlay .lu-sub {
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-size: clamp(12px, 1.8vh, 18px);
        color: #aee9ff;
        letter-spacing: 3px;
        opacity: 0.9;
    }
    #levelup-cards {
        display: flex;
        gap: clamp(14px, 2vw, 28px);
        align-items: stretch;
        justify-content: center;
    }
    .lu-card {
        width: clamp(180px, 22vw, 280px);
        min-height: clamp(220px, 36vh, 340px);
        background: linear-gradient(180deg, rgba(10,30,60,0.95), rgba(4,10,28,0.95));
        border: 2px solid var(--neon-blue, #00d4ff);
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.45),
                    inset 0 0 24px rgba(0, 168, 255, 0.12);
        padding: 22px 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        position: relative;
        overflow: hidden;
    }
    .lu-card::before {
        content: '';
        position: absolute; inset: 0;
        background: repeating-linear-gradient(0deg,
            transparent, transparent 2px,
            rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 4px);
        pointer-events: none;
    }
    .lu-card:hover {
        transform: translateY(-8px) scale(1.03);
        box-shadow: 0 0 30px rgba(0, 212, 255, 0.85),
                    inset 0 0 28px rgba(0, 168, 255, 0.2);
    }
    .lu-card.cat-A { border-color: #ff4466; box-shadow: 0 0 20px rgba(255, 68, 102, 0.45), inset 0 0 24px rgba(255, 68, 102, 0.12); }
    .lu-card.cat-A:hover { box-shadow: 0 0 30px rgba(255, 68, 102, 0.85), inset 0 0 28px rgba(255, 68, 102, 0.2); }
    .lu-card.cat-B { border-color: ${SKY_BLUE}; box-shadow: 0 0 20px rgba(${SKY_BLUE_RGB}, 0.45), inset 0 0 24px rgba(${SKY_BLUE_RGB}, 0.12); }
    .lu-card.cat-B:hover { box-shadow: 0 0 30px rgba(${SKY_BLUE_RGB}, 0.85), inset 0 0 28px rgba(${SKY_BLUE_RGB}, 0.2); }
    .lu-card.cat-C { border-color: #7DFF3A; box-shadow: 0 0 20px rgba(125, 255, 58, 0.45), inset 0 0 24px rgba(125, 255, 58, 0.12); }
    .lu-card.cat-C:hover { box-shadow: 0 0 30px rgba(125, 255, 58, 0.85), inset 0 0 28px rgba(125, 255, 58, 0.2); }
    .lu-card.cat-D { border-color: #ffcc00; box-shadow: 0 0 20px rgba(255, 204, 0, 0.45), inset 0 0 24px rgba(255, 204, 0, 0.12); }
    .lu-card.cat-D:hover { box-shadow: 0 0 30px rgba(255, 204, 0, 0.85), inset 0 0 28px rgba(255, 204, 0, 0.2); }
    .lu-card-icon {
        font-size: clamp(38px, 6vh, 60px);
        line-height: 1;
        filter: drop-shadow(0 0 8px currentColor);
    }
    .lu-card.cat-A .lu-card-icon { color: #ff4466; }
    .lu-card.cat-B .lu-card-icon { color: ${SKY_BLUE}; }
    .lu-card.cat-C .lu-card-icon { color: #7DFF3A; }
    .lu-card.cat-D .lu-card-icon { color: #ffcc00; }
    .lu-card-title {
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-weight: 900;
        font-size: clamp(13px, 1.9vh, 18px);
        color: #fff;
        letter-spacing: 2px;
        text-align: center;
        text-shadow: 0 0 6px rgba(255,255,255,0.5);
    }
    .lu-card-desc {
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-size: clamp(10px, 1.4vh, 13px);
        color: #cfeaff;
        text-align: center;
        line-height: 1.5;
        opacity: 0.9;
        flex: 1;
        display: flex;
        align-items: center;
    }
    .lu-card-tag {
        font-family: var(--font-sci, 'Orbitron', sans-serif);
        font-size: clamp(9px, 1.2vh, 11px);
        letter-spacing: 2px;
        color: rgba(255,255,255,0.6);
        padding: 4px 10px;
        border: 1px solid rgba(255,255,255,0.3);
    }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = 'features-style';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ───────────────────────────────────────────────────────────
    // 2. DOM injection (executed once at DOM ready)
    // ───────────────────────────────────────────────────────────
    function injectDOM() {
        const hud = document.getElementById('game-hud');
        const container = document.getElementById('game-container');
        if (!hud || !container) return;

        // --- 2.a Numeric labels under health & energy + shield bar group ---
        const topLeft = document.getElementById('hud-top-left');
        if (topLeft) {
            // Add value labels under existing health & energy bar groups
            const groups = topLeft.querySelectorAll('.hud-bar-group');
            // Health value
            const healthVal = document.createElement('div');
            healthVal.id = 'health-value';
            healthVal.className = 'hud-bar-value health-value';
            healthVal.textContent = '100 / 100';
            if (groups[0]) groups[0].appendChild(healthVal);

            // Energy value
            const energyVal = document.createElement('div');
            energyVal.id = 'energy-value';
            energyVal.className = 'hud-bar-value energy-value';
            energyVal.textContent = '100 / 100';
            if (groups[1]) groups[1].appendChild(energyVal);

            // Shield bar group (hidden by default)
            const shieldGroup = document.createElement('div');
            shieldGroup.id = 'shield-bar-group';
            shieldGroup.className = 'hud-bar-group';
            shieldGroup.innerHTML = `
                <div class="hud-icon shield-icon float-anim">🛡</div>
                <div class="hud-bar shield-bar">
                    <div id="shield-fill" class="bar-fill shield-fill"></div>
                </div>
                <div id="shield-value" class="hud-bar-value shield-value">0 / 0</div>
            `;
            topLeft.appendChild(shieldGroup);
        }

        // --- 2.b Supersonic button (above Sonic) ---
        const controlsRight = document.getElementById('controls-right');
        const sonicBtn = document.getElementById('btn-sonic');
        if (controlsRight && sonicBtn) {
            // Reorganize the right controls so Supersonic stacks above Sonic
            const wrap = document.createElement('div');
            wrap.id = 'btn-supersonic-wrap';
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '12px';

            const ssBtn = document.createElement('button');
            ssBtn.id = 'btn-supersonic';
            ssBtn.className = 'control-btn action-btn supersonic-btn disabled';
            ssBtn.innerHTML = `
                <span class="ss-symbol"></span>
                <span class="supersonic-cd-label" id="supersonic-cd-label">45</span>
            `;
            wrap.appendChild(ssBtn);

            // Move existing sonic button into the same wrap (preserve order: SS on top, Sonic below)
            controlsRight.insertBefore(wrap, sonicBtn);
            wrap.appendChild(sonicBtn);
        }

        // --- 2.c Danger warning + dim overlay ---
        const dangerDim = document.createElement('div');
        dangerDim.id = 'danger-dim';
        container.appendChild(dangerDim);

        const danger = document.createElement('div');
        danger.id = 'danger-warning';
        danger.innerHTML = '<span class="danger-text">DANGER</span>';
        container.appendChild(danger);

        // --- 2.d Supersonic cut-in ---
        const cutin = document.createElement('div');
        cutin.id = 'supersonic-cutin';
        cutin.innerHTML = '<span class="ss-cutin-text">SUPERSONIC WAVE</span>';
        container.appendChild(cutin);

        // --- 2.e Death fade & defeat dim ---
        const defeatDim = document.createElement('div');
        defeatDim.id = 'defeat-dim';
        container.appendChild(defeatDim);

        const deathFade = document.createElement('div');
        deathFade.id = 'death-fade';
        container.appendChild(deathFade);

        // --- 2.f Level-up overlay ---
        const lu = document.createElement('div');
        lu.id = 'levelup-overlay';
        lu.innerHTML = `
            <div class="lu-title">LEVEL UP!</div>
            <div class="lu-sub" id="levelup-sub">CHOOSE AN UPGRADE</div>
            <div id="levelup-cards"></div>
        `;
        container.appendChild(lu);
    }

    // ───────────────────────────────────────────────────────────
    // 3. CARD REGISTRY
    // ───────────────────────────────────────────────────────────
    const CARDS = [
        // Category A — Health
        { id: 'A01', cat: 'A', icon: '❤', title: 'HEALTH REFILL (S)',
          desc: 'Instantly restore 30% of max health.',
          tag: 'INSTANT',
          apply: () => { Features.heal(0.30); } },
        { id: 'A02', cat: 'A', icon: '❤', title: 'HEALTH REFILL (M)',
          desc: 'Instantly restore 50% of max health.',
          tag: 'INSTANT',
          apply: () => { Features.heal(0.50); } },
        { id: 'A03', cat: 'A', icon: '❤', title: 'MAX HEALTH BOOST & FORTIFY',
          desc: '+30% max health & permanent -10% incoming damage.',
          tag: 'PASSIVE',
          apply: () => { Features.boostMaxHealth(0.30); Features.addDamageReduction(0.10); } },
        { id: 'A04', cat: 'A', icon: '❤', title: 'MAX HEALTH BOOST',
          desc: '+20% maximum health permanently.',
          tag: 'PASSIVE',
          apply: () => { Features.boostMaxHealth(0.20); } },

        // Category B — Shield
        { id: 'B05', cat: 'B', icon: '🛡', title: 'BASIC SHIELD ACTIVATOR',
          desc: 'Deploy a standard protective shield around you.',
          tag: 'DEPLOY',
          apply: () => { Features.activateShield(1.0); } },
        { id: 'B06', cat: 'B', icon: '🛡', title: 'HEAVY SHIELD OVERLOAD',
          desc: 'Generate a stronger, high-capacity shield (×1.6).',
          tag: 'DEPLOY',
          apply: () => { Features.activateShield(1.6); } },
        { id: 'B07', cat: 'B', icon: '🛡', title: 'SHIELD EFFICIENCY MATRIX',
          desc: 'Permanent: shields absorb +25% more damage.',
          tag: 'PASSIVE',
          apply: () => { Features.shieldEfficiency *= 0.75; /* lower depletion = higher efficiency */ } },

        // Category C — Speed
        { id: 'C08', cat: 'C', icon: '⚡', title: 'SONIC SPEED CORE',
          desc: '+15% movement speed permanently.',
          tag: 'PASSIVE',
          apply: () => { Features.boostMoveSpeed(0.15); } },
        { id: 'C09', cat: 'C', icon: '⚡', title: 'SUPERSONIC OVERDRIVE',
          desc: '+25% movement speed permanently.',
          tag: 'PASSIVE',
          apply: () => { Features.boostMoveSpeed(0.25); } },
        { id: 'C10', cat: 'C', icon: '🌀', title: 'KINETIC AGILITY',
          desc: 'Tighter handling, better drift, +10% accel & turn.',
          tag: 'PASSIVE',
          apply: () => { Features.boostMoveSpeed(0.10); Features.boostJump(0.08); } },

        // Category D — Energy
        { id: 'D11', cat: 'D', icon: '🔋', title: 'ENERGY RECOVERY CORE',
          desc: 'Instantly restore 30% of max energy.',
          tag: 'INSTANT',
          apply: () => { Game.energy = Math.min(100, Game.energy + 30); } },
        { id: 'D12', cat: 'D', icon: '🔋', title: 'ENERGY RECOVERY MATRIX',
          desc: 'Instantly restore 50% of max energy.',
          tag: 'INSTANT',
          apply: () => { Game.energy = Math.min(100, Game.energy + 50); } },
        { id: 'D13', cat: 'D', icon: '🔋', title: 'ENERGY REFILL SPEED I',
          desc: '+10% passive energy regen.',
          tag: 'PASSIVE',
          apply: () => { CONFIG.ENERGY_REGEN_RATE *= 1.10; } },
        { id: 'D14', cat: 'D', icon: '🔋', title: 'ENERGY REFILL SPEED II',
          desc: '+30% energy regen & -10% incoming damage.',
          tag: 'PASSIVE',
          apply: () => { CONFIG.ENERGY_REGEN_RATE *= 1.30; Features.addDamageReduction(0.10); } },
    ];

    // ───────────────────────────────────────────────────────────
    // 4. FEATURES STATE  +  HELPERS
    // ───────────────────────────────────────────────────────────
    const Features = window.Features = {
        // Shield collectibles & active shield
        shieldPacks: [],
        shield: { active: false, health: 0, maxHealth: 0, hitFlash: 0, baseMaxRef: 100 },
        shieldEfficiency: 1.0,           // multiplier on damage absorbed (lower = better)

        // Health/Movement scaling
        maxHealth: 100,
        damageReduction: 1.0,            // multiplier on incoming damage (lower = better)
        baseMoveSpeed: null,
        baseJumpForce: null,
        baseDoubleJumpForce: null,

        // Supersonic state
        superCooldownRemaining: 0,
        superLastTouchHeld: false,

        // Time-slow state (used by frame-skipping inside wrapped update)
        timeSlowFactor: 1.0,             // 1.0 = normal; 0.25 = quarter-speed
        timeSlowEndAt: 0,                // performance.now() ms
        slowFrameAcc: 0,                 // fractional accumulator for frame-skipping

        // Cut-in / danger animation state (these run on REAL time, not slowed)
        cutinEndAt: 0,
        dangerEndAt: 0,
        dangerArmedForCycle: false,      // already triggered warning for current main-boss cycle?

        // Defeat blink (boss/player) — slows game slightly
        defeatBlinkEndAt: 0,

        // Death sequence
        deathSequenceActive: false,
        deathSequenceStartedAt: 0,
        gameOverPending: false,

        // Level-up card UI
        cardActive: false,                // blocks world update while shown
        previousLevelSeen: 1,

        // ── Helpers ─────────────────────────────────────────
        now() { return performance.now(); },

        ensureBaseStats() {
            if (this.baseMoveSpeed == null) this.baseMoveSpeed = CONFIG.MOVE_SPEED;
            if (this.baseJumpForce == null) this.baseJumpForce = CONFIG.JUMP_FORCE;
            if (this.baseDoubleJumpForce == null) this.baseDoubleJumpForce = CONFIG.DOUBLE_JUMP_FORCE;
        },

        resetRun() {
            this.shieldPacks = [];
            this.shield = { active: false, health: 0, maxHealth: 0, hitFlash: 0, baseMaxRef: 100 };
            this.shieldEfficiency = 1.0;
            this.maxHealth = 100;
            this.damageReduction = 1.0;
            this.superCooldownRemaining = 0;
            this.superLastTouchHeld = false;
            this.timeSlowFactor = 1.0;
            this.timeSlowEndAt = 0;
            this.slowFrameAcc = 0;
            this.cutinEndAt = 0;
            this.dangerEndAt = 0;
            this.dangerArmedForCycle = false;
            this.defeatBlinkEndAt = 0;
            this.deathSequenceActive = false;
            this.deathSequenceStartedAt = 0;
            this.gameOverPending = false;
            this.cardActive = false;
            this.previousLevelSeen = 1;

            // Reset modifiable CONFIG values to base
            if (this.baseMoveSpeed != null) CONFIG.MOVE_SPEED = this.baseMoveSpeed;
            if (this.baseJumpForce != null) CONFIG.JUMP_FORCE = this.baseJumpForce;
            if (this.baseDoubleJumpForce != null) CONFIG.DOUBLE_JUMP_FORCE = this.baseDoubleJumpForce;
            if (this._baseEnergyRegen != null) CONFIG.ENERGY_REGEN_RATE = this._baseEnergyRegen;
            else this._baseEnergyRegen = CONFIG.ENERGY_REGEN_RATE;

            // UI resets
            const sbg = document.getElementById('shield-bar-group');
            if (sbg) sbg.classList.remove('active');
            const ssBtn = document.getElementById('btn-supersonic');
            if (ssBtn) {
                ssBtn.classList.remove('cooling', 'ready');
                ssBtn.classList.add('disabled');
            }
            const overlay = document.getElementById('levelup-overlay');
            if (overlay) overlay.classList.remove('active');
            const defeatDim = document.getElementById('defeat-dim');
            if (defeatDim) defeatDim.classList.remove('active');
            const dangerDim = document.getElementById('danger-dim');
            if (dangerDim) dangerDim.classList.remove('active');
        },

        // ── Card effect helpers ────────────────────────────
        heal(fracOfMax) {
            const amt = this.maxHealth * fracOfMax;
            Game.health = Math.min(this.maxHealth, Game.health + amt);
        },
        boostMaxHealth(frac) {
            const oldMax = this.maxHealth;
            this.maxHealth = Math.round(this.maxHealth * (1 + frac));
            // Also raise current health proportionally so the gain is felt
            Game.health = Math.min(this.maxHealth, Game.health + (this.maxHealth - oldMax));
        },
        addDamageReduction(frac) {
            // Multiplicative stacking: 10% reduction = ×0.90
            this.damageReduction *= (1 - frac);
        },
        boostMoveSpeed(frac) {
            this.ensureBaseStats();
            CONFIG.MOVE_SPEED = +(CONFIG.MOVE_SPEED * (1 + frac)).toFixed(3);
        },
        boostJump(frac) {
            this.ensureBaseStats();
            CONFIG.JUMP_FORCE = +(CONFIG.JUMP_FORCE * (1 + frac)).toFixed(3);
            CONFIG.DOUBLE_JUMP_FORCE = +(CONFIG.DOUBLE_JUMP_FORCE * (1 + frac)).toFixed(3);
        },
        activateShield(multiplier) {
            const cap = Math.round(this.maxHealth / 3 * multiplier);
            this.shield.maxHealth = cap;
            this.shield.health = cap;
            this.shield.active = true;
            this.shield.hitFlash = 0;
            const sbg = document.getElementById('shield-bar-group');
            if (sbg) sbg.classList.add('active');
        },
        deactivateShield() {
            this.shield.active = false;
            this.shield.health = 0;
            this.shield.maxHealth = 0;
            const sbg = document.getElementById('shield-bar-group');
            if (sbg) sbg.classList.remove('active');
        },

        // ── Triggers ───────────────────────────────────────
        triggerDanger() {
            const el = document.getElementById('danger-warning');
            const dim = document.getElementById('danger-dim');
            if (!el) return;
            // Force restart of animation
            el.classList.remove('active');
            void el.offsetWidth;
            el.classList.add('active');
            dim && dim.classList.add('active');
            this.dangerEndAt = this.now() + DANGER_DURATION_MS;
            try { AudioManager.play('click'); } catch (e) {}
        },

        triggerCutin() {
            const el = document.getElementById('supersonic-cutin');
            if (!el) return;
            el.classList.remove('active');
            void el.offsetWidth;
            el.classList.add('active');
            this.cutinEndAt = this.now() + CUTIN_DURATION_MS;
        },

        triggerTimeSlow() {
            this.timeSlowFactor = TIME_SLOW_FACTOR;
            this.timeSlowEndAt = this.now() + TIME_SLOW_DURATION_MS;
            this.slowFrameAcc = 0;
        },

        triggerSupersonic() {
            // Validate
            if (this.superCooldownRemaining > 0) return;
            if (Game.energy < SUPERSONIC_ENERGY_THRESHOLD) return;
            if (Game.state !== 'playing') return;

            // Consume energy (spec: power bar 90% is just a threshold, but we still use a lot)
            Game.energy = Math.max(0, Game.energy - 60);

            // Spawn supersonic wave: 4x larger, 3x damage (via sonicDamage multiplier on hit),
            // 1/4 speed.
            const p = Game.player;
            const dir = p.facingRight ? 1 : -1;
            const W = CONFIG.SONIC_WAVE_WIDTH * 4;
            const H = CONFIG.SONIC_WAVE_HEIGHT * 4;
            const speed = CONFIG.SONIC_WAVE_SPEED * 0.25;
            const wave = {
                x: p.x + (p.facingRight ? p.w : -W),
                y: p.y + p.h * 0.35 - (H - CONFIG.SONIC_WAVE_HEIGHT) * 0.5,
                w: W, h: H,
                vx: speed * dir,
                life: 70 * 4,                 // proportional to slower speed so it still travels
                dir,
                isSupersonic: true,
                damageMul: 3
            };
            Game.sonicWaves.push(wave);

            // Trigger time-slow + cut-in
            this.triggerCutin();
            this.triggerTimeSlow();

            // Start cooldown
            this.superCooldownRemaining = SUPERSONIC_COOLDOWN_MS;
            try { AudioManager.play('victory'); } catch (e) {}
        },

        // ── Per-frame UI updates ──────────────────────────
        tick(rawDt) {
            // Supersonic cooldown ticks on real time only when game is playing
            if (Game.state === 'playing' && this.superCooldownRemaining > 0) {
                this.superCooldownRemaining = Math.max(0, this.superCooldownRemaining - rawDt);
            }
            this.updateSupersonicButton();

            // Time-slow expiry
            if (this.timeSlowFactor < 1 && this.now() >= this.timeSlowEndAt) {
                this.timeSlowFactor = 1.0;
                this.slowFrameAcc = 0;
            }

            // Defeat blink expiry
            if (this.defeatBlinkEndAt > 0 && this.now() >= this.defeatBlinkEndAt) {
                this.defeatBlinkEndAt = 0;
                const dim = document.getElementById('defeat-dim');
                if (dim) dim.classList.remove('active');
            }

            // Death sequence → fire game-over near peak white (~50%)
            if (this.deathSequenceActive && !this.gameOverPending) {
                const t = this.now() - this.deathSequenceStartedAt;
                if (t >= DEATH_FADE_MS * 0.5) {
                    this.gameOverPending = true;
                    // call the original game-over so scoreboard etc. shows
                    if (typeof Features._origGameOver === 'function') {
                        Features._origGameOver.call(Game);
                    }
                }
                if (t >= DEATH_FADE_MS) {
                    this.deathSequenceActive = false;
                    const df = document.getElementById('death-fade');
                    if (df) df.classList.remove('active');
                }
            }

            // Danger pre-spawn detection (only when playing & no card overlay)
            if (Game.state === 'playing' && !this.cardActive) {
                const remaining = CONFIG.MAIN_BOSS_SPAWN_INTERVAL - Game.mainBossSpawnTimer;
                if (!this.dangerArmedForCycle && remaining <= DANGER_PRE_SPAWN_MS && remaining > 0) {
                    this.dangerArmedForCycle = true;
                    this.triggerDanger();
                }
                // After main boss spawns, the spawn timer wraps below the interval; rearm
                if (remaining > DANGER_PRE_SPAWN_MS + 1000) {
                    this.dangerArmedForCycle = false;
                }
                // Clean up dim once warning is done
                if (this.dangerEndAt > 0 && this.now() >= this.dangerEndAt) {
                    this.dangerEndAt = 0;
                    const dim = document.getElementById('danger-dim');
                    if (dim) dim.classList.remove('active');
                }
            }
        },

        updateSupersonicButton() {
            const btn = document.getElementById('btn-supersonic');
            if (!btn) return;
            const label = document.getElementById('supersonic-cd-label');
            if (this.superCooldownRemaining > 0) {
                btn.classList.add('cooling');
                btn.classList.remove('ready', 'disabled');
                if (label) label.textContent = Math.ceil(this.superCooldownRemaining / 1000);
            } else {
                btn.classList.remove('cooling');
                if (Game.state === 'playing' && Game.energy >= SUPERSONIC_ENERGY_THRESHOLD) {
                    btn.classList.add('ready');
                    btn.classList.remove('disabled');
                } else {
                    btn.classList.remove('ready');
                    btn.classList.add('disabled');
                }
            }
        },

        // ── Shield pack spawning (called after each generateSegment) ──
        maybeSpawnShieldPack(segStart, mainTop, platW) {
            // ~10% chance per segment
            if (Math.random() < 0.10) {
                this.shieldPacks.push({
                    x: segStart + platW * (0.25 + Math.random() * 0.5),
                    y: mainTop - 55,
                    size: SHIELD_PACK_SIZE,
                    collected: false,
                    bobOffset: Math.random() * Math.PI * 2
                });
            }
        },

        // ── Damage routing (called from wrapped playerHit) ──
        absorbDamage(damage) {
            // Apply passive damage reduction
            const reducedDmg = damage * this.damageReduction;
            if (this.shield.active && this.shield.health > 0) {
                // Shield absorbs first
                const effective = reducedDmg * this.shieldEfficiency;
                this.shield.health -= effective;
                this.shield.hitFlash = SHIELD_HIT_FLASH_FRAMES;
                if (this.shield.health <= 0) {
                    this.shield.health = 0;
                    this.deactivateShield();
                }
                return 0; // damage fully absorbed (per spec: subsequent damage applies on next hit)
            }
            return reducedDmg;
        },

        // ── Level-up flow ──────────────────────────────────
        showLevelUpCards() {
            this.cardActive = true;
            const overlay = document.getElementById('levelup-overlay');
            const cardsHost = document.getElementById('levelup-cards');
            const sub = document.getElementById('levelup-sub');
            if (!overlay || !cardsHost) return;

            if (sub) sub.textContent = 'LEVEL ' + Game.playerLevel + ' — CHOOSE AN UPGRADE';

            // Pick 3 unique cards
            const pool = CARDS.slice();
            const picked = [];
            while (picked.length < 3 && pool.length) {
                const idx = Math.floor(Math.random() * pool.length);
                picked.push(pool.splice(idx, 1)[0]);
            }

            cardsHost.innerHTML = '';
            picked.forEach((card) => {
                const el = document.createElement('div');
                el.className = 'lu-card cat-' + card.cat;
                el.innerHTML = `
                    <div class="lu-card-icon">${card.icon}</div>
                    <div class="lu-card-title">${card.title}</div>
                    <div class="lu-card-desc">${card.desc}</div>
                    <div class="lu-card-tag">${card.tag}</div>
                `;
                const choose = () => {
                    try { AudioManager.play('click'); } catch (e) {}
                    try { card.apply(); } catch (e) { console.warn('Card apply error', e); }
                    this.hideLevelUpCards();
                };
                el.addEventListener('click', choose);
                el.addEventListener('touchend', (ev) => { ev.preventDefault(); choose(); });
                cardsHost.appendChild(el);
            });

            overlay.classList.add('active');
            // Pause audio to mirror pause-like state
            try { AudioManager.pauseMusic(); } catch (e) {}
        },

        hideLevelUpCards() {
            const overlay = document.getElementById('levelup-overlay');
            if (overlay) overlay.classList.remove('active');
            this.cardActive = false;
            try { AudioManager.resumeMusic(); } catch (e) {}
        },

        // ── Player death sequence ──────────────────────────
        triggerDeath() {
            if (this.deathSequenceActive) return;
            this.deathSequenceActive = true;
            this.deathSequenceStartedAt = this.now();
            this.gameOverPending = false;
            // White fade
            const df = document.getElementById('death-fade');
            if (df) {
                df.classList.remove('active');
                void df.offsetWidth;
                df.classList.add('active');
            }
            // Trigger defeat blink/slow on the player (so they visibly blink while dying)
            this.defeatBlinkEndAt = this.now() + DEFEAT_BLINK_MS;
            const dim = document.getElementById('defeat-dim');
            if (dim) dim.classList.add('active');
            // Force invincible flicker on player for the blink window
            if (Game.player) {
                Game.player.invincible = true;
                Game.player.invTimer = Math.ceil(DEFEAT_BLINK_MS / (CONFIG.FIXED_DT));
            }
        },

        triggerBossDefeated(b) {
            // Generic defeat blink (also slightly slows game)
            this.defeatBlinkEndAt = this.now() + DEFEAT_BLINK_MS;
            const dim = document.getElementById('defeat-dim');
            if (dim) dim.classList.add('active');
            // Tag boss for blinking render
            b._defeatedAt = this.now();
        }
    };

    // ───────────────────────────────────────────────────────────
    // 5. MONKEY-PATCH GAME / UI METHODS
    // ───────────────────────────────────────────────────────────

    // Override main-boss spawn interval (2:30)
    CONFIG.MAIN_BOSS_SPAWN_INTERVAL = MAIN_BOSS_INTERVAL_MS;

    // -- 5.a Wrap update --------------------------------------
    const _origUpdate = Game.update.bind(Game);
    Game.update = function (dt) {
        // Tick UI/feature timers using REAL dt (these don't slow with the game)
        Features.tick(dt);

        if (Game.state !== 'playing') {
            // Still let original update bail out as it does
            return _origUpdate(dt);
        }

        // Block world update while level-up card is shown
        if (Features.cardActive) return;

        // Frame-skipping for time-slow / defeat-slow
        let effectiveFactor = 1.0;
        if (Features.timeSlowFactor < 1) effectiveFactor = Math.min(effectiveFactor, Features.timeSlowFactor);
        if (Features.defeatBlinkEndAt > 0 && Features.now() < Features.defeatBlinkEndAt) {
            effectiveFactor = Math.min(effectiveFactor, DEFEAT_SLOW_FACTOR);
        }
        if (effectiveFactor < 1) {
            Features.slowFrameAcc += effectiveFactor;
            if (Features.slowFrameAcc < 1) {
                return; // skip this physics tick
            }
            Features.slowFrameAcc -= 1;
        } else {
            Features.slowFrameAcc = 0;
        }

        // Detect level-up: capture state pre-update
        const prevLevel = Game.playerLevel;
        const prevSonicDamage = Game.sonicDamage;
        const prevWorldEndX = Game.worldEndX;

        _origUpdate(dt);

        // ===== After-update extensions =====

        // (i) Detect new segments → maybe spawn a shield pack
        if (Game.worldEndX > prevWorldEndX) {
            // Find newly added main platforms (after prevWorldEndX)
            const newMains = Game.platforms.filter(pl =>
                pl.type === 'main' && pl.x >= prevWorldEndX - 1
            );
            for (const m of newMains) {
                Features.maybeSpawnShieldPack(m.x, m.y, m.w);
            }
        }

        // (ii) Shield pack collection
        if (Game.player) {
            for (const sp of Features.shieldPacks) {
                if (sp.collected) continue;
                if (Game.circleRectOverlap(sp.x, sp.y, sp.size / 2, Game.player)) {
                    sp.collected = true;
                    // Activate shield at 1/3 of max health
                    Features.activateShield(1.0);
                    Game.spawnParticles(sp.x, sp.y, SKY_BLUE, 8);
                    try { AudioManager.play('click'); } catch (e) {}
                }
            }
            // Cull off-screen
            const cleanX = Game.cameraX - Game.vw;
            Features.shieldPacks = Features.shieldPacks.filter(sp => !sp.collected || sp.x > cleanX);
        }

        // (iii) Shield hit flash decay
        if (Features.shield.hitFlash > 0) Features.shield.hitFlash--;

        // (iv) Clamp Game.health to our maxHealth
        if (Game.health > Features.maxHealth) Game.health = Features.maxHealth;

        // (v) Level-up: revert old auto-scaling; show card UI instead
        if (Game.playerLevel > prevLevel) {
            // Undo: do not auto-grow sonic damage anymore
            Game.sonicDamage = prevSonicDamage;
            // Hide the in-canvas LEVEL UP! animation
            Game.levelUpAnim = null;
            Features.showLevelUpCards();
        }

        // (vi) Supersonic wave damage multiplier — patch sonicDamage during hit
        // We can't easily intercept; instead post-process by adjusting boss health
        // damage was over-applied? Approach: detect supersonic waves that were spliced
        // out THIS frame and add extra damage retroactively. Simpler approach: pre-multiply
        // Game.sonicDamage before update for supersonic waves — but they're handled inline.
        // Strategy: at end of update, scan sonicWaves still alive that are supersonic and
        // mark them. Actual extra damage is achieved via the wave-vs-boss loop inside the
        // original update applying `Game.sonicDamage` only ONCE per hit. To deliver 3×
        // damage we instead boost sonic damage temporarily; but that has frame ordering
        // issues. So we use a SEPARATE hit pass below:
        Features._supersonicHitPass();

        // (vii) Animate value labels (bump on change)
        Features._animateValueLabels();
    };

    // Supersonic-wave extra hit pass (delivers triple damage to bosses)
    Features._lastShieldHealth = 0;
    Features._lastHealth = 100;
    Features._lastEnergy = 100;
    Features._lastSuperWaveIds = new WeakSet();

    Features._supersonicHitPass = function () {
        // For any supersonic wave alive, deal an EXTRA 2× damage per overlap per frame
        // (original loop already dealt 1×, so total ≈ 3×). We do this once per wave.
        for (const w of Game.sonicWaves) {
            if (!w.isSupersonic) continue;
            if (this._lastSuperWaveIds.has(w)) continue;
            // Apply extra damage to bosses currently overlapping
            for (const b of Game.bosses) {
                if (!b.alive) continue;
                if (Game.rectsOverlap(w, b)) {
                    const extra = (w.damageMul || 3) - 1;
                    b.health -= Game.sonicDamage * extra;
                    b.hitFlash = 12;
                    if (b.health <= 0 && b.alive) {
                        b.alive = false;
                        Game.bossesDefeated++;
                        Game.points += b.isMainBoss ? 500 : 200;
                        Game.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffcc00', b.isMainBoss ? 35 : 20);
                        Features.triggerBossDefeated(b);
                        try { AudioManager.play('victory'); } catch (e) {}
                    }
                    this._lastSuperWaveIds.add(w);
                    break;
                }
            }
        }
    };

    // Animate value labels — bump on change
    Features._animateValueLabels = function () {
        const hVal = document.getElementById('health-value');
        const eVal = document.getElementById('energy-value');
        const sVal = document.getElementById('shield-value');

        if (hVal) {
            if (Math.ceil(Game.health) !== Math.ceil(this._lastHealth)) {
                hVal.classList.add('bump');
                clearTimeout(this._hBumpT);
                this._hBumpT = setTimeout(() => hVal.classList.remove('bump'), 160);
            }
            this._lastHealth = Game.health;
        }
        if (eVal) {
            if (Math.ceil(Game.energy) !== Math.ceil(this._lastEnergy)) {
                eVal.classList.add('bump');
                clearTimeout(this._eBumpT);
                this._eBumpT = setTimeout(() => eVal.classList.remove('bump'), 160);
            }
            this._lastEnergy = Game.energy;
        }
        if (sVal && this.shield.active) {
            if (Math.ceil(this.shield.health) !== Math.ceil(this._lastShieldHealth)) {
                sVal.classList.add('bump');
                clearTimeout(this._sBumpT);
                this._sBumpT = setTimeout(() => sVal.classList.remove('bump'), 160);
            }
            this._lastShieldHealth = this.shield.health;
        }
    };

    // -- 5.b Wrap render --------------------------------------
    const _origRender = Game.render.bind(Game);
    Game.render = function () {
        // Skip default LEVEL UP! anim suppression handled by clearing levelUpAnim already.
        _origRender();

        // Draw shield-pack collectibles in world space
        const ctx = Game.ctx;
        if (Game.state === 'playing' || Game.state === 'paused') {
            ctx.save();
            ctx.translate(-Game.cameraX, 0);

            // Shield packs
            for (const sp of Features.shieldPacks) {
                if (sp.collected) continue;
                const bob = Math.sin(Game.animFrame * 0.05 + sp.bobOffset) * 6;
                drawShieldPack(ctx, sp.x, sp.y + bob, sp.size, Game.animFrame);
            }

            // Active shield overlay around player
            if (Features.shield.active && Game.player) {
                drawShieldOverlay(ctx, Game.player, Features.shield, Game.animFrame);
            }

            ctx.restore();
        }

        // Supersonic waves get a brighter purple/red render on top (the original render
        // already drew them with the standard sonic style; we add an extra glow layer).
        if (Game.state === 'playing' || Game.state === 'paused') {
            ctx.save();
            ctx.translate(-Game.cameraX, 0);
            for (const w of Game.sonicWaves) {
                if (!w.isSupersonic) continue;
                drawSupersonicGlow(ctx, w);
            }
            ctx.restore();
        }
    };

    // -- 5.c Wrap playerHit -----------------------------------
    const _origPlayerHit = Game.playerHit.bind(Game);
    Game.playerHit = function (damage) {
        if (this.player && this.player.invincible) return;
        const remaining = Features.absorbDamage(damage);
        if (remaining <= 0) {
            // Damage fully absorbed by shield → mimic original invincibility / particles
            this.player.invincible = true;
            this.player.invTimer = 60;
            Game.spawnParticles(
                this.player.x + this.player.w / 2,
                this.player.y + this.player.h / 2,
                SKY_BLUE, 8
            );
            return;
        }
        // Otherwise apply (possibly reduced) damage via the original handler
        _origPlayerHit(remaining);
    };

    // -- 5.d Wrap startGame -----------------------------------
    const _origStartGame = Game.startGame.bind(Game);
    Game.startGame = function () {
        Features.ensureBaseStats();
        Features.resetRun();
        _origStartGame();
        // After original reset, sync our maxHealth view to the engine's initial health
        Features.maxHealth = 100;
        Features.previousLevelSeen = 1;
        Features._lastHealth = Game.health;
        Features._lastEnergy = Game.energy;
        Features._lastShieldHealth = 0;
    };

    // -- 5.e Wrap gameOver (player death sequence) ------------
    Features._origGameOver = Game.gameOver.bind(Game);
    Game.gameOver = function () {
        // Switch to a custom flow: trigger blink/fade FIRST, then call original game-over
        // after the fade peaks.
        if (Features.deathSequenceActive) return;
        // Park the state at 'playing' briefly so update keeps running for blink frames.
        // We block input by setting health to 0 and player.invincible (already true).
        Features.triggerDeath();
        // Keep the player invincible & freeze them
        if (this.player) {
            this.player.vx = 0;
            this.player.vy = 0;
            this.player.invincible = true;
            this.player.invTimer = 9999;
        }
        // The actual transition to the game-over screen is triggered inside Features.tick()
        // when the white-fade reaches its peak.
    };

    // -- 5.f Wrap UI.updateHUD --------------------------------
    const _origUpdateHUD = UI.updateHUD.bind(UI);
    UI.updateHUD = function (health, energy, points, gameTimer, highScore) {
        // Call original (sets width to "health%" assuming 0-100 scale)
        _origUpdateHUD(health, energy, points, gameTimer, highScore);

        // Correct health bar width using our maxHealth scale
        const hFill = document.getElementById('health-fill');
        if (hFill) {
            const pct = Math.max(0, Math.min(100, (health / Features.maxHealth) * 100));
            hFill.style.width = pct + '%';
        }
        // Energy is still on 0-100 scale — original setting is fine

        // Numeric labels
        const hVal = document.getElementById('health-value');
        const eVal = document.getElementById('energy-value');
        if (hVal) hVal.textContent = Math.max(0, Math.ceil(health)) + ' / ' + Math.ceil(Features.maxHealth);
        if (eVal) eVal.textContent = Math.max(0, Math.ceil(energy)) + ' / 100';

        // Shield bar
        if (Features.shield.active) {
            const sFill = document.getElementById('shield-fill');
            const sVal = document.getElementById('shield-value');
            const sPct = Math.max(0, Math.min(100, (Features.shield.health / Features.shield.maxHealth) * 100));
            if (sFill) sFill.style.width = sPct + '%';
            if (sVal) sVal.textContent = Math.max(0, Math.ceil(Features.shield.health)) + ' / ' + Math.ceil(Features.shield.maxHealth);
        }
    };

    // ───────────────────────────────────────────────────────────
    // 6. CUSTOM DRAW HELPERS
    // ───────────────────────────────────────────────────────────
    function drawShieldPack(ctx, x, y, size, frame) {
        const glow = Math.sin(frame * 0.08 + 3) * 0.3 + 0.7;
        ctx.save();
        ctx.shadowColor = SKY_BLUE;
        ctx.shadowBlur = 14 * glow;

        // Outer ring
        ctx.strokeStyle = '#1aa0d0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Fill
        const grad = ctx.createRadialGradient(x - size * 0.15, y - size * 0.15, 1, x, y, size / 2);
        grad.addColorStop(0, '#ddf6ff');
        grad.addColorStop(0.5, SKY_BLUE);
        grad.addColorStop(1, '#1d7fb0');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, size / 2 - 4, 0, Math.PI * 2);
        ctx.fill();

        // Shield icon inside
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.floor(size * 0.55) + 'px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡', x, y + 1);

        ctx.restore();
    }

    function drawShieldOverlay(ctx, p, shield, frame) {
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const rx = p.w * 0.95;      // slightly wider than player
        const ry = p.h * 0.62;      // slightly taller-than-half
        // Hit-flash factor 0..1 (peaks just after hit)
        const flashT = shield.hitFlash > 0 ? (shield.hitFlash / SHIELD_HIT_FLASH_FRAMES) : 0;
        const baseAlphaMid = 0.06 + flashT * 0.25;     // very transparent middle
        const baseAlphaEdge = 0.32 + flashT * 0.40;    // more pronounced edges

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Sphere body — gradient with low opacity in middle, higher on left/right outer sides.
        // We use a linear gradient (horizontal) for the side accent, plus a radial gradient
        // for the soft falloff, both with NO border/stroke.
        // Radial (soft falloff)
        const rg = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.05,
                                            cx, cy, Math.max(rx, ry));
        rg.addColorStop(0.00, `rgba(${SKY_BLUE_RGB},${baseAlphaMid})`);
        rg.addColorStop(0.55, `rgba(${SKY_BLUE_RGB},${baseAlphaMid * 1.4 + 0.04})`);
        rg.addColorStop(1.00, `rgba(${SKY_BLUE_RGB},0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // Side accent (linear, horizontal): boosts opacity on left/right outer sides
        const lg = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
        lg.addColorStop(0.00, `rgba(${SKY_BLUE_RGB},${baseAlphaEdge})`);
        lg.addColorStop(0.30, `rgba(${SKY_BLUE_RGB},${baseAlphaMid * 0.5})`);
        lg.addColorStop(0.50, `rgba(${SKY_BLUE_RGB},0)`);
        lg.addColorStop(0.70, `rgba(${SKY_BLUE_RGB},${baseAlphaMid * 0.5})`);
        lg.addColorStop(1.00, `rgba(${SKY_BLUE_RGB},${baseAlphaEdge})`);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // Subtle highlight sweep (animated)
        const sweep = (Math.sin(frame * 0.04) * 0.5 + 0.5);
        ctx.globalAlpha = 0.10 + flashT * 0.2;
        const hg = ctx.createLinearGradient(
            cx - rx + rx * 2 * sweep - 30, cy - ry,
            cx - rx + rx * 2 * sweep + 30, cy + ry
        );
        hg.addColorStop(0, 'rgba(255,255,255,0)');
        hg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.restore();
    }

    function drawSupersonicGlow(ctx, w) {
        const cx = w.x + w.w / 2;
        const cy = w.y + w.h / 2;
        ctx.save();
        ctx.globalAlpha = Math.min(1, w.life / 200);
        // Outer red shockwave
        const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, w.w * 0.55);
        g1.addColorStop(0, 'rgba(255, 80, 100, 0.6)');
        g1.addColorStop(0.4, 'rgba(255, 34, 68, 0.45)');
        g1.addColorStop(1, 'rgba(255, 0, 40, 0)');
        ctx.fillStyle = g1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, w.w * 0.55, w.h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner white-hot core
        const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, w.w * 0.22);
        g2.addColorStop(0, 'rgba(255,255,255,0.9)');
        g2.addColorStop(0.6, 'rgba(255, 100, 100, 0.5)');
        g2.addColorStop(1, 'rgba(255, 34, 68, 0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, w.w * 0.22, w.h * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        // Crackling outline ring
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, w.w * 0.5 + (Math.sin(Game.animFrame * 0.3) * 4),
                            w.h * 0.4 + (Math.cos(Game.animFrame * 0.3) * 4),
                    0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // ───────────────────────────────────────────────────────────
    // 7. WIRE UP THE SUPERSONIC BUTTON
    // ───────────────────────────────────────────────────────────
    function wireSupersonicButton() {
        const btn = document.getElementById('btn-supersonic');
        if (!btn) return;
        const trigger = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            Features.triggerSupersonic();
        };
        btn.addEventListener('click', trigger);
        btn.addEventListener('touchend', trigger, { passive: false });

        // Keyboard shortcut: G triggers supersonic
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyG' && Game.state === 'playing') {
                Features.triggerSupersonic();
            }
        });
    }

    // ───────────────────────────────────────────────────────────
    // 8. BOOTSTRAP
    // ───────────────────────────────────────────────────────────
    function bootstrap() {
        injectDOM();
        wireSupersonicButton();
        // Cache base CONFIG values for reset between runs
        Features._baseEnergyRegen = CONFIG.ENERGY_REGEN_RATE;
        Features.ensureBaseStats();
        // Initial UI state
        Features.updateSupersonicButton();
        console.log('🛡️  NEO-ROBO Features layer loaded.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
