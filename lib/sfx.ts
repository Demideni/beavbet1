"use client";

// Tiny shutter-ish sound made with WebAudio.
// No external assets needed. Hover sound will only work after the first user gesture unlocks audio.

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // @ts-ignore
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function ensureUnlocked() {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;

  const unlock = async () => {
    try {
      if (c.state === "suspended") await c.resume();
      // A tiny silent buffer to fully unlock on iOS
      const buf = c.createBuffer(1, 1, c.sampleRate);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
      unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    } catch {
      // ignore
    }
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

export function playShutter(opts?: { kind?: "hover" | "click" }) {
  ensureUnlocked();
  const c = getCtx();
  if (!c) return;

  // For hover, only play after unlocked to avoid annoying blocked promises.
  if (opts?.kind === "hover" && !unlocked) return;

  try {
    const now = c.currentTime;

    // noise burst
    const bufferSize = Math.floor(c.sampleRate * 0.045);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);

    // A short filtered noise that resembles a camera shutter / bolt click.
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const decay = Math.exp(-t * 12);
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const src = c.createBufferSource();
    src.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = opts?.kind === "click" ? 1800 : 1400;
    filter.Q.value = 0.9;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(opts?.kind === "click" ? 0.16 : 0.09, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    src.start(now);
    src.stop(now + 0.07);
  } catch {
    // ignore
  }
}
