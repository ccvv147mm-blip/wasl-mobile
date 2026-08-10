// Tiny Web Audio chirps for UI feedback. No assets, no network.
let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
  }
  return ctx;
}

function blip(freq: number, dur = 0.12, type: OscillatorType = "sine", vol = 0.08) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g).connect(a.destination);
  const t = a.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur);
}

export const sfx = {
  like:    () => { blip(660, 0.08, "triangle"); setTimeout(() => blip(990, 0.12, "triangle"), 60); },
  comment: () => { blip(520, 0.09, "sine"); },
  share:   () => { blip(440, 0.06, "square", 0.05); setTimeout(() => blip(880, 0.1, "square", 0.05), 70); },
  pop:     () => { blip(300, 0.05, "sine"); },
};
