// The Gloom: spores that drift in from the garden's edge in timed waves and mean the
// warden harm. Five kinds, five habits — chasers walk at her, darters zigzag in fast,
// spitters hold their distance and spit, splitters divide when they die, and every fifth
// wave a Gloomheart boss comes with a bar of its own and bursts of bolts.

import {
  BOSS_BURST_PERIOD, ENEMY_TYPES, SPITTER_PERIOD, SPITTER_RANGE, VIEW, waveBudget,
} from './config.js';
import { hurtPlayer } from './player.js';
import { spawnBolt } from './projectiles.js';

/** Place one enemy of the kind at (x, y), hardened a little by the wave it belongs to. */
export function spawnEnemy(state, kind, x, y) {
  const base = ENEMY_TYPES[kind];
  const harden = 1 + (state.wave - 1) * 0.13;
  const enemy = {
    kind, x, y,
    vx: 0, vy: 0,
    radius: base.radius,
    hp: Math.round(base.hp * harden),
    maxHp: Math.round(base.hp * harden),
    speed: base.speed * (1 + (state.wave - 1) * 0.02),
    touch: base.touch,
    score: base.score,
    motes: base.motes,
    color: base.color,
    flash: 0,
    fireTimer: state.rng.range(0.6, SPITTER_PERIOD),
    burstTimer: BOSS_BURST_PERIOD * 0.6,
    wobble: state.rng.range(0, Math.PI * 2),
    dead: false,
  };
  state.enemies.push(enemy);
  return enemy;
}

/** A point just outside a random edge of the garden. */
function edgePoint(state) {
  const side = state.rng.int(0, 3);
  if (side === 0) return { x: state.rng.range(0, VIEW.width), y: -30 };
  if (side === 1) return { x: state.rng.range(0, VIEW.width), y: VIEW.height + 30 };
  if (side === 2) return { x: -30, y: state.rng.range(0, VIEW.height) };
  return { x: VIEW.width + 30, y: state.rng.range(0, VIEW.height) };
}

/** The mix a wave is made of: new kinds join as the nights deepen. */
function waveComposition(state) {
  const wave = state.wave;
  const list = [];
  const bossWave = wave % 5 === 0;
  let budget = waveBudget(wave);
  if (bossWave) budget = Math.ceil(budget / 2);
  for (let i = 0; i < budget; i += 1) {
    const roll = state.rng.next();
    if (wave >= 4 && roll < 0.14) list.push('splitter');
    else if (wave >= 3 && roll < 0.32) list.push('spitter');
    else if (wave >= 2 && roll < 0.58) list.push('darter');
    else list.push('chaser');
  }
  return { list, bossWave };
}

/** Begin a wave: queue its gloom and raise its banner. Boss waves raise a warning too. */
export function startWave(state) {
  const { list, bossWave } = waveComposition(state);
  state.spawnQueue = list;
  state.spawnTimer = 0.5;
  state.bossWave = bossWave;
  state.bossSpawned = false;
  state.waveActive = true;
}

/** Let the queued gloom in, a few at a time; the boss arrives once the queue has thinned. */
export function updateSpawning(state, dt) {
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = Math.max(0.28, 0.85 - state.wave * 0.045);
      const p = edgePoint(state);
      spawnEnemy(state, state.spawnQueue.shift(), p.x, p.y);
    }
  } else if (state.bossWave && !state.bossSpawned) {
    state.bossSpawned = true;
    const p = edgePoint(state);
    spawnEnemy(state, 'boss', p.x, p.y);
    state.audio.bossWarn();
  }
}

/** True when the wave is spent: nothing queued, nothing walking, the boss (if any) placed. */
export function waveCleared(state) {
  return state.waveActive && state.spawnQueue.length === 0
    && (!state.bossWave || state.bossSpawned) && state.enemies.length === 0;
}

function steer(enemy, state, dt, tx, ty, wobbleAmount) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.wobble += dt * 3;
  const sway = Math.sin(enemy.wobble) * wobbleAmount;
  const px = (-dy / dist) * sway;
  const py = (dx / dist) * sway;
  enemy.x += ((dx / dist) * enemy.speed + px) * dt;
  enemy.y += ((dy / dist) * enemy.speed + py) * dt;
  return dist;
}

/** Move every enemy by its habit, let the spitters and the boss shoot, and settle touches. */
export function updateEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.kind === 'darter') {
      steer(enemy, state, dt, player.x, player.y, 130);
    } else if (enemy.kind === 'spitter') {
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y) || 1;
      if (dist > SPITTER_RANGE + 24) steer(enemy, state, dt, player.x, player.y, 26);
      else if (dist < SPITTER_RANGE - 60) steer(enemy, state, dt, enemy.x * 2 - player.x, enemy.y * 2 - player.y, 0);
      else steer(enemy, state, dt, enemy.x + Math.cos(enemy.wobble * 0.4) * 40, enemy.y, 20);
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && dist < SPITTER_RANGE + 90) {
        enemy.fireTimer = SPITTER_PERIOD * state.rng.range(0.85, 1.15);
        spawnBolt(state, enemy.x, enemy.y, Math.atan2(player.y - enemy.y, player.x - enemy.x));
      }
    } else if (enemy.kind === 'boss') {
      steer(enemy, state, dt, player.x, player.y, 12);
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0) {
        enemy.burstTimer = BOSS_BURST_PERIOD;
        const base = state.rng.range(0, Math.PI * 2);
        for (let i = 0; i < 10; i += 1) spawnBolt(state, enemy.x, enemy.y, base + (i / 10) * Math.PI * 2);
        state.audio.hit();
      }
    } else {
      steer(enemy, state, dt, player.x, player.y, enemy.kind === 'mini' ? 60 : 22);
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    if (dx * dx + dy * dy < (player.radius + enemy.radius) * (player.radius + enemy.radius)) {
      if (hurtPlayer(state, enemy.touch)) state.audio.hurt();
    }
  }
}

function spikyBlob(ctx, enemy, spikes, wobbleScale) {
  const wob = Math.sin(enemy.wobble * 2) * wobbleScale;
  ctx.beginPath();
  for (let i = 0; i < spikes; i += 1) {
    const a = (i / spikes) * Math.PI * 2 + enemy.wobble * 0.3;
    const r = enemy.radius * (i % 2 === 0 ? 1.12 + wob : 0.82);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function eyes(ctx, enemy, spread, size, color = '#0b0620') {
  const player = enemy.lookAt;
  const angle = player ? Math.atan2(player.y - enemy.y, player.x - enemy.x) : 0;
  const ex = Math.cos(angle) * 2.4;
  const ey = Math.sin(angle) * 2.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-spread + ex, -2 + ey, size, 0, Math.PI * 2);
  ctx.arc(spread + ex, -2 + ey, size, 0, Math.PI * 2);
  ctx.fill();
}

/** Paint every enemy by its kind; a fresh hit flashes white, the boss wears a crown. */
export function drawEnemies(ctx, state) {
  for (const enemy of state.enemies) {
    enemy.lookAt = state.player;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = enemy.kind === 'boss' ? 26 : 10;
    if (enemy.kind === 'darter') {
      const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 5, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius * 0.72);
      ctx.lineTo(-enemy.radius * 0.4, 0);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.72);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d3b2a';
      ctx.beginPath();
      ctx.arc(0, 5, enemy.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, enemy, 6, 2.4, '#eafff3');
    } else if (enemy.kind === 'boss') {
      spikyBlob(ctx, enemy, 14, 0.05);
      ctx.fillStyle = '#ff3860';
      ctx.shadowColor = '#ff3860';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.38 + Math.sin(state.time * 3) * 2.5, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, enemy, 15, 4.6, '#1c0530');
    } else {
      spikyBlob(ctx, enemy, enemy.kind === 'splitter' ? 10 : 8, 0.08);
      eyes(ctx, enemy, enemy.radius * 0.36, Math.max(1.8, enemy.radius * 0.13));
      if (enemy.kind === 'splitter') {
        ctx.strokeStyle = 'rgba(20, 4, 40, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-enemy.radius * 0.6, -enemy.radius * 0.5);
        ctx.quadraticCurveTo(0, 0, enemy.radius * 0.6, enemy.radius * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Hurt enemies (and only they) wear a slim health sliver.
    if (enemy.hp < enemy.maxHp && enemy.kind !== 'boss') {
      ctx.save();
      ctx.fillStyle = 'rgba(6, 8, 20, 0.7)';
      ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2, 4);
      ctx.fillStyle = '#ff8fb2';
      ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 4);
      ctx.restore();
    }
  }
}
