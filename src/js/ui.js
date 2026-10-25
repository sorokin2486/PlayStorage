// PlayStorage by sorokin — screen stack and shared overlay components.
import { el } from './util.js';
import { t, lang } from './i18n.js';
import { icon } from './icons.js';
import * as sound from './sound.js';
import * as input from './input.js';
import { S } from './store.js';

let host;
const stack = [];
export const top = () => stack[stack.length - 1];
export const depth = () => stack.length;
const rm = () => document.documentElement.classList.contains('rm');

export function init(h) {
  host = h;
  input.hooks.action = dispatch;
  input.hooks.key = (e) => { const s = top(); return !!(s && s.onKey && s.onKey(e)); };
}

export function push(screen, { overlay = false } = {}) {
  const prev = top();
  screen.overlay = overlay;
  screen.el.classList.add('screen', overlay ? 'overlay' : 'full');
  host.appendChild(screen.el);
  if (prev) { prev.el.classList.add(overlay ? 'dimmed' : 'under'); prev.onPause && prev.onPause(); }
  stack.push(screen);
  requestAnimationFrame(() => requestAnimationFrame(() => screen.el.classList.add('in')));
  screen.onEnter && screen.onEnter();
  return screen;
}

export function pop(screen) {
  const i = screen ? stack.indexOf(screen) : stack.length - 1;
  if (i < 0) return;
  const [s] = stack.splice(i, 1);
  s.el.classList.remove('in'); s.el.classList.add('out');
  s.onExit && s.onExit();
  setTimeout(() => s.el.remove(), rm() ? 0 : 280);
  const t0 = top();
  if (t0 && i === stack.length) { t0.el.classList.remove('under', 'dimmed'); t0.onResume && t0.onResume(); }
}
export function popToRoot() { while (stack.length > 1) pop(); }

export function dispatch(action, ev) {
  const s = top();
  if (!s || !s.onAction) return false;
  const r = s.onAction(action, ev);
  if (r) {
    if (r === 'none') return true;
    if (typeof r === 'string') sound.play(r);
    else sound.play(action === 'confirm' ? 'ok' : action === 'back' ? 'back' : ['up', 'down', 'left', 'right', 'tabprev', 'tabnext'].includes(action) ? 'move' : 'ok');
  }
  return !!r;
}

// scroll helper: keep child fully visible inside a clipping container (uses translateY on inner)
export function ensureVisible(container, child, pad = 0) {
  const c = container, ch = child;
  const top = ch.offsetTop - pad, bot = ch.offsetTop + ch.offsetHeight + pad;
  if (top < c.scrollTop) c.scrollTop = top;
  else if (bot > c.scrollTop + c.clientHeight) c.scrollTop = bot - c.clientHeight;
}

// ── hint bar ──
export function hintbar(items) {
  return el('div', { class: 'hintbar' }, items.map((h) => el('span', { class: 'hint' }, input.glyph(h.action), el('span', {}, h.text))));
}

// ── dialog ──
export function dialog({ title = '', text = '', buttons, def = 0, cancel = -1, wide = false }) {
  buttons = buttons || [{ label: t('common.ok') }];
  return new Promise((resolve) => {
    let idx = def;
    const btns = buttons.map((b) => el('div', { class: 'pill' + (b.danger ? ' danger' : '') }, b.label));
    const panel = el('div', { class: 'dlg' + (wide ? ' wide' : '') },
      title ? el('div', { class: 'dlg-title' }, title) : null,
      text ? el('div', { class: 'dlg-text' }, text) : null,
      el('div', { class: 'dlg-btns' }, btns));
    const wrap = el('div', { class: 'dlg-wrap' }, panel);
    const upd = () => btns.forEach((b, i) => b.classList.toggle('focus', i === idx));
    const done = (v) => { pop(scr); resolve(v); };
    const scr = {
      el: wrap,
      onEnter: upd,
      onAction(a) {
        if (a === 'left' || a === 'up') { if (idx > 0) { idx--; upd(); return true; } return false; }
        if (a === 'right' || a === 'down') { if (idx < btns.length - 1) { idx++; upd(); return true; } return false; }
        if (a === 'confirm') { done(idx); return true; }
        if (a === 'back') { done(cancel); return true; }
        return true;
      },
    };
    push(scr, { overlay: true });
  });
}
export const confirmDialog = (title, text, yes = t('common.yes'), danger = false) =>
  dialog({ title, text, buttons: [{ label: t('common.cancel') }, { label: yes, danger }], def: 0, cancel: 0 }).then((i) => i === 1);
export const alertDialog = (title, text) => dialog({ title, text, buttons: [{ label: t('common.ok') }], cancel: 0 });

// ── menu (dropdown / popup) ──
// items: [{label, sub, checked, icon, danger, disabled}] ; mode 'single' → resolves index or -1;
// mode 'check' → toggles stay open, resolves array of booleans on close.
export function menu({ title = '', items, index = 0, mode = 'single', pos = 'center', style = null, width = null }) {
  return new Promise((resolve) => {
    let idx = Math.max(0, Math.min(index, items.length - 1));
    const checks = items.map((i) => !!i.checked);
    const rows = items.map((it) => {
      const r = el('div', { class: 'mi' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '') });
      return r;
    });
    const paint = () => rows.forEach((r, i) => {
      const it = items[i];
      r.innerHTML = '';
      const mark = mode === 'check'
        ? el('span', { class: 'cb' + (checks[i] ? ' on' : ''), html: checks[i] ? icon('check') : '' })
        : el('span', { class: 'ck', html: it.checked ? icon('check') : '' });
      r.append(mark);
      if (it.icon) r.append(el('span', { class: 'mi-ic', html: icon(it.icon) }));
      r.append(el('span', { class: 'mi-l' }, it.label));
      if (it.sub) r.append(el('span', { class: 'mi-s' }, it.sub));
      r.classList.toggle('focus', i === idx);
    });
    const list = el('div', { class: 'mi-list' }, rows);
    const panel = el('div', { class: 'menu ' + pos, style: Object.assign({}, style || {}, width ? { width } : {}) },
      title ? el('div', { class: 'menu-title' }, title) : null, list);
    const wrap = el('div', { class: 'menu-wrap' }, panel);
    const done = (v) => { pop(scr); resolve(v); };
    const scr = {
      el: wrap,
      onEnter() { paint(); requestAnimationFrame(() => rows[idx] && ensureVisible(list, rows[idx])); },
      onAction(a) {
        if (a === 'up' || a === 'down') {
          const d = a === 'up' ? -1 : 1; let n = idx + d;
          while (n >= 0 && n < items.length && items[n].disabled) n += d;
          if (n < 0 || n >= items.length) return false;
          idx = n; paint(); ensureVisible(list, rows[idx]); return true;
        }
        if (a === 'confirm') {
          if (items[idx].disabled) return 'error';
          if (mode === 'check') { checks[idx] = !checks[idx]; paint(); return true; }
          done(idx); return true;
        }
        if (a === 'back') { done(mode === 'check' ? checks : -1); return true; }
        return true;
      },
    };
    push(scr, { overlay: true });
  });
}

// ── on-screen keyboard ──
const KB = {
  en: ['1234567890-', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,.'],
  ru: ['1234567890-', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю.'],
};
export function osk({ title = '', value = '', maxLen = 80, secretHint = '' } = {}) {
  return new Promise((resolve) => {
    let text = String(value), lg = lang() === 'ru' ? 'ru' : 'en', shift = false, r = 0, c = 0, typed = false;
    const field = el('div', { class: 'osk-field' });
    const board = el('div', { class: 'osk-board' });
    let cells = [];
    const build = () => {
      board.innerHTML = ''; cells = [];
      KB[lg].forEach((row, ri) => {
        const rowEl = el('div', { class: 'osk-row' }); const rc = [];
        for (const ch of row) {
          const k = el('div', { class: 'key' }, shift ? ch.toUpperCase() : ch);
          k.dataset.val = shift ? ch.toUpperCase() : ch; rowEl.append(k); rc.push(k);
        }
        board.append(rowEl); cells.push(rc);
      });
      const sp = [
        ['shift', '⇧', 'w1'], ['lang', lg.toUpperCase(), 'w1'], ['space', t('osk.space'), 'w5'], ['back', '⌫', 'w1'], ['ok', t('osk.ok'), 'w2 ok'],
      ];
      const rowEl = el('div', { class: 'osk-row' }); const rc = [];
      for (const [id, label, w] of sp) { const k = el('div', { class: 'key ' + w }, label); k.dataset.id = id; rowEl.append(k); rc.push(k); }
      board.append(rowEl); cells.push(rc);
      paint();
    };
    const paintField = () => { field.textContent = ''; field.append(el('span', {}, text), el('span', { class: 'caret' })); if (!text) field.prepend(el('span', { class: 'ph' }, secretHint)); };
    const paint = () => {
      r = Math.min(r, cells.length - 1); c = Math.min(c, cells[r].length - 1);
      cells.forEach((row, ri) => row.forEach((k, ci) => k.classList.toggle('focus', ri === r && ci === c)));
      cells[cells.length - 1][0].classList.toggle('active', shift);
      paintField();
    };
    const add = (s) => { if (text.length + s.length <= maxLen) text += s; };
    const press = () => {
      const k = cells[r][c]; const id = k.dataset.id;
      if (!id) { add(k.dataset.val); if (shift) { shift = false; build(); } else paintField(); return; }
      if (id === 'shift') { shift = !shift; build(); }
      else if (id === 'lang') { lg = lg === 'ru' ? 'en' : 'ru'; build(); }
      else if (id === 'space') { add(' '); paintField(); }
      else if (id === 'back') { text = text.slice(0, -1); paintField(); }
      else if (id === 'ok') done(text);
    };
    const done = (v) => { pop(scr); resolve(v); };
    const wrap = el('div', { class: 'osk-wrap' },
      el('div', { class: 'osk' }, el('div', { class: 'osk-title' }, title), field, board,
        hintbar([{ action: 'confirm', text: t('osk.press') }, { action: 'back', text: t('common.cancel') }])));
    const scr = {
      el: wrap,
      onEnter: build,
      onKey(e) {
        if (e.ctrlKey || e.altKey || e.metaKey) return false;
        if (e.key === 'Backspace') { typed = true; text = text.slice(0, -1); paintField(); return true; }
        if (e.key === 'Enter' && typed) { done(text); return true; }
        if (e.key.length === 1 && e.key !== ' ' || (e.key === ' ' && typed)) { typed = true; add(e.key); paintField(); return true; }
        if (e.key === ' ') { return false; }
        return false;
      },
      onAction(a) {
        if (a === 'up') { if (r > 0) { r--; paint(); return true; } return false; }
        if (a === 'down') { if (r < cells.length - 1) { r++; paint(); return true; } return false; }
        if (a === 'left') { if (c > 0) { c--; paint(); return true; } return false; }
        if (a === 'right') { if (c < cells[r].length - 1) { c++; paint(); return true; } return false; }
        if (a === 'confirm') { press(); return true; }
        if (a === 'back') { done(null); return true; }
        return true;
      },
    };
    push(scr, { overlay: true });
  });
}

// ── toast / busy ──
export function toast(text, ic = 'info', ms = 3800) {
  const host2 = document.getElementById('toasts');
  if (!host2) return;
  const n = el('div', { class: 'toast' }, el('span', { class: 'toast-ic', html: icon(ic) }), el('span', {}, text));
  host2.append(n);
  requestAnimationFrame(() => n.classList.add('in'));
  setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 400); }, ms);
}
export const notify = (text, ic) => { if (S.p && S.p.settings.notifications) toast(text, ic); };

export function busy(text) {
  const label = el('div', { class: 'busy-t' }, text);
  const wrap = el('div', { class: 'busy-wrap' }, el('div', { class: 'busy' }, el('div', { class: 'spin' }), label));
  const scr = { el: wrap, onAction: () => 'none' };
  push(scr, { overlay: true });
  return { set: (s) => { label.textContent = s; }, close: () => pop(scr) };
}
