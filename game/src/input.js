// Keyboard and mouse, read as the game needs them: a held-keys set for movement, the mouse
// in field coordinates for aim and clicks, and a small queue of one-shot actions (confirm,
// pause, mute) the state machine takes once each. The first gesture of any kind is reported
// so the game can open its audio there.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

/**
 * Listen on the canvas and window. `onGesture` runs on the first key or click.
 * The returned object is polled by the loop; nothing here knows the game's rules.
 */
export function createInput(canvas, onGesture) {
  const held = new Set();
  const mouse = { x: 640, y: 400, down: false };
  let actions = 0;
  let click = null;
  let gestured = false;

  function gesture() {
    if (gestured) return;
    gestured = true;
    onGesture();
  }

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    gesture();
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = toField(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    gesture();
    const p = toField(event);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    click = p;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    /** The movement direction the held keys ask for, as an unnormalised vector. */
    moveVector() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const dir = MOVE_KEYS[code];
        if (dir === 'up') y -= 1;
        else if (dir === 'down') y += 1;
        else if (dir === 'left') x -= 1;
        else if (dir === 'right') x += 1;
      }
      return { x, y };
    },
    /** True while the key with this code is held (Shift and Space dash read this). */
    isHeld(code) {
      return held.has(code);
    },
    /** The one-shot actions pressed since the last call; taking them clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click's field position, once; then null until the next click. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
