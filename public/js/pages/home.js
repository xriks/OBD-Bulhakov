import { api } from '../core/api.js';
import { $, esc, money, safe } from '../core/ui.js';
import { loadLookups, state } from '../core/state.js';
import { limitPlayers } from '../core/validate.js';
import { rentModal } from '../components/rentModal.js';
import { mountSlideshow } from '../components/slideshow.js';

let CATALOG_LOAD = null;

export async function goToGame(id) {
  let el = $('#game-' + id);
  if (!el && CATALOG_LOAD) {
    ['#f-q', '#f-genre', '#f-diff', '#f-players'].forEach(s => $(s).value = ''); $('#f-av').checked = false;
    await CATALOG_LOAD(); el = $('#game-' + id);
  }
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

export async function pageHome() {
  await loadLookups();
  $('#view').innerHTML = `
  <section class="hero">
    <h1>Hooked</h1><div class="sub">оренда та прокат настільних ігор</div>
    <div class="slideshow" id="slides"></div>
    <div class="cta"><a class="btn" href="#catalog" id="go">Обрати гру</a>${state.me ? '' : '<a class="btn terra" href="#/login">Створити акаунт</a>'}</div>
  </section>
  <h2 class="sec" id="catalog">Оренда настільних ігор</h2>
  <div class="dpick" id="dpick">${state.lookups.difficulty_levels.map(d => `<button type="button" class="dchip" data-d="${d.difficulty_id}"><b>${esc(d.level_name)}</b><span>${esc(d.description || '')}</span></button>`).join('')}</div>
  <div class="filters">
    <label class="field">Пошук<input id="f-q" placeholder="Назва гри"></label>
    <label class="field">Жанр<select id="f-genre"><option value="">Усі</option>${state.lookups.genres.map(g => `<option value="${g.genre_id}">${esc(g.genre_name)}</option>`).join('')}</select></label>
    <label class="field">Складність<select id="f-diff"><option value="">Будь-яка</option>${state.lookups.difficulty_levels.map(g => `<option value="${g.difficulty_id}">${esc(g.level_name)}</option>`).join('')}</select></label>
    <label class="field">Гравців<input id="f-players" type="number" min="1" max="12" placeholder="1–12"></label>
    <label class="chk"><input type="checkbox" id="f-av"> Лише доступні</label>
  </div>
  <div class="grid" id="grid"></div>`;
  const load = safe(async () => {
    const p = new URLSearchParams();
    [['q', '#f-q'], ['genre', '#f-genre'], ['difficulty', '#f-diff'], ['players', '#f-players']].forEach(([k, s]) => { if ($(s).value) p.set(k, $(s).value); });
    if ($('#f-av').checked) p.set('available', '1');
    const games = await api('/api/games?' + p);
    $('#grid').innerHTML = games.length ? games.map((g, i) => `
      <article class="game c${i % 3}" id="game-${g.game_id}">
        <div class="pic"><img src="img/games/${g.game_id}.jpg" alt="${esc(g.title)}" onerror="this.parentNode.classList.add('noimg');this.remove()"><span class="price">${money(g.price_per_day)} за добу</span></div>
        <div class="body"><h3>${esc(g.title)}</h3>
          <div class="tags"><span class="tag">${esc(g.genre_name)}</span><span class="tag">${esc(g.level_name || 'Складність не вказана')}</span><span class="tag">${g.min_players}–${g.max_players} гравців</span></div>
          <div class="note">${esc(g.completeness_note || '')}</div>
          <div class="foot2"><span class="avail ${g.available_copies ? 'yes' : 'no'}">${g.available_copies ? `Вільно: ${g.available_copies}` : 'Усі видані'}</span>
            <button class="btn sm" data-rent="${g.game_id}" ${g.available_copies ? '' : 'disabled'}>Забронювати</button></div></div></article>`).join('')
      : '<div class="empty">Нічого не знайдено. Спробуйте змінити фільтри.</div>';
    $('#grid').querySelectorAll('[data-rent]').forEach(b => b.onclick = () => rentModal(games.find(g => g.game_id == b.dataset.rent)));
  });
  limitPlayers($('#f-players'));
  ['#f-q', '#f-players'].forEach(s => $(s).addEventListener('input', load));
  document.querySelectorAll('.dchip').forEach(c => c.onclick = () => { const on = c.classList.contains('on'); document.querySelectorAll('.dchip').forEach(x => x.classList.remove('on')); $('#f-diff').value = on ? '' : c.dataset.d; if (!on) c.classList.add('on'); load(); });
  $('#f-diff').addEventListener('change', () => document.querySelectorAll('.dchip').forEach(x => x.classList.toggle('on', x.dataset.d === $('#f-diff').value)));
  ['#f-genre', '#f-diff', '#f-av'].forEach(s => $(s).addEventListener('change', load));
  $('#go').onclick = e => { e.preventDefault(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); };
  CATALOG_LOAD = load;
  load();
  api('/api/games').then(g => mountSlideshow($('#slides'), g, goToGame)).catch(() => { });
}
