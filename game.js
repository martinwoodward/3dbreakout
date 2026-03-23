// ═══════════════════════════════════════════════════════════════
// GitHub Breakout 3D — Full Game Engine
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────
  const FIELD_W = 16;
  const FIELD_H = 22;
  const WALL_THICKNESS = 0.4;

  const GRID_COLS = 20;
  const GRID_ROWS = 7;
  const BLOCK_SIZE = 0.58;
  const BLOCK_DEPTH = 0.28;
  const BLOCK_SPACING = 0.70;

  const PADDLE_W = 2.8;
  const PADDLE_H = 0.35;
  const PADDLE_D = 0.55;
  const PADDLE_Y = -FIELD_H / 2 + 1.5;

  const BALL_RADIUS = 0.22;
  const BALL_SPEED_INITIAL = 10;
  const BALL_SPEED_MAX = 16;
  const BALL_SPEED_INCREMENT = 0.3;

  const MAX_LIVES = 3;

  const GITHUB_BG = 0x0d1117;
  const GITHUB_EMPTY = 0x161b22;
  const GITHUB_GREENS = [
    null,
    { hex: 0x9be9a8, css: '#9be9a8', points: 10 },
    { hex: 0x40c463, css: '#40c463', points: 20 },
    { hex: 0x30a14e, css: '#30a14e', points: 30 },
    { hex: 0x216e39, css: '#216e39', points: 50 },
  ];

  const PARTICLE_COUNT = 32;
  const SPARKLE_COUNT = 18;
  const PARTICLE_LIFE = 1.0;
  const SPARKLE_LIFE = 0.6;

  // Camera base position
  const CAM_BASE = new THREE.Vector3(0, -2, 22);
  const CAM_LOOKAT_BASE = new THREE.Vector3(0, 1, 0);
  const PARALLAX_STRENGTH_X = 4.0;
  const PARALLAX_STRENGTH_Y = 2.5;

  // ─── State ───────────────────────────────────────────────────
  let gameState = 'WAITING'; // WAITING | PLAYING | GAME_OVER | WIN
  let score = 0;
  let lives = MAX_LIVES;
  let ballSpeed = BALL_SPEED_INITIAL;
  let blocksAlive = 0;
  let screenShake = 0;

  // Face tracking state
  let faceDetected = false;
  let rawFaceX = 0;  // -1 … 1
  let rawFaceY = 0;
  let smoothFaceX = 0;
  let smoothFaceY = 0;
  const FACE_SMOOTH = 0.12; // lower = smoother

  // Fallback mouse control
  let mouseX = 0;
  let useMouseFallback = false;

  // ─── DOM ─────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const webcam = document.getElementById('webcam');
  const webcamContainer = document.getElementById('webcamContainer');
  const webcamLabel = document.getElementById('webcamLabel');
  const overlay = document.getElementById('overlay');
  const gameOverEl = document.getElementById('gameOver');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const scoreSpan = document.querySelector('#scoreDisplay span');
  const finalScoreSpan = document.querySelector('#finalScore span');
  const livesDisplay = document.getElementById('livesDisplay');
  const loadingEl = document.getElementById('loading');
  const commitGraphEl = document.getElementById('commitGraph');

  // ─── Three.js Setup ─────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(GITHUB_BG);
  scene.fog = new THREE.Fog(GITHUB_BG, 28, 45);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.copy(CAM_BASE);
  camera.lookAt(CAM_LOOKAT_BASE);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x8b949e, 0.4);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(5, 15, 20);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  mainLight.shadow.camera.left = -12;
  mainLight.shadow.camera.right = 12;
  mainLight.shadow.camera.top = 15;
  mainLight.shadow.camera.bottom = -15;
  scene.add(mainLight);

  const rimLight = new THREE.DirectionalLight(0x40c463, 0.3);
  rimLight.position.set(-8, 5, -10);
  scene.add(rimLight);

  const bottomLight = new THREE.PointLight(0x58a6ff, 0.4, 30);
  bottomLight.position.set(0, PADDLE_Y - 2, 5);
  scene.add(bottomLight);

  // ─── Playing Field ──────────────────────────────────────────
  // Floor
  const floorGeo = new THREE.PlaneGeometry(FIELD_W + 4, FIELD_H + 8);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0d1117,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, 0, -0.5);
  floor.receiveShadow = true;
  scene.add(floor);

  // Subtle grid on floor
  const gridHelper = new THREE.GridHelper(30, 30, 0x161b22, 0x161b22);
  gridHelper.rotation.x = Math.PI / 2;
  gridHelper.position.z = -0.45;
  scene.add(gridHelper);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x21262d,
    roughness: 0.7,
    metalness: 0.3,
  });

  function createWall(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // Left, right, top walls
  createWall(WALL_THICKNESS, FIELD_H + 2, 1.0, -FIELD_W / 2 - WALL_THICKNESS / 2, 0, 0);
  createWall(WALL_THICKNESS, FIELD_H + 2, 1.0, FIELD_W / 2 + WALL_THICKNESS / 2, 0, 0);
  createWall(FIELD_W + WALL_THICKNESS * 2 + 0.1, WALL_THICKNESS, 1.0, 0, FIELD_H / 2 + WALL_THICKNESS / 2, 0);

  // ─── Blocks (Commit Graph) ─────────────────────────────────
  const blocks = [];
  const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_DEPTH);

  // Generate commit-graph-like data
  function generateCommitData() {
    const data = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      data[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        // Weekday bias: rows 1-5 (Mon-Fri) have more activity
        const isWeekday = row >= 1 && row <= 5;
        const activityBias = isWeekday ? 0.7 : 0.35;

        // Create "streaks" — some columns (weeks) are more active
        const weekActivity = Math.sin(col * 0.5 + 2) * 0.3 + 0.5 +
          Math.sin(col * 1.3) * 0.2;

        const chance = activityBias * weekActivity;
        if (Math.random() < chance) {
          // Weighted level distribution: more light, fewer dark
          const r = Math.random();
          if (r < 0.35) data[row][col] = 1;
          else if (r < 0.60) data[row][col] = 2;
          else if (r < 0.82) data[row][col] = 3;
          else data[row][col] = 4;
        } else {
          data[row][col] = 0;
        }
      }
    }
    return data;
  }

  let commitData;

  function buildBlocks() {
    // Clear existing blocks
    blocks.forEach(b => { if (b.mesh) scene.remove(b.mesh); });
    blocks.length = 0;
    blocksAlive = 0;

    commitData = generateCommitData();

    const gridW = GRID_COLS * BLOCK_SPACING;
    const gridH = GRID_ROWS * BLOCK_SPACING;
    const startX = -gridW / 2 + BLOCK_SPACING / 2;
    const startY = FIELD_H / 2 - 2.5;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const level = commitData[row][col];
        if (level === 0) continue;

        const color = GITHUB_GREENS[level];
        const mat = new THREE.MeshStandardMaterial({
          color: color.hex,
          roughness: 0.4,
          metalness: 0.2,
          emissive: color.hex,
          emissiveIntensity: 0.15,
        });

        const mesh = new THREE.Mesh(blockGeo, mat);
        const x = startX + col * BLOCK_SPACING;
        const y = startY - row * BLOCK_SPACING;
        mesh.position.set(x, y, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        blocks.push({
          mesh,
          alive: true,
          level,
          color,
          x, y,
          row, col,
        });
        blocksAlive++;
      }
    }
  }

  buildBlocks();

  // Build decorative commit graph on start screen
  function buildUICommitGraph() {
    const data = commitData || generateCommitData();
    commitGraphEl.innerHTML = '';
    const colors = [null, '#9be9a8', '#40c463', '#30a14e', '#216e39'];
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'commit-row';
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = document.createElement('div');
        cell.className = 'commit-cell';
        if (data[row] && data[row][col] > 0) {
          cell.style.background = colors[data[row][col]];
        }
        rowEl.appendChild(cell);
      }
      commitGraphEl.appendChild(rowEl);
    }
  }
  buildUICommitGraph();

  // ─── Paddle ─────────────────────────────────────────────────
  const paddleGeo = new THREE.BoxGeometry(PADDLE_W, PADDLE_H, PADDLE_D);
  const paddleMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf3,
    roughness: 0.3,
    metalness: 0.5,
    emissive: 0x58a6ff,
    emissiveIntensity: 0.2,
  });
  const paddle = new THREE.Mesh(paddleGeo, paddleMat);
  paddle.position.set(0, PADDLE_Y, 0);
  paddle.castShadow = true;
  scene.add(paddle);

  // Paddle glow
  const paddleGlowGeo = new THREE.PlaneGeometry(PADDLE_W + 1.5, 0.6);
  const paddleGlowMat = new THREE.MeshBasicMaterial({
    color: 0x58a6ff,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  const paddleGlow = new THREE.Mesh(paddleGlowGeo, paddleGlowMat);
  paddleGlow.position.set(0, PADDLE_Y - 0.25, -0.2);
  scene.add(paddleGlow);

  // ─── Ball ───────────────────────────────────────────────────
  const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.1,
    metalness: 0.8,
    emissive: 0xffffff,
    emissiveIntensity: 0.6,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.castShadow = true;
  scene.add(ball);

  // Ball glow
  const ballGlowGeo = new THREE.SphereGeometry(BALL_RADIUS * 2.5, 16, 16);
  const ballGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
  });
  const ballGlow = new THREE.Mesh(ballGlowGeo, ballGlowMat);
  ball.add(ballGlow);

  let ballVel = new THREE.Vector2(0, 0);

  // Ball trail
  const TRAIL_LENGTH = 12;
  const trail = [];
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const size = BALL_RADIUS * (1 - i / TRAIL_LENGTH) * 0.8;
    const geo = new THREE.SphereGeometry(size, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3 * (1 - i / TRAIL_LENGTH),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    trail.push({ mesh, x: 0, y: 0 });
  }

  function resetBall() {
    ball.position.set(paddle.position.x, PADDLE_Y + PADDLE_H / 2 + BALL_RADIUS + 0.1, 0);
    const angle = (Math.random() * 0.6 + 0.2) * Math.PI; // 36°–144° upward
    ballVel.set(Math.cos(angle) * ballSpeed, Math.sin(angle) * ballSpeed);
  }

  function resetBallOnPaddle() {
    ball.position.set(paddle.position.x, PADDLE_Y + PADDLE_H / 2 + BALL_RADIUS + 0.05, 0);
    ballVel.set(0, 0);
  }

  resetBallOnPaddle();

  // ─── Particle System ───────────────────────────────────────
  const particles = [];

  function spawnBlockExplosion(block) {
    const baseColor = new THREE.Color(block.color.hex);

    // Cube fragments
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const size = 0.06 + Math.random() * 0.12;
      const geo = new THREE.BoxGeometry(size, size, size);
      const shade = baseColor.clone();
      shade.offsetHSL(0, 0, (Math.random() - 0.5) * 0.3);

      const mat = new THREE.MeshBasicMaterial({
        color: shade,
        transparent: true,
        opacity: 1,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        block.x + (Math.random() - 0.5) * BLOCK_SIZE * 0.8,
        block.y + (Math.random() - 0.5) * BLOCK_SIZE * 0.8,
        (Math.random() - 0.5) * BLOCK_DEPTH
      );

      const speed = 2 + Math.random() * 6;
      const angle = Math.random() * Math.PI * 2;
      const elevAngle = (Math.random() - 0.3) * Math.PI;

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      scene.add(mesh);
      particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * Math.cos(elevAngle) * speed,
          Math.sin(angle) * Math.cos(elevAngle) * speed,
          Math.sin(elevAngle) * speed
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
        life: PARTICLE_LIFE,
        maxLife: PARTICLE_LIFE,
        type: 'cube',
      });
    }

    // Sparkle points
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const size = 0.03 + Math.random() * 0.06;
      const geo = new THREE.SphereGeometry(size, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        block.x + (Math.random() - 0.5) * BLOCK_SIZE,
        block.y + (Math.random() - 0.5) * BLOCK_SIZE,
        Math.random() * 0.5
      );

      const speed = 4 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;

      scene.add(mesh);
      particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          (Math.random() - 0.2) * speed * 0.5
        ),
        rotVel: new THREE.Vector3(0, 0, 0),
        life: SPARKLE_LIFE * (0.5 + Math.random() * 0.5),
        maxLife: SPARKLE_LIFE,
        type: 'sparkle',
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        particles.splice(i, 1);
        continue;
      }

      const t = 1 - p.life / p.maxLife; // 0→1 over lifetime
      const ease = t * t; // quadratic ease

      // Move
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Gravity for cubes
      if (p.type === 'cube') {
        p.vel.z -= 12 * dt;
        p.vel.x *= (1 - 2.0 * dt);
        p.vel.y *= (1 - 2.0 * dt);
      }

      // Rotate cubes
      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;

      // Fade and shrink
      p.mesh.material.opacity = 1 - ease;
      const s = 1 - ease * 0.7;
      p.mesh.scale.set(s, s, s);

      // Sparkles: twinkle
      if (p.type === 'sparkle') {
        p.mesh.material.opacity *= 0.5 + Math.sin(p.life * 30) * 0.5;
      }
    }
  }

  // ─── Collision Detection ────────────────────────────────────
  function ballBlockCollision(bx, by, block) {
    const halfW = BLOCK_SIZE / 2;
    const halfH = BLOCK_SIZE / 2;

    const closestX = Math.max(block.x - halfW, Math.min(bx, block.x + halfW));
    const closestY = Math.max(block.y - halfH, Math.min(by, block.y + halfH));

    const dx = bx - closestX;
    const dy = by - closestY;

    return (dx * dx + dy * dy) < (BALL_RADIUS * BALL_RADIUS);
  }

  function ballPaddleCollision(bx, by) {
    const px = paddle.position.x;
    const halfW = PADDLE_W / 2;
    const halfH = PADDLE_H / 2;

    return (
      bx + BALL_RADIUS > px - halfW &&
      bx - BALL_RADIUS < px + halfW &&
      by - BALL_RADIUS < PADDLE_Y + halfH &&
      by + BALL_RADIUS > PADDLE_Y - halfH
    );
  }

  // ─── Score & Lives ─────────────────────────────────────────
  function updateScoreDisplay() {
    scoreSpan.textContent = score;
  }

  function updateLivesDisplay() {
    livesDisplay.textContent = Array(lives).fill('❤️').join(' ');
  }

  // ─── Face Tracking (MediaPipe Vision Tasks) ─────────────────
  let faceDetector = null;
  let lastDetectTime = 0;

  async function initFaceTracking() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      webcam.srcObject = stream;
      await webcam.play();

      webcamLabel.textContent = 'Loading model…';

      // Dynamically import MediaPipe Vision Tasks
      const vision = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
      );

      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      faceDetector = await vision.FaceDetector.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
      });

      webcamLabel.textContent = 'Face tracking active';
      webcamLabel.classList.add('tracking');
      webcamContainer.classList.add('tracking');
      loadingEl.classList.add('hidden');

      detectFace();
    } catch (err) {
      console.warn('Face tracking not available, falling back to mouse:', err);
      webcamLabel.textContent = 'Camera unavailable — use mouse';
      loadingEl.textContent = 'Using mouse/trackpad control';
      useMouseFallback = true;
      setTimeout(() => loadingEl.classList.add('hidden'), 3000);
    }
  }

  function detectFace() {
    if (!faceDetector) return;
    requestAnimationFrame(detectFace);

    // Throttle to ~30 fps for face detection
    const now = performance.now();
    if (now - lastDetectTime < 33) return;
    lastDetectTime = now;

    try {
      const result = faceDetector.detectForVideo(webcam, now);

      if (result.detections && result.detections.length > 0) {
        const detection = result.detections[0];
        faceDetected = true;

        // Use keypoints for precise tracking (nose tip = index 2)
        if (detection.keypoints && detection.keypoints.length > 2) {
          const nose = detection.keypoints[2];
          // nose.x and nose.y are normalized 0–1; mirror and center to -1…1
          rawFaceX = -(nose.x - 0.5) * 2;
          rawFaceY = -(nose.y - 0.5) * 2;
        } else {
          // Fallback to bounding box center
          const bb = detection.boundingBox;
          rawFaceX = -((bb.originX + bb.width / 2) / webcam.videoWidth - 0.5) * 2;
          rawFaceY = -((bb.originY + bb.height / 2) / webcam.videoHeight - 0.5) * 2;
        }

        if (!webcamContainer.classList.contains('tracking')) {
          webcamContainer.classList.add('tracking');
          webcamLabel.textContent = 'Face tracking active';
          webcamLabel.classList.add('tracking');
        }
      } else {
        faceDetected = false;
        webcamContainer.classList.remove('tracking');
        webcamLabel.textContent = 'No face detected';
        webcamLabel.classList.remove('tracking');
      }
    } catch (e) {
      // Silently continue on detection errors
    }
  }

  // ─── Input ──────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (gameState === 'WAITING') {
        startGame();
      } else if (gameState === 'GAME_OVER' || gameState === 'WIN') {
        resetGame();
      }
    }
  });

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2; // -1…1
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ─── Game State Management ─────────────────────────────────
  function startGame() {
    gameState = 'PLAYING';
    score = 0;
    lives = MAX_LIVES;
    ballSpeed = BALL_SPEED_INITIAL;
    updateScoreDisplay();
    updateLivesDisplay();
    overlay.classList.add('hidden');
    gameOverEl.classList.remove('visible');
    resetBall();
  }

  function loseLife() {
    lives--;
    updateLivesDisplay();
    screenShake = 0.5;

    if (lives <= 0) {
      endGame(false);
    } else {
      resetBallOnPaddle();
      // Brief pause then re-launch
      setTimeout(() => {
        if (gameState === 'PLAYING') resetBall();
      }, 800);
    }
  }

  function endGame(won) {
    gameState = won ? 'WIN' : 'GAME_OVER';
    gameOverTitle.textContent = won ? '🎉 You Win!' : 'Game Over';
    gameOverTitle.className = won ? 'win' : '';
    finalScoreSpan.textContent = score;
    gameOverEl.classList.add('visible');
  }

  function resetGame() {
    // Clear particles
    particles.forEach(p => {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    particles.length = 0;

    buildBlocks();
    buildUICommitGraph();
    startGame();
  }

  // ─── Physics Update ─────────────────────────────────────────
  function updatePhysics(dt) {
    if (gameState !== 'PLAYING') return;

    // Cap dt to avoid tunneling on tab switch
    dt = Math.min(dt, 0.033);

    const bx = ball.position.x + ballVel.x * dt;
    const by = ball.position.y + ballVel.y * dt;

    // Wall collisions
    const leftBound = -FIELD_W / 2 + BALL_RADIUS;
    const rightBound = FIELD_W / 2 - BALL_RADIUS;
    const topBound = FIELD_H / 2 - BALL_RADIUS;

    if (bx < leftBound) {
      ball.position.x = leftBound;
      ballVel.x = Math.abs(ballVel.x);
    } else if (bx > rightBound) {
      ball.position.x = rightBound;
      ballVel.x = -Math.abs(ballVel.x);
    } else {
      ball.position.x = bx;
    }

    if (by > topBound) {
      ball.position.y = topBound;
      ballVel.y = -Math.abs(ballVel.y);
    } else {
      ball.position.y = by;
    }

    // Paddle collision
    if (ballVel.y < 0 && ballPaddleCollision(ball.position.x, ball.position.y)) {
      ball.position.y = PADDLE_Y + PADDLE_H / 2 + BALL_RADIUS;
      
      // Angle based on hit position (-1 to 1)
      const hitPos = (ball.position.x - paddle.position.x) / (PADDLE_W / 2);
      const maxAngle = Math.PI * 0.38;
      const angle = Math.PI / 2 + hitPos * maxAngle;

      ballVel.x = -Math.cos(angle) * ballSpeed;
      ballVel.y = Math.sin(angle) * ballSpeed;

      screenShake = 0.08;
    }

    // Block collisions
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block.alive) continue;

      if (ballBlockCollision(ball.position.x, ball.position.y, block)) {
        // Destroy block
        block.alive = false;
        scene.remove(block.mesh);
        blocksAlive--;

        // Score
        score += block.color.points;
        updateScoreDisplay();

        // Speed up slightly
        ballSpeed = Math.min(BALL_SPEED_MAX, ballSpeed + BALL_SPEED_INCREMENT);

        // Determine bounce direction
        const dx = ball.position.x - block.x;
        const dy = ball.position.y - block.y;

        if (Math.abs(dx) / (BLOCK_SIZE / 2) > Math.abs(dy) / (BLOCK_SIZE / 2)) {
          ballVel.x = Math.sign(dx) * Math.abs(ballVel.x);
        } else {
          ballVel.y = Math.sign(dy) * Math.abs(ballVel.y);
        }

        // Normalize velocity to current speed
        const currentSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
        if (currentSpeed > 0) {
          ballVel.x = (ballVel.x / currentSpeed) * ballSpeed;
          ballVel.y = (ballVel.y / currentSpeed) * ballSpeed;
        }

        // Explosion particles!
        spawnBlockExplosion(block);
        screenShake = 0.15;

        // Win check
        if (blocksAlive <= 0) {
          endGame(true);
        }

        break; // One block per frame
      }
    }

    // Ball out of bounds (bottom)
    if (ball.position.y < -FIELD_H / 2 - 2) {
      loseLife();
    }
  }

  // ─── Update Loop ────────────────────────────────────────────
  const clock = new THREE.Clock();

  function update() {
    requestAnimationFrame(update);

    const dt = clock.getDelta();

    // Smooth face tracking input
    const targetX = (faceDetected && !useMouseFallback) ? rawFaceX : mouseX;
    const targetY = faceDetected ? rawFaceY : 0;

    smoothFaceX += (targetX - smoothFaceX) * FACE_SMOOTH;
    smoothFaceY += (targetY - smoothFaceY) * FACE_SMOOTH;

    // Update paddle position
    // Remap so the middle third of the webcam covers the full paddle range
    if (gameState === 'PLAYING' || gameState === 'WAITING') {
      const amplified = Math.max(-1, Math.min(1, smoothFaceX * 3));
      const paddleTarget = amplified * (FIELD_W / 2 - PADDLE_W / 2);
      paddle.position.x += (paddleTarget - paddle.position.x) * 0.15;
      paddle.position.x = Math.max(-FIELD_W / 2 + PADDLE_W / 2, Math.min(FIELD_W / 2 - PADDLE_W / 2, paddle.position.x));

      paddleGlow.position.x = paddle.position.x;
    }

    // Ball follows paddle when stationary (waiting or between lives)
    if (gameState === 'WAITING' || (gameState === 'PLAYING' && ballVel.x === 0 && ballVel.y === 0)) {
      ball.position.x = paddle.position.x;
      ball.position.y = PADDLE_Y + PADDLE_H / 2 + BALL_RADIUS + 0.05;
    }

    // Physics
    updatePhysics(dt);

    // Particles
    updateParticles(dt);

    // Camera parallax
    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    screenShake *= 0.9;
    if (screenShake < 0.001) screenShake = 0;

    camera.position.set(
      CAM_BASE.x + smoothFaceX * PARALLAX_STRENGTH_X + shakeX,
      CAM_BASE.y + smoothFaceY * PARALLAX_STRENGTH_Y + shakeY,
      CAM_BASE.z
    );
    camera.lookAt(
      CAM_LOOKAT_BASE.x + smoothFaceX * PARALLAX_STRENGTH_X * 0.15,
      CAM_LOOKAT_BASE.y + smoothFaceY * PARALLAX_STRENGTH_Y * 0.15,
      CAM_LOOKAT_BASE.z
    );

    // Paddle glow pulse
    paddleGlowMat.opacity = 0.1 + Math.sin(clock.elapsedTime * 3) * 0.04;

    // Ball glow pulse
    ballGlowMat.opacity = 0.12 + Math.sin(clock.elapsedTime * 5) * 0.05;

    // Ball rotation (visual only)
    ball.rotation.x += ballVel.y * dt * 0.5;
    ball.rotation.y += ballVel.x * dt * 0.5;

    // Ball trail update
    const isMoving = ballVel.x !== 0 || ballVel.y !== 0;
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      trail[i].x = trail[i - 1].x;
      trail[i].y = trail[i - 1].y;
    }
    trail[0].x = ball.position.x;
    trail[0].y = ball.position.y;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      trail[i].mesh.position.set(trail[i].x, trail[i].y, 0);
      trail[i].mesh.visible = isMoving && gameState === 'PLAYING';
    }

    // Render
    renderer.render(scene, camera);
  }

  // ─── Init ───────────────────────────────────────────────────
  updateScoreDisplay();
  updateLivesDisplay();
  initFaceTracking();
  update();

})();
