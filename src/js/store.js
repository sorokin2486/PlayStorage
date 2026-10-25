// PlayStorage by sorokin — © Sorokin Ivan — MIT
// State + persistence. Everything lives in %APPDATA%\PlayStorage:
//   global.json            shared: game library, scanned folders, media shortcuts
//   profiles/<id>.json     per profile: settings, favorites, hidden, play time
import * as api from './api.js';
import { setLang } from './i18n.js';
import { uid, normPath, normName, baseName } from './util.js';

export const DEFAULT_SETTINGS = {
  lang: 'ru', textSize: 'normal', boldText: false, highContrast: false, reduceMotion: false,
  invert: false, colorFilter: 'off', uiSounds: true, volume: 70, uiScale: 100, bgDim: 55,
  coverShape: 'square', glyphs: 'auto', confirmBtn: 'cross', clock24: true, showClock: true,
  freeMemory: true, notifications: true, downloadArt: true, fullscreen: true, sort: 'recent',
  filters: { steam: false, epic: false, exe: false }, monitor: 0,
};
export const COLORS = ['#2f7bff', '#8a4dff', '#e0489a', '#ff7a2f', '#1fb89a', '#e5b92a', '#e5534b', '#7a8599'];

export const PRESET_MEDIA = [
  { key: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/tv', color: '#d9261c' },
  { key: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv', color: '#7a3fe0' },
  { key: 'netflix', name: 'Netflix', url: 'https://www.netflix.com', color: '#b3131b' },
  { key: 'spotify', name: 'Spotify', url: 'https://open.spotify.com', color: '#169c46' },
  { key: 'kinopoisk', name: 'Кинопоиск', url: 'https://www.kinopoisk.ru', color: '#e0641a' },
  { key: 'rutube', name: 'Rutube', url: 'https://rutube.ru', color: '#1b2a4a' },
  { key: 'vkvideo', name: 'VK Видео', url: 'https://vkvideo.ru', color: '#2a6fe0' },
  { key: 'prime', name: 'Prime Video', url: 'https://www.primevideo.com', color: '#0b6fa8' },
];
export const presetMedia = () => PRESET_MEDIA.map((m) => ({ id: 'm_' + m.key, preset: m.key, name: m.name, url: m.url, color: m.color }));

export const S = { g: null, p: null, pid: null };

const timers = {};
function queue(kind, fn) { clearTimeout(timers[kind]); timers[kind] = setTimeout(fn, 350); }

export async function loadGlobal() {
  const raw = (await api.readJson('global.json')) || {};
  S.g = { v: 1, lang: null, folders: [], games: [], media: null, lastProfile: null, askProfile: true, mediaMode: 'browser', sizes: {}, sizesAt: 0, ...raw };
  if (!Array.isArray(S.g.media)) S.g.media = presetMedia();
}
export const saveGlobal = () => queue('g', () => api.writeJson('global.json', S.g));
export const saveProfile = () => queue('p', () => S.p && api.writeJson(`profiles/${S.pid}.json`, S.p));
export async function flush() {
  clearTimeout(timers.g); clearTimeout(timers.p);
  await api.writeJson('global.json', S.g);
  if (S.p) await api.writeJson(`profiles/${S.pid}.json`, S.p);
}

function mergeProfile(raw) {
  const p = { v: 1, id: '', name: 'Player', color: COLORS[0], created: Date.now(), favorites: [], hidden: [], playtime: {}, lastPlayed: {}, ...raw };
  p.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  p.settings.filters = { ...DEFAULT_SETTINGS.filters, ...(p.settings.filters || {}) };
  return p;
}
export async function listProfiles() {
  const names = (await api.storageList('profiles')).filter((n) => n.endsWith('.json'));
  const out = [];
  for (const n of names) {
    const p = await api.readJson('profiles/' + n);
    if (p && p.id) out.push({ id: p.id, name: p.name, color: p.color });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
export async function createProfile({ name, color, lang }) {
  const id = uid('p');
  const p = mergeProfile({ id, name, color: color || COLORS[0], settings: { lang } });
  await api.writeJson(`profiles/${id}.json`, p);
  return id;
}
export async function loadProfile(id) {
  const raw = await api.readJson(`profiles/${id}.json`);
  S.p = mergeProfile(raw || { id, name: 'Player' });
  S.pid = id;
  S.g.lastProfile = id; S.g.lang = S.p.settings.lang;
  setLang(S.p.settings.lang);
  saveGlobal();
}
export async function deleteProfile(id) { await api.storageDelete(`profiles/${id}.json`); }
export const settings = () => S.p.settings;
export function setSetting(k, v) { S.p.settings[k] = v; saveProfile(); }

// ── games ──
export const allGames = () => S.g.games;
export const getGame = (id) => S.g.games.find((g) => g.id === id);
export const isHidden = (id) => S.p.hidden.includes(id);
export const isFav = (id) => S.p.favorites.includes(id);
export const visibleGames = () => S.g.games.filter((g) => !isHidden(g.id));
export const hiddenGames = () => S.g.games.filter((g) => isHidden(g.id));
export const playtime = (id) => S.p.playtime[id] || 0;
export const lastPlayed = (id) => S.p.lastPlayed[id] || 0;

export function sortGames(list, mode) {
  const a = [...list];
  const by = {
    recent: (x, y) => lastPlayed(y.id) - lastPlayed(x.id) || (y.added || 0) - (x.added || 0),
    added: (x, y) => (y.added || 0) - (x.added || 0),
    name: (x, y) => x.name.localeCompare(y.name),
    nameDesc: (x, y) => y.name.localeCompare(x.name),
    played: (x, y) => playtime(y.id) - playtime(x.id),
  };
  return a.sort(by[mode] || by.recent);
}
export function addGames(found) {
  const added = [];
  for (const f of found) {
    const dupe = S.g.games.find((g) => (f.steamAppid && g.steamAppid === f.steamAppid) || (f.exe && normPath(g.exe) === normPath(f.exe)));
    if (dupe) continue;
    const g = { id: uid('g'), name: f.name, exe: f.exe, dir: f.dir, source: f.source, steamAppid: f.steamAppid || null,
      added: Date.now(), candidates: f.candidates || [], art: {}, customCover: false };
    S.g.games.push(g); added.push(g);
  }
  if (added.length) saveGlobal();
  return added;
}
export function updateGame(id, patch) { const g = getGame(id); if (g) { Object.assign(g, patch); saveGlobal(); } return g; }
export function removeGame(id) {
  S.g.games = S.g.games.filter((g) => g.id !== id);
  S.p.favorites = S.p.favorites.filter((x) => x !== id);
  S.p.hidden = S.p.hidden.filter((x) => x !== id);
  saveGlobal(); saveProfile();
}
export function toggleFav(id) { const i = S.p.favorites.indexOf(id); i < 0 ? S.p.favorites.push(id) : S.p.favorites.splice(i, 1); saveProfile(); }
export function setHidden(id, on) { const i = S.p.hidden.indexOf(id); if (on && i < 0) S.p.hidden.push(id); if (!on && i >= 0) S.p.hidden.splice(i, 1); saveProfile(); }
export function recordLaunch(id) { S.p.lastPlayed[id] = Date.now(); }
export function addPlaytime(profile, id, sec) {
  if (profile.playtime) profile.playtime[id] = (profile.playtime[id] || 0) + sec;
}
export function addFolder(path) {
  if (!S.g.folders.some((f) => normPath(f) === normPath(path))) { S.g.folders.push(path); saveGlobal(); return true; }
  return false;
}
export function removeFolder(path) { S.g.folders = S.g.folders.filter((f) => f !== path); saveGlobal(); }
export function displayName(g) { return g.name || baseName(g.dir) || baseName(g.exe); }
export { normName };
