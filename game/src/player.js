// The Warden: a small lantern-sprite who walks the garden paths. She moves on the held
// keys, aims at the mouse, fires blooms while the mouse is held (or always, with the
// auto-fire toggle), and dashes in a short bright burst that carries her through harm.
// Her growing powers live in player.stats, which the upgrade cards rewrite.

import { PALETTE, PLAYER_BASE, VIEW } from './config.js';
import { fireBlooms } from './projectiles.js';
import { spawnRing } from './particles.js';

/** A fresh warden at the garden's heart, with her starting lantern stats. */
export function createPlayer() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER_BASE.radius,
    aimX: VIEW.width / 2,
    aimY: 0,
    hp: PLAYER_BASE.hp,
    fireTimer: 0,
    dashTimer: 0,
    dashCd: 0,
    dashDirX: 1,
    dashDirY: 0,
    invuln: 0,
    walkPhase: 0,
    stats: {
      damage: PLAYER_BASE.damage,
      fireRate: PLAYER_BASE.fireRate,
      projSpeed: PLAYER_BASE.projSpeed,
      projectiles: PLAYER_BASE.projectiles,
      pierce: PLAYER_BASE.pierce,
      speed: PLAYER_BASE.speed,
      magnet: PLAYER_BASE.magnet,
      maxHp: PLAYER_BASE.hp,
      dashCooldown: PLAYER_BASE.dashCooldown,
      novaLevel: 0,
    },
  };
}

/** Take a hit unless a dash or the moment's grace says otherwise. Returns true if it landed. */
export function hurtPlayer(state, damage) {
  const player = state.player;
  if (player.dashTimer > 0 || player.invuln > 0 || state.screen !== 'play') return false;
  player.hp -= damage;
  player.invuln = PLAYER_BASE.invulnTime;
  state.shake = Math.min(10, state.shake + 5);
  return true;
}

/**
 * Advance the warden by dt under `controls` ({mx, my, aimX, aimY, fire, dash}).
 * Returns true on the steps she fires, so the caller can play the sound.
 */
export function updatePlayer(state, dt, controls) {
  const player = state.player;
  player.aimX = controls.aimX;
  player.aimY = controls.aimY;
  player.invuln = Math.max(0, player.invuln - dt);
  player.dashCd = Math.max(0, player.dashCd - dt);

  const length = Math.hypot(controls.mx, controls.my);
  const nx = length > 0 ? controls.mx / length : 0;
  const ny = length > 0 ? controls.my / length : 0;

  if (controls.dash && player.dashCd <= 0 && player.dashTimer <= 0) {
    player.dashTimer = PLAYER_BASE.dashTime;
    player.dashCd = player.stats.dashCooldown;
    player.dashDirX = length > 0 ? nx : Math.cos(Math.atan2(player.aimY - player.y, player.aimX - player.x));
    player.dashDirY = length > 0 ? ny : Math.sin(Math.atan2(player.aimY - player.y, player.aimX - player.x));
    spawnRing(state, player.x, player.y, PALETTE.bloomCyan, 44);
    state.audio.dash();
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.dashDirX * PLAYER_BASE.dashSpeed;
    player.vy = player.dashDirY * PLAYER_BASE.dashSpeed;
  } else {
    player.vx = nx * player.stats.speed;
    player.vy = ny * player.stats.speed;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.min(VIEW.width - player.radius, Math.max(player.radius, player.x));
  player.y = Math.min(VIEW.height - player.radius, Math.max(player.radius, player.y));
  if (length > 0 || player.dashTimer > 0) player.walkPhase += dt * 11;

  player.fireTimer -= dt;
  let fired = false;
  if (controls.fire && player.fireTimer <= 0) {
    player.fireTimer = 1 / player.stats.fireRate;
    fireBlooms(state);
    fired = true;
  }
  return fired;
}

/** Paint the warden: a bobbing sprite in a teal cloak, carrying her glowing lantern. */
export function drawPlayer(ctx, state) {
  const player = state.player;
  const bob = Math.sin(player.walkPhase) * 1.6;
  const blink = player.invuln > 0 && Math.floor(state.time * 18) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  if (blink) ctx.globalAlpha = 0.35;

  // The lantern's halo pools around her before anything of her is drawn.
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 64);
  halo.addColorStop(0, 'rgba(255, 217, 122, 0.30)');
  halo.addColorStop(1, 'rgba(255, 217, 122, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, Math.PI * 2);
  ctx.fill();

  // Cloak and hood.
  ctx.fillStyle = '#14586b';
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(13, -2, 10, 14);
  ctx.quadraticCurveTo(0, 18, -10, 14);
  ctx.quadraticCurveTo(-13, -2, 0, -13);
  ctx.fill();
  ctx.fillStyle = '#f2e3c6';
  ctx.beginPath();
  ctx.arc(0, -6, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b40';
  ctx.beginPath();
  ctx.arc(-2.2, -6.5, 1.1, 0, Math.PI * 2);
  ctx.arc(2.2, -6.5, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // The lantern itself, swung toward the aim.
  const angle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  const lx = Math.cos(angle) * 17;
  const ly = Math.sin(angle) * 17 + 2;
  ctx.strokeStyle = '#8a6d3b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = PALETTE.lantern;
  ctx.shadowBlur = 18;
  ctx.fillStyle = PALETTE.lantern;
  ctx.beginPath();
  ctx.arc(lx, ly, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.lanternCore;
  ctx.beginPath();
  ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // A thin ring at her feet shows the dash is ready again.
  if (player.dashCd <= 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(110, 243, 255, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(player.x, player.y + 16, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
