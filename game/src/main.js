// SHADOWLINE — bootstrap and frame loop.
// One file, one job: wire canvas, input, audio and game together; serve the
// frozen ?shot=N poses and the ?selftest=1 checks without starting the loop.

import { VIEW_W, VIEW_H } from './config.js';
import { createGame, updateGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawWorld, drawHud, drawOverlay } from './render.js';
import { applyShot, runSelfTest } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const audio = createAudio();
const game = createGame(audio);
const input = createInput(canvas);
window.__shadowline = game; // handy for a human play-test in devtools

function render() {
  drawWorld(ctx, game);
  drawHud(ctx, game);
  if (game.state === 'title') {
    drawOverlay(ctx, 'SHADOWLINE', [
      'The Meridian Archive — steal 3 intel cores per floor, reach the EXIT unseen.',
      '',
      'WASD / arrows — move      SHIFT — sneak (quiet, harder to spot)',
      'CLICK — throw a lure coin      P — pause      M — mute      R — restart floor',
      'Guards patrol with vision cones. Shadow tiles hide you. Cameras sweep floors 2–3.',
      '',
      'Press ENTER or CLICK to begin',
    ], '#e8c547');
  } else if (game.overlay) {
    drawOverlay(ctx, game.overlay.title, game.overlay.lines, game.overlay.accent);
  }
}

// Frozen screenshot pose: render once, no loop, no timers.
if (params.has('shot')) {
  const n = Math.max(1, Math.min(4, Number(params.get('shot')) || 1));
  applyShot(game, n);
  render();
} else if (params.has('selftest')) {
  // Run the scripted checks, publish the results for the harness to read.
  const results = runSelfTest();
  const el = document.getElementById('selftest-results');
  el.textContent = JSON.stringify(results);
  document.title = `SELFTEST ${results.all_pass ? 'PASS' : 'FAIL'}`;
  render();
} else {
  // The live game.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateGame(game, input, dt);
    render();
    input.endFrame();
    requestAnimationFrame(frame);
  }
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  requestAnimationFrame(frame);
}
