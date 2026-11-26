import { $, esc, toast, safe } from './core/ui.js';
import { api } from './core/api.js';
import { state, loadMe } from './core/state.js';
import { initTheme } from './core/theme.js';
import { maybeShowWelcome } from './components/welcome.js';
import { stopSlideshow } from './components/slideshow.js';
import { pageHome } from './pages/home.js';
import { pageAuth } from './pages/auth.js';
import { pageMy } from './pages/my.js';
import { pageAdmin } from './pages/admin.js';
import { pageProfile } from './pages/profile.js';

function renderNav() {
  const h = location.hash || '#/';
  const a = (href, t) => `<a href="${href}" class="${h === href || (href !== '#/' && h.startsWith(href)) ? 'on' : ''}">${t}</a>`;
  const me = state.me;
  const lock = state.missing.length;
  $('#nav').innerHTML = (lock ? '' : a('#/', 'Каталог') + (me ? a('#/my', 'Мої оренди') : '')) + (me?.role === 'admin' ? a('#/admin/' + (lock ? 'games' : 'overview'), 'Адмін-панель') : '')
    + (me ? `<a href="#/profile" class="who ${h.startsWith('#/profile') ? 'on' : ''}" title="Мій профіль">${esc(me.first_name)} ${esc(me.last_name)}</a><a href="#" id="logout">Вийти</a>` : a('#/login', 'Увійти'));
  const lo = $('#logout');
  if (lo) lo.onclick = safe(async e => { e.preventDefault(); await api('/api/logout', { method: 'POST' }); state.me = null; if (location.hash !== '#/') location.hash = '#/'; else route(); });
}

function lockPage(admin) {
  const list = state.missing;
  $('#view').innerHTML = `<div class="panel lockbox"><h2>Потрібно призначити складність</h2>
    <div class="warnbox"><div>${admin ? 'Для цих ігор не вказано складність. Доки це не виправлено, інші розділи недоступні.' : 'Сайт тимчасово недоступний: адміністратор уточнює дані каталогу. Спробуйте пізніше.'}</div></div>
    ${admin ? `<ul class="locklist">${list.map(g => `<li><span>${esc(g.title)}</span><a class="btn sm" href="#/admin/games/${g.game_id}">Редагувати</a></li>`).join('')}</ul>` : ''}</div>`;
}

function page(h) {
  const lock = state.missing.length;
  if (lock && !h.startsWith('#/login') && !(state.me?.role === 'admin' && /^#\/admin\/(games|difficulty_levels)/.test(h))) return lockPage(state.me?.role === 'admin');
  if (h.startsWith('#/login')) return pageAuth();
  if (h.startsWith('#/profile')) return state.me ? pageProfile() : (location.hash = '#/login');
  if (h.startsWith('#/my')) return state.me ? pageMy() : (location.hash = '#/login');
  if (h.startsWith('#/admin')) return state.me?.role === 'admin' ? pageAdmin(h.split('/')[2] || 'overview', h.split('/')[3]) : (location.hash = state.me ? '#/' : '#/login');
  return pageHome();
}

async function route() {
  const h = location.hash || '#/';
  stopSlideshow();
  try { state.missing = (await api('/api/integrity')).missing; } catch { state.missing = []; }
  renderNav();
  window.scrollTo(0, 0);
  try { await page(h); } catch (e) { toast(e.message, true); }
  if (!h.startsWith('#/login')) maybeShowWelcome();
}

window.addEventListener('hashchange', route);
document.addEventListener('app:refresh', async e => {
  await loadMe();
  const to = e.detail;
  if (to && location.hash !== to) location.hash = to; else route();
});

(async () => { initTheme(); try { await loadMe(); } catch { /* гість */ } route(); })();
