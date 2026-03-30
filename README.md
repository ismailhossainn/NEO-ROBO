# NEO-ROBO - Sci-Fi Platformer Game

## Overview
NEO-ROBO is a side-scrolling sci-fi platformer game built with HTML5 Canvas, CSS, and JavaScript. Players select a robot character and navigate through a cyberpunk cityscape, fighting enemies, collecting gold, and defeating bosses.

## Features
- **5 Selectable Robot Characters**: MRK-069, MRK-301, MRK-608, MRK-720, MRK-830
- **Parallax Scrolling Backgrounds**: Multi-layer city skyline with depth
- **Platform Types**: Main, Static, and Moving platforms
- **Enemy Types**: Ground enemies, Flying enemies, Bosses, and MAIN BOSS
- **Double Jump**: Two-jump system for advanced platforming
- **Sonic Wave Attack**: Energy-based ranged attack
- **Health & Energy System**: With collectible health packs and energy regeneration
- **Gold Collection**: Score-based progression
- **Touch Controls**: Full mobile support with on-screen buttons
- **Landscape-Only Mode**: Orientation detection with rotation prompt

## Boss System
- **Regular Boss**: Spawns every **500 points** — Scale 2.0x, Health 5, Speed 2.5, Reward 200 pts
- **MAIN BOSS** *(NEW)*: Spawns every **2000 points** — Scale 3.0x (1.5× bigger), Health 8 (1.5× more), Speed 2.0, Reward 500 pts
  - Displays `⚠ MAIN BOSS ⚠` text label above (larger font, orange glow)
  - Deals 25 damage on contact (vs 20 for regular boss)
  - More particles on defeat (35 vs 20)
  - At 2000-point intervals, MAIN BOSS replaces the regular boss

## Entry Point
- `index.html` — Main game page

## File Structure
```
index.html              — Main HTML page
css/style.css           — Full sci-fi themed stylesheet
js/game.js              — Game engine (physics, rendering, boss logic)
js/ui.js                — UI manager (screens, HUD, touch controls)
js/audio.js             — Audio system (sound effects, music)
js/main.js              — Entry point (init, game loop, event listeners)
assets/images/          — Game sprites and backgrounds
assets/audio/           — Sound effects and music
```

## Controls
- **Keyboard**: Arrow keys / WASD to move, SPACE to jump (x2), F for Sonic Wave, ESC to pause
- **Touch**: On-screen directional buttons + JUMP / SONIC action buttons

## Tech Stack
- HTML5 Canvas (2D rendering)
- Vanilla JavaScript (no frameworks)
- CSS3 with Orbitron font (Google Fonts)
- Responsive design: Fixed 1080px height, flexible width
