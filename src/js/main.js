// PlayStorage by sorokin — © Sorokin Ivan — MIT
// Entry point: load data → (first run wizard | profile picker) → home screen.
import * as api from './api.js';
import * as store from './store.js';
import * as ui from './ui.js';
import * as bg from './bg.js';
import * as input from './input.js';
import * as sound from './sound.js';
import { setLang } from './i18n.js';
import { applySettings } from './appearance.js';
import { applySession } from './session.js';
import { dismissLaunch } from './launch.js';
import { createHome } from './screens/home.js';
import { runWizard } from './screens/wizard.js';
import { pickProfile } from './screens/profiles.js';
import * as art from './art.js';

function fatal(e) {
  console.error(e);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:4rem;background:#100;color:#fcc;font:14px monospace;white-space:pre-wrap;overflow:auto;z-index:99999';
  pre.textContent = 'PlayStorage error\n\n' + (e && e.stack ? e.stack : String(e));
  document.body.append(pre);
  api.uiReady().catch(() => {});
}
window.addEventListener('error', (ev) => { if (!window.__booted) fatal(ev.error || ev.message); });

async function boot() {
  ui.init(document.getElementById('screens'));
  bg.init(document.getElementById('bg'));
  await api.init();
  await store.loadGlobal();
  const sys = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  setLang(store.S.g.lang || sys);
  input.start();

  let profiles = await store.listProfiles();
  api.uiReady().catch(() => {});
  if (!profiles.length) {
    await runWizard();
  } else {
    let id = store.S.g.lastProfile;
    let skip = false;
    try { skip = sessionStorage.getItem('ps-skip-ask') === '1'; sessionStorage.removeItem('ps-skip-ask'); } catch { /* ignore */ }
    const known = profiles.find((p) => p.id === id);
    if (!known || (store.S.g.askProfile && profiles.length > 1 && !skip)) id = await pickProfile(profiles);
    await store.loadProfile(id);
  }
  applySettings();
  if (store.settings().fullscreen === false) api.setFullscreen(false).catch(() => {});
  await applySession();
  ui.push(createHome());
  window.__booted = true;
  sound.play('start');

  api.listen('session-ended', async () => { await applySession(); dismissLaunch(); });
  art.fetchMissing().catch(() => {});
}

boot().catch(fatal);
