"use client";

// Lightweight sound effects without external assets.
// NOTE: Browsers require a user gesture before audio can play.

let ctx: AudioContext | null = null;
let armed = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function armAudioOnce() {
  if (armed) return;
  armed = true;

  const tryResume = async () => {
    const c = getCtx();
    if (!c) return;
    if (c.state !== "running") {
      try {
        await c.resume();
      } catch {
        // ignore
      }
    }
    window.removeEventListener("pointerdown", tryResume);
    window.removeEventListener("keydown", tryResume);
  };

  window.addEventListener("pointerdown", tryResume, { once: true });
  window.addEventListener("keydown", tryResume, { once: true });
}

export function playTrainHorn() {
  const c = getCtx();
  if (!c) return;
  // If not yet running, don't hard-fail; the next user gesture will arm audio.
  if (c.state !== "running") return;

  const now = c.currentTime;
  const dur = 1.35;

  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, now);
  // fast attack -> sustain -> release
  out.gain.exponentialRampToValueAtTime(0.9, now + 0.05);
  out.gain.setValueAtTime(0.75, now + dur - 0.25);
  out.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  out.connect(c.destination);

  // Two oscillators to imitate a horn (fundamental + octave-ish)
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  o1.type = "sawtooth";
  o2.type = "square";

  // Slight detune + wobble
  o1.frequency.setValueAtTime(110, now);
  o2.frequency.setValueAtTime(220, now);
  o2.detune.setValueAtTime(-12, now);

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(6.5, now);
  lfoGain.gain.setValueAtTime(18, now);
  lfo.connect(lfoGain);
  lfoGain.connect(o1.detune);
  lfoGain.connect(o2.detune);

  // Mild filtering to remove harsh highs
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, now);
  lp.Q.setValueAtTime(0.8, now);

  o1.connect(lp);
  o2.connect(lp);
  lp.connect(out);

  o1.start(now);
  o2.start(now);
  lfo.start(now);

  o1.stop(now + dur);
  o2.stop(now + dur);
  lfo.stop(now + dur);
}
