// PlayStorage by sorokin — shared tile / avatar builders.
import { el, hash } from './util.js';
import * as api from './api.js';
import { icon } from './icons.js';

export const gradFor = (name) => {
  const h = hash(name || 'x') % 360;
  return `linear-gradient(145deg, hsl(${h} 45% 30%), hsl(${(h + 40) % 360} 50% 12%))`;
};
export function artEl(g) {
  const a = g.art || {};
  if (a.cover) return el('img', { class: 'art', src: api.assetUrl(a.cover), decoding: 'async', draggable: 'false', alt: '' });
  return el('div', { class: 'art gen', style: { background: gradFor(g.name) } },
    a.icon ? el('img', { class: 'gen-ic', src: api.assetUrl(a.icon), alt: '' }) : null,
    el('span', { class: 'gen-t' }, g.name));
}
export const gameTile = (g) => el('div', { class: 'tile' }, artEl(g));
export const specialTile = (ic) => el('div', { class: 'tile special', html: icon(ic) });
export function mediaTile(m) {
  return el('div', { class: 'tile media', style: { background: `linear-gradient(150deg, ${m.color}, #0b0d14 140%)` } },
    el('span', { class: 'media-n' }, m.name));
}
export function avatar(p, cls = '') {
  const name = (p && p.name) || '?';
  return el('div', { class: 'avatar ' + cls, style: { background: (p && p.color) || '#2f7bff' } }, Array.from(name)[0].toUpperCase());
}
export const sourceLabel = (g) => (g.source === 'steam' ? 'Steam' : g.source === 'epic' ? 'Epic' : 'PC');
