// PlayStorage by sorokin — keyboard + gamepad (DualSense / Xbox) → abstract actions.
import { S } from './store.js';
import { el } from './util.js';
import { icon } from './icons.js';
import { bus } from './util.js';

export const hooks = { action: null, key: null };
export let padName = '';
export let padKind = null; // 'ps' | 'xbox' | null

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'confirm', ' ': 'confirm', Escape: 'back', Backspace: 'back',
  i: 'options', I: 'options', F2: 'options', ContextMenu: 'options',
  Tab: 'guide', Home: 'guide', q: 'tabprev', Q: 'tabprev', PageUp: 'tabprev',
  e: 'tabnext', E: 'tabnext', PageDown: 'tabnext', '/': 'search', F11: 'fullscreen',
};

function fire(a, ev) { if (hooks.action) hooks.action(a, ev); }

function onKeyDown(e) {
  if (e.altKey && e.key === 'F4') return; // let Windows close the window
  if (hooks.key && hooks.key(e)) { e.preventDefault(); return; }
  let a = KEYS[e.key];
  if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) a = 'search';
  if (!a) return;
  e.preventDefault();
  fire(a, e);
}

const DELAY = 380, RATE = 105;
const held = {}, prev = {};
function detect(gp) {
  const id = (gp.id || '').toLowerCase();
  const kind = /054c|dualsense|dualshock|wireless controller|playstation/.test(id) ? 'ps' : /xbox|xinput|045e|microsoft/.test(id) ? 'xbox' : 'ps';
  if (padName !== gp.id) { padName = gp.id; padKind = kind; bus.emit('pad', { name: gp.id, kind }); }
}
function poll(now) {
  try {
    const pads = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(Boolean);
    const gp = pads.find((p) => p.mapping === 'standard') || pads[0];
    if (gp) {
      detect(gp);
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const dirs = { up: b(12) || ay < -0.55, down: b(13) || ay > 0.55, left: b(14) || ax < -0.55, right: b(15) || ax > 0.55 };
      for (const d of Object.keys(dirs)) {
        const h = held[d];
        if (dirs[d]) {
          if (!h) { held[d] = { t0: now, last: now }; fire(d); }
          else if (now - h.t0 > DELAY && now - h.last > RATE) { h.last = now; fire(d); }
        } else delete held[d];
      }
      const swap = S.p && S.p.settings.confirmBtn === 'circle';
      const map = { 0: swap ? 'back' : 'confirm', 1: swap ? 'confirm' : 'back', 3: 'search', 9: 'options', 8: 'guide', 16: 'guide', 4: 'tabprev', 5: 'tabnext' };
      for (const i of Object.keys(map)) {
        const down = b(+i);
        if (down && !prev[i]) fire(map[i]);
        prev[i] = down;
      }
    } else if (padName) { padName = ''; padKind = null; bus.emit('pad', null); }
  } catch { /* gamepad API unavailable */ }
  requestAnimationFrame(poll);
}
let started = false;
export function start() {
  if (started) return; started = true;
  window.addEventListener('keydown', onKeyDown);
  requestAnimationFrame(poll);
}

// ── button glyphs for hint bars ──
export function effectiveKind() {
  const g = S.p ? S.p.settings.glyphs : 'auto';
  return g === 'auto' ? padKind || 'ps' : g;
}
export function glyph(action) {
  const swap = S.p && S.p.settings.confirmBtn === 'circle';
  const confirm = swap ? 'back' : 'confirm';
  const k = effectiveKind();
  const a = action === 'confirm' || action === 'back' ? (action === confirm ? 'cross' : 'circle') : action;
  if (k === 'xbox') {
    const t = { cross: 'A', circle: 'B', options: '≡', search: 'Y', guide: '⊞', tabprev: 'LB', tabnext: 'RB' }[a] || '';
    return el('span', { class: 'glyph x' }, t);
  }
  if (a === 'cross' || a === 'circle') return el('span', { class: 'glyph ps', html: icon(a) });
  const t = { options: '≡', search: '△', guide: 'PS', tabprev: 'L1', tabnext: 'R1' }[a] || '';
  return el('span', { class: 'glyph p' }, t);
}
