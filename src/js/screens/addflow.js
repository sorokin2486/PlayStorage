// PlayStorage by sorokin — "Add games" flow: auto-detect, folder scan, manual .exe, results list.
import { el, bus, normPath, baseName } from '../util.js';
import * as api from '../api.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as art from '../art.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { pickPath } from './filebrowser.js';

export async function addGamesFlow() {
  const folders = store.S.g.folders;
  const i = await ui.menu({
    title: t('add.title'), pos: 'center',
    items: [
      { label: t('add.auto'), sub: t('add.autoSub'), icon: 'search' },
      { label: t('add.scan', { n: folders.length }), icon: 'folder', disabled: !folders.length },
      { label: t('add.folder'), icon: 'plus' },
      { label: t('add.exe'), icon: 'play' },
    ],
  });
  if (i === 0) return runDetect();
  if (i === 1) return runScan(folders);
  if (i === 2) return addFolderAndScan();
  if (i === 3) return addManual();
  return 0;
}

export async function addFolderAndScan() {
  const p = await pickPath({ mode: 'dir', title: t('add.pickFolder') });
  if (!p) return 0;
  store.addFolder(p);
  return runScan([p]);
}

export async function runDetect() {
  const b = ui.busy(t('add.searching'));
  let found = [];
  try { found = await api.detectLaunchers(); } catch (e) { console.warn(e); }
  b.close();
  return showResults(found);
}
export async function runScan(roots) {
  const b = ui.busy(t('add.scanning'));
  let found = [];
  try { found = await api.scanFolders(roots); } catch (e) { console.warn(e); }
  b.close();
  return showResults(found);
}

export async function addManual() {
  const exe = await pickPath({ mode: 'exe', title: t('add.pickExe') });
  if (!exe) return 0;
  const dir = (await api.fsParent(exe)) || '';
  const guess = baseName(dir) || baseName(exe).replace(/\.exe$/i, '');
  const name = await ui.osk({ title: t('add.name'), value: guess });
  if (!name || !name.trim()) return 0;
  const added = store.addGames([{ name: name.trim(), exe, dir, source: 'exe', candidates: [exe] }]);
  finish(added);
  return added.length;
}

function finish(added) {
  if (!added.length) return;
  art.enqueue(added);
  ui.notify(t('add.added', { n: added.length }), 'check');
  bus.emit('library-changed');
}

// Resolves with the number of games added.
export function showResults(found) {
  const have = new Set(store.allGames().map((g) => (g.steamAppid ? 's' + g.steamAppid : normPath(g.exe))));
  const fresh = found.filter((f) => !have.has(f.steamAppid ? 's' + f.steamAppid : normPath(f.exe)));
  if (!fresh.length) {
    return ui.alertDialog(t('add.noneTitle'), found.length ? t('add.noneAll') : t('add.noneText')).then(() => 0);
  }
  return new Promise((resolve) => {
    const items = fresh.map((f) => ({ f, on: true }));
    let idx = 0;
    const list = el('div', { class: 'fb-list' });
    const rowsOf = () => [{ k: 'add' }, { k: 'all' }, ...items.map((x) => ({ k: 'g', x }))];
    const count = () => items.filter((x) => x.on).length;
    const paint = () => {
      list.innerHTML = '';
      rowsOf().forEach((r, i) => {
        let n;
        if (r.k === 'add') n = el('div', { class: 'fb-row sel' }, el('span', { class: 'fb-ic', html: icon('check') }), el('span', { class: 'fb-n' }, t('add.addSelected', { n: count() })));
        else if (r.k === 'all') n = el('div', { class: 'fb-row' }, el('span', { class: 'fb-ic', html: icon('swap') }), el('span', { class: 'fb-n' }, count() === items.length ? t('add.none') : t('add.all')));
        else {
          const f = r.x.f;
          n = el('div', { class: 'fb-row' },
            el('span', { class: 'cb' + (r.x.on ? ' on' : ''), html: r.x.on ? icon('check') : '' }),
            el('span', { class: 'fb-n' }, f.name, el('small', {}, `${f.source === 'steam' ? 'Steam' : f.source === 'epic' ? 'Epic' : 'EXE'} · ${f.exe ? f.exe.split(/[\\/]/).slice(-2).join('\\') : '—'}`)));
        }
        n.classList.toggle('focus', i === idx);
        list.append(n);
      });
      const f = list.children[idx]; if (f) ui.ensureVisible(list, f, 8);
    };
    const done = (n) => { ui.pop(scr); resolve(n); };
    const scr = {
      el: el('div', { class: 'fb' },
        el('div', { class: 'fb-title' }, t('add.found', { n: items.length })),
        el('div', { class: 'fb-path' }, t('add.foundHint')), list,
        ui.hintbar([{ action: 'confirm', text: t('add.toggle') }, { action: 'options', text: t('add.changeExe') }, { action: 'back', text: t('common.back') }])),
      onEnter: paint,
      async onAction(a) {
        const rows = rowsOf(), r = rows[idx];
        if (a === 'up') { if (idx > 0) { idx--; paint(); return true; } return false; }
        if (a === 'down') { if (idx < rows.length - 1) { idx++; paint(); return true; } return false; }
        if (a === 'back') { done(0); return true; }
        if (a === 'confirm') {
          if (r.k === 'g') { r.x.on = !r.x.on; paint(); return true; }
          if (r.k === 'all') { const v = count() !== items.length; items.forEach((x) => (x.on = v)); paint(); return true; }
          if (r.k === 'add') {
            const sel = items.filter((x) => x.on).map((x) => x.f);
            if (!sel.length) return 'error';
            const added = store.addGames(sel); finish(added); done(added.length); return true;
          }
        }
        if (a === 'options' && r.k === 'g') {
          const f = r.x.f; const c = f.candidates || [];
          if (c.length < 2) return 'error';
          ui.menu({ title: f.name, pos: 'center', items: c.map((p) => ({ label: p.split(/[\\/]/).slice(-2).join('\\'), checked: p === f.exe })) })
            .then((j) => { if (j >= 0) { f.exe = c[j]; paint(); } });
          return true;
        }
        return false;
      },
    };
    ui.push(scr);
  });
}
