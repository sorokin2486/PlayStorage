// PlayStorage by sorokin — per-game Options menu.
import * as store from '../store.js';
import * as api from '../api.js';
import * as ui from '../ui.js';
import * as art from '../art.js';
import { t } from '../i18n.js';
import { bus } from '../util.js';
import { pickPath } from './filebrowser.js';
import { launchGame } from '../launch.js';

export async function openGameOptions(g, { inLibrary = false } = {}) {
  const fav = store.isFav(g.id);
  const items = [
    { label: t('opt.play'), icon: 'play' },
    { label: fav ? t('opt.unfav') : t('opt.fav'), icon: 'star' },
    { label: t('opt.rename'), icon: 'edit' },
    { label: t('opt.cover'), icon: 'image' },
    { label: t('opt.redownload'), icon: 'download' },
    { label: t('opt.exe'), icon: 'file' },
    { label: t('opt.folder'), icon: 'folder' },
    { label: t('opt.hide'), icon: 'eye' },
    { label: t('opt.remove'), icon: 'trash', danger: true },
  ];
  const i = await ui.menu({ title: g.name, items, pos: 'side' });
  const changed = () => bus.emit('library-changed');
  try {
    if (i === 0) launchGame(g);
    else if (i === 1) { store.toggleFav(g.id); changed(); }
    else if (i === 2) {
      const n = await ui.osk({ title: t('opt.rename'), value: g.name });
      if (n && n.trim()) { store.updateGame(g.id, { name: n.trim() }); changed(); }
    } else if (i === 3) {
      const p = await pickPath({ mode: 'image', title: t('opt.cover') });
      if (p) {
        const ext = (p.split('.').pop() || 'jpg').toLowerCase();
        const rel = `covers/${g.id}_custom_${Date.now()}.${ext}`;
        await api.storageImport(p, rel);
        store.updateGame(g.id, { art: { ...(g.art || {}), cover: rel }, customCover: true });
        changed();
      }
    } else if (i === 4) {
      const b = ui.busy(t('opt.downloading'));
      try { await art.fetchOne(g, true); } finally { b.close(); }
      changed();
    } else if (i === 5) {
      const c = (g.candidates || []).filter((x) => x !== g.exe);
      let exe = null;
      if (c.length) {
        const j = await ui.menu({ title: t('opt.exe'), items: [...c.map((x) => ({ label: x.split(/[\\/]/).slice(-2).join('\\'), sub: '' })), { label: t('opt.exeOther'), icon: 'folder' }], pos: 'side' });
        if (j >= 0 && j < c.length) exe = c[j];
        else if (j === c.length) exe = await pickPath({ mode: 'exe', title: t('opt.exe') });
      } else exe = await pickPath({ mode: 'exe', title: t('opt.exe') });
      if (exe) { store.updateGame(g.id, { exe, steamAppid: null, source: g.source === 'steam' ? 'exe' : g.source }); changed(); }
    } else if (i === 6) {
      try { await api.openFolder(g.dir || (g.exe || '').replace(/[\\/][^\\/]*$/, '')); } catch (e) { ui.toast(String(e), 'warn'); }
    } else if (i === 7) { store.setHidden(g.id, true); ui.toast(t('opt.hidden'), 'eye'); changed(); }
    else if (i === 8) {
      if (await ui.confirmDialog(t('opt.remove'), t('opt.removeAsk', { name: g.name }), t('opt.remove'), true)) { store.removeGame(g.id); changed(); }
    }
  } catch (e) { ui.toast(String(e), 'warn'); }
}
