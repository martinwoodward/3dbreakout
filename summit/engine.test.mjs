import test from "node:test";
import assert from "node:assert/strict";
import { createGame, stepGame, score, STEP, GRAVITY, JUMP, SPEED, LIMIT } from "./engine.mjs";

test("seeded levels are repeatable and every gap is within a normal jump", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const game = createGame(seed);
    assert.deepEqual(game.platforms, createGame(seed).platforms);
    for (let i = 1; i < game.platforms.length; i++) {
      const a = game.platforms[i - 1], b = game.platforms[i];
      const gap = b.y - a.y;
      assert.ok(gap < JUMP * JUMP / (2 * GRAVITY));
      const flight = (JUMP + Math.sqrt(JUMP * JUMP - 2 * GRAVITY * gap)) / GRAVITY;
      assert.ok(Math.abs(b.baseX - a.baseX) + 1.2 < SPEED * (flight - .15));
    }
  }
});
test("landing bounces only when descending and shortbread breaks once", () => {
  const game = createGame(1);
  game.platforms = [{ id: 1, x: 0, y: 1, width: 3, type: "shortbread", pickup: null }];
  game.player = { x: 0, y: 1.02, vy: -5, vx: 0 };
  stepGame(game, 0);
  assert.equal(game.player.y, 1);
  assert.equal(game.player.vy, JUMP);
  assert.equal(game.platforms[0].broken, true);
  assert.equal(game.events.filter(e => e.type === "bounce").length, 1);
  game.player.y = .99;
  game.player.vy = 5;
  stepGame(game, 0);
  assert.ok(game.player.vy < 5);
});
test("thistles score once and bagpipes boost", () => {
  const game = createGame(2);
  game.platforms = [{ id: 1, x: 0, y: 0, width: 3, type: "grass", pickup: "thistle" }];
  game.player.y = .5;
  stepGame(game, 0);
  assert.equal(game.bonus, 25);
  assert.equal(game.thistles, 1);
  stepGame(game, 0);
  assert.equal(game.bonus, 25);
  game.platforms[0].pickup = "pipes";
  stepGame(game, 0);
  assert.equal(game.player.vy, 18);
});
test("cameo bonus is awarded once", () => {
  const game = createGame(2);
  game.platforms = [{ id: 1, x: 0, y: 1, width: 3, type: "grass", cameo: true }];
  for (let i = 0; i < 2; i++) {
    game.player = { x: 0, y: 1.02, vy: -5, vx: 0 };
    stepGame(game, 0);
  }
  assert.equal(game.bonus, 50);
});
test("falling ends a run; restart resets height, collectibles and score", () => {
  const game = createGame(3);
  game.player.y = -10;
  stepGame(game, 0);
  assert.equal(game.over, true);
  const time = game.time;
  stepGame(game, 1);
  assert.equal(game.time, time);
  const fresh = createGame(3);
  assert.equal(fresh.over, false);
  assert.equal(score(fresh), 0);
  assert.equal(fresh.thistles, 0);
});
test("horizontal input is clamped at world edges", () => {
  const game = createGame(4);
  game.player.x = LIMIT - .001;
  game.player.vx = SPEED;
  stepGame(game, 50);
  assert.equal(game.player.x, LIMIT);
});
test("an automatic steering player can climb generated levels with bounded memory", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const game = createGame(seed);
    for (let frame = 0; frame < 120 * 90 && !game.over; frame++) {
      const available = game.platforms.filter(p => !p.broken && p.y > game.player.y - .1 && p.y < game.player.y + game.player.vy ** 2 / (2 * GRAVITY) + .1);
      const next = game.player.vy > 0 ? available.find(p => p.y > game.player.y + .3) : game.platforms.filter(p => !p.broken && p.y <= game.player.y).at(-1);
      const direction = next ? Math.max(-1, Math.min(1, (next.x - game.player.x) * 3)) : 0;
      stepGame(game, direction, STEP);
      game.events.length = 0;
      assert.ok(game.platforms.length < 35);
      if (game.height > 35) break;
    }
    assert.ok(game.height > 10, `seed ${seed} reached ${game.height}`);
  }
});
