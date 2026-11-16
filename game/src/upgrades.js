// The level-up boons. Gathering light motes fills the warden's lantern; each level the
// game pauses and offers three cards, and the one she takes rewrites her stats at once.
// Every boon stacks, so a long night builds a very bright warden. The bloom nova, once
// taken, keeps its own timer and blasts whatever crowds her.

import { NOVA_PERIOD, PALETTE, VIEW } from './config.js';
import { spawnRing } from './particles.js';

export const UPGRADES = [
  {
    id: 'power', name: 'Petal Power',
    desc: () => 'Blooms hit 35% harder.',
    apply: (s) => { s.player.stats.damage *= 1.35; },
  },
  {
    id: 'rapid', name: 'Rapid Bloom',
    desc: () => 'Fire blooms 25% faster.',
    apply: (s) => { s.player.stats.fireRate *= 1.25; },
  },
  {
    id: 'twin', name: 'Twin Bloom',
    desc: () => 'One more bloom in every volley.',
    apply: (s) => { s.player.stats.projectiles += 1; },
  },
  {
    id: 'pierce', name: 'Thorn Petals',
    desc: () => 'Blooms pierce one more enemy.',
    apply: (s) => { s.player.stats.pierce += 1; },
  },
  {
    id: 'swift', name: 'Swift Lantern',
    desc: () => 'Walk 12% faster.',
    apply: (s) => { s.player.stats.speed *= 1.12; },
  },
  {
    id: 'dash', name: 'Dash Charm',
    desc: () => 'Dash recharges 30% sooner.',
    apply: (s) => { s.player.stats.dashCooldown *= 0.7; },
  },
  {
    id: 'magnet', name: 'Mote Magnet',
    desc: () => 'Light motes fly to you from 60% farther.',
    apply: (s) => { s.player.stats.magnet *= 1.6; },
  },
  {
    id: 'heart', name: 'Heart Bloom',
    desc: () => '+25 max health, and mend 40 now.',
    apply: (s) => {
      s.player.stats.maxHp += 25;
      s.player.hp = Math.min(s.player.stats.maxHp, s.player.hp + 40);
    },
  },
  {
    id: 'nova', name: 'Bloom Nova',
    desc: (s) => (s.player.stats.novaLevel > 0
      ? 'The nova blasts harder and oftener.'
      : 'Every few seconds a nova blasts the gloom crowding you.'),
    apply: (s) => { s.player.stats.novaLevel += 1; },
  },
];

/** Take a chosen boon: rewrite the warden's stats with it at once. */
export function applyUpgrade(state, choice) {
  choice.apply(state);
}

/** Draw three distinct boons for this level, at the seeded rng's pleasure. */
export function rollChoices(state) {
  const pool = [...UPGRADES];
  const choices = [];
  for (let i = 0; i < 3; i += 1) {
    const index = Math.floor(state.rng.next() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

/** The nova's timer: at zero it rings out, hurting everything within reach. */
export function updateNova(state, dt, events) {
  const level = state.player.stats.novaLevel;
  if (level <= 0) return;
  state.novaTimer -= dt;
  if (state.novaTimer > 0) return;
  state.novaTimer = Math.max(2.4, NOVA_PERIOD - (level - 1) * 0.9);
  const radius = 130 + level * 18;
  const damage = 26 + level * 14;
  spawnRing(state, state.player.x, state.player.y, PALETTE.bloomPink, radius);
  state.audio.nova();
  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    if (dx * dx + dy * dy > (radius + enemy.radius) * (radius + enemy.radius)) continue;
    enemy.hp -= damage;
    enemy.flash = 0.09;
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      events.kills.push(enemy);
    }
  }
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);
}

// The three cards, laid out across the middle of the field. cardAt and the painter share
// this one layout so the click always lands on the card it names.
const CARD = { w: 300, h: 300, gap: 36, y: 300 };

export function cardRect(index) {
  const total = CARD.w * 3 + CARD.gap * 2;
  return {
    x: (VIEW.width - total) / 2 + index * (CARD.w + CARD.gap),
    y: CARD.y, w: CARD.w, h: CARD.h,
  };
}

/** The index of the card under (x, y), or -1. */
export function cardAt(state, x, y) {
  for (let i = 0; i < state.choices.length; i += 1) {
    const r = cardRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function drawIcon(ctx, id, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = PALETTE.lantern;
  ctx.fillStyle = PALETTE.lantern;
  ctx.lineWidth = 4;
  ctx.shadowColor = PALETTE.lantern;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  if (id === 'power') { // a bold four-petal bloom
    for (let i = 0; i < 4; i += 1) {
      ctx.ellipse(0, -14, 9, 16, (i * Math.PI) / 2, 0, Math.PI * 2);
    }
    ctx.fill();
  } else if (id === 'rapid') { // three speed lines and a dart
    ctx.moveTo(-24, -12); ctx.lineTo(2, -12);
    ctx.moveTo(-24, 0); ctx.lineTo(8, 0);
    ctx.moveTo(-24, 12); ctx.lineTo(2, 12);
    ctx.stroke();
    ctx.moveTo(14, -10); ctx.lineTo(30, 0); ctx.lineTo(14, 10);
    ctx.closePath(); ctx.fill();
  } else if (id === 'twin') { // two blooms side by side
    ctx.arc(-13, 0, 10, 0, Math.PI * 2);
    ctx.arc(13, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'pierce') { // a thorn through a ring
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.moveTo(-26, 10); ctx.lineTo(26, -10); ctx.lineTo(12, 12);
    ctx.closePath(); ctx.fill();
  } else if (id === 'swift') { // a wing
    ctx.moveTo(-22, 12);
    ctx.quadraticCurveTo(-6, -22, 24, -16);
    ctx.quadraticCurveTo(6, -4, 10, 6);
    ctx.quadraticCurveTo(-4, 0, -8, 12);
    ctx.closePath(); ctx.fill();
  } else if (id === 'dash') { // a swirling gust
    ctx.arc(0, 0, 18, 0.6, 4.6);
    ctx.stroke();
    ctx.moveTo(16, -14); ctx.lineTo(24, -2); ctx.lineTo(10, -4);
    ctx.closePath(); ctx.fill();
  } else if (id === 'magnet') { // a horseshoe magnet
    ctx.arc(0, -2, 15, Math.PI, 0);
    ctx.lineTo(15, 16); ctx.lineTo(5, 16); ctx.lineTo(5, -2);
    ctx.lineTo(-5, -2); ctx.lineTo(-5, 16); ctx.lineTo(-15, 16); ctx.lineTo(-15, -2);
    ctx.closePath(); ctx.fill();
  } else if (id === 'heart') { // a heart
    ctx.moveTo(0, 20);
    ctx.bezierCurveTo(-30, 2, -20, -20, 0, -8);
    ctx.bezierCurveTo(20, -20, 30, 2, 0, 20);
    ctx.fill();
  } else { // nova: a starburst
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else line = trial;
  }
  if (line) ctx.fillText(line, x, cy);
}

/** Paint the level-up pause: a dimmed garden, a heading, and the three offered cards. */
export function drawUpgradeCards(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 7, 18, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.lantern;
  ctx.font = '700 44px Georgia, "Times New Roman", serif';
  ctx.fillText('The lantern grows brighter', VIEW.width / 2, 190);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '400 21px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(`Level ${state.level} — choose a boon (click, or press 1, 2, 3)`, VIEW.width / 2, 232);

  state.choices.forEach((choice, i) => {
    const r = cardRect(i);
    const hovered = state.mouse.x >= r.x && state.mouse.x <= r.x + r.w
      && state.mouse.y >= r.y && state.mouse.y <= r.y + r.h;
    ctx.save();
    ctx.fillStyle = hovered ? '#1d2c52' : '#131c3a';
    ctx.strokeStyle = hovered ? PALETTE.lantern : '#3d5a8a';
    ctx.lineWidth = hovered ? 3.4 : 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    ctx.stroke();
    drawIcon(ctx, choice.id, r.x + r.w / 2, r.y + 74);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 25px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(choice.name, r.x + r.w / 2, r.y + 148);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '400 18px "Trebuchet MS", Verdana, sans-serif';
    wrapText(ctx, choice.desc(state), r.x + r.w / 2, r.y + 190, r.w - 44, 24);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '700 15px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + r.h - 22);
    ctx.restore();
  });
  ctx.restore();
}
