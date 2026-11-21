// SHADOWLINE — canvas drawing.
// One file, one job: floor, walls, crates, cones, characters and the HUD.

import {
  TILE, COLS, ROWS, VIEW_W, VIEW_H, PLAYER_RADIUS, GUARD_RADIUS,
  VISION_RANGE, VISION_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE,
  COLOURS, NOISE_RUN_RADIUS, LURE_HEAR_RADIUS,
} from './config.js';

function conePath(ctx, x, y, facing, range, halfAngle) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
}

export function drawWorld(ctx, game) {
  const { level, parsed, player, guards, cameras } = game;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  // Floor: two-tone checker + shadow tiles.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = level.map[y][x];
      if (ch === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? COLOURS.floorA : COLOURS.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (ch === 'S') {
        ctx.fillStyle = COLOURS.shadow;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.strokeStyle = COLOURS.shadowHatch;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x * TILE + 6, y * TILE + TILE - 6);
        ctx.lineTo(x * TILE + TILE - 6, y * TILE + 6);
        ctx.moveTo(x * TILE + 14, y * TILE + TILE - 6);
        ctx.lineTo(x * TILE + TILE - 6, y * TILE + 14);
        ctx.stroke();
      }
    }
  }

  // Intel cores (pulsing diamonds).
  const t = game.time;
  for (const it of game.intel) {
    const cx = (it.x + 0.5) * TILE, cy = (it.y + 0.5) * TILE;
    const pulse = 1 + 0.12 * Math.sin(t * 4 + it.x);
    ctx.fillStyle = COLOURS.intelGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 20 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.intel;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4 + Math.sin(t * 2 + it.y) * 0.15);
    const s = 9 * pulse;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }

  // Exit: closed hatch, or an open glowing doorway.
  const ex = parsed.exit;
  const exX = ex.x * TILE, exY = ex.y * TILE;
  const open = game.intel.length === 0;
  ctx.fillStyle = open ? COLOURS.exitOpen : COLOURS.exitClosed;
  ctx.fillRect(exX + 3, exY + 3, TILE - 6, TILE - 6);
  if (open) {
    ctx.fillStyle = COLOURS.exitGlow;
    ctx.fillRect(exX - 6, exY - 6, TILE + 12, TILE + 12);
    ctx.fillStyle = '#0d1117';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', exX + TILE / 2, exY + TILE / 2);
  } else {
    ctx.strokeStyle = '#9aa7b4';
    ctx.lineWidth = 2;
    ctx.strokeRect(exX + 9, exY + 9, TILE - 18, TILE - 18);
    ctx.fillStyle = '#9aa7b4';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${game.intel.length}`, exX + TILE / 2, exY + TILE / 2);
  }

  // Vision cones (under characters, over floor).
  for (const g of guards) drawGuardCone(ctx, g);
  for (const c of cameras) drawCameraCone(ctx, c);

  // Walls and crates.
  for (const w of parsed.walls) {
    ctx.fillStyle = COLOURS.wall;
    ctx.fillRect(w.x * TILE, w.y * TILE, TILE, TILE);
    ctx.fillStyle = COLOURS.wallTop;
    ctx.fillRect(w.x * TILE, w.y * TILE, TILE, 5);
  }
  for (const c of parsed.crates) {
    const x = c.x * TILE, y = c.y * TILE;
    ctx.fillStyle = COLOURS.crate;
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = COLOURS.crateTop;
    ctx.fillRect(x + 3, y + 3, TILE - 6, 6);
    ctx.strokeStyle = COLOURS.crateEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + TILE - 3, y + TILE - 3);
    ctx.stroke();
  }

  // Lure coins on the floor.
  for (const coin of player.coins) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,77,0.5)';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, LURE_HEAR_RADIUS * (0.25 + 0.1 * Math.sin(t * 5)), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cameras (wall mounts).
  for (const c of cameras) {
    ctx.fillStyle = '#7fa8e0';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dfe9ff';
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(c.angle) * 6, c.y + Math.sin(c.angle) * 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Guards.
  for (const g of guards) {
    ctx.fillStyle = g.state === 'chase' ? COLOURS.guard : COLOURS.guardDark;
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUARD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2b8b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.facing) * (GUARD_RADIUS + 7), g.y + Math.sin(g.facing) * (GUARD_RADIUS + 7));
    ctx.stroke();
    // Suspicion arc above the head.
    if (g.suspicion > 0.05) {
      ctx.strokeStyle = g.suspicion >= 1 ? '#ff5a5a' : COLOURS.alertLow;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.x, g.y, GUARD_RADIUS + 7, -Math.PI / 2, -Math.PI / 2 + g.suspicion * Math.PI * 2);
      ctx.stroke();
    }
    if (g.state === 'chase' || g.state === 'suspicious') {
      ctx.fillStyle = g.state === 'chase' ? '#ff5a5a' : COLOURS.alertLow;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(g.state === 'chase' ? '!' : '?', g.x, g.y - GUARD_RADIUS - 12);
    }
  }

  // Wren.
  const p = player;
  ctx.fillStyle = COLOURS.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOURS.playerDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.facing) * (PLAYER_RADIUS + 6), p.y + Math.sin(p.facing) * (PLAYER_RADIUS + 6));
  ctx.stroke();
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(232,197,71,0.6)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Running noise ring.
  if (p.running && p.moving) {
    ctx.strokeStyle = 'rgba(232,236,241,0.25)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, NOISE_RUN_RADIUS * (0.55 + 0.1 * Math.sin(t * 8)), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGuardCone(ctx, g) {
  const alert = g.state === 'chase' || g.state === 'investigate';
  ctx.fillStyle = g.state === 'chase' ? COLOURS.coneAlert : COLOURS.coneCalm;
  conePath(ctx, g.x, g.y, g.facing, VISION_RANGE, VISION_HALF_ANGLE);
  ctx.fill();
  if (alert) {
    ctx.strokeStyle = 'rgba(214,69,69,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawCameraCone(ctx, c) {
  ctx.fillStyle = c.spotted ? COLOURS.coneCameraAlert : COLOURS.coneCamera;
  conePath(ctx, c.x, c.y, c.angle, CAMERA_RANGE, CAMERA_HALF_ANGLE);
  ctx.fill();
}

export function drawHud(ctx, game) {
  const { player, levelIndex, score, lives, time } = game;
  ctx.fillStyle = COLOURS.hudBg;
  ctx.fillRect(0, 0, VIEW_W, 52);
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SHADOWLINE  ·  ${game.level.name}`, 14, 18);
  ctx.font = '15px monospace';
  ctx.fillStyle = COLOURS.textDim;
  ctx.fillText(`FLOOR ${levelIndex + 1}/3   INTEL ${player.intelCollected}/3   LIVES ${'●'.repeat(lives)}${'○'.repeat(Math.max(0, 3 - lives))}   LURES ${player.lures}   SCORE ${score}`, 14, 40);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLOURS.textDim;
  ctx.fillText(`TIME ${Math.floor(time)}s   BEST ${game.best}`, VIEW_W - 14, 18);
  ctx.fillText(game.muted ? 'MUTED (M)' : 'M mute · P pause · SHIFT sneak · CLICK lure', VIEW_W - 14, 40);

  // Alert meter (bottom centre): the highest guard suspicion. Kept off the
  // playfield's top row so it never covers intel or the player up there.
  const alert = game.alertLevel;
  const bw = 260, bx = (VIEW_W - bw) / 2, by = VIEW_H - 30;
  ctx.fillStyle = 'rgba(10,13,18,0.8)';
  ctx.fillRect(bx - 8, by - 4, bw + 16, 22);
  ctx.fillStyle = '#20262e';
  ctx.fillRect(bx, by, bw, 14);
  ctx.fillStyle = alert >= 1 ? COLOURS.alertHigh : alert >= 0.35 ? COLOURS.alertLow : '#5a7a5a';
  ctx.fillRect(bx, by, bw * Math.min(1, alert), 14);
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(alert >= 1 ? 'ALARM — RUN!' : alert >= 0.35 ? 'SUSPICIOUS' : 'UNSEEN', VIEW_W / 2, by + 7);
}

export function drawOverlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,10,14,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = accent || COLOURS.text;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 90);
  ctx.fillStyle = COLOURS.text;
  ctx.font = '18px monospace';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 - 30 + i * 30));
}
