// PlayStorage by sorokin — own synthesized UI sounds (no Sony audio assets).
import { S } from './store.js';
let ctx = null;
function tone(freq, dur, vol, when = 0, type = 'sine', slide = 0) {
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
export function play(kind) {
  try {
    const s = S.p && S.p.settings;
    if (!s || !s.uiSounds) return;
    const v = (s.volume / 100) * 0.35;
    if (v <= 0) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    if (kind === 'move') tone(1250, 0.035, v * 0.5);
    else if (kind === 'ok') { tone(740, 0.07, v * 0.7); tone(1110, 0.11, v * 0.6, 0.05); }
    else if (kind === 'back') tone(560, 0.09, v * 0.6, 0, 'sine', -140);
    else if (kind === 'error') tone(220, 0.18, v * 0.7, 0, 'triangle');
    else if (kind === 'start') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, v * 0.5, i * 0.09));
  } catch { /* audio is optional */ }
}
