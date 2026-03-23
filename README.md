# GitHub Breakout 3D 🎮

A 3D breakout game themed after the GitHub contribution graph, with webcam face-tracking controls.

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
