// A small seeded random generator (mulberry32). Every spawn, scatter and petal in the game
// draws from one of these, so a ?seed=N screenshot run replays the exact same night.

/** Create a generator whose whole sequence follows from the one seed number. */
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of the array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
  };
}
