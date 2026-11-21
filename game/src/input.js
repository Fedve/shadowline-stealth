// SHADOWLINE — keyboard and mouse state.
// One file, one job: turn raw DOM events into a clean per-frame input snapshot.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since last poll (edge-triggered)
  const mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0, down: false };

  const keyName = (e) => {
    const k = e.key.toLowerCase();
    return k === ' ' ? 'space' : k;
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = keyName(e);
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 1280;
    mouse.y = ((e.clientY - r.top) / r.height) * 720;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.down = true;
    mouse.clickX = ((e.clientX - r.left) / r.width) * 1280;
    mouse.clickY = ((e.clientY - r.top) / r.height) * 720;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    // Held keys.
    down: (k) => keys.has(k),
    // Movement vector from WASD / arrows, normalised.
    moveVector() {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    sneaking: () => keys.has('shift'),
    // True once for the frame the key went down; call after the game reads it.
    wasPressed(k) { return pressed.has(k); },
    mouse: () => mouse,
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
