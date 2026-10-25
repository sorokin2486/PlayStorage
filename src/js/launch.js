// PlayStorage by sorokin — launches a game and hands the screen over to it.
import { el, sleep } from './util.js';
import * as api from './api.js';
import * as store from './store.js';
import * as ui from './ui.js';
import * as bg from './bg.js';
import { t } from './i18n.js';
import { artEl } from './tiles.js';

let current = null;
export function dismissLaunch() { if (current) { ui.pop(current); current = null; } }

export async function launchGame(g) {
  if (current) return;
  const s = store.settings();
  store.recordLaunch(g.id);
  await store.flush();
  const a = g.art || {};
  const scr = {
    el: el('div', { class: 'launch' },
      el('div', { class: 'launch-art' }, artEl(g)),
      el('div', { class: 'launch-name' }, g.name),
      el('div', { class: 'launch-sub' }, el('div', { class: 'spin' }), el('span', {}, t('launch.starting')))),
    onAction: () => 'none',
  };
  current = scr;
  ui.push(scr, { overlay: true });
  if (a.hero) bg.art({ hero: api.assetUrl(a.hero) });
  await sleep(document.documentElement.classList.contains('rm') ? 100 : 1100);
  try {
    await api.launchGame({
      id: g.id, exe: g.exe || '', dir: g.dir || '', steamAppid: g.steamAppid || null,
      args: null, profile: store.S.pid, freeMemory: !!s.freeMemory,
    });
  } catch (e) {
    dismissLaunch();
    ui.alertDialog(t('launch.failed'), String(e && e.message ? e.message : e));
  }
}
