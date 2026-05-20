let audioCtx: AudioContext | null = null;
let muted = false;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  glide?: number;
  delay?: number;
}

function playTone(opts: ToneOpts): void {
  if (muted) return;
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + (opts.delay ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.glide !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glide), t0 + opts.duration);
  }
  const peak = opts.gain ?? 0.2;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.05);
}

function playNoise(duration: number, gain = 0.25, bandpassFreq?: number, delay = 0): void {
  if (muted) return;
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  let last: AudioNode = src;
  if (bandpassFreq) {
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = bandpassFreq;
    filter.Q.value = 1;
    last.connect(filter);
    last = filter;
  }
  last.connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.05);
}

export const sounds = {
  fire: () => {
    playTone({ freq: 700, glide: 80, duration: 0.6, type: 'sawtooth', gain: 0.15 });
    playNoise(0.5, 0.08, 400);
  },
  hit: () => {
    playTone({ freq: 120, glide: 40, duration: 0.7, type: 'square', gain: 0.25 });
    playNoise(0.5, 0.35, 200);
  },
  miss: () => {
    playNoise(0.4, 0.15, 2200);
    playTone({ freq: 1800, glide: 600, duration: 0.3, type: 'sine', gain: 0.06 });
  },
  sunk: () => {
    playTone({ freq: 220, glide: 90, duration: 1.2, type: 'sawtooth', gain: 0.2 });
    playNoise(1.0, 0.25, 180);
    playTone({ freq: 90, glide: 50, duration: 1.5, type: 'sine', gain: 0.15, delay: 0.2 });
  },
  victory: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      playTone({ freq: f, duration: 0.3, type: 'triangle', gain: 0.18, delay: i * 0.15 }),
    );
  },
  defeat: () => {
    [392, 330, 277, 220].forEach((f, i) =>
      playTone({ freq: f, duration: 0.4, type: 'sawtooth', gain: 0.18, delay: i * 0.2 }),
    );
  },
};
