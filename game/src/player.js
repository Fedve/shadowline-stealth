// SHADOWLINE — Wren, the infiltrator.
// One file, one job: movement, sneak vs run noise, lure-coin throws, pickups.

import {
  TILE, PLAYER_RADIUS, PLAYER_RUN_SPEED, PLAYER_SNEAK_SPEED,
  LURE_RANGE, LURE_PER_LEVEL, SCORE_INTEL,
} from './config.js';
import { isSolid } from './levels.js';

export function createPlayer(start) {
  return {
    x: (start.x + 0.5) * TILE,
    y: (start.y + 0.5) * TILE,
    facing: 0,
    moving: false,
    sneaking: false,
    running: false,
    lures: LURE_PER_LEVEL,
    intelCollected: 0,
    coins: [], // thrown lure coins {x, y, ttl}
  };
}

// Move with axis-separated collision so Wren slides along walls.
export function movePlayer(player, level, dx, dy, dt) {
  const nx = player.x + dx * dt;
  if (!hitsWall(level, nx, player.y, PLAYER_RADIUS)) player.x = nx;
  const ny = player.y + dy * dt;
  if (!hitsWall(level, player.x, ny, PLAYER_RADIUS)) player.y = ny;
  player.x = Math.max(PLAYER_RADIUS, Math.min(32 * TILE - PLAYER_RADIUS, player.x));
  player.y = Math.max(PLAYER_RADIUS, Math.min(18 * TILE - PLAYER_RADIUS, player.y));
}

function hitsWall(level, x, y, r) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(level, tx, ty)) {
        // Circle-vs-tile test: only a real overlap counts.
        const cx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
        const cy = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
      }
    }
  }
  return false;
}

// One frame of player logic. Returns events the game loop reacts to.
export function updatePlayer(player, level, input, dt, audio) {
  const v = input.moveVector();
  player.sneaking = input.sneaking();
  player.moving = v.x !== 0 || v.y !== 0;
  player.running = player.moving && !player.sneaking;
  const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_RUN_SPEED;
  if (player.moving) {
    player.facing = Math.atan2(v.y, v.x);
    movePlayer(player, level, v.x * speed, v.y * speed, dt);
    audio.footstep(player.running, dt);
  }
  // Click: throw a lure coin toward the mouse (limited range).
  const m = input.mouse();
  if (m.clicked && player.lures > 0) {
    const dx = m.clickX - player.x, dy = m.clickY - player.y;
    const d = Math.hypot(dx, dy);
    const range = Math.min(d, LURE_RANGE);
    const tx = player.x + (d === 0 ? 0 : (dx / d) * range);
    const ty = player.y + (d === 0 ? 0 : (dy / d) * range);
    player.coins.push({ x: tx, y: ty, ttl: 6 });
    player.lures -= 1;
    audio.ping();
    return { lure: { x: tx, y: ty } };
  }
  for (const c of player.coins) c.ttl -= dt;
  player.coins = player.coins.filter((c) => c.ttl > 0);
  return null;
}

// Intel pickup: returns the intel tile collected, or null.
export function tryPickupIntel(player, intel) {
  for (let i = 0; i < intel.length; i++) {
    const it = intel[i];
    const cx = (it.x + 0.5) * TILE, cy = (it.y + 0.5) * TILE;
    if (Math.hypot(player.x - cx, player.y - cy) < 30) {
      intel.splice(i, 1);
      player.intelCollected += 1;
      return it;
    }
  }
  return null;
}

export { SCORE_INTEL };
