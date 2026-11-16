// The garden itself and the screens that frame the night: the moonlit beds and paths the
// fight happens over, the title the warden starts from, the pause veil, and the tally she
// is left with when the gloom takes her. The garden's stones and sleeping flowers are
// placed once from a fixed seed, so every visit finds the same beds.

import { PALETTE, VIEW } from './config.js';
import { createRandom } from './random.js';

const decor = (() => {
  const rng = createRandom(7);
  const stones = [];
  const flowers = [];
  for (let i = 0; i < 46; i += 1) {
    stones.push({ x: rng.range(20, VIEW.width - 20), y: rng.range(20, VIEW.height - 20), r: rng.range(2, 5) });
  }
  for (let i = 0; i < 60; i += 1) {
    flowers.push({
      x: rng.range(16, VIEW.width - 16), y: rng.range(16, VIEW.height - 16),
      r: rng.range(2.5, 5), hue: rng.pick(['#3f6d8e', '#54689e', '#2f5d6e', '#71548f']),
      phase: rng.range(0, Math.PI * 2),
    });
  }
  return { stones, flowers };
})();

/** Paint the moonlit garden: layered dark, a plot grid, the moon's pool, stones, flowers. */
export function drawGarden(ctx, state) {
  const grad = ctx.createRadialGradient(
    VIEW.width * 0.72, VIEW.height * 0.2, 80,
    VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.75,
  );
  grad.addColorStop(0, '#14264a');
  grad.addColorStop(0.45, '#0d1836');
  grad.addColorStop(1, '#060818');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // The moon, high over the east beds.
  ctx.save();
  ctx.shadowColor = PALETTE.moon;
  ctx.shadowBlur = 42;
  ctx.fillStyle = PALETTE.moon;
  ctx.beginPath();
  ctx.arc(VIEW.width * 0.86, 92, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Garden plots: a quiet grid of beds, paths every 160 paces.
  ctx.strokeStyle = PALETTE.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 80; x < VIEW.width; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW.height);
  }
  for (let y = 80; y < VIEW.height; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW.width, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110, 243, 200, 0.10)';
  ctx.beginPath();
  for (let x = 0; x <= VIEW.width; x += 160) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW.height);
  }
  for (let y = 0; y <= VIEW.height; y += 160) {
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW.width, y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(200, 220, 255, 0.20)';
  for (const s of decor.stones) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of decor.flowers) {
    const glow = 0.35 + 0.3 * Math.sin(state.time * 0.9 + f.phase);
    ctx.save();
    ctx.globalAlpha = Math.max(0.12, glow);
    ctx.fillStyle = f.hue;
    for (let petal = 0; petal < 5; petal += 1) {
      const a = (petal / 5) * Math.PI * 2 + f.phase;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r, f.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function veil(ctx, alpha) {
  ctx.fillStyle = `rgba(4, 6, 16, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function bigTitle(ctx, text, y, size, color) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW.width / 2, y);
  ctx.restore();
}

function centred(ctx, text, y, font, color) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW.width / 2, y);
  ctx.restore();
}

const BODY = '400 20px "Trebuchet MS", Verdana, sans-serif';
const SMALL = '400 17px "Trebuchet MS", Verdana, sans-serif';

/** The title screen: the game's name, its promise, its controls and the way in. */
export function drawTitle(ctx, state) {
  veil(ctx, 0.45);
  bigTitle(ctx, 'GLOOMBLOOM', 218, 92, PALETTE.lantern);
  centred(ctx, 'A lantern warden’s night watch over a moonlit garden', 268, BODY, PALETTE.text);
  centred(ctx, 'The Gloom comes in waves to snuff the blooms. Hold the dark back, gather its light,', 330, SMALL, PALETTE.textDim);
  centred(ctx, 'and grow brighter with every level — until the garden takes you, as it takes us all.', 358, SMALL, PALETTE.textDim);

  const lines = [
    'WASD or arrow keys — walk the paths',
    'Mouse — aim the lantern · hold click — loose blooms',
    'Shift or Space — dash through harm · F — auto-fire',
    'P or Esc — pause · M — mute',
  ];
  lines.forEach((line, i) => centred(ctx, line, 428 + i * 30, SMALL, PALETTE.text));

  const pulse = 0.72 + 0.28 * Math.sin(state.time * 3.2);
  ctx.save();
  ctx.globalAlpha = pulse;
  centred(ctx, 'Click or press Enter to begin the watch', 592, '700 24px "Trebuchet MS", Verdana, sans-serif', PALETTE.bloomCyan);
  ctx.restore();
  if (state.best > 0) centred(ctx, `Best night so far: ${state.best}`, 640, SMALL, PALETTE.textDim);
}

/** The pause veil, with the way back written on it. */
export function drawPaused(ctx, state) {
  veil(ctx, 0.62);
  bigTitle(ctx, 'Paused', 360, 56, PALETTE.text);
  centred(ctx, 'The garden holds its breath.', 410, BODY, PALETTE.textDim);
  centred(ctx, 'Press P, Esc or Enter to walk on · M to mute', 452, SMALL, PALETTE.text);
  centred(ctx, `Wave ${state.wave} · Score ${state.score} · Lantern level ${state.level}`, 492, SMALL, PALETTE.textDim);
}

/** The tally at the end of a night: score, wave, best — and the way back in. */
export function drawGameOver(ctx, state) {
  veil(ctx, 0.66);
  bigTitle(ctx, 'The lantern goes out', 240, 64, PALETTE.danger);
  centred(ctx, 'The Gloom blooms over the garden — this time.', 292, BODY, PALETTE.textDim);
  centred(ctx, `Final score  ${state.score}`, 380, '700 34px "Trebuchet MS", Verdana, sans-serif', PALETTE.lantern);
  centred(ctx, `You held the garden through wave ${state.wave} · ${state.kills} gloom scattered`, 428, BODY, PALETTE.text);
  if (state.score >= state.best && state.score > 0) {
    centred(ctx, 'A new best night!', 470, '700 21px "Trebuchet MS", Verdana, sans-serif', PALETTE.heal);
  } else {
    centred(ctx, `Best night: ${state.best}`, 470, BODY, PALETTE.textDim);
  }
  const pulse = 0.72 + 0.28 * Math.sin(state.time * 3.2);
  ctx.save();
  ctx.globalAlpha = pulse;
  centred(ctx, 'Play again — click or press Enter', 552, '700 24px "Trebuchet MS", Verdana, sans-serif', PALETTE.bloomCyan);
  ctx.restore();
}
