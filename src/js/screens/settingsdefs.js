// PlayStorage by sorokin — © Sorokin Ivan — MIT
// Settings tree. Each section = { id, icon, title(), subs: [{ id, title(), rows() }] }.
// Rows: toggle | select | slider | action | info | text | node.
import { el, bus } from '../util.js';
import * as api from '../api.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as art from '../art.js';
import * as actions from '../actions.js';
import * as input from '../input.js';
import { t, setLang, LANGS, fmtBytes } from '../i18n.js';
import { applySettings } from '../appearance.js';
import { pickPath } from './filebrowser.js';
import { runScan, runDetect, addFolderAndScan, addManual } from './addflow.js';

const cache = { disks: null, loading: false, at: 0 };

export function buildSections(ctx) {
  const S = () => store.settings();
  const apply = (k, v) => { store.setSetting(k, v); applySettings(); };

  const tg = (label, key, desc) => ({ type: 'toggle', label: t(label), desc: desc ? t(desc) : '', get: () => !!S()[key], set: (v) => apply(key, v) });
  const sel = (label, key, opts, desc, after) => ({
    type: 'select', label: t(label), desc: desc ? t(desc) : '',
    options: () => opts.map(([id, l]) => ({ id, label: t(l) })),
    get: () => S()[key], set: (v) => { apply(key, v); if (after) after(v); },
  });
  const slider = (label, key, min, max, step, unit = '%', desc) => ({
    type: 'slider', label: t(label), desc: desc ? t(desc) : '', min, max, step, unit, get: () => S()[key], set: (v) => apply(key, v),
  });
  const act = (label, run, { desc, value, danger } = {}) => ({ type: 'action', label, desc: desc || '', value, run, danger });
  const info = (label, value) => ({ type: 'info', label, value });
  const text = (s) => ({ type: 'text', text: s });

  // ── helpers ──
  async function exportBackup() {
    const dir = await pickPath({ mode: 'dir', title: t('set.backup.pickDir') });
    if (!dir) return;
    await store.flush();
    const profiles = {};
    for (const n of (await api.storageList('profiles')).filter((f) => f.endsWith('.json'))) profiles[n] = await api.readJson('profiles/' + n);
    const data = { app: 'PlayStorage', author: 'Sorokin Ivan', format: 1, exported: new Date().toISOString(), global: store.S.g, profiles };
    const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
    const file = `${dir.replace(/[\\/]+$/, '')}\\PlayStorage-backup-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
    try { await api.fsWriteText(file, JSON.stringify(data, null, 1)); ui.toast(t('set.backup.done', { path: file }), 'check', 7000); }
    catch (e) { ui.alertDialog(t('set.backup.export'), String(e)); }
  }
  async function importBackup() {
    const file = await pickPath({ mode: 'json', title: t('set.backup.pickFile') });
    if (!file) return;
    try {
      const data = JSON.parse(await api.fsReadText(file));
      if (data.app !== 'PlayStorage' || !data.global) throw new Error(t('set.backup.bad'));
      if (!(await ui.confirmDialog(t('set.backup.import'), t('set.backup.importAsk'), t('set.backup.import'), true))) return;
      await api.writeJson('global.json', data.global);
      for (const [n, p] of Object.entries(data.profiles || {})) if (/^[\w.-]+\.json$/.test(n) && p) await api.writeJson('profiles/' + n, p);
      location.reload();
    } catch (e) { ui.alertDialog(t('set.backup.import'), String(e && e.message ? e.message : e)); }
  }
  async function resetProfile() {
    if (!(await ui.confirmDialog(t('set.reset.profile'), t('set.reset.profileAsk'), t('set.reset.do'), true))) return;
    store.S.p.settings = { ...store.DEFAULT_SETTINGS, lang: S().lang };
    store.saveProfile(); applySettings(); ctx.refresh();
  }
  async function wipeAll() {
    if (!(await ui.confirmDialog(t('set.reset.all'), t('set.reset.allAsk'), t('set.reset.do'), true))) return;
    if (!(await ui.confirmDialog(t('set.reset.all'), t('set.reset.allAsk2'), t('set.reset.doAll'), true))) return;
    await api.storageDelete('profiles'); await api.storageDelete('covers'); await api.storageDelete('global.json'); await api.storageDelete('session.json');
    location.reload();
  }
  async function deleteProfile() {
    const list = await store.listProfiles();
    if (list.length < 2) return;
    if (!(await ui.confirmDialog(t('set.prof.delete'), t('set.prof.deleteAsk', { name: store.S.p.name }), t('set.prof.delete'), true))) return;
    const other = list.find((p) => p.id !== store.S.pid);
    await store.deleteProfile(store.S.pid);
    actions.switchProfileTo(other.id);
  }

  async function loadDisks(force) {
    if (cache.loading) return;
    if (!force && cache.disks) return;
    cache.loading = true;
    try {
      const disks = await api.diskInfo();
      const games = store.allGames().filter((g) => g.dir || g.exe);
      const sizes = await api.dirSizes(games.map((g) => g.dir || g.exe.replace(/[\\/][^\\/]*$/, '')));
      games.forEach((g, i) => { store.S.g.sizes[g.id] = sizes[i] || 0; });
      store.S.g.sizesAt = Date.now(); store.saveGlobal();
      cache.disks = disks;
    } catch (e) { console.warn(e); cache.disks = cache.disks || []; }
    cache.loading = false;
    ctx.refresh();
  }
  function storageNode() {
    const box = el('div', { class: 'disks' });
    if (!cache.disks) { box.append(el('div', { class: 'rtext' }, t('set.storage.loading'))); loadDisks(false); return box; }
    const games = store.allGames();
    for (const d of cache.disks) {
      const letter = d.mount.slice(0, 2).toUpperCase();
      const gameBytes = games.filter((g) => ((g.dir || g.exe || '').slice(0, 2).toUpperCase()) === letter).reduce((a, g) => a + (store.S.g.sizes[g.id] || 0), 0);
      const used = d.total - d.free, other = Math.max(0, used - gameBytes);
      const pc = (n) => (d.total ? Math.max(0, Math.min(100, (n / d.total) * 100)) : 0).toFixed(2) + '%';
      box.append(el('div', { class: 'disk' },
        el('div', { class: 'disk-h' }, el('span', {}, d.mount), el('span', {}, t('set.storage.size', { n: fmtBytes(d.total) }))),
        el('div', { class: 'bar' }, el('i', { class: 'b1', style: { width: pc(gameBytes) } }), el('i', { class: 'b2', style: { width: pc(other) } })),
        el('div', { class: 'leg' }, el('i', { class: 'd1' }), el('span', {}, t('set.storage.games')), el('b', {}, fmtBytes(gameBytes))),
        el('div', { class: 'leg' }, el('i', { class: 'd2' }), el('span', {}, t('set.storage.other')), el('b', {}, fmtBytes(other))),
        el('div', { class: 'leg' }, el('i', { class: 'd3' }), el('span', {}, t('set.storage.free')), el('b', {}, fmtBytes(d.free)))));
    }
    return box;
  }

  const hotkeys = () => [
    ['Enter / Space', t('hk.confirm')], ['Esc / Backspace', t('hk.back')], ['← ↑ → ↓', t('hk.move')], ['I / F2', t('hk.options')],
    ['Tab / Home', t('hk.guide')], ['Q / E  (PgUp / PgDn)', t('hk.tabs')], ['/  or  Ctrl+F', t('hk.search')], ['F11', t('hk.full')], ['Alt+F4', t('hk.close')],
  ];

  return [
    // 1 ─ Guide & information
    {
      id: 'guide', icon: 'book', title: () => t('set.guide'),
      subs: [
        { id: 'manual', title: () => t('set.guide.manual'), rows: () => [text(t('set.guide.manualText')), act(t('set.guide.open'), () => actions.openGuide())] },
        { id: 'about', title: () => t('set.guide.about'), rows: () => [
          info(t('set.about.name'), 'PlayStorage by sorokin'), info(t('set.about.version'), ctx.info ? ctx.info.version : '…'),
          info(t('set.about.author'), 'Sorokin Ivan'), info('GitHub', 'sorokin'), info(t('set.about.license'), 'MIT'), text(t('set.about.disclaimer'))] },
        { id: 'legal', title: () => t('set.guide.legal'), rows: () => [text(t('set.legal.text'))] },
      ],
    },
    // 2 ─ Accessibility
    {
      id: 'access', icon: 'access', title: () => t('set.access'),
      subs: [{ id: 'display', title: () => t('set.access.display'), rows: () => [
        tg('set.access.invert', 'invert', 'set.access.invertD'),
        sel('set.access.filter', 'colorFilter', [['off', 'cf.off'], ['gray', 'cf.gray'], ['protan', 'cf.protan'], ['deutan', 'cf.deutan'], ['tritan', 'cf.tritan']], 'set.access.filterD'),
        sel('set.access.textSize', 'textSize', [['small', 'ts.small'], ['normal', 'ts.normal'], ['large', 'ts.large'], ['xlarge', 'ts.xlarge']], 'set.access.textSizeD'),
        tg('set.access.bold', 'boldText', 'set.access.boldD'),
        tg('set.access.contrast', 'highContrast', 'set.access.contrastD'),
        tg('set.access.motion', 'reduceMotion', 'set.access.motionD'),
      ] }],
    },
    // 3 ─ Profile
    {
      id: 'profile', icon: 'user', title: () => t('set.prof'),
      subs: [
        { id: 'me', title: () => t('set.prof.me'), rows: () => [
          info(t('set.prof.name'), store.S.p.name),
          act(t('set.prof.rename'), async () => { const n = await ui.osk({ title: t('prof.name'), value: store.S.p.name, maxLen: 24 }); if (n && n.trim()) { store.S.p.name = n.trim(); store.saveProfile(); } }),
          { type: 'select', label: t('set.prof.color'), desc: '', options: () => store.COLORS.map((c, i) => ({ id: c, label: t('color.' + i) })), get: () => store.S.p.color, set: (v) => { store.S.p.color = v; store.saveProfile(); } },
          act(t('set.prof.switch'), async () => { const list = await store.listProfiles(); if (list.length < 2) return ui.toast(t('set.prof.only'), 'info'); const { pickProfile } = await import('./profiles.js'); const id = await pickProfile(list, { overlay: true }); if (id && id !== store.S.pid) actions.switchProfileTo(id); }),
          act(t('prof.add'), () => actions.addProfile()),
          act(t('set.prof.delete'), deleteProfile, { danger: true }),
        ] },
        { id: 'login', title: () => t('set.prof.login'), rows: () => [
          { type: 'toggle', label: t('set.prof.ask'), desc: t('set.prof.askD'), get: () => !!store.S.g.askProfile, set: (v) => { store.S.g.askProfile = v; store.saveGlobal(); } },
        ] },
      ],
    },
    // 4 ─ System
    {
      id: 'system', icon: 'cube', title: () => t('set.sys'),
      subs: [
        { id: 'lang', title: () => t('set.sys.lang'), rows: () => [
          { type: 'select', label: t('set.sys.langLabel'), desc: t('set.sys.langD'), options: () => LANGS.map((l) => ({ id: l.id, label: l.name })), get: () => S().lang, set: (v) => { apply('lang', v); setLang(v); store.S.g.lang = v; store.saveGlobal(); ctx.rebuildAll(); } },
        ] },
        { id: 'time', title: () => t('set.sys.time'), rows: () => [tg('set.sys.showClock', 'showClock'), tg('set.sys.clock24', 'clock24', 'set.sys.clock24D')] },
        { id: 'behave', title: () => t('set.sys.behave'), rows: () => [
          { type: 'toggle', label: t('set.sys.autostart'), desc: t('set.sys.autostartD'), get: () => !!ctx.autostart, set: async (v) => { try { await api.setAutostart(v); ctx.autostart = v; } catch (e) { ui.toast(String(e), 'warn'); } } },
          tg('set.sys.freeMem', 'freeMemory', 'set.sys.freeMemD'),
          act(t('set.sys.quit'), () => actions.powerMenu(), { desc: t('set.sys.quitD') }),
        ] },
        { id: 'backup', title: () => t('set.sys.backup'), rows: () => [text(t('set.backup.text')), act(t('set.backup.export'), exportBackup), act(t('set.backup.import'), importBackup)] },
        { id: 'reset', title: () => t('set.sys.reset'), rows: () => [
          act(t('set.reset.profile'), resetProfile, { desc: t('set.reset.profileD') }),
          act(t('set.reset.all'), wipeAll, { desc: t('set.reset.allD'), danger: true }),
        ] },
      ],
    },
    // 5 ─ Storage
    {
      id: 'storage', icon: 'db', title: () => t('set.storage'),
      subs: [{ id: 'disks', title: () => t('set.storage'), rows: () => [
        { type: 'node', node: storageNode() },
        act(t('set.storage.recalc'), async () => { const b = ui.busy(t('set.storage.calc')); await loadDisks(true); b.close(); }, { desc: t('set.storage.recalcD') }),
      ] }],
    },
    // 6 ─ Sound
    {
      id: 'sound', icon: 'speaker', title: () => t('set.sound'),
      subs: [{ id: 's', title: () => t('set.sound'), rows: () => [tg('set.sound.ui', 'uiSounds', 'set.sound.uiD'), slider('set.sound.vol', 'volume', 0, 100, 10, '%')] }],
    },
    // 7 ─ Screen
    {
      id: 'screen', icon: 'monitor', title: () => t('set.screen'),
      subs: [{ id: 's', title: () => t('set.screen'), rows: () => [
        ...(ctx.monitors && ctx.monitors.length > 1 ? [{ type: 'select', label: t('set.screen.monitor'), desc: t('set.screen.monitorD'), options: () => ctx.monitors.map((m, i) => ({ id: i, label: `${i + 1}: ${m.width}×${m.height}` })), get: () => S().monitor || 0, set: (v) => { apply('monitor', v); api.setMonitor(v).catch(() => {}); } }] : []),
        { type: 'toggle', label: t('set.screen.full'), desc: t('set.screen.fullD'), get: () => !!S().fullscreen, set: (v) => { apply('fullscreen', v); api.setFullscreen(v).catch(() => {}); } },
        slider('set.screen.scale', 'uiScale', 80, 130, 5, '%', 'set.screen.scaleD'),
        slider('set.screen.dim', 'bgDim', 20, 90, 5, '%', 'set.screen.dimD'),
        sel('set.screen.cover', 'coverShape', [['square', 'cs.square'], ['portrait', 'cs.portrait']], 'set.screen.coverD'),
      ] }],
    },
    // 8 ─ Accessories
    {
      id: 'pads', icon: 'gamepad', title: () => t('set.pads'),
      subs: [
        { id: 'ctl', title: () => t('set.pads.ctl'), rows: () => [
          info(t('set.pads.found'), input.padName ? input.padName.replace(/\s*\(.*$/, '') : t('set.pads.none')),
          sel('set.pads.glyphs', 'glyphs', [['auto', 'gl.auto'], ['ps', 'gl.ps'], ['xbox', 'gl.xbox']], 'set.pads.glyphsD'),
          sel('set.pads.confirm', 'confirmBtn', [['cross', 'cb.cross'], ['circle', 'cb.circle']], 'set.pads.confirmD'),
        ] },
        { id: 'kbd', title: () => t('set.pads.kbd'), rows: () => hotkeys().map(([k, v]) => info(v, k)) },
      ],
    },
    // 9 ─ Games & library
    {
      id: 'library', icon: 'folder', title: () => t('set.lib'),
      subs: [
        { id: 'folders', title: () => t('set.lib.folders'), rows: () => [
          text(store.S.g.folders.length ? t('set.lib.foldersText') : t('set.lib.foldersEmpty')),
          ...store.S.g.folders.map((f) => act(f, async () => { if (await ui.confirmDialog(t('set.lib.removeFolder'), f, t('common.remove'), true)) { store.removeFolder(f); } }, { value: t('common.remove') })),
          act(t('set.lib.addFolder'), async () => { await addFolderAndScan(); }),
          act(t('set.lib.scan'), async () => { if (!store.S.g.folders.length) return ui.toast(t('set.lib.foldersEmpty'), 'info'); await runScan(store.S.g.folders); }, { desc: t('set.lib.scanD') }),
          act(t('set.lib.detect'), async () => { await runDetect(); }, { desc: t('set.lib.detectD') }),
        ] },
        { id: 'manual', title: () => t('set.lib.manual'), rows: () => [text(t('set.lib.manualText')), act(t('add.exe'), async () => { await addManual(); })] },
        { id: 'hidden', title: () => t('set.lib.hidden'), rows: () => {
          const h = store.hiddenGames();
          return h.length ? [text(t('set.lib.hiddenText')), ...h.map((g) => act(g.name, () => { store.setHidden(g.id, false); bus.emit('library-changed'); }, { value: t('set.lib.show') }))] : [text(t('set.lib.hiddenNone'))];
        } },
        { id: 'covers', title: () => t('set.lib.covers'), rows: () => [
          tg('set.lib.dl', 'downloadArt', 'set.lib.dlD'),
          act(t('set.lib.fetch'), async () => { const n = await art.fetchMissing(); ui.toast(t('set.lib.fetching', { n }), 'download'); }, { desc: t('set.lib.fetchD') }),
          act(t('set.lib.clear'), async () => {
            if (!(await ui.confirmDialog(t('set.lib.clear'), t('set.lib.clearAsk'), t('set.reset.do'), true))) return;
            await api.storageDelete('covers');
            store.allGames().forEach((g) => { g.art = {}; g.customCover = false; }); store.saveGlobal(); bus.emit('library-changed');
          }, { desc: t('set.lib.clearD') }),
        ] },
        { id: 'media', title: () => t('set.lib.media'), rows: () => [
          { type: 'select', label: t('set.lib.mediaMode'), desc: t('set.lib.mediaModeD'), options: () => [{ id: 'browser', label: t('mm.browser') }, { id: 'edge', label: t('mm.edge') }], get: () => store.S.g.mediaMode, set: (v) => { store.S.g.mediaMode = v; store.saveGlobal(); } },
          ...store.S.g.media.map((m) => act(m.name, async () => { if (await ui.confirmDialog(t('opt.remove'), t('opt.removeAsk', { name: m.name }), t('opt.remove'), true)) { store.S.g.media = store.S.g.media.filter((x) => x.id !== m.id); store.saveGlobal(); bus.emit('library-changed'); } }, { value: t('common.remove') })),
          act(t('home.addSite'), () => actions.addMediaSite()),
          act(t('set.lib.mediaReset'), () => { store.S.g.media = store.presetMedia(); store.saveGlobal(); bus.emit('library-changed'); }),
        ] },
      ],
    },
    // 10 ─ Notifications
    {
      id: 'notify', icon: 'bell', title: () => t('set.notify'),
      subs: [{ id: 's', title: () => t('set.notify'), rows: () => [tg('set.notify.on', 'notifications', 'set.notify.onD')] }],
    },
  ];
}
