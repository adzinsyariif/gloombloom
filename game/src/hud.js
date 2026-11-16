// The heads-up display: everything the warden needs at a glance, painted over the field —
// her health and lantern level along the bottom, the night's score and wave up top, the
// dash charm's recharge, and the Gloomheart's own great bar while a boss walks.

import { PALETTE, VIEW } from './config.js';

function bar(ctx, x, y, w, h, frac, color, back = 'rgba(8, 10, 24, 0.72)') {
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
}

/** Paint the whole HUD for the current state. */
export function drawHud(ctx, state) {
  const player = state.player;
  ctx.save();
  ctx.textAlign = 'left';

  // Top left: the wave and what is left of it.
  ctx.font = '700 24px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`Wave ${state.wave}`, 22, 36);
  ctx.font = '400 16px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  const left = state.enemies.length + state.spawnQueue.length + (state.bossWave && !state.bossSpawned ? 1 : 0);
  ctx.fillText(state.waveActive ? `${left} gloom in the garden` : 'the garden breathes…', 22, 60);

  // Top right: the score, and the best night so far.
  ctx.textAlign = 'right';
  ctx.font = '700 24px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = PALETTE.lantern;
  ctx.fillText(`${state.score}`, VIEW.width - 22, 36);
  ctx.font = '400 16px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`best ${Math.max(state.best, state.score)}`, VIEW.width - 22, 60);
  ctx.fillText(state.autoFire ? 'auto-fire on (F)' : '', VIEW.width - 22, 84);

  // The boss's bar, wide across the top centre while a Gloomheart walks.
  const boss = state.enemies.find((e) => e.kind === 'boss');
  if (boss) {
    ctx.textAlign = 'center';
    ctx.font = '700 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = '#ffb3c6';
    ctx.fillText('GLOOMHEART', VIEW.width / 2, 30);
    bar(ctx, VIEW.width / 2 - 260, 38, 520, 13, boss.hp / boss.maxHp, PALETTE.danger);
  }

  // Bottom: health on the left, the dash charm beside it, the lantern's growth full width.
  ctx.textAlign = 'left';
  ctx.font = '700 15px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`♥ ${Math.max(0, Math.ceil(player.hp))} / ${player.stats.maxHp}`, 22, VIEW.height - 44);
  bar(ctx, 22, VIEW.height - 38, 230, 14, player.hp / player.stats.maxHp,
    player.hp / player.stats.maxHp < 0.3 ? PALETTE.danger : PALETTE.heal);

  const dashFrac = 1 - player.dashCd / player.stats.dashCooldown;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('Dash', 268, VIEW.height - 44);
  bar(ctx, 268, VIEW.height - 38, 110, 14, dashFrac, PALETTE.bloomCyan);

  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '400 14px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(state.audio.muted ? 'muted (M)' : 'M mute · P pause · F auto-fire', VIEW.width - 22, VIEW.height - 44);

  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 15px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(`Lantern level ${state.level}`, 22, VIEW.height - 12);
  bar(ctx, 150, VIEW.height - 22, VIEW.width - 172, 12, state.xp / state.xpNext, PALETTE.mote);
  ctx.restore();
}
