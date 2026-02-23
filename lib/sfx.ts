"use client";

/**
 * Simple WebAudio SFX.
 * Browsers require a user gesture before audio can play.
 * Call armAudioOnce() on first click/tap (we also auto-arm on first pointerdown).
 */

let ctx: AudioContext | null = null;
let armed = false;

function getCtx() {
  if (ctx) return ctx;
  const AnyAudioContext = (window.AudioContext ||
    (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!AnyAudioContext) return null;
  ctx = new AnyAudioContext();
  return ctx;
}

export function armAudioOnce() {
  if (armed) return;
  const c = getCtx();
  if (!c) return;
  // resume might be required even after creating
  c.resume?.().catch(() => {});
  armed = true;
}

// auto-arm on first interaction
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    () => {
      armAudioOnce();
    },
    { once: true }
  );
}

/** tiny helper */
function beep({
  freq,
  duration,
  type = "square",
  gain = 0.15,
  attack = 0.002,
  release = 0.04,
}: {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
}) {
  const c = getCtx();
  if (!c) return;

  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration - release);

  osc.connect(g);
  g.connect(c.destination);

  osc.start(t0);
  osc.stop(t0 + duration);
}

/**
 * Shutter / bolt-click style (short, punchy).
 * Used by FaceitButton hover/click.
 */
export function playShutter() {
  // a quick "double click" feel
  armAudioOnce();
  beep({ freq: 220, duration: 0.05, type: "square", gain: 0.18 });
  setTimeout(() => {
    beep({ freq: 180, duration: 0.06, type: "square", gain: 0.16 });
  }, 45);
}

/**
 * Loud train-horn-ish beep (two oscillators) – attention sound when opponent accepts.
 */
export function playTrainHorn() {
  armAudioOnce();
  const c = getCtx();
  if (!c) {
    // fallback: beep pattern
    beep({ freq: 110, duration: 0.35, type: "sawtooth", gain: 0.25 });
    setTimeout(
      () => beep({ freq: 90, duration: 0.35, type: "sawtooth", gain: 0.25 }),
      120
    );
    return;
  }

  const t0 = c.currentTime;

  const osc1 = c.createOscillator();
  const osc2 = c.createOscillator();
  const g = c.createGain();

  osc1.type = "sawtooth";
  osc2.type = "square";

  osc1.frequency.setValueAtTime(110, t0);
  osc2.frequency.setValueAtTime(55, t0);

  // loud but not clipping
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);

  osc1.connect(g);
  osc2.connect(g);
  g.connect(c.destination);

  osc1.start(t0);
  osc2.start(t0);
  osc1.stop(t0 + 0.95);
  osc2.stop(t0 + 0.95);
}