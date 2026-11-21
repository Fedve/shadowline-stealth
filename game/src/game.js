// SHADOWLINE — the game itself.
// One file, one job: state machine, alert meter, score, win/lose, respawn.

import { LEVELS, parseLevel } from './levels.js';
import { createPlayer, updatePlayer, tryPickupIntel } from './player.js';
import { createGuard, updateGuard, hearNoise } from './guard.js';
import { cameraSeesPlayer } from './vision.js';
import {
  TILE, NOISE_RUN_RADIUS, LURE_HEAR_RADIUS, LIVES_START,
  SCORE_INTEL, SCORE_GHOST, SCORE_TIME_BONUS_MAX,
} from './config.js';

export function createGame(audio) {
  const game = {
    state: 'title', // title | playing | paused | levelComplete | victory | gameover
    levelIndex: 0,
    level: LEVELS[0],
    parsed: parseLevel(LEVELS[0]),
    player: null,
    guards: [],
    cameras: [],
    intel: [],
    score: 0,
    lives: LIVES_START,
    time: 0,
    levelTime: 0,
    alertLevel: 0,
    levelAlarmed: false,
    best: 0,
    muted: false,
    collectedKeys: new Set(), // "x,y" of intel cores already taken on this floor
    overlay: null, // {title, lines, accent} drawn over the world
    breakdown: [],
    noiseTimer: 0,
    stateTimer: 0,
    audio,
  };
  try {
    game.best = Number(window.localStorage.getItem('shadowline-best') || 0) || 0;
  } catch { game.best = 0; }
  loadLevel(game, 0);
  return game;
}

export function loadLevel(game, index) {
  game.levelIndex = index;
  game.level = LEVELS[index];
  game.parsed = parseLevel(game.level);
  game.player = createPlayer(game.parsed.playerStart);
  game.guards = game.level.guards.map(createGuard);
  game.cameras = game.level.cameras.map((c) => ({
    x: (c.tx + 0.5) * TILE,
    y: (c.ty + 0.5) * TILE,
    base: c.base,
    arc: c.arc,
    speed: c.speed,
    angle: c.base,
    spotted: false,
    cooldown: 0,
  }));
  game.intel = game.parsed.intel.map((i) => ({ ...i }));
  game.levelTime = 0;
  game.levelAlarmed = false;
  game.alertLevel = 0;
  game.noiseTimer = 0;
}

export function startGame(game) {
  game.score = 0;
  game.lives = LIVES_START;
  game.collectedKeys = new Set();
  loadLevel(game, 0);
  game.state = 'playing';
  game.overlay = null;
  game.audio.startAmbience();
}

function respawn(game) {
  // Respawn at the floor start, guards reset; intel already taken stays taken.
  loadLevel(game, game.levelIndex);
  game.player.intelCollected = game.collectedKeys.size;
  game.intel = game.parsed.intel.filter((it) => !game.collectedKeys.has(`${it.x},${it.y}`));
  game.state = 'playing';
  game.overlay = null;
}

function saveBest(game) {
  if (game.score > game.best) {
    game.best = game.score;
    try { window.localStorage.setItem('shadowline-best', String(game.best)); } catch { /* private mode */ }
  }
}

export function updateGame(game, input, dt) {
  // Global keys, in any state.
  if (input.wasPressed('m')) game.muted = game.audio.toggleMute();
  if (game.state === 'title') {
    if (input.wasPressed('enter') || input.wasPressed(' ') || input.mouse().clicked) startGame(game);
    return;
  }
  if (game.state === 'gameover' || game.state === 'victory') {
    if (input.wasPressed('enter') || input.wasPressed('r') || input.mouse().clicked) {
      game.state = 'title';
      loadLevel(game, 0);
      game.overlay = null;
    }
    return;
  }
  if (game.state === 'levelComplete') {
    game.stateTimer -= dt;
    if (game.stateTimer <= 0) {
      if (game.levelIndex + 1 >= LEVELS.length) {
        game.state = 'victory';
        saveBest(game);
        game.audio.win();
      } else {
        game.collectedKeys = new Set();
        loadLevel(game, game.levelIndex + 1);
        game.state = 'playing';
        game.overlay = null;
      }
    }
    return;
  }
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    game.state = game.state === 'paused' ? 'playing' : 'paused';
    game.overlay = game.state === 'paused'
      ? { title: 'PAUSED', lines: ['P / Esc to resume', 'M mute · R restart floor', 'WASD move · SHIFT sneak · CLICK throw a lure coin'], accent: '#e8c547' }
      : null;
    return;
  }
  if (game.state === 'paused') return;
  if (input.wasPressed('r')) { respawn(game); return; }

  game.time += dt;
  game.levelTime += dt;
  const events = [];

  // Player.
  const lureEvent = updatePlayer(game.player, game.level, input, dt, game.audio);
  if (lureEvent) {
    for (const g of game.guards) hearNoise(g, lureEvent.lure.x, lureEvent.lure.y, LURE_HEAR_RADIUS);
  }
  // Running feet are loud: a pulse of noise every half second.
  if (game.player.running && game.player.moving) {
    game.noiseTimer += dt;
    if (game.noiseTimer > 0.45) {
      game.noiseTimer = 0;
      for (const g of game.guards) hearNoise(g, game.player.x, game.player.y, NOISE_RUN_RADIUS);
    }
  }

  // Cameras sweep; a spot raises the global alarm.
  for (const c of game.cameras) {
    c.angle = c.base + Math.sin(game.time * c.speed) * (c.arc / 2);
    c.cooldown = Math.max(0, c.cooldown - dt);
    const sees = cameraSeesPlayer(game.level, c, game.player.x, game.player.y);
    c.spotted = sees;
    if (sees && c.cooldown === 0) {
      c.cooldown = 3;
      game.levelAlarmed = true;
      game.alertLevel = 1;
      game.audio.cameraAlarm();
      for (const g of game.guards) hearNoise(g, game.player.x, game.player.y, 10000);
    }
  }

  // Guards.
  for (const g of game.guards) updateGuard(g, game.level, game.player, game.parsed.shadows, dt, events);
  for (const e of events) {
    if (e.type === 'alarm') {
      game.levelAlarmed = true;
      game.audio.alert();
    }
    if (e.type === 'caught') return onCaught(game);
  }

  // Alert meter: the worst suspicion on the floor (or 1 while a camera spots you).
  game.alertLevel = Math.max(0, ...game.guards.map((g) => g.suspicion));
  if (game.cameras.some((c) => c.spotted)) game.alertLevel = Math.max(game.alertLevel, 0.85);

  // Intel pickup.
  const picked = tryPickupIntel(game.player, game.intel);
  if (picked) {
    game.collectedKeys.add(`${picked.x},${picked.y}`);
    game.score += SCORE_INTEL;
    game.audio.pickup();
    if (game.intel.length === 0) game.audio.exitOpen();
  }

  // Exit.
  if (game.intel.length === 0) {
    const ex = game.parsed.exit;
    const cx = (ex.x + 0.5) * TILE, cy = (ex.y + 0.5) * TILE;
    if (Math.hypot(game.player.x - cx, game.player.y - cy) < 30) onLevelComplete(game);
  }
}

function onCaught(game) {
  game.audio.caught();
  game.lives -= 1;
  if (game.lives <= 0) {
    game.state = 'gameover';
    saveBest(game);
    game.audio.lose();
    game.overlay = {
      title: 'CAUGHT',
      lines: [`The Meridian Archive keeps its secrets.`, `Score ${game.score}  ·  Best ${Math.max(game.best, game.score)}`, 'Press ENTER to try again'],
      accent: '#d64545',
    };
    return;
  }
  respawn(game);
  game.state = 'playing';
  game.overlay = null;
}

function onLevelComplete(game) {
  const timeBonus = Math.max(0, SCORE_TIME_BONUS_MAX - Math.floor(game.levelTime) * 2);
  const ghost = game.levelAlarmed ? 0 : SCORE_GHOST;
  game.score += timeBonus + ghost;
  game.breakdown = [
    `Intel cores  ${game.player.intelCollected} × ${SCORE_INTEL}`,
    `Time bonus  +${timeBonus}`,
    ghost > 0 ? `Ghost bonus (never alarmed)  +${SCORE_GHOST}` : 'Ghost bonus  +0  (the alarm was raised)',
    `Total score  ${game.score}`,
  ];
  game.state = 'levelComplete';
  game.stateTimer = 2.2;
  game.overlay = {
    title: game.levelIndex + 1 >= LEVELS.length ? 'ARCHIVE BREACHED' : 'FLOOR CLEAR',
    lines: game.breakdown,
    accent: '#39d353',
  };
}
