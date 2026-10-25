// PlayStorage by sorokin — gamepad-friendly folder / file picker (replaces the native dialog).
import { el } from '../util.js';
import * as api from '../api.js';
import * as ui from '../ui.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';

// mode: 'dir' | 'exe' | 'image' | 'json'   → resolves absolute path or null
export function pickPath({ mode = 'dir', title = '' } = {}) {
  return new Promise((resolve) => {
    let path = null, rows = [], idx = 0;
    const history = [];
    const list = el('div', { class: 'fb-list' });
    const pathEl = el('div', { class: 'fb-path' });
    const root = el('div', { class: 'fb' },
      el('div', { class: 'fb-title' }, title),
      pathEl, list,
      ui.hintbar([{ action: 'confirm', text: t('fb.open') }, ...(mode === 'dir' ? [{ action: 'options', text: t('fb.pickThis') }] : []), { action: 'back', text: t('fb.up') }]));

    const paint = () => {
      list.innerHTML = '';
      rows.forEach((r, i) => {
        const n = el('div', { class: 'fb-row' + (i === idx ? ' focus' : '') + (r.kind === 'select' ? ' sel' : '') },
          el('span', { class: 'fb-ic', html: icon(r.icon) }), el('span', { class: 'fb-n' }, r.label));
        list.append(n); r.node = n;
      });
      pathEl.textContent = path === null ? t('fb.computer') : path;
      const f = rows[idx] && rows[idx].node;
      if (f) ui.ensureVisible(list, f, 8);
    };
    const load = async (p, keepIdx = 0) => {
      try {
        const entries = p === null ? await api.fsRoots() : await api.fsList(p, mode === 'dir' ? '' : mode);
        path = p; rows = [];
        if (p !== null && mode === 'dir') rows.push({ kind: 'select', icon: 'check', label: t('fb.selectThis') });
        if (p !== null) rows.push({ kind: 'up', icon: 'folderUp', label: t('fb.upRow') });
        for (const e of entries) rows.push({ kind: 'entry', e, icon: e.isDir ? 'folder' : mode === 'image' ? 'image' : 'file', label: e.name });
        if (p !== null && !entries.length) rows.push({ kind: 'none', icon: 'info', label: t('fb.empty') });
        idx = Math.min(keepIdx, rows.length - 1);
        paint();
      } catch (e) {
        ui.toast(t('fb.error'), 'warn');
      }
    };
    const goUp = async () => {
      if (path === null) return false;
      const par = await api.fsParent(path);
      const prev = history.pop() || 0;
      await load(par || null, prev);
      return true;
    };
    const done = (v) => { ui.pop(scr); resolve(v); };
    const scr = {
      el: root,
      onEnter: () => load(null),
      onAction(a) {
        const r = rows[idx];
        if (a === 'up') { if (idx > 0) { idx--; paint(); return true; } return false; }
        if (a === 'down') { if (idx < rows.length - 1) { idx++; paint(); return true; } return false; }
        if (a === 'options' && mode === 'dir' && r && r.kind === 'entry' && r.e.isDir) { done(r.e.path); return true; }
        if (a === 'options' && mode === 'dir' && path !== null) { done(path); return true; }
        if (a === 'confirm' && r) {
          if (r.kind === 'select') { done(path); return true; }
          if (r.kind === 'up') { goUp(); return true; }
          if (r.kind === 'entry') {
            if (r.e.isDir) { history.push(idx); load(r.e.path); return true; }
            done(r.e.path); return true;
          }
          return false;
        }
        if (a === 'back') { if (path === null) { done(null); return true; } goUp(); return true; }
        return false;
      },
    };
    ui.push(scr);
  });
}
