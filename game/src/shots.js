// SHADOWLINE — deterministic screenshot poses and the in-browser self-test.
// One file, one job: ?shot=1..4 freezes a readable pose; ?selftest=1 proves the
// real update loop behaves (detection, shadow, pickup, exit, catch).

import { TILE } from './config.js';
import { createGame, startGame, loadLevel, updateGame } from './game.js';
import { createAudio } from './audio.js';

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

// Freeze a pose for a screenshot. All poses render at a fixed game.time so the
// pulsing intel and sweeping cones are identical on every capture.
export function applyShot(game, n) {
  startGame(game);
  if (n === 1) {
    // Cover: Wren crouched in shadow behind a crate, a guard cone sweeping past.
    const p = tileCenter(5, 3);
    game.player.x = p.x; game.player.y = p.y;
    game.player.sneaking = true;
    game.player.facing = Math.PI / 2;
    const g = game.guards[0];
    const gp = tileCenter(11, 5);
    g.x = gp.x; g.y = gp.y; g.facing = Math.PI; g.state = 'patrol';
    const g2 = game.guards[1];
    const g2p = tileCenter(28, 8);
    g2.x = g2p.x; g2.y = g2p.y; g2.facing = -Math.PI / 2; g2.state = 'patrol';
    game.alertLevel = 0.12;
    game.time = 1.7;
  } else if (n === 2) {
    // Near miss: a guard in full chase, red cone on Wren, alert meter red.
    const p = tileCenter(11, 7);
    game.player.x = p.x; game.player.y = p.y;
    game.player.facing = -Math.PI / 2;
    game.player.running = true;
    game.player.moving = true;
    const g = game.guards[0];
    const gp = tileCenter(11, 5);
    g.x = gp.x; g.y = gp.y; g.facing = Math.PI / 2;
    g.state = 'chase'; g.suspicion = 1;
    g.target = { x: p.x, y: p.y };
    game.alertLevel = 1;
    game.levelAlarmed = true;
    game.time = 2.3;
  } else if (n === 3) {
    // Shadow play: floor 3, Wren inside a shadow tile, a camera cone sweeping.
    game.collectedKeys = new Set();
    loadLevel(game, 2);
    game.state = 'playing';
    const p = tileCenter(7, 1);
    game.player.x = p.x; game.player.y = p.y;
    game.player.sneaking = true;
    game.player.facing = Math.PI / 2;
    const cam = game.cameras[0];
    cam.angle = Math.atan2(p.y - cam.y, p.x - cam.x);
    cam.spotted = false;
    const g = game.guards[0];
    const gp = tileCenter(16, 2);
    g.x = gp.x; g.y = gp.y; g.facing = 0; g.state = 'patrol';
    game.alertLevel = 0.2;
    game.time = 3.1;
  } else {
    // Victory: the archive breached, score breakdown on screen.
    game.collectedKeys = new Set();
    loadLevel(game, 2);
    game.state = 'victory';
    game.score = 1850;
    game.best = 1850;
    game.player.intelCollected = 3;
    game.intel = [];
    const p = tileCenter(26, 15);
    game.player.x = p.x; game.player.y = p.y;
    game.breakdown = [
      'Intel cores  3 × 250',
      'Time bonus  +300',
      'Ghost bonus (never alarmed)  +500',
      'Total score  1850',
    ];
    game.overlay = {
      title: 'ARCHIVE BREACHED',
      lines: [...game.breakdown, '', 'Press ENTER to play again'],
      accent: '#39d353',
    };
    game.time = 4.2;
  }
}

// A minimal input stub: the self-test drives the real updateGame with it.
function stubInput() {
  return {
    moveVector: () => ({ x: 0, y: 0 }),
    sneaking: () => false,
    wasPressed: () => false,
    mouse: () => ({ x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 }),
    endFrame: () => {},
  };
}

function step(game, input, frames, dt = 1 / 60) {
  for (let i = 0; i < frames; i++) updateGame(game, input, dt);
}

// Scripted checks against the real update loop. Returns a results object.
export function runSelfTest() {
  const results = {};
  const audio = createAudio();
  const input = stubInput();

  // T0 — the game starts and 60 frames run without error.
  try {
    const g = createGame(audio);
    startGame(g);
    step(g, input, 60);
    results.starts_and_runs = g.state === 'playing';
  } catch (e) {
    results.starts_and_runs = false;
    results.starts_and_runs_error = String(e);
  }

  // T1 — detection rises while Wren stands in a guard's cone.
  try {
    const g = createGame(audio);
    startGame(g);
    const p = tileCenter(11, 7);
    g.player.x = p.x; g.player.y = p.y;
    step(g, input, 45);
    results.detection_rises_in_cone = g.guards[0].suspicion > 0.3;
    results.detection_value = +g.guards[0].suspicion.toFixed(3);
  } catch (e) {
    results.detection_rises_in_cone = false;
    results.detection_error = String(e);
  }

  // T2 — the same exposure in shadow grows suspicion much slower.
  try {
    const g = createGame(audio);
    startGame(g);
    const guard = g.guards[0];
    const gp = tileCenter(6, 3);
    guard.x = gp.x; guard.y = gp.y;
    guard.waypoints = [tileCenter(6, 3), tileCenter(6, 2)];
    guard.wpIndex = 1;
    const p = tileCenter(6, 1); // shadow tile, right ahead of the guard
    g.player.x = p.x; g.player.y = p.y;
    step(g, input, 45);
    results.shadow_slows_detection = g.guards[0].suspicion > 0.05 && g.guards[0].suspicion < 0.3;
    results.shadow_value = +g.guards[0].suspicion.toFixed(3);
  } catch (e) {
    results.shadow_slows_detection = false;
    results.shadow_error = String(e);
  }

  // T3 — walking onto an intel core collects it.
  try {
    const g = createGame(audio);
    startGame(g);
    const it = g.intel[0];
    const p = tileCenter(it.x, it.y);
    g.player.x = p.x; g.player.y = p.y;
    step(g, input, 5);
    results.intel_pickup = g.player.intelCollected === 1 && g.score === 250;
  } catch (e) {
    results.intel_pickup = false;
    results.intel_error = String(e);
  }

  // T4 — all intel + exit wins the floor.
  try {
    const g = createGame(audio);
    startGame(g);
    for (const it of [...g.parsed.intel]) {
      const p = tileCenter(it.x, it.y);
      g.player.x = p.x; g.player.y = p.y;
      step(g, input, 5);
    }
    const ex = g.parsed.exit;
    const p = tileCenter(ex.x, ex.y);
    g.player.x = p.x; g.player.y = p.y;
    step(g, input, 5);
    results.exit_wins_floor = g.state === 'levelComplete' && g.score >= 750;
    results.exit_score = g.score;
  } catch (e) {
    results.exit_wins_floor = false;
    results.exit_error = String(e);
  }

  // T5 — a guard catching Wren costs a life and respawns the floor.
  try {
    const g = createGame(audio);
    startGame(g);
    const guard = g.guards[0];
    guard.state = 'chase';
    guard.suspicion = 1;
    guard.target = { x: g.player.x, y: g.player.y };
    let caught = false;
    for (let i = 0; i < 300 && !caught; i++) {
      updateGame(g, input, 1 / 60);
      if (g.lives === 2) caught = true;
    }
    results.catch_costs_life = caught && g.state === 'playing' && g.lives === 2;
  } catch (e) {
    results.catch_costs_life = false;
    results.catch_error = String(e);
  }

  results.all_pass = [
    results.starts_and_runs,
    results.detection_rises_in_cone,
    results.shadow_slows_detection,
    results.intel_pickup,
    results.exit_wins_floor,
    results.catch_costs_life,
  ].every(Boolean);
  return results;
}
