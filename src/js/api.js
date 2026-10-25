// PlayStorage by sorokin — © Sorokin Ivan — MIT
// Thin wrapper over the Tauri backend. Falls back to a browser mock so index.html can be
// opened in a normal browser for development.
const T = typeof window !== 'undefined' ? window.__TAURI__ : null;
export const hasTauri = !!(T && T.core);
let dataDirPath = '';

const mem = {};
const mockStore = {
  get: (k) => (typeof localStorage !== 'undefined' ? localStorage.getItem('ps:' + k) : mem[k] ?? null),
  set: (k, v) => (typeof localStorage !== 'undefined' ? localStorage.setItem('ps:' + k, v) : (mem[k] = v)),
  del: (k) => (typeof localStorage !== 'undefined' ? localStorage.removeItem('ps:' + k) : delete mem[k]),
  keys: () => (typeof localStorage !== 'undefined' ? Object.keys(localStorage).filter((k) => k.startsWith('ps:')).map((k) => k.slice(3)) : Object.keys(mem)),
};
async function mockInvoke(cmd, a = {}) {
  switch (cmd) {
    case 'data_dir': return 'C:\\Mock\\PlayStorage';
    case 'storage_read': return mockStore.get(a.rel);
    case 'storage_write': return mockStore.set(a.rel, a.data);
    case 'storage_delete': return mockStore.keys().filter((k) => k === a.rel || k.startsWith(a.rel + '/')).forEach(mockStore.del);
    case 'storage_list': {
      const pre = a.rel ? a.rel + '/' : '';
      return [...new Set(mockStore.keys().filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length).split('/')[0]))];
    }
    case 'fs_roots': return [{ name: 'C:\\', path: 'C:\\', isDir: true }, { name: 'D:\\', path: 'D:\\', isDir: true }];
    case 'fs_list': return [{ name: 'Games', path: a.path + 'Games\\', isDir: true }, { name: 'game.exe', path: a.path + 'game.exe', isDir: false }];
    case 'fs_parent': return null;
    case 'scan_folders': case 'detect_launchers':
      return [{ name: 'Demo Game', exe: 'D:\\Games\\Demo\\demo.exe', dir: 'D:\\Games\\Demo', source: 'exe', steamAppid: null, candidates: ['D:\\Games\\Demo\\demo.exe'] }];
    case 'fetch_art': return { steamAppid: null, matched: null, cover: null, hero: null, logo: null };
    case 'extract_icon': return null;
    case 'disk_info': return [{ mount: 'C:\\', total: 5e11, free: 2e11 }, { mount: 'D:\\', total: 1e12, free: 6e11 }];
    case 'dir_sizes': return (a.paths || []).map(() => 3e10);
    case 'list_monitors': return [{ name: 'Monitor 1', width: 1920, height: 1080 }];
    case 'get_autostart': return false;
    case 'app_info': return { version: '1.0.0', os: 'browser', arch: 'x', author: 'Sorokin Ivan' };
    default: return null;
  }
}
const inv = hasTauri ? (c, a) => T.core.invoke(c, a) : mockInvoke;

export async function init() { dataDirPath = await inv('data_dir'); }
export const dataDir = () => dataDirPath;

export async function readJson(rel) {
  const s = await inv('storage_read', { rel });
  if (s == null) return null;
  try { return JSON.parse(s); } catch { await inv('storage_write', { rel: rel + '.bad', data: s }); return null; }
}
export const writeJson = (rel, obj) => inv('storage_write', { rel, data: JSON.stringify(obj) });
export const storageDelete = (rel) => inv('storage_delete', { rel });
export const storageList = (rel) => inv('storage_list', { rel });
export const storageImport = (src, rel) => inv('storage_import', { src, rel });

export function assetUrl(rel) {
  if (!rel) return '';
  const sep = dataDirPath.includes('\\') ? '\\' : '/';
  const full = dataDirPath + sep + String(rel).split('/').join(sep);
  return hasTauri ? T.core.convertFileSrc(full) : 'file:///' + full;
}
export const listen = (ev, cb) => (hasTauri ? T.event.listen(ev, cb) : Promise.resolve(() => {}));

export const fsRoots = () => inv('fs_roots');
export const fsList = (path, filter) => inv('fs_list', { path, filter });
export const fsParent = (path) => inv('fs_parent', { path });
export const fsReadText = (path) => inv('fs_read_text', { path });
export const fsWriteText = (path, data) => inv('fs_write_text', { path, data });
export const scanFolders = (roots) => inv('scan_folders', { roots });
export const detectLaunchers = () => inv('detect_launchers');
export const fetchArt = (gameId, name, steamAppid) => inv('fetch_art', { gameId, name, steamAppid: steamAppid || null });
export const extractIcon = (gameId, exe) => inv('extract_icon', { gameId, exe });
export const launchGame = (spec) => inv('launch_game', { spec });
export const uiReady = () => inv('ui_ready');
export const openUrl = (url, mode) => inv('open_url', { url, mode: mode || 'browser' });
export const openFolder = (path) => inv('open_folder', { path });
export const power = (action) => inv('system_power', { action });
export const diskInfo = () => inv('disk_info');
export const dirSizes = (paths) => inv('dir_sizes', { paths });
export const monitors = () => inv('list_monitors');
export const setMonitor = (index) => inv('set_monitor', { index });
export const setFullscreen = (on) => inv('set_fullscreen', { on });
export const getAutostart = () => inv('get_autostart');
export const setAutostart = (on) => inv('set_autostart', { on });
export const appInfo = () => inv('app_info');
