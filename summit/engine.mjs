export const GRAVITY = 22;
export const JUMP = 12.7;
export const SPEED = 7.2;
export const LIMIT = 6.3;
export const STEP = 1 / 120;

export function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createGame(seed = Date.now()) {
  const game = {
    random: randomGenerator(seed), player: { x: 0, y: 0, vy: JUMP, vx: 0 },
    platforms: [], nextId: 0, top: 0, lastX: 0, cameraY: 4,
    height: 0, bonus: 0, thistles: 0, time: 0, over: false, events: []
  };
  game.platforms.push({ id: game.nextId++, x: 0, baseX: 0, y: 0, width: 4.4, type: "grass", pickup: null, used: false, broken: false });
  generatePlatforms(game, 24);
  return game;
}

function generatePlatforms(game, until) {
  while (game.top < until) {
    const id = game.nextId++;
    game.top += 1.65 + game.random() * .35;
    const x = Math.max(-4.7, Math.min(4.7, game.lastX + (game.random() - .5) * 5.2));
    const type = id > 7 && id % 7 === 0 ? "shortbread" : id > 5 && id % 5 === 0 ? "tartan" : "grass";
    game.platforms.push({
      id, x, baseX: x, y: game.top, width: type === "shortbread" ? 2.5 : 2.9,
      type, pickup: id % 9 === 4 ? "pipes" : id % 3 === 1 ? "thistle" : null,
      cameo: id % 15 === 8, used: false, broken: false
    });
    game.lastX = x;
  }
}

export function stepGame(game, direction, dt = STEP) {
  if (game.over) return;
  game.time += dt;
  const p = game.player;
  const oldY = p.y;
  p.vx += (Math.max(-1, Math.min(1, direction)) * SPEED - p.vx) * Math.min(1, dt * 15);
  p.x = Math.max(-LIMIT, Math.min(LIMIT, p.x + p.vx * dt));
  p.vy -= GRAVITY * dt;
  p.y += p.vy * dt;
  for (const platform of game.platforms) {
    if (platform.type === "tartan") platform.x = platform.baseX + Math.sin(game.time * 1.3 + platform.id) * .6;
    if (platform.broken) continue;
    const aligned = Math.abs(p.x - platform.x) < platform.width / 2 + .24;
    if (p.vy < 0 && oldY >= platform.y && p.y <= platform.y && aligned) {
      p.y = platform.y;
      p.vy = JUMP;
      if (platform.type === "shortbread") platform.broken = true;
      game.events.push({ type: "bounce", x: p.x, y: p.y, surface: platform.type });
      if (platform.cameo && !platform.used) {
        game.bonus += 50;
        game.events.push({ type: "cameo", x: p.x, y: p.y });
      }
      platform.used = true;
    }
    if (platform.pickup && Math.abs(p.x - platform.x) < .85 && Math.abs(p.y + .5 - (platform.y + 1)) < .8) {
      const type = platform.pickup;
      platform.pickup = null;
      if (type === "pipes") p.vy = 18;
      else { game.thistles++; game.bonus += 25; }
      game.events.push({ type, x: platform.x, y: platform.y + 1 });
    }
  }
  game.height = Math.max(game.height, p.y);
  game.cameraY = Math.max(game.cameraY, p.y + 1.2);
  generatePlatforms(game, game.cameraY + 16);
  game.platforms = game.platforms.filter(platform => platform.y > game.cameraY - 16);
  if (p.y < game.cameraY - 10) {
    game.over = true;
    game.events.push({ type: "over" });
  }
}

export function score(game) {
  return Math.floor(game.height * 10) + game.bonus;
}
