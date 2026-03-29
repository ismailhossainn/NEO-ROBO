# NEO-ROBO 🤖

**Futuristic sci-fi city runner with cartoon (Mario-inspired) aesthetics**

## Version 3.1 — Local Assets + Platform Fix

---

## ✅ Completed Features

### Core Gameplay
- 3-layer parallax city background (sky, far city, mid city)
- 3-tier platform system: ground (main), static (tier 2), moving lifts (tier 3, 200px oscillation)
- Infinite forward scrolling with seamless platform tiling
- Camera locks backward after advancing 20-30m (invisible wall)
- Death on falling through gaps in main platform
- Double-jump, Sonic Wave attack (uses Energy Bar)
- 5 selectable robots: MRK-069, MRK-301, MRK-608, MRK-720, MRK-830
- Ground enemies (patrol left/right), flying enemies (bob up/down)
- Boss every 500 points (2x scale, chosen from non-selected robots)
- Gold coins (+10 pts) and health packs (+25 HP) with bobbing animation
- Full audio system: bg_music, victory, game_over, ui_click, jump, robot sounds

### v3.1 Changes Applied
1. **All assets now local** — Images in `assets/images/`, audio in `assets/audio/`, matching exact PC file names
2. **platform_main.png cutoff fixed** — Main platform tiles now draw full PNG images without clipping; last tile extends past segment edge so artwork is never cut mid-image

### v3 Changes (previous)
1. **Flexible Canvas Width**: Height is ALWAYS 1080px fixed. Width dynamically adapts to screen aspect ratio — no horizontal cutoff on any device (mobile, tablet, PC, ultrawide)
2. **1.5x Upscale (robots/enemies/platforms)**: Player 120×158px, Enemies 120×158px, Flying enemies 82×82px, Platforms 1.5x taller (main 300px, static 120px, moving 90px)
3. **2x Boss**: Boss is 160×210px (2x of original 80×105), with health bar and name label
4. **No Blur/Transparency on Backgrounds**: city_far, city_mid, bg_sky all render at FULL OPACITY, no filters, no blur — crisp and clear
5. **Health Bar**: White/light red → electric red gradient with red glow, NO round corners
6. **Energy Bar**: Color changes per selected robot (orange for MRK-069, cyan for MRK-301, magenta for MRK-608, yellow for MRK-720, green for MRK-830), with glow, NO round corners
7. **Points Bar**: Light blue + electric blue with glow, NO round corners
8. **Scanline Effect**: Applied to all buttons, text backgrounds, medal frame, loading bar, HUD bars, pause panel, control buttons, robot thumbnails — subtle CRT-style horizontal lines
9. **Confirm Button**: Styled like start button but with light green color (transparent bg + green border + green glow + white text), replaces old solid green hexagonal button
10. **Mobile Selection Page Fix**: All content properly aligned and fits in any landscape screen — uses flexbox centering, `vh` units for sizing, `clamp()` for responsive text, overflow-y auto, and a `max-height: 500px` media query for small phones
11. **Loading Bar 2x Wider**: max-width increased from 480px to 960px (90% width container)

### Screens & Navigation
- **Start Screen**: Glowing "NEO-ROBO" title, START button, blinking "PRESS TO START"
- **Selection Screen**: Medal frame showcase, 5-robot carousel, CONFIRM button
- **Loading Screen**: Animated progress bar, percentage counter
- **Game HUD**: Health/Energy bars + Points counter + Pause button + Touch controls
- **Pause Menu**: Continue / Exit
- **Game Over**: Score display, Retry / Home
- **Victory**: Boss Defeated!, Score, Continue

### Controls
- **Desktop**: Arrow keys (move), Space (jump x2), F (Sonic Wave), ESC (Pause)
- **Mobile**: On-screen buttons (◀ ▶ JUMP SONIC), Pause button top-right
- **Landscape Only**: Portrait shows "Rotate Your Device" prompt

---

## 📁 Project Structure

```
index.html
css/style.css
js/game.js
js/ui.js
js/audio.js
js/main.js
assets/
├── images/
│   ├── bg_sky.png
│   ├── city_far.png
│   ├── city_mid.png
│   ├── platform_main.png
│   ├── platform_static.png
│   ├── platform_moving.png
│   ├── flying_enemy.png
│   └── robots/
│       ├── mrk_069.png
│       ├── mrk_301.png
│       ├── mrk_608.png
│       ├── mrk_720.png
│       └── mrk_830.png
└── audio/
    ├── Background Music.mp3
    ├── Click Sound.mp3
    ├── Jump Sound Effect.mp3
    ├── victory.mp3
    ├── Game Over Sound.mp3
    ├── Robot - Sound Effect.mp3
    ├── Mrk-069 Sound.wav
    ├── Mrk-301 Sound.wav
    ├── Mrk-608 Sound.wav
    ├── Mrk-720 Sound.MP3
    └── Mrk-830 Sound.wav
README.md
```

## 🔗 Entry URI

- `/index.html` — Main game page (all features)

## 📐 Display System

- **Height**: Always 1080px (virtual pixels)
- **Width**: Dynamically calculated from `window.innerWidth / window.innerHeight * 1080`
- **Scaling**: Canvas fills 100% of screen, CSS scales to fit
- **Result**: On a 16:9 phone → 1920×1080. On a 20:9 phone → 2400×1080. No cutoff anywhere.

## 🎮 Recommended Next Steps

1. Walk animation frames for robot sprites
2. Sound effects for sonic wave hit and enemy death
3. Difficulty progression (more enemies, faster speed over time)
4. High score persistence (localStorage or Table API)
5. More boss attack patterns
6. Power-ups (shield, speed boost, magnet)
