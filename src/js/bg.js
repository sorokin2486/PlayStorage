// PlayStorage by sorokin — full-screen background with cross-fade between artworks.
let root, layers = [], cur = 0, last = '', token = 0;
export function init(r) {
  root = r; root.innerHTML = '';
  layers = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'bg-layer'; root.appendChild(d); return d; });
  for (const c of ['bg-shade', 'bg-spot', 'bg-ribbon']) { const d = document.createElement('div'); d.className = c; root.appendChild(d); }
  mode('art');
}
export function mode(m) { if (root) root.dataset.mode = m; }
// art({hero, cover, grad}) — hero: wide artwork, cover: portrait cover (blurred), grad: CSS gradient
export function art({ hero, cover, grad } = {}) {
  const key = hero || cover || grad || '';
  if (key === last) return;
  last = key;
  const my = ++token;
  const apply = () => {
    if (my !== token) return;
    const n = layers[1 - cur], o = layers[cur];
    n.className = 'bg-layer' + (hero ? ' hero' : cover ? ' blur' : grad ? ' grad' : '');
    n.style.background = '';
    n.style.backgroundImage = hero ? `url("${hero}")` : cover ? `url("${cover}")` : '';
    if (!hero && !cover && grad) n.style.background = grad;
    n.classList.add('on'); o.classList.remove('on');
    cur = 1 - cur;
  };
  const url = hero || cover;
  if (url && typeof Image !== 'undefined') {
    const im = new Image(); im.src = url;
    (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(apply);
  } else apply();
}
export const clear = () => art({});
