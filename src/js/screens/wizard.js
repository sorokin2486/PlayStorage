// PlayStorage by sorokin — first-run setup: language → profile name → add games.
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as bg from '../bg.js';
import { t, setLang, LANGS } from '../i18n.js';
import { applySettings } from '../appearance.js';
import { addFolderAndScan, runDetect } from './addflow.js';

export async function runWizard() {
  bg.mode('spot');
  const sys = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  let li = -1;
  while (li < 0) li = await ui.menu({ title: 'Language / Язык', pos: 'center', index: LANGS.findIndex((l) => l.id === sys), items: LANGS.map((l) => ({ label: l.name })) });
  const lang = LANGS[li].id;
  setLang(lang);
  await ui.dialog({ title: t('wiz.welcome'), text: t('wiz.welcomeText'), buttons: [{ label: t('wiz.start') }], wide: true });
  let name = '';
  while (!name) { const v = await ui.osk({ title: t('wiz.name'), maxLen: 24 }); name = (v || '').trim(); }
  const id = await store.createProfile({ name, color: store.COLORS[0], lang });
  await store.loadProfile(id);
  applySettings();
  let again = true;
  while (again) {
    const i = await ui.dialog({
      title: t('wiz.gamesTitle'), text: t('wiz.gamesText'), wide: true,
      buttons: [{ label: t('wiz.auto') }, { label: t('wiz.folder') }, { label: t('wiz.skip') }], def: 0, cancel: 2,
    });
    if (i === 0) { const n = await runDetect(); again = n === 0 && (await ui.confirmDialog(t('wiz.gamesTitle'), t('wiz.retry'), t('common.yes'))); }
    else if (i === 1) { const n = await addFolderAndScan(); again = n === 0 && (await ui.confirmDialog(t('wiz.gamesTitle'), t('wiz.retry'), t('common.yes'))); }
    else again = false;
  }
  await store.flush();
}
