// PlayStorage by sorokin — Control Center (Guide / Tab / Home key): quick actions bar.
import { el } from '../util.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as actions from '../actions.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { avatar } from '../tiles.js';

export function createControlCenter() {
  let idx = 0, lastVol = 70;
  const vol = () => store.settings().volume;
  const defs = [
    { id: 'home', icon: 'home', label: () => t('cc.home') },
    { id: 'library', icon: 'grid', label: () => t('cc.library') },
    { id: 'volume', icon: 'speaker', label: () => t('cc.volume', { n: vol() }) },
    { id: 'profile', icon: 'user', label: () => store.S.p.name },
    { id: 'settings', icon: 'gear', label: () => t('cc.settings') },
    { id: 'power', icon: 'power', label: () => t('cc.power') },
  ];
  const btns = defs.map((d) => {
    const b = el('div', { class: 'cc-b' }, el('div', { class: 'cc-c', html: d.id === 'profile' ? '' : icon(d.icon) }), el('div', { class: 'cc-l' }));
    if (d.id === 'profile') b.firstChild.append(avatar(store.S.p, 'sm'));
    return b;
  });
  const paint = () => btns.forEach((b, i) => { b.classList.toggle('focus', i === idx); b.lastChild.textContent = defs[i].label(); });
  const close = () => ui.pop(scr);
  const go = (fn) => { close(); setTimeout(fn, 120); };
  const scr = {
    isCC: true,
    el: el('div', { class: 'cc-wrap' }, el('div', { class: 'cc-bar' }, btns)),
    onEnter: paint,
    onAction(a) {
      const id = defs[idx].id;
      if (a === 'left') { if (idx > 0) { idx--; paint(); return true; } return false; }
      if (a === 'right') { if (idx < defs.length - 1) { idx++; paint(); return true; } return false; }
      if ((a === 'up' || a === 'down') && id === 'volume') {
        store.setSetting('volume', Math.max(0, Math.min(100, vol() + (a === 'up' ? 10 : -10)))); paint(); return true;
      }
      if (a === 'back' || a === 'guide' || a === 'down') { close(); return true; }
      if (a === 'confirm') {
        if (id === 'home') go(() => ui.popToRoot());
        else if (id === 'library') go(() => actions.openLibrary());
        else if (id === 'settings') go(() => actions.openSettings());
        else if (id === 'profile') go(() => actions.openProfileMenu());
        else if (id === 'power') go(() => actions.powerMenu());
        else if (id === 'volume') { if (vol() > 0) { lastVol = vol(); store.setSetting('volume', 0); } else store.setSetting('volume', lastVol || 70); paint(); }
        return true;
      }
      return false;
    },
  };
  return scr;
}
