// PlayStorage by sorokin — applies the result of a finished game session (play time).
import * as api from './api.js';
import * as store from './store.js';
import * as ui from './ui.js';
import { t, fmtPlaytime } from './i18n.js';
import { bus } from './util.js';

export async function applySession() {
  const s = await api.readJson('session.json');
  if (!s) return;
  await api.storageDelete('session.json');
  const sec = Number(s.seconds) || 0;
  if (store.S.p && s.profile === store.S.pid) {
    store.addPlaytime(store.S.p, s.gameId, sec);
    store.saveProfile();
  } else if (s.profile) {
    const p = await api.readJson(`profiles/${s.profile}.json`);
    if (p) { p.playtime = p.playtime || {}; p.playtime[s.gameId] = (p.playtime[s.gameId] || 0) + sec; await api.writeJson(`profiles/${s.profile}.json`, p); }
  }
  bus.emit('session', s);
  const g = store.getGame(s.gameId);
  if (g && sec >= 60) ui.toast(t('session.played', { name: g.name, time: fmtPlaytime(sec) }), 'clock', 5000);
}
