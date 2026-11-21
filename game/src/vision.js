// SHADOWLINE — line of sight, vision cones and shadow tiles.
// One file, one job: answer "can this watcher see that point?" for guards and cameras.

import { VISION_RANGE, VISION_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE, TILE } from './config.js';
import { blocksSight } from './levels.js';

// Bresenham walk over the tiles between two points; false if a wall/crate blocks.
export function hasLineOfSight(level, x0, y0, x1, y1) {
  let tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE);
  const tx1 = Math.floor(x1 / TILE), ty1 = Math.floor(y1 / TILE);
  const dx = Math.abs(tx1 - tx0), dy = Math.abs(ty1 - ty0);
  const sx = tx0 < tx1 ? 1 : -1, sy = ty0 < ty1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (!(tx0 === Math.floor(x0 / TILE) && ty0 === Math.floor(y0 / TILE)) &&
        !(tx0 === tx1 && ty0 === ty1) && blocksSight(level, tx0, ty0)) return false;
    if (tx0 === tx1 && ty0 === ty1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; tx0 += sx; }
    if (e2 < dx) { err += dx; ty0 += sy; }
  }
}

// Smallest absolute angle between two headings, 0..PI.
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

// Is the point inside the watcher's cone (range + half-angle) with clear sight?
export function inVisionCone(level, wx, wy, facing, px, py, range, halfAngle) {
  const dx = px - wx, dy = py - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  if (angleDiff(Math.atan2(dy, dx), facing) > halfAngle) return false;
  return hasLineOfSight(level, wx, wy, px, py);
}

export function guardSeesPlayer(level, guard, px, py) {
  return inVisionCone(level, guard.x, guard.y, guard.facing, px, py, VISION_RANGE, VISION_HALF_ANGLE);
}

export function cameraSeesPlayer(level, camera, px, py) {
  return inVisionCone(level, camera.x, camera.y, camera.angle, px, py, CAMERA_RANGE, CAMERA_HALF_ANGLE);
}

// Is the player standing on a shadow tile?
export function inShadow(shadows, px, py) {
  return shadows.has(`${Math.floor(px / TILE)},${Math.floor(py / TILE)}`);
}
