// PlayStorage by sorokin — © Sorokin Ivan — MIT
// Settings screen engine: root list → section (sub-menu column + rows), PS5-style.
import { el, bus } from '../util.js';
import * as api from '../api.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as bg from '../bg.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { buildSections } from './settingsdefs.js';

export function createSettings(openId) {
  const ctx = { info: null, autostart: false, monitors: [], refresh: () => renderRows(), rebuildAll: () => rebuildAll() };
  let sections = buildSections(ctx);
  let level = 'root', rootIdx = 0, secIdx = 0, zone = 'content', rowIdx = 0;
  let rows = [], rowEls = [];

  const title = el('div', { class: 'set-title' });
  const rootList = el('div', { class: 'set-root' });
  const nav = el('div', { class: 'set-nav' });
  const content = el('div', { class: 'set-content' });
  const sec = el('div', { class: 'set-sec' }, nav, content);
  const root = el('div', { class: 'settings', 'data-level': 'root' }, title, rootList, sec);

  const sub = () => sections[rootIdx].subs[secIdx];
  const isFocusable = (r) => r.type === 'toggle' || r.type === 'select' || r.type === 'slider' || r.type === 'action';
  const focusables = () => rows.map((r, i) => (isFocusable(r) ? i : -1)).filter((i) => i >= 0);

  // ── root list ──
  function renderRoot() {
    title.textContent = t('set.title');
    rootList.innerHTML = '';
    sections.forEach((s, i) => rootList.append(el('div', { class: 'rrow' + (i === rootIdx ? ' focus' : '') }, el('span', { class: 'rr-ic', html: icon(s.icon) }), el('span', { class: 'rr-l' }, s.title()))));
    const f = rootList.children[rootIdx]; if (f) ui.ensureVisible(rootList, f, 20);
  }

  // ── row building ──
  function buildRow(r) {
    if (r.type === 'text') return el('div', { class: 'rtext' }, r.text);
    if (r.type === 'node') return r.node;
    const row = el('div', { class: 'row ' + r.type + (r.danger ? ' danger' : '') });
    const head = el('div', { class: 'row-h' }, el('span', { class: 'row-l' }, r.label));
    if (r.type === 'toggle') head.append(el('span', { class: 'tg' + (r.get() ? ' on' : '') }, el('i')));
    else if (r.type === 'select') { const o = r.options().find((x) => x.id === r.get()); head.append(el('span', { class: 'row-v' }, o ? o.label : '')); }
    else if (r.type === 'slider') head.append(el('span', { class: 'sl' }, el('i', { style: { width: ((r.get() - r.min) / (r.max - r.min)) * 100 + '%' } })), el('span', { class: 'row-v n' }, r.get() + (r.unit || '')));
    else if (r.type === 'action' && r.value) head.append(el('span', { class: 'row-v' }, r.value));
    else if (r.type === 'info') head.append(el('span', { class: 'row-v' }, String(r.value)));
    row.append(head);
    if (r.desc) row.append(el('div', { class: 'row-d' }, r.desc));
    return row;
  }
  function renderRows() {
    if (level !== 'section') return;
    rows = sub().rows();
    content.innerHTML = '';
    rowEls = rows.map((r) => { const n = buildRow(r); content.append(n); return n; });
    const f = focusables();
    if (!f.includes(rowIdx)) rowIdx = f.length ? (f.find((i) => i >= rowIdx) ?? f[f.length - 1]) : 0;
    paint();
  }
  function renderNav() {
    const s = sections[rootIdx];
    title.textContent = s.title();
    sec.classList.toggle('one', s.subs.length < 2);
    nav.innerHTML = '';
    s.subs.forEach((x, i) => nav.append(el('div', { class: 'nav-i' }, x.title())));
  }
  function paint() {
    if (level === 'root') { [...rootList.children].forEach((n, i) => n.classList.toggle('focus', i === rootIdx)); const f = rootList.children[rootIdx]; if (f) ui.ensureVisible(rootList, f, 20); return; }
    [...nav.children].forEach((n, i) => { n.classList.toggle('active', i === secIdx); n.classList.toggle('focus', zone === 'nav' && i === secIdx); });
    sec.dataset.zone = zone;
    rowEls.forEach((n, i) => n.classList.toggle('focus', zone === 'content' && i === rowIdx && isFocusable(rows[i])));
    const f = rowEls[rowIdx];
    if (f && zone === 'content') ui.ensureVisible(content, f, 12);
  }
  function setLevel(l) { level = l; root.dataset.level = l; }
  function openSection(i, focusContent = true) {
    rootIdx = i; secIdx = 0; rowIdx = 0;
    setLevel('section'); renderNav(); renderRows();
    const multi = sections[rootIdx].subs.length > 1;
    zone = multi && !focusContent ? 'nav' : multi ? 'nav' : 'content';
    const f = focusables(); rowIdx = f.length ? f[0] : 0;
    paint();
  }
  function backToRoot() { setLevel('root'); title.textContent = t('set.title'); renderRoot(); paint(); }
  function rebuildAll() { sections = buildSections(ctx); level === 'root' ? renderRoot() : (renderNav(), renderRows()); }

  // ── activation ──
  async function activate(r) {
    try {
      if (r.type === 'toggle') await r.set(!r.get());
      else if (r.type === 'select') {
        const opts = r.options(), cur = r.get();
        const i = await ui.menu({ title: r.label, pos: 'right', index: Math.max(0, opts.findIndex((o) => o.id === cur)), items: opts.map((o) => ({ label: o.label, checked: o.id === cur })) });
        if (i >= 0) await r.set(opts[i].id);
      } else if (r.type === 'action') await r.run();
    } catch (e) { console.error(e); ui.toast(String(e && e.message ? e.message : e), 'warn'); }
    renderRows();
  }

  const offs = [];
  const scr = {
    el: root,
    onEnter() {
      bg.mode('spot'); renderRoot();
      api.appInfo().then((i) => { ctx.info = i; }).catch(() => {});
      api.getAutostart().then((v) => { ctx.autostart = !!v; }).catch(() => {});
      api.monitors().then((m) => { ctx.monitors = m || []; }).catch(() => {});
      if (openId) { const i = sections.findIndex((s) => s.id === openId); if (i >= 0) openSection(i); }
    },
    onResume() { bg.mode('spot'); if (level === 'root') renderRoot(); else { renderNav(); renderRows(); } },
    onExit() { offs.forEach((f) => f()); },
    onAction(a) {
      if (a === 'guide') { import('../actions.js').then((m) => m.openControlCenter()); return true; }
      if (level === 'root') {
        if (a === 'up') { if (rootIdx > 0) { rootIdx--; paint(); return true; } return false; }
        if (a === 'down') { if (rootIdx < sections.length - 1) { rootIdx++; paint(); return true; } return false; }
        if (a === 'confirm' || a === 'right') { openSection(rootIdx); return true; }
        if (a === 'back') { ui.pop(); return true; }
        return false;
      }
      const multi = sections[rootIdx].subs.length > 1;
      if (zone === 'nav') {
        const n = sections[rootIdx].subs.length;
        if (a === 'up') { if (secIdx > 0) { secIdx--; rowIdx = 0; renderRows(); paint(); return true; } return false; }
        if (a === 'down') { if (secIdx < n - 1) { secIdx++; rowIdx = 0; renderRows(); paint(); return true; } return false; }
        if (a === 'right' || a === 'confirm') { const f = focusables(); if (!f.length) return false; zone = 'content'; rowIdx = f[0]; paint(); return true; }
        if (a === 'back') { if (openId) { ui.pop(); return true; } backToRoot(); return true; }
        return false;
      }
      // content zone
      const f = focusables(), pos = f.indexOf(rowIdx), r = rows[rowIdx];
      if (a === 'up') { if (pos > 0) { rowIdx = f[pos - 1]; paint(); return true; } return false; }
      if (a === 'down') { if (pos < f.length - 1) { rowIdx = f[pos + 1]; paint(); return true; } return false; }
      if (a === 'left' || a === 'right') {
        if (r && r.type === 'slider') {
          const v = Math.max(r.min, Math.min(r.max, r.get() + (a === 'left' ? -r.step : r.step)));
          if (v === r.get()) return false;
          r.set(v); renderRows(); return 'move';
        }
        if (a === 'left' && multi) { zone = 'nav'; paint(); return true; }
        return false;
      }
      if (a === 'confirm' && r) { if (r.type === 'slider') return false; activate(r); return true; }
      if (a === 'back') { if (multi) { zone = 'nav'; paint(); return true; } if (openId) { ui.pop(); return true; } backToRoot(); return true; }
      return false;
    },
  };
  offs.push(bus.on('library-changed', () => { if (level === 'section') renderRows(); }));
  offs.push(bus.on('pad', () => { if (level === 'section') renderRows(); }));
  return scr;
}
