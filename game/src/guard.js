// SHADOWLINE — guard AI.
// One file, one job: the patrol / suspicious / investigate / chase state machine.

import {
  TILE, GUARD_PATROL_SPEED, GUARD_CHASE_SPEED, GUARD_INVESTIGATE_SPEED,
  SUSPICION_INVESTIGATE, SUSPICION_CHASE, SUSPICION_DECAY,
  VISION_RANGE, CATCH_RADIUS,
} from './config.js';
import { guardSeesPlayer, inShadow } from './vision.js';
import { isSolid } from './levels.js';

export function createGuard(def) {
  const w0 = def.waypoints[0];
  return {
    x: (w0.tx + 0.5) * TILE,
    y: (w0.ty + 0.5) * TILE,
    waypoints: def.waypoints.map((w) => ({ x: (w.tx + 0.5) * TILE, y: (w.ty + 0.5) * TILE })),
    wpIndex: 1,
    facing: 0,
    state: 'patrol', // patrol | suspicious | investigate | chase
    suspicion: 0,
    target: null, // {x, y} being investigated / chased
    lookTimer: 0, // pause at a waypoint / look-around timer
    stuckTimer: 0,
    path: null, // BFS tile path (pixel centres) toward the current target
    pathTimer: 0,
    pathTarget: null,
  };
}

// Breadth-first tile path from (sx, sy) to (tx, ty); pixel centres, start excluded.
export function findPath(level, sx, sy, tx, ty) {
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [{ x: sx, y: sy }];
  prev.set(key(sx, sy), null);
  while (queue.length) {
    const c = queue.shift();
    if (c.x === tx && c.y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (isSolid(level, nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), c);
      queue.push({ x: nx, y: ny });
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  let c = { x: tx, y: ty };
  while (c && !(c.x === sx && c.y === sy)) {
    path.unshift({ x: (c.x + 0.5) * TILE, y: (c.y + 0.5) * TILE });
    c = prev.get(key(c.x, c.y));
  }
  return path;
}

// How fast suspicion grows while the guard sees Wren.
export function suspicionRate(dist, sneaking, shadowed) {
  let rate = 0.9 - (dist / VISION_RANGE) * 0.55; // closer = faster
  if (sneaking) rate *= 0.45;
  if (shadowed) rate *= 0.35;
  return Math.max(0.12, rate);
}

// Follow a BFS path toward (tx, ty), re-planning when the target tile moves or
// the plan gets stale. Falls back to a straight step when no path exists.
function followPath(guard, level, tx, ty, speed, dt) {
  const ttx = Math.floor(tx / TILE), tty = Math.floor(ty / TILE);
  const gtx = Math.floor(guard.x / TILE), gty = Math.floor(guard.y / TILE);
  guard.pathTimer -= dt;
  if (!guard.path || guard.pathTimer <= 0 || guard.pathTarget !== `${ttx},${tty}`) {
    guard.path = findPath(level, gtx, gty, ttx, tty);
    guard.pathTimer = 0.5;
    guard.pathTarget = `${ttx},${tty}`;
  }
  if (guard.path === null) return true; // target unreachable: look around here
  if (guard.path.length === 0) {
    return stepToward(guard, level, tx, ty, speed, dt);
  }
  const node = guard.path[0];
  if (stepToward(guard, level, node.x, node.y, speed, dt)) guard.path.shift();
  return guard.path.length === 0;
}

function stepToward(guard, level, tx, ty, speed, dt) {
  const dx = tx - guard.x, dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const nx = guard.x + (dx / d) * speed * dt;
  const ny = guard.y + (dy / d) * speed * dt;
  if (!isSolid(level, Math.floor(nx / TILE), Math.floor(ny / TILE))) {
    guard.x = nx; guard.y = ny;
  } else if (!isSolid(level, Math.floor(nx / TILE), Math.floor(guard.y / TILE))) {
    guard.x = nx;
  } else if (!isSolid(level, Math.floor(guard.x / TILE), Math.floor(ny / TILE))) {
    guard.y = ny;
  } else {
    guard.stuckTimer += dt;
  }
  guard.facing = Math.atan2(dy, dx);
  return d < speed * dt + 2;
}

export function updateGuard(guard, level, player, shadows, dt, events) {
  const sees = guardSeesPlayer(level, guard, player.x, player.y);
  const shadowed = inShadow(shadows, player.x, player.y);
  if (sees) {
    guard.suspicion = Math.min(1, guard.suspicion + suspicionRate(Math.hypot(player.x - guard.x, player.y - guard.y), player.sneaking, shadowed) * dt);
    guard.target = { x: player.x, y: player.y };
    if (guard.suspicion >= SUSPICION_CHASE && guard.state !== 'chase') {
      guard.state = 'chase';
      events.push({ type: 'alarm', guard });
    } else if (guard.suspicion >= SUSPICION_INVESTIGATE && guard.state === 'patrol') {
      guard.state = 'suspicious';
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY * dt);
    if (guard.state === 'chase' && guard.suspicion <= 0.05) {
      guard.state = 'investigate'; // lost sight: check the last known spot
    }
  }

  if (guard.state === 'patrol') {
    if (guard.lookTimer > 0) {
      guard.lookTimer -= dt;
      guard.facing += dt * 1.2; // look around at the waypoint
    } else {
      const wp = guard.waypoints[guard.wpIndex];
      if (stepToward(guard, level, wp.x, wp.y, GUARD_PATROL_SPEED, dt)) {
        guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
        guard.lookTimer = 0.9;
      }
    }
  } else if (guard.state === 'suspicious') {
    // Hesitate, turn toward the glimpse, then go look.
    guard.facing = Math.atan2((guard.target?.y ?? guard.y) - guard.y, (guard.target?.x ?? guard.x) - guard.x);
    guard.state = 'investigate';
  } else if (guard.state === 'investigate') {
    if (guard.target) {
      if (followPath(guard, level, guard.target.x, guard.target.y, GUARD_INVESTIGATE_SPEED, dt)) {
        guard.lookTimer += dt;
        guard.facing += dt * 2.2;
        if (guard.lookTimer > 2.4) {
          guard.lookTimer = 0;
          guard.state = 'patrol';
          guard.target = null;
          guard.path = null;
        }
      }
    } else {
      guard.state = 'patrol';
    }
  } else if (guard.state === 'chase') {
    if (guard.target) {
      guard.target = { x: player.x, y: player.y };
      followPath(guard, level, player.x, player.y, GUARD_CHASE_SPEED, dt);
    }
  }

  // Caught?
  if (Math.hypot(player.x - guard.x, player.y - guard.y) < CATCH_RADIUS) {
    events.push({ type: 'caught', guard });
  }
}

// A noise (running feet, a lure coin) pulls nearby patrolling guards to look.
export function hearNoise(guard, x, y, radius) {
  if (guard.state === 'chase') return;
  if (Math.hypot(guard.x - x, guard.y - y) > radius) return;
  guard.target = { x, y };
  guard.state = 'investigate';
  guard.lookTimer = 0;
  guard.suspicion = Math.max(guard.suspicion, SUSPICION_INVESTIGATE);
}
