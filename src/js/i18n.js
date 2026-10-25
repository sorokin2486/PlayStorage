// PlayStorage by sorokin — © Sorokin Ivan — MIT
import ru from './i18n/ru.js';
import en from './i18n/en.js';
const D = { ru, en };
let L = 'ru';
export const LANGS = [{ id: 'ru', name: 'Русский' }, { id: 'en', name: 'English' }];
export function setLang(l) { L = D[l] ? l : 'en'; document.documentElement.lang = L; }
export const lang = () => L;
export function t(key, vars) {
  let s = D[L][key] ?? D.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
  return s;
}
export function fmtPlaytime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  if (sec < 60) return t('time.none');
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? t('time.hm', { h, m }) : t('time.m', { m });
}
export function fmtBytes(n) {
  const u = L === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; n = Number(n) || 0;
  while (n >= 1024 && i < 4) { n /= 1024; i++; }
  const v = i >= 3 ? n.toFixed(2) : n.toFixed(i ? 1 : 0);
  return (L === 'ru' ? v.replace('.', ',') : v) + ' ' + u[i];
}
export function fmtAgo(ts) {
  if (!ts) return t('time.never');
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return t('time.today');
  if (days === 1) return t('time.yesterday');
  return t('time.daysAgo', { n: days });
}
