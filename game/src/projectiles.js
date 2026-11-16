// The two kinds of shot in the garden: the warden's neon blooms, which fly straight and
// can pierce once she learns how, and the gloom's dark bolts, spat back at her. Movement
// and hits are resolved here; what a kill is worth is the caller's business, reported
// through the events object updateProjectiles fills in.

import { BOLT, PALETTE, VIEW } from './config.js';
import { spawnSparks } from './particles.js';

const SPREAD_STEP = 0.11; // radians between the blooms of one volley

/** Fire one volley from the warden toward her aim; count and spread follow her stats. */
export function fireBlooms(state) {
  const player = state.player;
  const base = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  const count = player.stats.projectiles;
  for (let i = 0; i < count; i += 1) {
    const angle = base + (i - (count - 1) / 2) * SPREAD_STEP;
    state.shots.push({
      x: player.x + Math.cos(angle) * (player.radius + 6),
      y: player.y + Math.sin(angle) * (player.radius + 6),
      vx: Math.cos(angle) * player.stats.projSpeed,
      vy: Math.sin(angle) * player.stats.projSpeed,
      damage: player.stats.damage,
      pierce: player.stats.pierce,
      color: i % 2 === 0 ? PALETTE.bloomPink : PALETTE.bloomCyan,
      spin: state.rng.range(0, Math.PI * 2),
    });
  }
}

/** A gloom bolt leaves (x, y) along the angle, aimed at the warden a moment ago. */
export function spawnBolt(state, x, y, angle) {
  state.bolts.push({
    x, y,
    vx: Math.cos(angle) * BOLT.speed,
    vy: Math.sin(angle) * BOLT.speed,
    radius: BOLT.radius,
    damage: BOLT.damage,
  });
}

function offField(x, y, margin = 60) {
  return x < -margin || y < -margin || x > VIEW.width + margin || y > VIEW.height + margin;
}

/**
 * Advance both kinds of shot by dt. events.kills collects each enemy a bloom finished
 * (already removed from state.enemies); events.playerHit is set when a bolt lands.
 */
export function updateProjectiles(state, dt, events) {
  const player = state.player;
  const keptShots = [];
  for (const shot of state.shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.spin += dt * 9;
    if (offField(shot.x, shot.y)) continue;
    let spent = false;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - shot.x;
      const dy = enemy.y - shot.y;
      if (dx * dx + dy * dy > (enemy.radius + 7) * (enemy.radius + 7)) continue;
      enemy.hp -= shot.damage;
      enemy.flash = 0.09;
      spawnSparks(state, shot.x, shot.y, shot.color);
      events.hit = true;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        events.kills.push(enemy);
      }
      if (shot.pierce > 0) shot.pierce -= 1;
      else spent = true;
      break;
    }
    if (!spent) keptShots.push(shot);
  }
  state.shots = keptShots;
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);

  const keptBolts = [];
  for (const bolt of state.bolts) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    if (offField(bolt.x, bolt.y)) continue;
    const dx = player.x - bolt.x;
    const dy = player.y - bolt.y;
    if (dx * dx + dy * dy < (player.radius + bolt.radius) * (player.radius + bolt.radius)) {
      if (player.dashTimer <= 0 && player.invuln <= 0) events.playerHit = bolt.damage;
      continue;
    }
    keptBolts.push(bolt);
  }
  state.bolts = keptBolts;
}

/** Paint blooms as spinning neon petals and bolts as ember-dark orbs. */
export function drawProjectiles(ctx, state) {
  for (const shot of state.shots) {
    ctx.save();
    ctx.translate(shot.x, shot.y);
    ctx.rotate(shot.spin);
    ctx.shadowColor = shot.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = shot.color;
    for (let petal = 0; petal < 4; petal += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(5.5, 0, 6.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const bolt of state.bolts) {
    ctx.save();
    ctx.shadowColor = BOLT.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = BOLT.color;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b0a18';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
