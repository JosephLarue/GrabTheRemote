'use client';

// Couch sound effects, synthesized with the Web Audio API: no files to download, nothing to license.
// Browsers only let audio start after a user gesture, so the context is created lazily and resumed on
// the first pointer/key event. The on/off switch is remembered per browser.

export type Sfx = 'click' | 'zap' | 'cheer' | 'buzz' | 'steal' | 'shatter' | 'chime' | 'power';

const KEY = 'gtr:sfx';
const listeners = new Set<(on: boolean) => void>();
let ctx: AudioContext | null = null;
let enabled: boolean | null = null;

export function sfxEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(KEY) !== '0';
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {}
  listeners.forEach((fn) => fn(on));
  if (on) play('click');
}

export function onSfxChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    // Unlock on the first gesture (the context starts suspended until then).
    const unlock = () => {
      ctx?.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }
  return ctx;
}

/** Plays a sound effect if they're on. Safe to call anywhere on the client; silent before the first gesture. */
export function play(name: Sfx) {
  if (!sfxEnabled()) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  try {
    SOUNDS[name](ac);
  } catch {}
}

// ---------------------------------------------------------------- synths

type Synth = (ac: AudioContext) => void;

function out(ac: AudioContext, gain = 0.2) {
  const g = ac.createGain();
  g.gain.value = gain;
  g.connect(ac.destination);
  return g;
}

function tone(ac: AudioContext, dest: AudioNode, type: OscillatorType, freq: number, t0: number, dur: number, peak = 1, to?: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

const SOUNDS: Record<Sfx, Synth> = {
  // A remote's rubber button: short, dry.
  click(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.12);
    tone(ac, dest, 'square', 1800, t, 0.03, 1, 900);
    tone(ac, dest, 'sine', 300, t, 0.06, 0.6, 120);
  },
  // Changing the channel: a burst of static with a low thunk.
  zap(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.16);
    const n = noise(ac, 0.3);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(3000, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    f.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.connect(f).connect(g).connect(dest);
    n.start(t);
    tone(ac, dest, 'sine', 140, t, 0.12, 0.8, 50);
  },
  // Applause: many tiny noise bursts, denser at the start, plus a little fanfare.
  cheer(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.22);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.5;
    f.connect(dest);
    for (let i = 0; i < 90; i++) {
      const at = t + Math.random() * 1.6 * Math.random();
      const n = noise(ac, 0.04);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.5 + Math.random() * 0.5, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03 + Math.random() * 0.02);
      n.connect(g).connect(f);
      n.start(at);
    }
    [523, 659, 784, 1047].forEach((hz, i) => tone(ac, dest, 'triangle', hz, t + 0.05 + i * 0.09, 0.35, 0.35));
  },
  // Wrong answer: a sagging sawtooth.
  buzz(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.14);
    tone(ac, dest, 'sawtooth', 160, t, 0.4, 0.9, 70);
    tone(ac, dest, 'square', 83, t, 0.4, 0.4, 40);
  },
  // Someone stole the remote: an alarm-clock two-tone.
  steal(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.14);
    for (let i = 0; i < 3; i++) {
      tone(ac, dest, 'square', 880, t + i * 0.22, 0.09, 0.6);
      tone(ac, dest, 'square', 1175, t + i * 0.22 + 0.1, 0.09, 0.6);
    }
  },
  // The TV shattering: a crack, then glass raining down.
  shatter(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.2);
    const n = noise(ac, 0.15);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const g = ac.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    n.connect(hp).connect(g).connect(dest);
    n.start(t);
    for (let i = 0; i < 18; i++) {
      const at = t + 0.08 + Math.random() * 0.7;
      tone(ac, dest, 'sine', 2500 + Math.random() * 4000, at, 0.06 + Math.random() * 0.08, 0.25);
    }
  },
  // A soft bell for easter eggs and good news.
  chime(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.12);
    tone(ac, dest, 'sine', 1047, t, 0.5, 0.8);
    tone(ac, dest, 'sine', 1568, t + 0.12, 0.6, 0.5);
  },
  // Tubes warming up: a rising hum with a pop.
  power(ac) {
    const t = ac.currentTime;
    const dest = out(ac, 0.1);
    tone(ac, dest, 'sine', 60, t, 0.5, 0.6, 180);
    tone(ac, dest, 'square', 2400, t + 0.42, 0.03, 0.4, 600);
  },
};
