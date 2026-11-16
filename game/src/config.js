// The night's fixed numbers: the field, the warden's lantern stats, the gloom bestiary and
// the palette every module paints with. Tuning lives here so the balance is one read away.

export const VIEW = { width: 1280, height: 800 };
export const STEP = 1 / 60;
export const BEST_KEY = 'gloombloom-best-score';

export const PALETTE = {
  deep: '#070a1a',
  indigo: '#0d1330',
  teal: '#0a2e35',
  gridLine: 'rgba(110, 243, 200, 0.055)',
  moon: '#cfe8ff',
  lantern: '#ffd97a',
  lanternCore: '#fff3c4',
  bloomPink: '#ff7ad9',
  bloomCyan: '#6ef3ff',
  mote: '#ffe066',
  text: '#e8f4ff',
  textDim: '#9db8d6',
  danger: '#ff3860',
  heal: '#5df2a6',
};

export const PLAYER_BASE = {
  radius: 15,
  speed: 252,
  hp: 100,
  damage: 12,
  fireRate: 5, // blooms per second
  projSpeed: 600,
  projectiles: 1,
  pierce: 0,
  magnet: 92,
  dashTime: 0.16,
  dashSpeed: 860,
  dashCooldown: 2.2,
  invulnTime: 0.7,
};

// hp and touch are the base values; each wave past the first hardens the gloom a little.
export const ENEMY_TYPES = {
  chaser: { radius: 17, hp: 30, speed: 96, touch: 10, score: 50, motes: 2, color: '#8b5cf6' },
  darter: { radius: 11, hp: 12, speed: 196, touch: 8, score: 40, motes: 1, color: '#ff5d8f' },
  spitter: { radius: 16, hp: 26, speed: 74, touch: 8, score: 80, motes: 3, color: '#3ddc97' },
  splitter: { radius: 24, hp: 52, speed: 52, touch: 12, score: 70, motes: 3, color: '#c084fc' },
  mini: { radius: 9, hp: 10, speed: 168, touch: 6, score: 20, motes: 1, color: '#a78bfa' },
  boss: { radius: 52, hp: 640, speed: 40, touch: 20, score: 1000, motes: 26, color: '#7c3aed' },
};

export const BOLT = { radius: 6, speed: 238, damage: 8, color: '#ff3860' };
export const SPITTER_RANGE = 300; // it holds about this far off and spits from there
export const SPITTER_PERIOD = 2.3; // seconds between spits
export const BOSS_BURST_PERIOD = 3.1; // seconds between the boss's radial bursts
export const NOVA_PERIOD = 6; // seconds between bloom novas, once the upgrade is taken

/** Light motes needed to rise from `level` to the next. */
export function xpForLevel(level) {
  return 6 + (level - 1) * 5;
}

/** How many gloom the wave sends in, before its boss (boss waves send fewer, plus the boss). */
export function waveBudget(wave) {
  return 7 + wave * 3;
}
