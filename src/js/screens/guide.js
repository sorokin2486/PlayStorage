// PlayStorage by sorokin — in-app user guide viewer (scrollable with D-pad / arrows).
import { el } from '../util.js';
import * as ui from '../ui.js';
import * as bg from '../bg.js';
import { t, lang } from '../i18n.js';
import ru from '../../guide/ru.js';
import en from '../../guide/en.js';

export function createGuide() {
  const body = el('div', { class: 'guide-body', html: (lang() === 'ru' ? ru : en) });
  const root = el('div', { class: 'guide' }, el('div', { class: 'set-title' }, t('guide.title')), body,
    ui.hintbar([{ action: 'back', text: t('common.back') }]));
  const step = () => body.clientHeight * 0.35;
  return {
    el: root,
    onEnter() { bg.mode('spot'); },
    onResume() { bg.mode('spot'); },
    onAction(a) {
      if (a === 'down') { body.scrollTop += step(); return 'move'; }
      if (a === 'up') { body.scrollTop -= step(); return 'move'; }
      if (a === 'tabnext') { body.scrollTop += body.clientHeight * 0.9; return 'move'; }
      if (a === 'tabprev') { body.scrollTop -= body.clientHeight * 0.9; return 'move'; }
      if (a === 'back') { ui.pop(); return true; }
      return false;
    },
  };
}
