// PlayStorage by sorokin — "Who's playing?" profile picker.
import { el } from '../util.js';
import * as ui from '../ui.js';
import * as bg from '../bg.js';
import { t } from '../i18n.js';
import { avatar } from '../tiles.js';

// resolves a profile id (or null when cancelled in overlay mode)
export function pickProfile(profiles, { overlay = false } = {}) {
  return new Promise((resolve) => {
    let idx = 0;
    const cards = profiles.map((p) => el('div', { class: 'pcard' }, avatar(p, 'lg'), el('div', { class: 'pname' }, p.name)));
    const paint = () => cards.forEach((c, i) => c.classList.toggle('focus', i === idx));
    const done = (v) => { ui.pop(scr); resolve(v); };
    const scr = {
      el: el('div', { class: 'profiles' }, el('div', { class: 'prof-title' }, t('prof.who')), el('div', { class: 'prof-row' }, cards)),
      onEnter() { bg.mode('spot'); paint(); },
      onAction(a) {
        if (a === 'left') { if (idx > 0) { idx--; paint(); return true; } return false; }
        if (a === 'right') { if (idx < cards.length - 1) { idx++; paint(); return true; } return false; }
        if (a === 'confirm') { done(profiles[idx].id); return true; }
        if (a === 'back' && overlay) { done(null); return true; }
        return false;
      },
    };
    ui.push(scr, { overlay });
  });
}
