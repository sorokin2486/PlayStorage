// PlayStorage by sorokin — © Sorokin Ivan — MIT
export const $ = (s, r = document) => r.querySelector(s);

export function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const uid = (p = 'g') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const normName = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export const normPath = (p) => String(p || '').replace(/\//g, '\\').toLowerCase();
export const baseName = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';

// tiny event bus
const subs = {};
export const bus = {
  on(ev, fn) { (subs[ev] ||= new Set()).add(fn); return () => subs[ev].delete(fn); },
  emit(ev, data) { (subs[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); },
};
