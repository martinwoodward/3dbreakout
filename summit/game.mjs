import { createGame, stepGame, score, STEP, LIMIT } from "./engine.mjs";
import { HighlandAudio } from "./audio.mjs";

const $ = id => document.getElementById(id);
const audio = new HighlandAudio();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let state = "ready";
let game = createGame();
let best = 0;
let storageWarning = false;
let soundBusy = false;
let toastUntil = 0;
const keys = new Set();
const pointers = new Map();
let pointerTarget = null;
let dragId = null;
let lastZone = 0;

function toast(message, seconds = 2.5) {
  $("toast").textContent = message;
  toastUntil = performance.now() + seconds * 1000;
}
try {
  const saved = Number(localStorage.getItem("summit-hop-best"));
  best = Number.isFinite(saved) && saved >= 0 ? saved : 0;
} catch (error) {
  console.warn("Personal best storage unavailable:", error);
  storageWarning = true;
}

function fail(error) {
  console.error(error);
  $("error").hidden = false;
  $("error-detail").textContent = "The 3D renderer couldn't start. Enable hardware acceleration / WebGL in your browser, then reload.";
  $("start").disabled = true;
  $("start").textContent = "3D unavailable";
  audio.setPlaying(false);
}

function boot() {
  const T = window.THREE;
  if (!T) throw new Error("The local Three.js library failed to load.");
  const canvas = $("world");
  const css = getComputedStyle(document.documentElement);
  const color = name => css.getPropertyValue(`--cp-${name}`).trim();
  const palette = Object.fromEntries(["bg", "surface", "text", "text-muted", "accent", "success", "warning", "link", "border", "bg-elevated"].map(name => [name, color(name)]));
  const tint = (a, b, amount) => new T.Color(palette[a]).lerp(new T.Color(palette[b]), amount);
  const scene = new T.Scene();
  scene.background = new T.Color(palette.bg);
  scene.fog = new T.Fog(palette.bg, 30, 75);
  const camera = new T.OrthographicCamera(-15, 15, 10, -10, .1, 100);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const lightColor = document.documentElement.dataset.theme === "dark" ? palette.text : palette.surface;
  const darkColor = document.documentElement.dataset.theme === "dark" ? palette.surface : palette.text;
  scene.add(new T.AmbientLight(lightColor, .65));
  const sun = new T.DirectionalLight(lightColor, 1);
  sun.position.set(-8, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 20, bottom: -15, far: 65 });
  sun.shadow.bias = -.001;
  scene.add(sun);
  scene.add(sun.target);
  const rim = new T.DirectionalLight(palette.accent, .2);
  rim.position.set(8, 8, -12);
  scene.add(rim);

  function material(value, extra = {}) {
    return new T.MeshStandardMaterial({ color: new T.Color(value).convertSRGBToLinear(), roughness: .85, flatShading: true, ...extra });
  }
  const mats = {
    grass: material(tint("success", "bg", .18)),
    rock: material(tint("text-muted", "bg", .4)),
    rockLight: material(tint("text-muted", "bg", .65)),
    cream: material(lightColor),
    dark: material(darkColor),
    rose: material(palette.accent),
    gold: material(palette.warning),
    skin: material(new T.Color(palette.warning).lerp(new T.Color(lightColor), .65)),
    blue: material(palette.link),
    leaf: material(palette.success),
    cloud: material(palette.surface),
    biscuit: material(tint("warning", "bg", .55))
  };
  function tartanTexture() {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = textureCanvas.height = 128;
    const context = textureCanvas.getContext("2d");
    context.fillStyle = palette.accent;
    context.fillRect(0, 0, 128, 128);
    context.fillStyle = palette.text;
    context.globalAlpha = .6;
    for (const p of [12, 72]) { context.fillRect(p, 0, 22, 128); context.fillRect(0, p, 128, 22); }
    context.globalAlpha = .8;
    context.fillStyle = palette.warning;
    for (const p of [22, 82]) { context.fillRect(p, 0, 2, 128); context.fillRect(0, p, 128, 2); }
    context.globalAlpha = .4;
    context.fillStyle = palette.surface;
    for (const p of [48, 108]) { context.fillRect(p, 0, 4, 128); context.fillRect(0, p, 128, 4); }
    const texture = new T.CanvasTexture(textureCanvas);
    texture.encoding = T.sRGBEncoding;
    return texture;
  }
  mats.tartan = material(lightColor, { map: tartanTexture() });
  const cube = new T.BoxGeometry(1, 1, 1);
  const sphere = new T.IcosahedronGeometry(1, 1);
  const cone = new T.ConeGeometry(1, 1, 5);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 8);
  function mesh(parent, geometry, mat, x, y, z, sx, sy = sx, sz = sx) {
    const result = new T.Mesh(geometry, mat);
    result.position.set(x, y, z);
    result.scale.set(sx, sy, sz);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  const box = (parent, mat, x, y, z, sx, sy, sz) => mesh(parent, cube, mat, x, y, z, sx, sy, sz);
  const ball = (parent, mat, x, y, z, sx, sy = sx, sz = sx) => mesh(parent, sphere, mat, x, y, z, sx, sy, sz);

  function thistle() {
    const group = new T.Group();
    box(group, mats.leaf, 0, .2, 0, .07, .6, .07);
    for (const sign of [-1, 1]) {
      const leaf = mesh(group, cone, mats.leaf, sign * .15, .17, 0, .14, .4, .1);
      leaf.rotation.z = -sign * .9;
    }
    ball(group, mats.leaf, 0, .48, 0, .22, .2, .22);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      mesh(group, cone, mats.rose, Math.cos(a) * .12, .7, Math.sin(a) * .12, .1, .4, .1);
    }
    return group;
  }
  function bagpipes() {
    const group = new T.Group();
    ball(group, mats.tartan, 0, .15, 0, .4, .3, .23);
    for (let i = 0; i < 3; i++) {
      const pipe = new T.Group();
      pipe.position.set((i - 1) * .17, .35, 0);
      pipe.rotation.z = -.25 + i * .2;
      box(pipe, mats.dark, 0, .25, 0, .075, .65 + i * .12, .075);
      box(pipe, mats.cream, 0, .53 + i * .06, 0, .12, .06, .12);
      group.add(pipe);
    }
    const chanter = box(group, mats.dark, .3, -.12, 0, .075, .5, .075);
    chanter.rotation.z = .45;
    return group;
  }
  function character(cameo = false) {
    const group = new T.Group();
    const shoes = [];
    for (const sign of [-1, 1]) {
      box(group, mats.cream, sign * .18, .18, 0, .16, .35, .17);
      shoes.push(box(group, mats.dark, sign * .18, .06, .08, .24, .14, .36));
    }
    mesh(group, cylinder, cameo ? mats.rose : mats.tartan, 0, .47, 0, .38, .42, .31);
    box(group, cameo ? mats.rose : mats.cream, 0, .85, 0, .58, .48, .35);
    box(group, mats.dark, 0, .62, .19, .61, .08, .06);
    box(group, mats.gold, 0, .62, .23, .13, .11, .025);
    const arms = [];
    for (const sign of [-1, 1]) {
      const arm = new T.Group();
      arm.position.set(sign * .37, .96, 0);
      box(arm, cameo ? mats.rose : mats.cream, 0, -.12, 0, .18, .36, .2);
      ball(arm, mats.skin, 0, -.33, 0, .12);
      arm.rotation.z = sign * .25;
      group.add(arm);
      arms.push(arm);
    }
    box(group, mats.skin, 0, 1.27, 0, .51, .47, .44);
    for (const sign of [-1, 1]) {
      ball(group, mats.skin, sign * .29, 1.25, 0, .09);
      box(group, mats.dark, sign * .115, 1.31, .23, .055, .065, .025);
    }
    box(group, mats.skin, 0, 1.19, .26, .12, .11, .12);
    box(group, mats.dark, 0, 1.1, .23, .14, .025, .025);
    box(group, mats.gold, 0, 1.5, -.035, .55, .15, .45);
    ball(group, cameo ? mats.rose : mats.tartan, 0, 1.57, 0, .38, .16, .31);
    box(group, cameo ? mats.rose : mats.dark, .03, 1.51, .28, .48, .05, .21);
    ball(group, mats.rose, .04, 1.75, 0, .095);
    if (!cameo) {
      box(group, mats.rose, .11, .95, .195, .05, .24, .02);
      box(group, mats.cream, .11, .77, .215, .15, .17, .025);
    }
    group.userData = { arms, shoes };
    return group;
  }
  function platformModel(platform) {
    const group = new T.Group();
    const top = platform.type === "tartan" ? mats.tartan : platform.type === "shortbread" ? mats.biscuit : mats.grass;
    box(group, top, 0, -.12, 0, platform.width, .24, 1.55);
    if (platform.type === "shortbread") {
      for (let i = -1; i <= 1; i++) for (const z of [-.35, .35]) {
        ball(group, mats.gold, i * .65, .005, z, .055, .02, .055);
      }
    } else {
      mesh(group, cone, mats.rock, 0, -.38, 0, platform.width * .53, .6, 1.05).rotation.z = Math.PI;
      box(group, mats.rockLight, .38, -.3, .45, .6, .26, .28);
    }
    if (platform.type === "tartan") {
      for (const sign of [-1, 1]) {
        const arrow = mesh(group, cone, mats.cream, sign * .9, .025, 0, .14, .25, .05);
        arrow.rotation.z = -sign * Math.PI / 2;
        arrow.rotation.x = Math.PI / 2;
      }
    }
    if (platform.pickup) {
      const pickup = platform.pickup === "pipes" ? bagpipes() : thistle();
      pickup.position.y = .85;
      pickup.position.z = .75;
      group.add(pickup);
      group.userData.pickup = pickup;
    }
    if (platform.cameo) {
      const jimmy = character(true);
      jimmy.scale.setScalar(.7);
      jimmy.position.set(-platform.width / 2 + .4, 0, -.25);
      jimmy.rotation.y = .2;
      group.add(jimmy);
      group.userData.cameo = jimmy;
    }
    return group;
  }
  function saltire(parent, x, y, z) {
    box(parent, mats.dark, x, y + 1, z, .06, 2.2, .06);
    box(parent, mats.blue, x + .55, y + 1.65, z, 1.1, .65, .05);
    for (const sign of [-1, 1]) {
      const cross = box(parent, mats.cream, x + .55, y + 1.65, z + .035, 1.22, .09, .025);
      cross.rotation.z = sign * .48;
    }
  }

  const landscape = new T.Group();
  scene.add(landscape);
  for (let i = 0; i < 12; i++) {
    const x = (i - 5.5) * 4;
    const h = 6 + Math.sin(i * 5) * 2.5;
    const mountain = mesh(landscape, cone, i % 2 ? mats.rockLight : mats.rock, x, -4, -13 - i % 3 * 4, 6, h, 5);
    mountain.rotation.y = i * .5;
    if (i % 3 === 0) mesh(landscape, cone, mats.cream, x, -4 + h * .37, mountain.position.z, 1.5, h * .26, 1.3);
  }
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = new T.Group();
    cloud.position.set((i % 5 - 2) * 7, (i > 4 ? 12 : 3) + Math.sin(i) * 2, -7 - i % 3 * 3);
    for (let j = 0; j < 4; j++) ball(cloud, mats.cloud, j * .65 - .9, Math.sin(j * 2) * .2, 0, .9, .38 + (j % 2) * .15, .55);
    landscape.add(cloud);
    clouds.push(cloud);
  }
  const preview = new T.Group();
  scene.add(preview);
  const island = platformModel({ type: "grass", width: 5.8 });
  island.scale.z = 2;
  preview.add(island);
  const hero = character();
  hero.scale.setScalar(1.6);
  hero.position.set(-.3, 0, .35);
  hero.rotation.y = -.25;
  preview.add(hero);
  saltire(preview, -1.9, 0, -.9);
  for (const [x, z] of [[2, .7], [-2, .8], [1.7, -1]]) {
    const flower = thistle();
    flower.position.set(x, 0, z);
    preview.add(flower);
  }
  const previewSteps = [
    { x: 3.5, y: 2.8, type: "tartan", width: 2.4, pickup: "thistle" },
    { x: .5, y: 5.1, type: "grass", width: 2.6, pickup: "pipes" },
    { x: 3.3, y: 7.5, type: "shortbread", width: 2.5, cameo: true }
  ];
  for (const platform of previewSteps) {
    const group = platformModel(platform);
    group.position.set(platform.x, platform.y, -.6);
    preview.add(group);
  }
  const playerMesh = character();
  playerMesh.visible = false;
  scene.add(playerMesh);
  const platformMeshes = new Map();
  const particles = [];
  const zones = ["Murrayfield base camp", "Microsoft 365 meadows", "Power Platform peaks", "Azure altitude", "Copilot country", "The Scottish Summit"];
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  const intersection = new T.Vector3();
  let viewHeight = 20;
  let displayCameraY = 4;
  let accumulator = 0;
  let previousTime = performance.now();

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    viewHeight = state === "ready" ? (width < 761 ? 21 : 17) : Math.max(20, 14 / (width / height));
    const viewWidth = viewHeight * width / height;
    Object.assign(camera, { left: -viewWidth / 2, right: viewWidth / 2, top: viewHeight / 2, bottom: -viewHeight / 2 });
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener("resize", resize);

  function setState(next) {
    state = next;
    $("app").dataset.state = next;
    const started = next !== "ready";
    $("intro").hidden = started;
    $("scene-caption").hidden = started;
    $("hud").hidden = !started;
    $("zone").hidden = !started;
    $("pause").hidden = next !== "playing";
    $("touch-controls").hidden = next !== "playing";
    $("dialog").hidden = next !== "paused" && next !== "over";
    canvas.tabIndex = next === "playing" ? 0 : -1;
    $("start").tabIndex = next === "ready" ? 0 : -1;
    preview.visible = !started;
    playerMesh.visible = started;
    keys.clear();
    pointers.clear();
    pointerTarget = null;
    dragId = null;
    accumulator = 0;
    audio.setPlaying(next === "playing");
    resize();
  }
  function start() {
    for (const group of platformMeshes.values()) scene.remove(group);
    platformMeshes.clear();
    for (const item of particles) scene.remove(item.mesh);
    particles.length = 0;
    game = createGame();
    displayCameraY = game.cameraY;
    lastZone = 0;
    $("zone").textContent = zones[0];
    $("best").textContent = best;
    $("toast").textContent = "";
    setState("playing");
    syncWorld(0);
    canvas.focus({ preventScroll: true });
    if (storageWarning) toast("Personal best can't be saved in this browser.", 4);
    else toast("Aye, up you go! Land on the grassy ledges.", 3);
  }
  function pause() {
    if (state !== "playing") return;
    setState("paused");
    $("dialog-title").textContent = "Taking a breather?";
    $("dialog-description").textContent = "The Highlands can wait. Your climb is right where you left it.";
    $("results").hidden = true;
    $("resume").hidden = false;
    $("resume").textContent = "Back to the climb";
    $("resume").focus();
  }
  function resume() {
    if (state !== "paused") return;
    setState("playing");
    canvas.focus({ preventScroll: true });
  }
  function finish() {
    const total = score(game);
    const record = total > best;
    best = Math.max(best, total);
    try { localStorage.setItem("summit-hop-best", String(best)); }
    catch (error) { console.warn("Couldn't save personal best:", error); storageWarning = true; }
    setState("over");
    $("best").textContent = best;
    $("dialog-title").textContent = record ? "A new high, pal!" : "Och, gravity.";
    $("dialog-description").textContent = `${game.thistles} thistle${game.thistles === 1 ? "" : "s"} collected. ${record ? "A personal best worth piping about." : "A wee tumble. A fresh start. That's the spirit."}${storageWarning ? " Your best is kept for this visit only; browser storage is unavailable." : ""}`;
    $("results").hidden = false;
    $("final-height").textContent = `${Math.floor(game.height * 10)} m`;
    $("final-score").textContent = total;
    $("resume").hidden = true;
    $("restart").textContent = "One more wee go";
    $("restart").focus();
  }
  $("start").addEventListener("click", start);
  $("restart").addEventListener("click", start);
  $("pause").addEventListener("click", pause);
  $("resume").addEventListener("click", resume);
  $("sound").addEventListener("click", async () => {
    if (soundBusy) return;
    soundBusy = true;
    try {
      const enabled = await audio.toggle();
      $("sound").setAttribute("aria-pressed", String(enabled));
      $("sound-label").textContent = enabled ? "Sound on" : "Sound off";
      $("sound").title = enabled ? "Mute music and sound effects" : "Enable original music and sound effects";
      if (enabled && state !== "playing") toast("Pipes ready. Music starts with your climb.");
    } catch (error) {
      console.error("Audio couldn't start:", error);
      toast("Audio couldn't start. Try Sound again in a supported browser.", 5);
    } finally { soundBusy = false; }
  });
  window.addEventListener("keydown", event => {
    if (event.target instanceof HTMLElement && event.target.closest("button, a") && ["Space", "Enter"].includes(event.code)) return;
    if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD", "KeyP", "Escape"].includes(event.code)) event.preventDefault();
    if (event.repeat && ["Space", "KeyP", "Escape"].includes(event.code)) return;
    if (event.code === "Space" && (state === "ready" || state === "over")) start();
    else if (["KeyP", "Escape"].includes(event.code)) state === "playing" ? pause() : resume();
    if (state === "playing") keys.add(event.code);
  });
  window.addEventListener("keyup", event => keys.delete(event.code));
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  // Keep modal keyboard focus on the dialog or the always-available sound control.
  document.addEventListener("keydown", event => {
    if (event.code !== "Tab" || !["paused", "over"].includes(state)) return;
    const focusable = [$("sound"), ...Array.from($("dialog").querySelectorAll("button:not([hidden])"))];
    const index = focusable.indexOf(document.activeElement);
    event.preventDefault();
    focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
  });
  for (const [id, direction] of [["left", -1], ["right", 1]]) {
    const button = $(id);
    button.addEventListener("pointerdown", event => {
      if (state !== "playing") return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, direction);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, event => pointers.delete(event.pointerId));
  }
  function steer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, intersection)) pointerTarget = Math.max(-LIMIT, Math.min(LIMIT, intersection.x));
  }
  canvas.addEventListener("pointerdown", event => {
    if (state !== "playing") return;
    dragId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    steer(event);
  });
  canvas.addEventListener("pointermove", event => { if (dragId === event.pointerId) steer(event); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, event => {
    if (event.pointerId === dragId) { dragId = null; pointerTarget = null; }
  });
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    pause();
    $("error").hidden = false;
    $("error-detail").textContent = "The graphics context was interrupted. Reload to start a fresh climb.";
  });
  function burst(x, y, mat) {
    if (reducedMotion) return;
    for (let i = 0; i < 12; i++) {
      const particle = mesh(scene, cube, mat, x, y + .1, .2, .09);
      particles.push({ mesh: particle, vx: (Math.random() - .5) * 5, vy: 2 + Math.random() * 3, vz: (Math.random() - .5) * 3, life: .6 });
    }
  }
  function syncWorld(dt) {
    const alive = new Set(game.platforms.filter(p => !p.broken).map(p => p.id));
    for (const [id, group] of platformMeshes) {
      if (!alive.has(id)) { scene.remove(group); platformMeshes.delete(id); }
    }
    for (const platform of game.platforms) {
      if (platform.broken) continue;
      let group = platformMeshes.get(platform.id);
      if (!group) {
        group = platformModel(platform);
        scene.add(group);
        platformMeshes.set(platform.id, group);
      }
      group.position.set(platform.x, platform.y, 0);
      const pickup = group.userData.pickup;
      if (pickup) {
        pickup.visible = Boolean(platform.pickup);
        pickup.rotation.y = reducedMotion ? 0 : game.time;
        pickup.position.y = .85 + (reducedMotion ? 0 : Math.sin(game.time * 3 + platform.id) * .1);
      }
      if (group.userData.cameo && !reducedMotion) group.userData.cameo.userData.arms[1].rotation.z = 2.3 + Math.sin(game.time * 4) * .3;
    }
    playerMesh.position.set(game.player.x, game.player.y, .12);
    playerMesh.rotation.z = -game.player.vx * .025;
    playerMesh.rotation.y = game.player.vx * .04;
    playerMesh.userData.arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * (game.player.vy > 0 ? 1.4 : .45); });
    displayCameraY += (game.cameraY - displayCameraY) * Math.min(1, dt * 7);
    $("height").textContent = Math.floor(game.height * 10);
    $("score").textContent = score(game);
    const zone = Math.min(zones.length - 1, Math.floor(game.height / 30));
    if (zone !== lastZone) { lastZone = zone; $("zone").textContent = zones[zone]; toast(`Welcome to ${zones[zone]}!`); }
  }
  function processEvents() {
    for (const event of game.events) {
      if (event.type === "over") { finish(); continue; }
      audio.effect(event.type);
      if (event.type === "thistle") { burst(event.x, event.y, mats.rose); toast("Thistle do nicely. +25"); }
      if (event.type === "pipes") { burst(event.x, event.y, mats.gold); toast("Bagpipe boost! Haud on tae yer hat!"); }
      if (event.type === "cameo") { burst(event.x, event.y, mats.rose); toast("Wee Jimmy says: fan-dabby-dozy! +50", 3.5); }
      if (event.type === "bounce" && event.surface === "shortbread") {
        burst(event.x, event.y, mats.biscuit);
        audio.effect("crumble");
        toast("That's the way the shortbread crumbles.");
      }
    }
    game.events.length = 0;
  }
  function frame(time) {
    requestAnimationFrame(frame);
    const dt = Math.min((time - previousTime) / 1000, .05);
    previousTime = time;
    if (state === "playing") {
      let direction = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
      if (pointers.size) direction = [...pointers.values()].reduce((sum, value) => sum + value, 0);
      else if (!direction && pointerTarget !== null) direction = Math.max(-1, Math.min(1, (pointerTarget - game.player.x) * 3));
      accumulator += dt;
      while (accumulator >= STEP && !game.over) {
        stepGame(game, direction);
        accumulator -= STEP;
      }
      processEvents();
      syncWorld(dt);
    }
    if (state === "ready") {
      const mobile = canvas.clientWidth < 761;
      const targetX = mobile ? -2.8 : -5.4;
      const targetY = mobile ? 1.8 : 3.6;
      camera.position.set(targetX, targetY + 7, 23);
      camera.lookAt(targetX, targetY, 0);
      preview.position.set(mobile ? .6 : 0, mobile ? 2.4 : -.8, 0);
      preview.scale.setScalar(mobile ? .72 : 1);
      preview.rotation.y = -.18;
      hero.position.y = reducedMotion ? .1 : .12 + Math.abs(Math.sin(time * .0018)) * .45;
      hero.userData.arms[1].rotation.z = -1.7;
      landscape.position.y = 0;
    } else {
      camera.position.set(0, displayCameraY + 7, 23);
      camera.lookAt(0, displayCameraY, 0);
      landscape.position.y = displayCameraY - 4;
      sun.position.y = displayCameraY + 14;
      sun.target.position.y = displayCameraY;
    }
    if ((state === "ready" || state === "playing") && !reducedMotion) {
      clouds.forEach((cloud, i) => { cloud.position.x += Math.sin(i + 1) * dt * .1; });
    }
    if (state === "playing") {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.vy -= 10 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += dt * 5;
        p.mesh.scale.setScalar(Math.max(.001, p.life * .15));
        if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
      }
    }
    if (time > toastUntil) $("toast").textContent = "";
    renderer.setScissorTest(false);
    renderer.clear();
    if (state === "ready") {
      const mobile = canvas.clientWidth < 761;
      const left = Math.floor(canvas.clientWidth * (mobile ? .58 : .39));
      renderer.setScissor(left, 0, canvas.clientWidth - left, canvas.clientHeight * (mobile ? .73 : 1));
      renderer.setScissorTest(true);
    }
    renderer.render(scene, camera);
  }
  resize();
  $("start").disabled = false;
  $("start").textContent = "Let's go, pal!  ↑";
  $("best").textContent = best;
  requestAnimationFrame(frame);
}

try { boot(); } catch (error) { fail(error); }
