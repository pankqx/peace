// Little game-feel helpers: synthesized sounds, flying coins, result flash.
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- sound (Web Audio, no files) ----------
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('peace.muted') === '1'; } catch {}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', gain = 0.1, when = 0, to } = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { freq = 2500, q = 0.8, gain = 0.2, when = 0 } = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + when;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  coin() { tone(1900, 0.12, { gain: 0.09 }); tone(2850, 0.2, { gain: 0.06, when: 0.03 }); },
  deal() { noise(0.07, { freq: 2600, gain: 0.35 }); },
  flip() { noise(0.05, { freq: 4200, q: 1.4, gain: 0.2 }); },
  tick() { tone(1250, 0.05, { type: 'square', gain: 0.025 }); },
  match() { tone(880, 0.14, { type: 'triangle', gain: 0.14 }); tone(1320, 0.35, { type: 'triangle', gain: 0.12, when: 0.08 }); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.12, when: i * 0.09 }));
    for (let i = 0; i < 6; i++) tone(2200 + Math.random() * 900, 0.12, { gain: 0.04, when: 0.4 + i * 0.06 });
  },
  lose() { tone(330, 0.2, { gain: 0.09 }); tone(247, 0.4, { gain: 0.09, when: 0.15 }); },
  start() { tone(392, 0.15, { type: 'triangle', gain: 0.1 }); tone(587, 0.25, { type: 'triangle', gain: 0.1, when: 0.12 }); },
};

export const sound = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('peace.muted', muted ? '1' : '0'); } catch {}
    if (!muted) ac();
    return muted;
  },
  unlock() { if (!muted) ac(); },
  play(name) { if (!muted && SOUNDS[name]) { try { SOUNDS[name](); } catch {} } },
};

// ---------- motion ----------
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function coinNode(value, size = 34) {
  const c = document.createElement('div');
  c.className = 'fly-coin';
  c.dataset.v = value || '';
  c.style.width = c.style.height = `${size}px`;
  document.body.append(c);
  return c;
}

export function flyCoin(fromEl, toEl, value) {
  if (!fromEl || !toEl || reduced()) return;
  const a = center(fromEl.getBoundingClientRect()), b = center(toEl.getBoundingClientRect());
  const c = coinNode(value, 34);
  const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 60 };
  c.animate([
    { transform: `translate(${a.x - 17}px, ${a.y - 17}px) scale(1)` },
    { transform: `translate(${mid.x - 17}px, ${mid.y - 17}px) scale(1.15) rotate(180deg)`, offset: 0.5 },
    { transform: `translate(${b.x - 17}px, ${b.y - 17}px) scale(.7) rotate(360deg)`, opacity: 0.9 },
  ], { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' }).onfinish = () => c.remove();
}

export function coinBurst(fromEl, toEl, count = 14) {
  if (!fromEl || !toEl || reduced()) return;
  const a = center(fromEl.getBoundingClientRect()), b = center(toEl.getBoundingClientRect());
  for (let i = 0; i < count; i++) {
    const c = coinNode(2, 22 + Math.random() * 10);
    const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 90;
    const p = { x: a.x + Math.cos(ang) * dist, y: a.y + Math.sin(ang) * dist - 30 };
    c.animate([
      { transform: `translate(${a.x}px, ${a.y}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${p.x}px, ${p.y}px) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${b.x - 10}px, ${b.y - 10}px) scale(.5) rotate(720deg)`, opacity: 0.8 },
    ], { duration: 900 + Math.random() * 400, delay: i * 35, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' })
      .onfinish = () => c.remove();
  }
}

export function flash(container, text, cls = '') {
  if (!container) return;
  const el = document.createElement('div');
  el.className = `flash ${cls}`;
  el.textContent = text;
  container.append(el);
  setTimeout(() => el.remove(), 1900);
}
