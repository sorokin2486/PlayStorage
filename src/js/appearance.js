// PlayStorage by sorokin — applies display / accessibility settings to the document.
import { S } from './store.js';
import { setLang } from './i18n.js';
const TEXT = { small: 0.88, normal: 1, large: 1.15, xlarge: 1.3 };
export function applySettings() {
  const s = S.p.settings, r = document.documentElement;
  setLang(s.lang);
  r.style.setProperty('--ui', String(s.uiScale / 100));
  r.style.setProperty('--tx', String(TEXT[s.textSize] || 1));
  r.style.setProperty('--dim', String(s.bgDim / 100));
  r.classList.toggle('bold-text', !!s.boldText);
  r.classList.toggle('hc', !!s.highContrast);
  r.classList.toggle('rm', !!s.reduceMotion);
  r.classList.toggle('sq', s.coverShape !== 'portrait');
  const f = [];
  if (s.invert) f.push('invert(1) hue-rotate(180deg)');
  if (s.colorFilter === 'gray') f.push('grayscale(1)');
  else if (s.colorFilter === 'protan') f.push('url(#cf-protan)');
  else if (s.colorFilter === 'deutan') f.push('url(#cf-deutan)');
  else if (s.colorFilter === 'tritan') f.push('url(#cf-tritan)');
  const root = document.getElementById('root');
  if (root) root.style.filter = f.join(' ');
}
