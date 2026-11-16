// Every sound is synthesized with WebAudio at play time: short shaped blips and noise for
// the effects, and a slow pentatonic arpeggio with a soft bass for the garden at night.
// Nothing loads, and nothing sounds until the player's first click or keypress opens the
// context, as browsers require. M toggles the master mute.

const ARP_NOTES = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 329.63]; // C E G C' G E D E
const ARP_SECONDS = 0.46;

/** Create the sound engine. All of its methods are safe to call before unlock(). */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let arpTimer = 0;
  let arpStep = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }

  function tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  function noise(seconds, volume, filterFrom, filterTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t0 + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(t0);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Advance the night music; call once a frame while a screen is showing. */
    update(dt) {
      if (!ctx || muted) return;
      arpTimer -= dt;
      if (arpTimer > 0) return;
      arpTimer = ARP_SECONDS;
      const note = ARP_NOTES[arpStep % ARP_NOTES.length];
      tone(note, note, 0.5, 'sine', 0.055);
      tone(note * 2, note * 2, 0.3, 'triangle', 0.016);
      if (arpStep % 8 === 0) tone(130.81, 130.81, 1.6, 'sine', 0.05); // a low C under each bar
      if (arpStep % 8 === 4) tone(98.0, 98.0, 1.6, 'sine', 0.045); // and a low G at the turn
      arpStep += 1;
    },
    shoot() {
      tone(880, 320, 0.09, 'square', 0.05);
    },
    hit() {
      noise(0.06, 0.10, 2400, 700);
    },
    kill() {
      tone(520, 90, 0.18, 'triangle', 0.14);
      noise(0.12, 0.06, 1200, 300);
    },
    pickup() {
      tone(1240, 1760, 0.07, 'sine', 0.06);
    },
    hurt() {
      tone(160, 60, 0.22, 'sawtooth', 0.16);
    },
    dash() {
      noise(0.16, 0.09, 500, 2600);
    },
    levelup() {
      tone(523.25, 523.25, 0.12, 'triangle', 0.12);
      tone(659.25, 659.25, 0.12, 'triangle', 0.12, 0.09);
      tone(783.99, 783.99, 0.2, 'triangle', 0.13, 0.18);
      tone(1046.5, 1046.5, 0.3, 'sine', 0.10, 0.27);
    },
    nova() {
      tone(220, 880, 0.28, 'sine', 0.12);
      noise(0.25, 0.05, 300, 1800);
    },
    waveStart() {
      tone(392.0, 392.0, 0.14, 'triangle', 0.10);
      tone(587.33, 587.33, 0.22, 'triangle', 0.10, 0.11);
    },
    bossWarn() {
      tone(98.0, 92.0, 0.5, 'sawtooth', 0.14);
      tone(98.0, 92.0, 0.5, 'sawtooth', 0.14, 0.4);
    },
    gameOver() {
      tone(392.0, 392.0, 0.3, 'triangle', 0.12);
      tone(329.63, 329.63, 0.3, 'triangle', 0.12, 0.26);
      tone(261.63, 196.0, 0.7, 'triangle', 0.12, 0.52);
    },
  };
}
