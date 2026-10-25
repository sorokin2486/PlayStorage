// PlayStorage by sorokin — cross-screen actions (kept in one place to avoid import tangles).
import * as ui from './ui.js';
import * as store from './store.js';
import * as api from './api.js';
import { t } from './i18n.js';
import { bus } from './util.js';
import { createLibrary } from './screens/library.js';
import { createSettings } from './screens/settings.js';
import { createControlCenter } from './screens/controlcenter.js';
import { createGuide } from './screens/guide.js';
import { pickProfile } from './screens/profiles.js';

export { addGamesFlow } from './screens/addflow.js';
export { launchGame } from './launch.js';
export { openGameOptions } from './screens/options.js';

export const openLibrary = (opts = {}) => ui.push(createLibrary(opts));
export const openSettings = (section) => ui.push(createSettings(section));
export const openControlCenter = () => { if (ui.top() && ui.top().isCC) return; ui.push(createControlCenter(), { overlay: true }); };
export const openGuide = () => ui.push(createGuide());

export async function openSearch() {
  const q = await ui.osk({ title: t('search.title') });
  if (q && q.trim()) openLibrary({ search: q.trim() });
}

export async function switchProfileTo(id) {
  store.S.g.lastProfile = id;
  await store.flush();
  try { sessionStorage.setItem('ps-skip-ask', '1'); } catch { /* ignore */ }
  location.reload();
}
export async function openProfileMenu() {
  const profiles = await store.listProfiles();
  const i = await ui.menu({
    title: store.S.p.name, pos: 'right',
    items: [
      { label: t('prof.switch'), icon: 'user', disabled: profiles.length < 2 },
      { label: t('prof.add'), icon: 'plus' },
      { label: t('prof.settings'), icon: 'gear' },
    ],
  });
  if (i === 0) {
    const id = await pickProfile(profiles, { overlay: true });
    if (id && id !== store.S.pid) switchProfileTo(id);
  } else if (i === 1) await addProfile();
  else if (i === 2) openSettings('profile');
}
export async function addProfile() {
  const name = await ui.osk({ title: t('prof.name'), maxLen: 24 });
  if (!name || !name.trim()) return;
  const id = await store.createProfile({ name: name.trim(), color: store.COLORS[Math.floor(Math.random() * store.COLORS.length)], lang: store.settings().lang });
  switchProfileTo(id);
}
export async function powerMenu() {
  const i = await ui.menu({
    title: t('power.title'), pos: 'center',
    items: [
      { label: t('power.sleep'), icon: 'moon' },
      { label: t('power.restart'), icon: 'restart' },
      { label: t('power.shutdown'), icon: 'power' },
      { label: t('power.exit'), icon: 'exit' },
    ],
  });
  if (i < 0) return;
  const action = ['sleep', 'restart', 'shutdown', 'exit'][i];
  if (action !== 'exit' && action !== 'sleep') {
    if (!(await ui.confirmDialog(t('power.title'), t(action === 'restart' ? 'power.askRestart' : 'power.askShutdown'), t('common.yes'), true))) return;
  }
  await store.flush();
  try { await api.power(action); } catch (e) { ui.alertDialog(t('power.title'), String(e)); }
}

export async function addMediaSite() {
  const name = await ui.osk({ title: t('media.siteName'), maxLen: 30 });
  if (!name || !name.trim()) return;
  let url = await ui.osk({ title: t('media.siteUrl'), value: 'https://', maxLen: 200 });
  if (!url) return;
  url = url.trim();
  if (!/^https?:\/\/.+\..+/i.test(url)) { ui.toast(t('media.badUrl'), 'warn'); return; }
  store.S.g.media.push({ id: 'm_' + Date.now().toString(36), name: name.trim(), url, color: store.COLORS[store.S.g.media.length % store.COLORS.length] });
  store.saveGlobal();
  bus.emit('library-changed');
}
