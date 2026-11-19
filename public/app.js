
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => `${Math.round(Number(n) * 100) / 100} грн`;
const today = () => new Date().toISOString().slice(0, 10);
let ME = null, LK = { genres: [], difficulty_levels: [], services: [], games: [] };

async function api(url, o = {}) {
  const r = await fetch(url, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Помилка запиту');
  return d;
}
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
}
const safe = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

// ---------- модальні вікна ----------
function modal(html) {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { o.remove(); document.removeEventListener('keydown', k); } });
  document.body.appendChild(o);
  o.close = () => o.remove();
  o.querySelectorAll('[data-close]').forEach(b => b.onclick = () => o.remove());
  return o;
}
// Підтвердження видалення («Ви впевнені?»)
function confirmDelete(what) {
  return new Promise(res => {
    const m = modal(`<h3>Видалити запис?</h3>
      <div class="warnbox"><div>Ви впевнені, що хочете видалити <b>«${esc(what)}»</b>?<br>Цю дію неможливо скасувати.</div></div>
      <div class="btns"><button class="btn ghost" id="no">Скасувати</button><button class="btn danger" id="yes">Так, видалити</button></div>`);
    m.querySelector('#no').onclick = () => { m.close(); res(false); };
    m.querySelector('#yes').onclick = () => { m.close(); res(true); };
    m.querySelector('#no').focus();
  });
}

// ---------- довідники / ліміти ----------
const STATUS = {
  copy: { available: ['Вільна', 'ok'], rented: ['Видана', 'warn'], repair: ['Ремонт', 'bad'] },
  rental: { open: ['Відкрита', 'warn'], closed: ['Закрита', 'ok'] },
  pay: { Pending: ['Очікує оплати', 'warn'], Paid: ['Сплачено', 'ok'], Cancelled: ['Скасовано', 'bad'] },
  role: { admin: ['Адміністратор', 'bad'], client: ['Клієнт', ''] },
};
const badge = (k, v) => { const [t, c] = (STATUS[k][v] || [v, '']); return `<span class="badge ${c}">${esc(t)}</span>`; };

// ---------- роутер ----------
async function loadMe() { ME = (await api('/api/me')).user; }
async function loadLookups() { LK = await api('/api/lookups'); }
function renderNav() {
  const h = location.hash || '#/';
  const a = (href, t) => `<a href="${href}" class="${h === href || (href !== '#/' && h.startsWith(href)) ? 'on' : ''}">${t}</a>`;
  $('#nav').innerHTML = a('#/', 'Каталог') + (ME ? a('#/my', 'Мої оренди') : '') + (ME?.role === 'admin' ? a('#/admin/overview', 'Адмін-панель') : '')
    + (ME ? `<span class="who">${esc(ME.first_name)} ${esc(ME.last_name)}</span><a href="#" id="logout">Вийти</a>` : a('#/login', 'Увійти'));
  const lo = $('#logout'); if (lo) lo.onclick = safe(async e => { e.preventDefault(); await api('/api/logout', { method: 'POST' }); ME = null; location.hash = '#/'; route(); });
}
async function route() {
  const h = location.hash || '#/';
  renderNav();
  window.scrollTo(0, 0);
  try {
    if (h.startsWith('#/login')) return pageAuth();
    if (h.startsWith('#/my')) return ME ? await pageMy() : (location.hash = '#/login');
    if (h.startsWith('#/admin')) return ME?.role === 'admin' ? await pageAdmin(h.split('/')[2] || 'overview') : (location.hash = ME ? '#/' : '#/login');
    return await pageHome();
  } catch (e) { toast(e.message, true); }
}
window.addEventListener('hashchange', route);

const HERO = `<img src="img/hero.jpg" alt="" onerror="this.remove()">`;

async function pageHome() {
  await loadLookups();
  $('#view').innerHTML = `
  <section class="hero">
    <h1>Hooked</h1><div class="sub">оренда та прокат настільних ігор</div>
    <div class="lace"><div class="inner">${HERO}</div></div>
    <div class="cta"><a class="btn" href="#catalog" id="go">Обрати гру</a>${ME ? '' : '<a class="btn terra" href="#/login">Створити акаунт</a>'}</div>
  </section>
  <section class="panel green"><h2>Як взяти гру?</h2><div class="steps">
    <div>Обирай гру в каталозі та тисни «Забронювати»</div><div>Вкажи кількість діб і додаткові послуги</div>
    <div>Грай та повертай — адміністратор прийме гру</div><div>Оплати рахунок у розділі «Мої оренди»</div></div></section>
  <h2 class="sec" id="catalog">Оренда настільних ігор</h2>
  <div class="filters">
    <label class="field">Пошук<input id="f-q" placeholder="Назва гри"></label>
    <label class="field">Жанр<select id="f-genre"><option value="">Усі</option>${LK.genres.map(g => `<option value="${g.genre_id}">${esc(g.genre_name)}</option>`).join('')}</select></label>
    <label class="field">Складність<select id="f-diff"><option value="">Будь-яка</option>${LK.difficulty_levels.map(g => `<option value="${g.difficulty_id}">${esc(g.level_name)}</option>`).join('')}</select></label>
    <label class="field">Гравців<input id="f-players" type="number" min="1" max="20" placeholder="к-сть"></label>
    <label class="chk"><input type="checkbox" id="f-av"> Лише доступні</label>
  </div>
  <div class="grid" id="grid"></div>`;
  const load = safe(async () => {
    const p = new URLSearchParams();
    [['q', '#f-q'], ['genre', '#f-genre'], ['difficulty', '#f-diff'], ['players', '#f-players']].forEach(([k, s]) => { if ($(s).value) p.set(k, $(s).value); });
    if ($('#f-av').checked) p.set('available', '1');
    const games = await api('/api/games?' + p);
    $('#grid').innerHTML = games.length ? games.map((g, i) => `
      <article class="game c${i % 3}">
        <div class="pic"><img src="img/games/${g.game_id}.jpg" alt="" onerror="this.remove()"><span class="price">${money(g.price_per_day)}/доба</span></div>
        <div class="body"><h3>${esc(g.title)}</h3>
          <div class="tags"><span class="tag">${esc(g.genre_name)}</span><span class="tag">${esc(g.level_name)}</span><span class="tag">${g.min_players}–${g.max_players} гравців</span></div>
          <div class="note">${esc(g.completeness_note || '')}</div>
          <div class="foot2"><span class="avail ${g.available_copies ? 'yes' : 'no'}">${g.available_copies ? `Вільно: ${g.available_copies}` : 'Усі видані'}</span>
            <button class="btn sm" data-rent="${g.game_id}" ${g.available_copies ? '' : 'disabled'}>Забронювати</button></div></div></article>`).join('')
      : '<div class="empty">Нічого не знайдено. Спробуйте змінити фільтри.</div>';
    $('#grid').querySelectorAll('[data-rent]').forEach(b => b.onclick = () => rentModal(games.find(g => g.game_id == b.dataset.rent)));
  });
  ['#f-q', '#f-players'].forEach(s => $(s).addEventListener('input', load));
  ['#f-genre', '#f-diff', '#f-av'].forEach(s => $(s).addEventListener('change', load));
  $('#go').onclick = e => { e.preventDefault(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); };
  load();
}

function rentModal(g) {
  if (!ME) { toast('Щоб забронювати гру, увійдіть в акаунт'); location.hash = '#/login'; return; }
  const m = modal(`<h3>Оренда: ${esc(g.title)}</h3>
    <div class="row">
      <label class="field">Кількість діб (1–30)<input id="r-days" type="number" min="1" max="30" value="3"></label>
      <div class="field">Додаткові послуги${LK.services.map(s => `<label class="chk"><input type="checkbox" class="r-svc" value="${s.service_id}" data-cost="${s.cost}"> ${esc(s.service_name)} — ${money(s.cost)}</label>`).join('')}</div>
      <div class="total" id="r-total"></div></div>
    <div class="btns"><button class="btn ghost" data-close>Скасувати</button><button class="btn" id="r-ok">Підтвердити оренду</button></div>`);
  const calc = () => {
    const d = Math.min(30, Math.max(1, +m.querySelector('#r-days').value || 1));
    const extra = [...m.querySelectorAll('.r-svc:checked')].reduce((s, c) => s + +c.dataset.cost, 0);
    m.querySelector('#r-total').textContent = `Разом: ${money(d * g.price_per_day + extra)}`;
  };
  m.addEventListener('input', calc); calc();
  m.querySelector('#r-ok').onclick = safe(async () => {
    await api('/api/rent', { method: 'POST', body: { game_id: g.game_id, days: +m.querySelector('#r-days').value, service_ids: [...m.querySelectorAll('.r-svc:checked')].map(c => +c.value) } });
    m.close(); toast('Гру заброньовано! Рахунок — у розділі «Мої оренди»'); location.hash = '#/my';
  });
}

function pageAuth() {
  let reg = false;
  const draw = () => {
    $('#view').innerHTML = `<div class="panel authbox"><h2>${reg ? 'Реєстрація' : 'Вхід'}</h2>
      <form id="af">${reg ? `<label class="field">Ім’я<input name="first_name" required></label><label class="field">Прізвище<input name="last_name" required></label>
        <label class="field">Телефон<input name="phone" required placeholder="+380…"></label>` : ''}
        <label class="field">E-mail<input name="email" type="email" required autocomplete="username"></label>
        <label class="field">Пароль<input name="password" type="password" required minlength="${reg ? 6 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
        <button class="btn">${reg ? 'Зареєструватися' : 'Увійти'}</button></form>
      <p><a href="#" id="sw">${reg ? 'Вже є акаунт? Увійти' : 'Немає акаунта? Зареєструватися'}</a></p>
      ${reg ? '' : '<div class="hint">Демо: <b>admin@hooked.ua</b> Пароль: <b>admin123</b><br>Клієнт: <b>olena@example.com</b> Пароль: <b>client123</b></div>'}</div>`;
    $('#sw').onclick = e => { e.preventDefault(); reg = !reg; draw(); };
    $('#af').onsubmit = safe(async e => {
      e.preventDefault();
      await api(reg ? '/api/register' : '/api/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      await loadMe(); location.hash = ME.role === 'admin' ? '#/admin/overview' : '#/'; route();
    });
  };
  draw();
}

// ---------- кабінет клієнта ----------
const overdue = r => r.status === 'open' && r.due_date < today();
async function pageMy() {
  const rows = await api('/api/my/rentals');
  $('#view').innerHTML = `<h2 class="sec">Мої оренди</h2>` + (rows.length ? `<div class="tablewrap"><table><thead><tr>
    <th>№</th><th>Гра</th><th>Видано</th><th>Повернути до</th><th>Повернено</th><th>Статус</th><th>Сума</th><th>Оплата</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r.rental_id}</td><td><b>${esc(r.game_title)}</b><br><small>${esc(r.inventory_number)}</small></td><td>${r.rental_date}</td>
      <td>${r.due_date}${overdue(r) ? ' <span class="badge bad">прострочено</span>' : ''}</td><td>${r.return_date || '—'}</td><td>${badge('rental', r.status)}</td>
      <td>${money(r.total_amount)}${r.penalty_amount ? `<br><small>з них штраф ${money(r.penalty_amount)}</small>` : ''}</td><td>${badge('pay', r.payment_status)}</td>
      <td class="act">${r.payment_status === 'Pending' ? `<button class="btn sm" data-pay="${r.invoice_id}">Оплатити</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Повернення гри оформлює адміністратор у пункті видачі.</p>`
    : '<div class="panel empty">Ви ще не орендували ігор. <a href="#/">Перейти до каталогу</a></div>');
  document.querySelectorAll('[data-pay]').forEach(b => b.onclick = safe(async () => { await api(`/api/invoices/${b.dataset.pay}/pay`, { method: 'POST' }); toast('Оплату прийнято'); pageMy(); }));
}

const sel = (src, v, t) => () => LK[src].map(x => [x[v], x[t]]);
const CONDS = [['добра', 'Добра'], ['задовільна', 'Задовільна'], ['пошкоджена', 'Пошкоджена']];
const ADMIN = {
  games: { title: 'Ігри', name: r => r.title, cols: [['title', 'Назва'], ['genre_name', 'Жанр'], ['level_name', 'Складність'], ['min_players', 'Мін.'], ['max_players', 'Макс.'],
    ['price_per_day', 'Ціна/доба', r => money(r.price_per_day)], ['available_copies', 'Вільно'], ['completeness_note', 'Комплектність']],
    fields: [{ k: 'title', l: 'Назва', req: 1 }, { k: 'genre_id', l: 'Жанр', t: 'select', o: sel('genres', 'genre_id', 'genre_name') }, { k: 'difficulty_id', l: 'Складність', t: 'select', o: sel('difficulty_levels', 'difficulty_id', 'level_name') },
      { k: 'min_players', l: 'Мін. гравців', t: 'number', min: 1 }, { k: 'max_players', l: 'Макс. гравців', t: 'number', min: 1 }, { k: 'price_per_day', l: 'Ціна за добу, грн', t: 'number', min: 1, step: '0.01' }, { k: 'completeness_note', l: 'Комплектність' }] },
  game_copies: { title: 'Копії ігор', name: r => r.inventory_number, cols: [['inventory_number', 'Інв. номер'], ['title', 'Гра'], ['status', 'Статус', r => badge('copy', r.status)]],
    fields: [{ k: 'game_id', l: 'Гра', t: 'select', o: sel('games', 'game_id', 'title') }, { k: 'inventory_number', l: 'Інвентарний номер', req: 1 }, { k: 'status', l: 'Статус', t: 'select', o: () => [['available', 'Вільна'], ['rented', 'Видана'], ['repair', 'Ремонт']] }] },
  customers: { title: 'Клієнти', name: r => `${r.first_name} ${r.last_name}`, cols: [['customer_id', 'ID'], ['first_name', 'Ім’я'], ['last_name', 'Прізвище'], ['email', 'E-mail'], ['phone', 'Телефон'], ['role', 'Роль', r => badge('role', r.role)]],
    fields: [{ k: 'first_name', l: 'Ім’я', req: 1 }, { k: 'last_name', l: 'Прізвище', req: 1 }, { k: 'email', l: 'E-mail', t: 'email', req: 1 }, { k: 'phone', l: 'Телефон', req: 1 },
      { k: 'role', l: 'Роль', t: 'select', o: () => [['client', 'Клієнт'], ['admin', 'Адміністратор']] }, { k: 'password', l: 'Пароль (для нового; за замовч. client123)', t: 'password', createOnly: 1 }] },
  invoices: { title: 'Рахунки', ro: 1, noDel: 1, cols: [['invoice_id', '№'], ['customer_name', 'Клієнт'], ['total_amount', 'Сума', r => money(r.total_amount)], ['issue_date', 'Дата'], ['payment_status', 'Оплата', r => badge('pay', r.payment_status)]],
    fields: [{ k: 'payment_status', l: 'Статус оплати', t: 'select', o: () => [['Pending', 'Очікує оплати'], ['Paid', 'Сплачено'], ['Cancelled', 'Скасовано']] }] },
  services: { title: 'Послуги', name: r => r.service_name, cols: [['service_name', 'Послуга'], ['cost', 'Вартість', r => money(r.cost)]],
    fields: [{ k: 'service_name', l: 'Назва послуги', req: 1 }, { k: 'cost', l: 'Вартість, грн', t: 'number', min: 0, step: '0.01' }] },
  genres: { title: 'Жанри', name: r => r.genre_name, cols: [['genre_id', 'ID'], ['genre_name', 'Жанр']], fields: [{ k: 'genre_name', l: 'Назва жанру', req: 1 }] },
  difficulty_levels: { title: 'Рівні складності', name: r => r.level_name, cols: [['difficulty_id', 'ID'], ['level_name', 'Рівень']], fields: [{ k: 'level_name', l: 'Назва рівня', req: 1 }] },
  damage_reports: { title: 'Пошкодження', ro: 1, name: r => `${r.game_title}: ${r.description}`, cols: [['game_title', 'Гра'], ['description', 'Опис'], ['report_date', 'Дата'], ['damage_level', 'Рівень']],
    fields: [{ k: 'description', l: 'Опис', req: 1 }, { k: 'damage_level', l: 'Рівень', t: 'select', o: () => [['Незначне', 'Незначне'], ['Середнє', 'Середнє'], ['Критичне', 'Критичне']] }, { k: 'report_date', l: 'Дата', t: 'date' }] },
};
const MENU = [['overview', 'Огляд'], ['rentals', 'Оренди та повернення'], ['_Каталог'], ['games', 'Ігри'], ['game_copies', 'Копії'], ['genres', 'Жанри'], ['difficulty_levels', 'Складність'], ['services', 'Послуги'],
  ['_Люди та гроші'], ['customers', 'Клієнти'], ['invoices', 'Рахунки'], ['damage_reports', 'Пошкодження']];

async function pageAdmin(sec) {
  await loadLookups();
  $('#view').innerHTML = `<div class="admin"><aside class="side">${MENU.map(([k, t]) => k[0] === '_' ? `<small>${k.slice(1)}</small>` : `<a href="#/admin/${k}" class="${k === sec ? 'on' : ''}">${t}</a>`).join('')}</aside><section id="adm"></section></div>`;
  if (sec === 'overview') return adminOverview();
  if (sec === 'rentals') return adminRentals();
  if (ADMIN[sec]) return adminTable(sec);
  $('#adm').innerHTML = '<div class="panel empty">Розділ не знайдено</div>';
}

async function adminOverview() {
  const s = await api('/api/admin/stats'), t = s.totals;
  const bars = (arr, k, v, cls) => { const mx = Math.max(1, ...arr.map(x => x[v])); return arr.map(x => `<div class="bar ${cls}"><span>${esc(x[k])}</span><i style="width:${Math.max(4, x[v] / mx * 100)}%"></i><b>${x[v]}</b></div>`).join('') || '<div class="empty">Даних немає</div>'; };
  $('#adm').innerHTML = `<div class="toolbar"><h2>Огляд</h2></div>
  <div class="stats">${[['Ігор у каталозі', t.games], ['Фізичних копій', t.copies], ['Клієнтів', t.clients], ['Відкритих оренд', t.open_rentals], ['Прострочено', t.overdue], ['Отримано', money(t.revenue)], ['Очікує оплати', money(t.pending)]]
    .map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
  <div class="cols2">
    <div class="panel"><h3>Найпопулярніші ігри</h3>${bars(s.popular, 'title', 'rentals_count', '')}</div>
    <div class="panel"><h3>Оренди за жанрами</h3>${bars(s.byGenre, 'genre_name', 'total_rentals', 't')}</div>
    <div class="panel"><h3>Ігри з пошкодженнями</h3>${s.damaged.length ? `<table><tbody>${s.damaged.map(d => `<tr><td>${esc(d.title)}</td><td>${d.damage_count} шт.</td><td>${d.last_report}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Немає</div>'}</div>
    <div class="panel"><h3>Не орендувалися 30 днів</h3><div class="tags">${s.idle.map(i => `<span class="tag">${esc(i.title)}</span>`).join('') || 'Усі ігри в обігу'}</div></div>
  </div>`;
}

async function adminRentals() {
  const rows = await api('/api/admin/rentals');
  $('#adm').innerHTML = `<div class="toolbar"><h2>Оренди та повернення</h2></div><div class="tablewrap"><table><thead><tr><th>№</th><th>Клієнт</th><th>Гра</th><th>Видано</th><th>До</th><th>Повернено</th><th>Стан</th><th>Статус</th><th>Рахунок</th><th></th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${r.rental_id}</td><td>${esc(r.customer_name)}</td><td><b>${esc(r.game_title)}</b><br><small>${esc(r.inventory_number)}</small></td><td>${r.rental_date}</td>
    <td>${r.due_date}${overdue(r) ? ' <span class="badge bad">!</span>' : ''}</td><td>${r.return_date || '—'}</td><td>${esc(r.condition_on_return || '—')}${r.penalty_amount ? `<br><small>штраф ${money(r.penalty_amount)}</small>` : ''}</td>
    <td>${badge('rental', r.status)}</td><td>${money(r.total_amount)}<br>${badge('pay', r.payment_status)}</td>
    <td class="act">${r.return_date ? '' : `<button class="btn sm" data-ret="${r.rental_item_id}" data-t="${esc(r.game_title)}">Прийняти</button>`}<button class="btn sm danger" data-del="${r.rental_id}" data-t="Оренда №${r.rental_id} — ${esc(r.game_title)}">Видалити</button></td></tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = safe(async () => {
    if (!(await confirmDelete(b.dataset.t))) return;
    await api(`/api/admin/rentals/${b.dataset.del}?confirm=yes`, { method: 'DELETE' }); toast('Оренду видалено'); adminRentals();
  }));
  document.querySelectorAll('[data-ret]').forEach(b => b.onclick = () => {
    const m = modal(`<h3>Повернення: ${esc(b.dataset.t)}</h3><div class="row">
      <label class="field">Стан гри<select id="c">${CONDS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label class="field">Штраф, грн (порожньо — авто за прострочення)<input id="p" type="number" min="0" step="1"></label>
      <label class="field">Опис пошкодження (за наявності)<textarea id="d" rows="2"></textarea></label>
      <label class="field">Рівень пошкодження<select id="l"><option>Незначне</option><option>Середнє</option><option>Критичне</option></select></label></div>
      <div class="btns"><button class="btn ghost" data-close>Скасувати</button><button class="btn" id="ok">Підтвердити повернення</button></div>`);
    m.querySelector('#ok').onclick = safe(async () => {
      const r = await api(`/api/admin/rentals/${b.dataset.ret}/return`, { method: 'POST', body: { condition: m.querySelector('#c').value, penalty: m.querySelector('#p').value, damage_description: m.querySelector('#d').value, damage_level: m.querySelector('#l').value } });
      m.close(); toast(`Повернення оформлено${r.penalty ? `, штраф ${money(r.penalty)}` : ''}`); adminRentals();
    });
  });
}

async function adminTable(sec) {
  const D = ADMIN[sec], rows = await api('/api/admin/' + sec);
  $('#adm').innerHTML = `<div class="toolbar"><h2>${D.title}</h2>${D.ro ? '' : '<button class="btn" id="add">+ Додати</button>'}</div>
  <div class="tablewrap"><table><thead><tr>${D.cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr>${D.cols.map(c => `<td>${c[2] ? c[2](r) : esc(r[c[0]])}</td>`).join('')}<td class="act">
    <button class="btn sm ghost" data-edit="${i}">Змінити</button>${D.noDel ? '' : `<button class="btn sm danger" data-del="${i}">Видалити</button>`}</td></tr>`).join('') || `<tr><td colspan="${D.cols.length + 1}" class="empty">Записів немає</td></tr>`}</tbody></table></div>`;
  const pk = Object.keys(rows[0] || {})[0];
  const form = (row) => {
    const m = modal(`<h3>${row ? 'Редагування' : 'Новий запис'}</h3><form id="ef"><div class="row">${D.fields.filter(f => !(row && f.createOnly)).map(f => {
      const v = row ? row[f.k] : ''; const a = `name="${f.k}" ${f.req ? 'required' : ''}`;
      if (f.t === 'select') return `<label class="field">${f.l}<select ${a}>${f.o().map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></label>`;
      return `<label class="field">${f.l}<input ${a} type="${f.t || 'text'}" value="${esc(v)}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''}></label>`;
    }).join('')}</div><div class="btns"><button type="button" class="btn ghost" data-close>Скасувати</button><button class="btn">Зберегти</button></div></form>`);
    m.querySelector('#ef').onsubmit = safe(async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target));
      await api(`/api/admin/${sec}${row ? '/' + row[pk] : ''}`, { method: row ? 'PUT' : 'POST', body });
      m.close(); toast('Збережено'); await loadLookups(); adminTable(sec);
    });
  };
  const add = $('#add'); if (add) add.onclick = () => form(null);
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(rows[b.dataset.edit]));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = safe(async () => {
    const r = rows[b.dataset.del];
    if (!(await confirmDelete(D.name ? D.name(r) : '#' + r[pk]))) return;
    await api(`/api/admin/${sec}/${r[pk]}?confirm=yes`, { method: 'DELETE' });
    toast('Запис видалено'); await loadLookups(); adminTable(sec);
  }));
}

(async () => { try { await loadMe(); } catch { } route(); })();
