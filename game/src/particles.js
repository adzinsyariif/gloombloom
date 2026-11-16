// Petals, sparks, rings, floating words and the light motes the gloom drops. Motes are the
// game's experience: they drift, glow, and fly to the warden once inside her lantern's
// magnet reach; collecting enough of them is what levels her up.

import { PALETTE } from './config.js';

/** Burst a killed enemy into coloured petals that spin, slow and fade. */
export function spawnBurst(state, x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    const speed = state.rng.range(50, 260);
    state.particles.push({
      kind: 'petal', x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      rot: state.rng.range(0, Math.PI * 2), vr: state.rng.range(-6, 6),
      size: state.rng.range(3, 7), color,
      life: 0, ttl: state.rng.range(0.4, 0.9),
    });
  }
}

/** A few bright sparks where a bloom struck home. */
export function spawnSparks(state, x, y, color = PALETTE.bloomCyan) {
  for (let i = 0; i < 4; i += 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    const speed = state.rng.range(40, 150);
    state.particles.push({
      kind: 'spark', x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      rot: 0, vr: 0, size: state.rng.range(1.5, 3), color,
      life: 0, ttl: state.rng.range(0.15, 0.35),
    });
  }
}

/** An expanding ring: the nova's blast front, or the ripple of a dash. */
export function spawnRing(state, x, y, color, maxRadius) {
  state.rings.push({ x, y, color, r: 8, maxRadius, life: 0, ttl: 0.35 });
}

/** A word that floats up and fades: a wave banner, a level gained, a warning. */
export function spawnFloater(state, x, y, text, color = PALETTE.text, size = 20) {
  state.floaters.push({ x, y, text, color, size, life: 0, ttl: 1.6 });
}

/** Scatter the light motes a kill drops; each carries one point of experience. */
export function dropMotes(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    const speed = state.rng.range(20, 120);
    state.motes.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      t: state.rng.range(0, Math.PI * 2),
    });
  }
}

/**
 * Advance everything in this file by dt. Returns how many motes the warden gathered this
 * step, so the caller can chime and count experience.
 */
export function updateParticles(state, dt) {
  const player = state.player;
  for (const p of state.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 3.2 * dt;
    p.vy *= 1 - 3.2 * dt;
    p.rot += p.vr * dt;
  }
  state.particles = state.particles.filter((p) => p.life < p.ttl);
  for (const r of state.rings) {
    r.life += dt;
    r.r = 8 + (r.maxRadius - 8) * (r.life / r.ttl);
  }
  state.rings = state.rings.filter((r) => r.life < r.ttl);
  for (const f of state.floaters) {
    f.life += dt;
    f.y -= 26 * dt;
  }
  state.floaters = state.floaters.filter((f) => f.life < f.ttl);

  let gathered = 0;
  const kept = [];
  for (const mote of state.motes) {
    mote.t += dt * 3;
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
    mote.vx *= 1 - 2.4 * dt;
    mote.vy *= 1 - 2.4 * dt;
    const dx = player.x - mote.x;
    const dy = player.y - mote.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < player.stats.magnet) {
      const pull = 340 * (1 - dist / player.stats.magnet) + 90;
      mote.x += (dx / dist) * pull * dt;
      mote.y += (dy / dist) * pull * dt;
    }
    if (dist < player.radius + 12) gathered += 1;
    else kept.push(mote);
  }
  state.motes = kept;
  return gathered;
}

/** Paint motes, petals, sparks, rings and floaters. Called over the field, under the HUD. */
export function drawParticles(ctx, state) {
  for (const mote of state.motes) {
    const pulse = 3.4 + Math.sin(mote.t) * 0.9;
    ctx.save();
    ctx.shadowColor = PALETTE.mote;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.mote;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const p of state.particles) {
    const fade = 1 - p.life / p.ttl;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.kind === 'petal') {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const r of state.rings) {
    ctx.save();
    ctx.globalAlpha = 0.75 * (1 - r.life / r.ttl);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.min(1, 2 * (1 - f.life / f.ttl));
    ctx.font = `700 ${f.size}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
