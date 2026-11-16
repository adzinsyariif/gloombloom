// Gloombloom's boot and one loop. The state machine walks five screens — title, play,
// upgrade (the level-up pause), paused and over — while a fixed-step simulation advances
// the garden: the warden, the waves of gloom, both kinds of shot, the motes and petals.
// Input is read every frame; the world steps in 1/60 s ticks so a slow frame replays a
// few ticks and a fast one none.
//
// ?seed=N fixes the night's randomness. ?shot=title|play|upgrade|over (with &seed=N)
// stages that screen from a real simulated run and sets window.__shotReady, so the
// entry's screenshots are the game's own renders, never a mock-up.

import { BEST_KEY, STEP, VIEW, xpForLevel } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createPlayer, drawPlayer, hurtPlayer, updatePlayer } from './player.js';
import { spawnEnemy, startWave, updateEnemies, updateSpawning, waveCleared, drawEnemies } from './enemies.js';
import { updateProjectiles, drawProjectiles } from './projectiles.js';
import {
  dropMotes, drawParticles, spawnBurst, spawnFloater, updateParticles,
} from './particles.js';
import { applyUpgrade, cardAt, drawUpgradeCards, rollChoices, updateNova } from './upgrades.js';
import { drawHud } from './hud.js';
import { drawGameOver, drawGarden, drawPaused, drawTitle } from './screens.js';

const MAX_FRAME = 0.25; // the longest stall the loop catches up on; a hidden tab is dropped
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best night then lasts this visit only.
  }
}

/** The whole garden in one object; every module reads and writes its own corner of it. */
function createState() {
  return {
    screen: 'title',
    time: 0,
    rng: createRandom(seed),
    audio,
    player: createPlayer(),
    enemies: [],
    shots: [],
    bolts: [],
    motes: [],
    particles: [],
    rings: [],
    floaters: [],
    score: 0,
    best: readBest(),
    kills: 0,
    wave: 0,
    waveActive: false,
    bossWave: false,
    bossSpawned: false,
    spawnQueue: [],
    spawnTimer: 0,
    interTimer: 0,
    xp: 0,
    level: 1,
    xpNext: xpForLevel(1),
    choices: [],
    novaTimer: 0,
    shake: 0,
    autoFire: false,
    mouse: { x: VIEW.width / 2, y: VIEW.height / 2 },
  };
}

const state = createState();
window.__gloombloom = state; // a handle for play-test scripts; the game itself never reads it

/** Begin a fresh night: a new warden, an empty garden, and wave 1 on its way. */
function startRun() {
  const best = state.best;
  Object.assign(state, createState());
  state.best = best;
  state.screen = 'play';
  state.wave = 1;
  state.interTimer = 0.8;
  announce('The watch begins. Wave 1 is coming.');
}

function announce(message) {
  status.textContent = message;
}

/** Settle one kill: score, petals, motes, a splitter's children, the boss's fanfare. */
function settleKill(enemy) {
  state.kills += 1;
  state.score += enemy.score;
  spawnBurst(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 42 : 13);
  dropMotes(state, enemy.x, enemy.y, enemy.motes);
  audio.kill();
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const child = spawnEnemy(state, 'mini', enemy.x + state.rng.range(-16, 16), enemy.y + state.rng.range(-16, 16));
      child.wobble = state.rng.range(0, Math.PI * 2);
    }
  }
  if (enemy.kind === 'boss') {
    state.score += 250 * state.wave;
    spawnFloater(state, VIEW.width / 2, 170, 'The Gloomheart bursts!', '#ffb3c6', 30);
    state.shake = Math.min(12, state.shake + 7);
  }
}

/** Bank gathered motes; a full lantern pauses the night for a level-up choice. */
function gainXp(count) {
  if (count <= 0) return;
  audio.pickup();
  state.xp += count;
  if (state.xp >= state.xpNext && state.screen === 'play') {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = xpForLevel(state.level);
    state.choices = rollChoices(state);
    state.screen = 'upgrade';
    state.shots = [];
    state.bolts = [];
    audio.levelup();
    announce(`Level ${state.level}. Choose a boon.`);
  }
}

/** One fixed tick of the night while the screen is 'play'. */
function stepPlay(dt, controls) {
  state.time += dt;
  if (updatePlayer(state, dt, controls)) audio.shoot();

  if (!state.waveActive && state.screen === 'play') {
    state.interTimer -= dt;
    if (state.interTimer <= 0) {
      startWave(state);
      spawnFloater(state, VIEW.width / 2, 150, state.bossWave ? `Wave ${state.wave} — something vast approaches` : `Wave ${state.wave}`, '#e8f4ff', 30);
      audio.waveStart();
    }
  }
  if (state.waveActive) {
    updateSpawning(state, dt);
    if (waveCleared(state)) {
      state.waveActive = false;
      state.score += 100 * state.wave;
      spawnFloater(state, VIEW.width / 2, 150, `Wave ${state.wave} cleared`, '#5df2a6', 26);
      state.wave += 1;
      state.interTimer = 2.6;
    }
  }

  updateEnemies(state, dt);
  const events = { kills: [], hit: false, playerHit: 0 };
  updateProjectiles(state, dt, events);
  updateNova(state, dt, events);
  for (const enemy of events.kills) settleKill(enemy);
  if (events.hit) audio.hit();
  if (events.playerHit > 0 && hurtPlayer(state, events.playerHit)) audio.hurt();
  gainXp(updateParticles(state, dt));

  if (state.player.hp <= 0 && state.screen === 'play') {
    state.screen = 'over';
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
    audio.gameOver();
    announce(`Game over. Score ${state.score}. Wave ${state.wave}.`);
  }
}

/** Ambient ticks for the still screens: petals settle, motes drift, the garden breathes. */
function stepAmbient(dt) {
  state.time += dt;
  updateParticles(state, dt);
  for (const enemy of state.enemies) enemy.flash = Math.max(0, enemy.flash - dt);
}

/** Paint one frame of whatever screen the night is on. */
function render() {
  ctx.save();
  if (state.shake > 0.2) {
    ctx.translate(state.rng.range(-state.shake, state.shake) * 0.4, state.rng.range(-state.shake, state.shake) * 0.4);
    state.shake *= 0.86;
  }
  drawGarden(ctx, state);
  drawParticles(ctx, state);
  drawEnemies(ctx, state);
  if (state.screen !== 'over') drawPlayer(ctx, state);
  drawProjectiles(ctx, state);
  ctx.restore();

  if (state.screen === 'play' || state.screen === 'upgrade' || state.screen === 'paused') drawHud(ctx, state);
  if (state.screen === 'title') drawTitle(ctx, state);
  else if (state.screen === 'upgrade') drawUpgradeCards(ctx, state);
  else if (state.screen === 'paused') drawPaused(ctx, state);
  else if (state.screen === 'over') drawGameOver(ctx, state);
}

/** Keep the 1280 by 800 field whole in the window, centred, at any size. */
function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  canvas.style.left = `${Math.floor((window.innerWidth - VIEW.width * scale) / 2)}px`;
  canvas.style.top = `${Math.floor((window.innerHeight - VIEW.height * scale) / 2)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function runGame() {
  const input = createInput(canvas, () => audio.unlock());
  let accumulator = 0;
  let last = performance.now();

  function controlsFromInput() {
    const move = input.moveVector();
    const dash = input.isHeld('ShiftLeft') || input.isHeld('ShiftRight') || input.isHeld('Space');
    return {
      mx: move.x, my: move.y,
      aimX: input.mouse.x, aimY: input.mouse.y,
      fire: input.mouse.down || state.autoFire,
      dash,
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMuted();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (state.screen === 'play' && actions & ACTION_PAUSE) {
      state.screen = 'paused';
      announce('Paused.');
      return;
    }
    if (state.screen === 'paused' && actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      state.screen = 'play';
      announce('The watch goes on.');
      return;
    }
    if ((state.screen === 'title' || state.screen === 'over') && actions & ACTION_CONFIRM) startRun();
  }

  function handleClicks() {
    const click = input.takeClick();
    state.mouse.x = input.mouse.x;
    state.mouse.y = input.mouse.y;
    if (!click) return;
    if (state.screen === 'title' || state.screen === 'over') startRun();
    else if (state.screen === 'paused') state.screen = 'play';
    else if (state.screen === 'upgrade') {
      const index = cardAt(state, click.x, click.y);
      if (index >= 0) chooseUpgrade(index);
    }
  }

  function chooseUpgrade(index) {
    const choice = state.choices[index];
    if (!choice) return;
    applyUpgrade(state, choice);
    state.choices = [];
    state.screen = 'play';
    spawnFloater(state, state.player.x, state.player.y - 34, choice.name, '#ffd97a', 19);
    announce(`${choice.name} taken. The watch goes on.`);
  }

  window.addEventListener('keydown', (event) => {
    if (state.screen === 'upgrade' && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      chooseUpgrade(Number(event.code.slice(-1)) - 1);
    }
    if (event.code === 'KeyF' && state.screen === 'play') {
      state.autoFire = !state.autoFire;
      announce(state.autoFire ? 'Auto-fire on.' : 'Auto-fire off.');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'paused';
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClicks();
    if (state.screen === 'play') {
      const controls = controlsFromInput();
      while (accumulator >= STEP && state.screen === 'play') {
        stepPlay(STEP, controls);
        accumulator -= STEP;
      }
      if (state.screen !== 'play') accumulator = 0;
    } else {
      while (accumulator >= STEP) {
        stepAmbient(STEP);
        accumulator -= STEP;
      }
    }
    audio.update(1 / 60);
    render();
  }

  announce('Gloombloom. Click or press Enter to begin the watch.');
  requestAnimationFrame(frame);
}

// The screenshot scenes. Each plays the real rules forward from a fresh run under a
// simple autopilot — chase the nearest mote, keep clear of the gloom, aim and fire at
// the nearest of it — so the frame staged is one a short game really reaches, and the
// same seed always stages the same frame.

function autopilotControls() {
  const player = state.player;
  let target = null;
  let targetDist = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < targetDist) {
      targetDist = d;
      target = enemy;
    }
  }
  let mx = 0;
  let my = 0;
  let mote = null;
  let moteDist = Infinity;
  for (const m of state.motes) {
    const d = Math.hypot(m.x - player.x, m.y - player.y);
    if (d < moteDist) {
      moteDist = d;
      mote = m;
    }
  }
  if (mote && moteDist > 26) {
    mx = mote.x - player.x;
    my = mote.y - player.y;
  } else if (target) {
    mx = player.x - target.x;
    my = player.y - target.y;
    if (targetDist > 330) {
      mx = -mx;
      my = -my;
    }
  }
  if (target && targetDist < 95) {
    mx = player.x - target.x;
    my = player.y - target.y;
  }
  return {
    mx, my,
    aimX: target ? target.x : player.x + 200,
    aimY: target ? target.y : player.y - 120,
    fire: target !== null && targetDist < 720,
    dash: target !== null && targetDist < 60,
  };
}

function stageShot(name) {
  if (name === 'play' || name === 'upgrade' || name === 'over') {
    startRun();
    const idle = { mx: 0, my: 0, aimX: 0, aimY: 0, fire: false, dash: false };
    // A level reached mid-scene is spent on the first card at once, as a player in a
    // hurry would, so the run keeps moving; only the upgrade scene stops on the cards.
    const spendLevel = () => {
      if (state.screen !== 'upgrade') return;
      applyUpgrade(state, state.choices[0]);
      state.choices = [];
      state.screen = 'play';
    };
    if (name === 'play') {
      // Run until the garden is properly busy — a crowd of gloom and blooms in flight —
      // so the frame is the middle of a fight, not the quiet after one.
      for (let i = 0; i < 60 * 45 && state.screen === 'play'; i += 1) {
        stepPlay(STEP, autopilotControls());
        spendLevel();
        if (i > 60 * 8 && state.enemies.length >= 6 && state.shots.length >= 2) break;
      }
    } else if (name === 'upgrade') {
      for (let i = 0; i < 60 * 90 && state.screen === 'play'; i += 1) {
        stepPlay(STEP, autopilotControls());
        if (state.screen === 'play' && i > 60 * 6 && state.level === 1) {
          dropMotes(state, state.player.x, state.player.y, state.xpNext);
        }
      }
    } else {
      // The over scene earns a real tally first, then stands still for the gloom.
      for (let i = 0; i < 60 * 20 && state.screen === 'play'; i += 1) {
        stepPlay(STEP, autopilotControls());
        spendLevel();
      }
      for (let i = 0; i < 60 * 150 && state.screen === 'play'; i += 1) {
        stepPlay(STEP, idle);
        spendLevel(); // motes gathered passively can still fill the lantern; spend and stand on
      }
    }
  }
  let painted = 0;
  function paint() {
    render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shotName) stageShot(shotName);
else runGame();
