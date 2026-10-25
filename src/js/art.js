// PlayStorage by sorokin — cover / hero / logo download queue (Steam CDN, cached on disk).
import * as api from './api.js';
import * as store from './store.js';
import { bus } from './util.js';

const queue = [];
let running = false;
export function enqueue(games) {
  for (const g of games) if (!queue.includes(g)) queue.push(g);
  run();
}
async function run() {
  if (running) return;
  running = true; let n = 0;
  while (queue.length) {
    const g = queue.shift();
    try { await fetchOne(g); n++; } catch (e) { console.warn('art failed', g.name, e); }
  }
  running = false;
  bus.emit('art-done', n);
}
export async function fetchOne(g, force = false) {
  const s = store.settings();
  const art = { ...(g.art || {}) };
  if (s.downloadArt && (force || !art.cover || !art.hero)) {
    const r = await api.fetchArt(g.id, g.name, g.steamAppid);
    if (r) {
      if (r.cover && !g.customCover) art.cover = r.cover;
      if (r.hero) art.hero = r.hero;
      if (r.logo) art.logo = r.logo;
    }
  }
  if (!art.cover && !art.icon && g.exe) {
    const ic = await api.extractIcon(g.id, g.exe);
    if (ic) art.icon = ic;
  }
  store.updateGame(g.id, { art });
  bus.emit('art', g.id);
}
export async function fetchMissing() {
  const list = store.allGames().filter((g) => !(g.art && g.art.cover));
  enqueue(list);
  return list.length;
}
