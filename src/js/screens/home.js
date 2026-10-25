// PlayStorage by sorokin — © Sorokin Ivan — MIT
// Home screen: "Games / Media" tabs, tile shelf, game hub (Play button, stats), top bar.
import { el, bus, debounce } from '../util.js';
import * as api from '../api.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as bg from '../bg.js';
import * as actions from '../actions.js';
import { t, lang, fmtPlaytime, fmtAgo } from '../i18n.js';
import { icon } from '../icons.js';
import { gameTile, specialTile, mediaTile, avatar, gradFor, sourceLabel } from '../tiles.js';

const TOP = ['games', 'media', 'search', 'settings', 'profile'];

export function createHome() {
  let tab = 'games', zone = 'shelf', idx = 0, topIdx = 0, hubIdx = 0;
  let items = [], tiles = [];

  const tabGames = el('div', { class: 'tab' }, t('home.games'));
  const tabMedia = el('div', { class: 'tab' }, t('home.media'));
  const iSearch = el('div', { class: 'ti', html: icon('search') });
  const iGear = el('div', { class: 'ti', html: icon('gear') });
  const iUser = el('div', { class: 'ti av' });
  const clock = el('div', { class: 'clock' });
  const topEls = [tabGames, tabMedia, iSearch, iGear, iUser];

  const track = el('div', { class: 'track' });
  const label = el('div', { class: 'shelf-label' });
  const hubLogo = el('div', { class: 'hub-logo' });
  const btnPlay = el('div', { class: 'btn-play' }, el('span', { html: icon('play') }), el('span', {}, t('hub.play')));
  const btnMore = el('div', { class: 'btn-more', html: icon('more') });
  const hubStats = el('div', { class: 'hub-stats' });
  const hubDesc = el('div', { class: 'hub-desc' });
  const hub = el('div', { class: 'hub' }, hubLogo, hubDesc, el('div', { class: 'hub-btns' }, btnPlay, btnMore), hubStats);

  const root = el('div', { class: 'home', 'data-zone': 'shelf' },
    el('div', { class: 'topbar' }, el('div', { class: 'tabs' }, tabGames, tabMedia), el('div', { class: 'tright' }, iSearch, iGear, iUser, clock)),
    el('div', { class: 'shelf' }, track), label, hub);

  // ── data ──
  function buildItems() {
    if (tab === 'games') {
      const list = store.sortGames(store.visibleGames(), 'recent').slice(0, 20);
      items = [{ k: 'add' }, ...list.map((g) => ({ k: 'game', g })), { k: 'lib' }];
    } else {
      items = [...store.S.g.media.map((m) => ({ k: 'media', m })), { k: 'mediaadd' }];
    }
  }
  function renderShelf() {
    track.innerHTML = '';
    tiles = items.map((it) => {
      const n = it.k === 'game' ? gameTile(it.g) : it.k === 'media' ? mediaTile(it.m) : it.k === 'add' || it.k === 'mediaadd' ? specialTile('plus') : specialTile('grid');
      track.append(n);
      return n;
    });
  }
  const defaultIdx = () => (tab === 'games' && items.length > 2 ? 1 : 0);

  // ── painting ──
  const paintTop = () => {
    tabGames.classList.toggle('active', tab === 'games');
    tabMedia.classList.toggle('active', tab === 'media');
    topEls.forEach((n, i) => n.classList.toggle('focus', zone === 'top' && i === topIdx));
  };
  const paintHub = () => {
    btnPlay.classList.toggle('focus', zone === 'hub' && hubIdx === 0);
    btnMore.classList.toggle('focus', zone === 'hub' && hubIdx === 1);
  };
  const paintZone = () => { root.dataset.zone = zone; paintTop(); paintHub(); };

  function paintHubContent() {
    const it = items[idx];
    hub.className = 'hub';
    hubLogo.innerHTML = ''; hubStats.innerHTML = ''; hubDesc.textContent = '';
    if (!it) return;
    if (it.k === 'game') {
      const g = it.g, a = g.art || {};
      hub.classList.add('game');
      if (a.logo) hubLogo.append(el('img', { src: api.assetUrl(a.logo), alt: g.name }));
      else hubLogo.append(el('div', { class: 'hub-title' }, g.name));
      btnPlay.lastChild.textContent = t('hub.play');
      hubStats.append(
        el('div', { class: 'stat' }, el('span', { class: 'stat-ic', html: icon('clock') }), el('div', {}, el('small', {}, t('hub.played')), el('b', {}, fmtPlaytime(store.playtime(g.id))))),
        el('div', { class: 'stat' }, el('div', {}, el('small', {}, t('hub.last')), el('b', {}, fmtAgo(store.lastPlayed(g.id))))));
    } else if (it.k === 'media') {
      hub.classList.add('mediahub');
      hubLogo.append(el('div', { class: 'hub-title' }, it.m.name));
      hubDesc.textContent = it.m.preset ? t('media.desc.' + it.m.preset) : it.m.url;
      btnPlay.lastChild.textContent = t('hub.open');
    } else if (it.k === 'add' && !store.allGames().length) {
      hub.classList.add('hint');
      hubDesc.textContent = t('home.emptyHint');
    }
  }
  function paintLabel() {
    const it = items[idx]; label.innerHTML = '';
    if (!it) return;
    if (it.k === 'game') label.append(el('span', {}, it.g.name), el('span', { class: 'plat' }, ' | ' + sourceLabel(it.g)));
    else if (it.k === 'media') label.append(el('span', {}, it.m.name));
    else label.append(el('span', {}, it.k === 'lib' ? t('home.library') : it.k === 'add' ? t('home.addGame') : t('home.addSite')));
  }
  const updateBg = debounce(() => {
    const it = items[idx];
    if (!it) return;
    if (it.k === 'game') {
      const a = it.g.art || {};
      bg.mode('art');
      bg.art({ hero: a.hero ? api.assetUrl(a.hero) : undefined, cover: !a.hero && a.cover ? api.assetUrl(a.cover) : undefined, grad: !a.hero && !a.cover ? gradFor(it.g.name) : undefined });
    } else if (it.k === 'media') {
      bg.mode('art');
      bg.art({ grad: `radial-gradient(120% 100% at 75% 30%, ${it.m.color}aa, #090b12 70%)` });
    } else { bg.mode('lib'); bg.art({}); }
  }, 90);

  function setIdx(i, instant = false) {
    idx = Math.max(0, Math.min(items.length - 1, i));
    tiles.forEach((n, k) => n.classList.toggle('focus', k === idx));
    track.style.transform = `translateX(${16.6 - idx * 11.6}rem)`;
    paintLabel(); paintHubContent(); instant ? updateBg() : updateBg();
  }
  function rebuild(keepGameId) {
    const keep = keepGameId || (items[idx] && items[idx].g && items[idx].g.id);
    buildItems(); renderShelf();
    let i = keep ? items.findIndex((x) => x.g && x.g.id === keep) : -1;
    if (i < 0) i = Math.min(idx, items.length - 1);
    if (i < 0) i = defaultIdx();
    track.classList.add('nosmooth'); setIdx(i, true);
    requestAnimationFrame(() => requestAnimationFrame(() => track.classList.remove('nosmooth')));
    paintZone();
  }
  function texts() {
    tabGames.textContent = t('home.games'); tabMedia.textContent = t('home.media');
    btnPlay.lastChild.textContent = t('hub.play');
    iUser.innerHTML = ''; iUser.append(avatar(store.S.p, 'sm'));
  }
  function tick() {
    const s = store.settings();
    clock.style.display = s.showClock ? '' : 'none';
    clock.textContent = new Date().toLocaleTimeString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: !s.clock24 });
  }

  // ── actions ──
  function switchTab(to) {
    if (tab === to) return false;
    tab = to; idx = 0; rebuild(); setIdx(defaultIdx());
    return true;
  }
  const addSite = () => actions.addMediaSite();
  async function mediaOptions(m) {
    const i = await ui.menu({ title: m.name, pos: 'side', items: [{ label: t('hub.open'), icon: 'link' }, { label: t('opt.rename'), icon: 'edit' }, { label: t('opt.remove'), icon: 'trash', danger: true }] });
    if (i === 0) openMedia(m);
    else if (i === 1) { const n = await ui.osk({ title: t('opt.rename'), value: m.name }); if (n && n.trim()) { m.name = n.trim(); store.saveGlobal(); rebuild(); } }
    else if (i === 2 && await ui.confirmDialog(t('opt.remove'), t('opt.removeAsk', { name: m.name }), t('opt.remove'), true)) {
      store.S.g.media = store.S.g.media.filter((x) => x.id !== m.id); store.saveGlobal(); rebuild();
    }
  }
  const openMedia = (m) => api.openUrl(m.url, store.S.g.mediaMode).catch((e) => ui.toast(String(e), 'warn'));

  function activate() {
    const it = items[idx];
    if (!it) return false;
    if (it.k === 'game') actions.launchGame(it.g);
    else if (it.k === 'add') actions.addGamesFlow();
    else if (it.k === 'lib') actions.openLibrary();
    else if (it.k === 'media') openMedia(it.m);
    else if (it.k === 'mediaadd') addSite();
    return true;
  }
  function options() {
    const it = items[idx];
    if (it && it.k === 'game') { actions.openGameOptions(it.g); return true; }
    if (it && it.k === 'media') { mediaOptions(it.m); return true; }
    return false;
  }
  function topActivate() {
    const id = TOP[topIdx];
    if (id === 'games' || id === 'media') { switchTab(id); zone = 'shelf'; paintZone(); return true; }
    if (id === 'search') actions.openSearch();
    else if (id === 'settings') actions.openSettings();
    else if (id === 'profile') actions.openProfileMenu();
    return true;
  }

  const offs = [];
  const scr = {
    el: root,
    onEnter() { bg.mode('art'); texts(); tick(); buildItems(); renderShelf(); setIdx(defaultIdx()); paintZone(); scr.timer = setInterval(tick, 15000); },
    onResume() { texts(); tick(); rebuild(); updateBg(); },
    onExit() { clearInterval(scr.timer); offs.forEach((f) => f()); },
    onAction(a) {
      if (a === 'guide') { actions.openControlCenter(); return true; }
      if (a === 'search') { actions.openSearch(); return true; }
      if (a === 'fullscreen') { api.setFullscreen(true); return 'none'; }
      if (a === 'tabprev' || a === 'tabnext') { const r = switchTab(tab === 'games' ? 'media' : 'games'); paintZone(); return r; }
      if (zone === 'shelf') {
        if (a === 'left') { if (idx > 0) { setIdx(idx - 1); return true; } return false; }
        if (a === 'right') { if (idx < items.length - 1) { setIdx(idx + 1); return true; } return false; }
        if (a === 'up') { zone = 'top'; topIdx = tab === 'games' ? 0 : 1; paintZone(); return true; }
        if (a === 'down') { const k = items[idx] && items[idx].k; if (k === 'game' || k === 'media') { zone = 'hub'; hubIdx = 0; paintZone(); return true; } return false; }
        if (a === 'confirm') return activate();
        if (a === 'options') return options();
      } else if (zone === 'hub') {
        const max = items[idx] && items[idx].k === 'game' ? 1 : 0;
        if (a === 'left') { if (hubIdx > 0) { hubIdx--; paintHub(); return true; } return false; }
        if (a === 'right') { if (hubIdx < max) { hubIdx++; paintHub(); return true; } return false; }
        if (a === 'up' || a === 'back') { zone = 'shelf'; paintZone(); return true; }
        if (a === 'confirm') return hubIdx === 0 ? activate() : options();
        if (a === 'options') return options();
      } else { // top bar
        if (a === 'left') { if (topIdx > 0) { topIdx--; paintTop(); return true; } return false; }
        if (a === 'right') { if (topIdx < TOP.length - 1) { topIdx++; paintTop(); return true; } return false; }
        if (a === 'down' || a === 'back') { zone = 'shelf'; paintZone(); return true; }
        if (a === 'confirm') return topActivate();
      }
      return false;
    },
  };
  offs.push(bus.on('library-changed', () => rebuild()));
  offs.push(bus.on('art', () => { rebuild(); updateBg(); }));
  offs.push(bus.on('session', () => rebuild()));
  return scr;
}
