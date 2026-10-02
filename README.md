# GitHub Breakout 3D 🎮

A 3D breakout game themed after the GitHub contribution graph, with webcam face-tracking controls.

## Scottish Summit: Summit Hop

**[Play Summit Hop](https://www.woodwardweb.com/3dbreakout/summit/)** — a separate,
static 3D Highland jumping game inspired by [Scottish Summit](https://scottishsummit.com/).
The original Breakout game remains at the repository root.

- Auto-jump between low-poly floating islands using **Left/Right** or **A/D**.
  On touch screens, hold the arrow buttons or drag on the landscape.
- Collect thistles (+25), catch bagpipe boosts, cross moving tartan platforms,
  and avoid relying on crumbling shortbread twice.
- Meet an original Wee Jimmy Krankie-inspired schoolboy cameo (+50 on landing).
- **Sound is muted on every page load.** Use the persistent **Sound off / Sound on**
  button to enable or mute the original synthesized bagpipe-inspired reel and effects.
  Music plays only during a climb.
- Press **P / Escape** or the pause button to pause. Leaving the tab pauses automatically.
  Personal bests are saved locally when browser storage is available.

All game artwork is original procedural 3D geometry, including the tartan texture,
characters, thistles, bagpipes, Saltire, mountains and clouds. Music and effects are
original Web Audio synthesis: no recorded music, samples, external art, analytics,
camera access, or runtime CDN requests. The fan game is not affiliated with or
endorsed by Scottish Summit or The Krankies.

Serve this repository with `python -m http.server 8000`, then open
`http://localhost:8000/summit/`. A WebGL-capable browser is required.
There is no build step. Three.js r128 is vendored with its MIT license under
`summit/vendor/`. The page respects reduced-motion preferences for decorative motion;
the jumping gameplay still moves.

Run the game-logic checks with `node --test summit/engine.test.mjs`.
The existing GitHub Pages workflow publishes both games on pushes to `main`.

## Features

- **GitHub Commit Graph Blocks** — Blocks are styled as the green contribution squares, with colors matching the real GitHub palette
- **Face-Tracked Paddle** — Move your head left/right to control the paddle using your webcam
- **Head-Coupled Parallax** — The 3D camera adjusts based on your head position, creating a depth "window" effect
- **Sparkle Explosions** — Blocks shatter into colored cube fragments and sparkle particles when hit
- **3 Lives System** — You get 3 lives per game with increasing ball speed
- **Mouse Fallback** — If the camera is unavailable, use your mouse to control the paddle

## How to Play

1. Open `index.html` in a modern browser (Chrome/Edge recommended)
2. Allow camera access when prompted
3. Press **SPACE** to start
4. Move your head left/right to move the paddle
5. Break all the blocks to win!

## Scoring

| Block Color | Points |
|-------------|--------|
| Light green (#9be9a8) | 10 |
| Medium green (#40c463) | 20 |
| Dark green (#30a14e) | 30 |
| Darkest green (#216e39) | 50 |

## Running Locally

Serve the directory with any static file server:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

Then open http://localhost:8000

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [TensorFlow.js](https://www.tensorflow.org/js) + [BlazeFace](https://github.com/nicedoc/blazeface) — Face detection
- Vanilla HTML/CSS/JS — No build step required
