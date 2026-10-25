// PlayStorage by sorokin — © Sorokin Ivan — MIT
// Game library: "All / Recent / Favorites" tabs, sort & filter panel, cover grid with search.
import { el, bus, normName } from '../util.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as bg from '../bg.js';
import * as actions from '../actions.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { artEl } from '../tiles.js';

const COLS = 5;
const SORTS = ['recent', 'added', 'name', 'nameDesc', 'played'];

export function createLibrary({ search = '' } = {}) {
  let tab = 0, zone = 'grid', idx = 0, scrollY = 0, list = [], nodes = [];
  const s = () => store.settings();

  const tabNames = [t('lib.tabAll'), t('lib.tabRecent'), t('lib.tabFav')];
  const tabEls = tabNames.map((n) => el('div', { class: 'ltab' }, n));
  const sortBtn = el('div', { class: 'lib-sortbtn', html: icon('sort') });
  const metaL = el('div', { class: 'meta-l' });
  const metaR = el('div', { class: 'meta-r' });
  const grid = el('div', { class: 'lib-grid' });
  const empty = el('div', { class: 'lib-empty' });
  const inner = el('div', { class: 'lib-inner' }, el('div', { class: 'lib-meta' }, metaL, metaR), grid, empty);
  const view = el('div', { class: 'lib-view' }, inner);
  const root = el('div', { class: 'lib' },
    el('div', { class: 'lib-ico', html: icon('grid') }),
    el('div', { class: 'lib-title' }, search ? t('lib.searchTitle', { q: search }) : t('home.library')),
    el('div', { class: 'lib-tabs' }, tabEls), sortBtn, view);

  function compute() {
    let l = store.visibleGames();
    if (search) { const q = normName(search); l = l.filter((g) => normName(g.name).includes(q)); }
    if (tab === 1) l = l.filter((g) => store.lastPlayed(g.id) > 0);
    if (tab === 2) l = l.filter((g) => store.isFav(g.id));
    const f = s().filters;
    if (f.steam || f.epic || f.exe) l = l.filter((g) => f[g.source]);
    list = store.sortGames(l, tab === 1 ? 'recent' : s().sort);
  }

  function filterText() {
    const f = s().filters, on = ['steam', 'epic', 'exe'].filter((k) => f[k]);
    return on.length ? ' | ' + t('lib.filter') + ': ' + on.map((k) => t('src.' + k)).join(', ') : '';
  }

  function render(keepId) {
    const prevId = keepId || (list[idx] && list[idx].id);
    compute();
    grid.innerHTML = ''; nodes = [];
    list.forEach((g) => {
      const n = el('div', { class: 'gt' }, artEl(g), el('div', { class: 'gt-bar' }, el('span', { class: 'gt-name' }, g.name), el('span', { class: 'gt-st' }, t('lib.installed'))));
      grid.append(n); nodes.push(n);
    });
    empty.textContent = list.length ? '' : search ? t('lib.noResults') : tab === 2 ? t('lib.noFav') : tab === 1 ? t('lib.noRecent') : t('lib.emptyAll');
    metaL.textContent = t('lib.count', { n: list.length });
    metaR.textContent = t('lib.sortedBy') + ': ' + t('sort.' + (tab === 1 ? 'recent' : s().sort)) + filterText();
    const k = list.findIndex((g) => g.id === prevId);
    idx = Math.max(0, Math.min(k >= 0 ? k : idx, list.length - 1));
    paint();
  }

  function paint() {
    tabEls.forEach((n, i) => { n.classList.toggle('active', i === tab); n.classList.toggle('focus', zone === 'tabs' && i === tab); });
    sortBtn.classList.toggle('focus', zone === 'sort');
    nodes.forEach((n, i) => n.classList.toggle('focus', zone === 'grid' && i === idx));
    root.dataset.zone = zone;
    const n = nodes[idx];
    if (n) {
      const vh = view.clientHeight, top = n.offsetTop, h = n.offsetHeight, pad = 24;
      if (idx < COLS) scrollY = 0;
      else if (top - scrollY < 0) scrollY = top - pad;
      else if (top + h - scrollY > vh) scrollY = top + h - vh + pad;
    } else scrollY = 0;
    inner.style.transform = `translateY(${-Math.round(scrollY)}px)`;
  }

  async function filterPanel() {
    for (;;) {
      const f = s().filters, n = ['steam', 'epic', 'exe'].filter((k) => f[k]).length;
      const i = await ui.menu({
        title: t('lib.sortFilter'), pos: 'left',
        items: [
          { label: t('lib.sort'), sub: t('sort.' + s().sort), icon: 'sort' },
          { label: t('lib.source'), sub: n ? String(n) : '', icon: 'folder' },
          { label: t('lib.reset'), icon: 'close', disabled: !n },
        ],
      });
      if (i === 0) {
        const j = await ui.menu({ title: t('lib.sort'), pos: 'left', index: SORTS.indexOf(s().sort), items: SORTS.map((m) => ({ label: t('sort.' + m), checked: m === s().sort })) });
        if (j >= 0) store.setSetting('sort', SORTS[j]);
      } else if (i === 1) {
        const keys = ['steam', 'epic', 'exe'];
        const checks = await ui.menu({ title: t('lib.source'), pos: 'left', mode: 'check', items: keys.map((k) => ({ label: t('src.' + k), checked: f[k] })) });
        keys.forEach((k, j) => { f[k] = !!checks[j]; });
        store.saveProfile();
      } else if (i === 2) { s().filters = { steam: false, epic: false, exe: false }; store.saveProfile(); }
      else break;
      render();
    }
  }

  function setTab(i) { tab = (i + tabEls.length) % tabEls.length; idx = 0; scrollY = 0; render(); }
  function play() { if (list[idx]) actions.launchGame(list[idx]); }

  const offs = [];
  const scr = {
    el: root,
    onEnter() { bg.mode('lib'); render(); },
    onResume() { bg.mode('lib'); render(); },
    onExit() { offs.forEach((f) => f()); },
    onAction(a) {
      if (a === 'guide') { actions.openControlCenter(); return true; }
      if (a === 'tabprev') { setTab(tab - 1); return true; }
      if (a === 'tabnext') { setTab(tab + 1); return true; }
      if (a === 'search') { actions.openSearch(); return true; }
      if (zone === 'grid') {
        if (a === 'left') { if (idx % COLS === 0) { zone = 'sort'; paint(); return true; } idx--; paint(); return true; }
        if (a === 'right') { if (idx < list.length - 1 && idx % COLS < COLS - 1) { idx++; paint(); return true; } return false; }
        if (a === 'up') { if (idx >= COLS) { idx -= COLS; paint(); return true; } zone = 'tabs'; paint(); return true; }
        if (a === 'down') {
          if (idx + COLS < list.length) { idx += COLS; paint(); return true; }
          const lastRowStart = Math.floor((list.length - 1) / COLS) * COLS;
          if (idx < lastRowStart) { idx = list.length - 1; paint(); return true; }
          return false;
        }
        if (a === 'confirm') { play(); return list.length > 0; }
        if (a === 'options') { if (list[idx]) { actions.openGameOptions(list[idx], { inLibrary: true }); return true; } return false; }
        if (a === 'back') { ui.pop(); return true; }
      } else if (zone === 'tabs') {
        if (a === 'left') { setTab(tab - 1); return true; }
        if (a === 'right') { setTab(tab + 1); return true; }
        if (a === 'down' || a === 'confirm') { zone = list.length ? 'grid' : 'tabs'; paint(); return true; }
        if (a === 'back') { ui.pop(); return true; }
      } else { // sort button
        if (a === 'right' || a === 'down') { if (list.length) { zone = 'grid'; paint(); return true; } return false; }
        if (a === 'up') { zone = 'tabs'; paint(); return true; }
        if (a === 'confirm') { filterPanel(); return true; }
        if (a === 'back') { ui.pop(); return true; }
      }
      return false;
    },
  };
  offs.push(bus.on('library-changed', () => render()));
  offs.push(bus.on('art', () => render()));
  return scr;
}
