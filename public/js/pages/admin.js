import { api } from '../core/api.js';
import { $, today, badge, confirmDelete, confirmDeleteUser, confirmWarn, esc, GAME_WARN, modal, money, overdue, refresh, safe, toast } from '../core/ui.js';
import { checkProfile, limitPlayers, phoneMask, showErrors } from '../core/validate.js';
import { loadLookups, state } from '../core/state.js';
import { ADMIN, CONDS, MENU } from './admin.config.js';

export async function pageAdmin(sec, id) {
  await loadLookups();
  $('#view').innerHTML = `<div class="admin"><aside class="side">${MENU.map(([k, t]) => k[0] === '_' ? `<small>${k.slice(1)}</small>` : `<a href="#/admin/${k}" class="${k === sec ? 'on' : ''}">${t}</a>`).join('')}</aside><section id="adm"></section></div>`;
  if (sec === 'overview') return adminOverview();
  if (sec === 'rentals') return adminRentals();
  if (sec === 'difficulty_levels') return adminDifficulty();
  if (sec === 'changes') return adminChanges();
  if (ADMIN[sec]) return adminTable(sec, id);
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

const d8 = v => v || '—';
async function adminRentals() {
  const rows = await api('/api/admin/rentals');
  $('#adm').innerHTML = `<div class="toolbar"><h2>Оренди та повернення</h2></div><div class="tablewrap"><table class="compact"><thead><tr><th>№</th><th>Клієнт</th><th>Гра</th><th>Видано</th><th>До</th><th>Повернено</th><th>Стан</th><th>Статус</th><th>Рахунок</th><th></th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${r.rental_id}</td><td>${esc(r.customer_name)}</td><td><b>${esc(r.game_title)}</b><br><small>${esc(r.inventory_number)}</small></td><td>${d8(r.rental_date)}</td>
    <td>${d8(r.due_date)}${overdue(r) ? ' <span class="badge bad">!</span>' : ''}</td><td>${d8(r.return_date)}</td><td>${esc(r.condition_on_return ? r.condition_on_return[0].toUpperCase() + r.condition_on_return.slice(1) : '—')}${r.penalty_amount ? `<br><small>штраф ${money(r.penalty_amount)}</small>` : ''}</td>
    <td>${badge('rental', r.status)}</td><td>${money(r.total_amount)}<br>${badge('pay', r.payment_status)}</td>
    <td class="act">${r.return_date ? '' : r.rental_date > today() ? `<span class="badge">Ще не видано</span>` : `<button class="btn sm" data-ret="${r.rental_item_id}" data-t="${esc(r.game_title)}">Прийняти</button>`}<button class="btn sm danger" data-del="${r.rental_id}" data-t="Оренда №${r.rental_id} — ${esc(r.game_title)}">Видалити</button></td></tr>`).join('')}</tbody></table></div>`;
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

const fileData = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });

function openForm(sec, row, done, deepId) {
  const D = ADMIN[sec], pk = D.pk;
  const m = modal(`<h3>${row ? 'Редагування' : 'Новий запис'}</h3><form id="ef" novalidate><div class="formerr" role="alert" hidden></div><div class="row">${D.fields.filter(f => !(row && f.createOnly)).map(f => {
    const v = row ? row[f.k] ?? '' : '', a = `name="${f.k}"`;
    if (f.t === 'select') return `<label class="field">${f.l}<select ${a}>${!v && f.k.endsWith('_id') ? '<option value="">— оберіть —</option>' : ''}${f.o().map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></label>`;
    if (f.t === 'textarea') return `<label class="field">${f.l}<textarea ${a} rows="3">${esc(v)}</textarea></label>`;
    if (f.t === 'file') return `<label class="field">${f.l}<input ${a} type="file" accept="image/jpeg"></label>`;
    return `<label class="field">${f.l}<input ${a} type="${f.t || 'text'}" value="${esc(v)}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''}></label>`;
  }).join('')}</div><div class="btns"><button type="button" class="btn ghost" data-close>Скасувати</button><button class="btn">Зберегти</button></div></form>`);
  const f = m.querySelector('#ef');
  ['min_players', 'max_players'].forEach(k => f.elements[k] && limitPlayers(f.elements[k]));
  if (f.elements.phone) phoneMask(f.elements.phone);
  if (deepId) m.onclose = () => history.replaceState(null, '', '#/admin/' + sec);
  f.onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries([...new FormData(f)].filter(([, v]) => typeof v === 'string'));
    const errs = sec === 'customers' ? checkProfile(body, false) : {};
    if (sec === 'games') {
      const nums = ['min_players', 'max_players'];
      nums.forEach(k => { const n = Number(body[k]); if (!Number.isInteger(n) || n < 1 || n > 12) errs[k] = 'Кількість гравців — від 1 до 12'; });
      if (!errs.max_players && +body.max_players < +body.min_players) errs.max_players = 'Максимум не може бути меншим за мінімум';
      if (!(Number(body.price_per_day) > 0)) errs.price_per_day = 'Ціна має бути більшою за 0';
      if (!body.difficulty_id) errs.difficulty_id = 'Оберіть складність';
      if (!body.genre_id) errs.genre_id = 'Оберіть жанр';
      if (!body.title?.trim()) errs.title = 'Вкажіть назву гри';
      const file = f.elements.image?.files[0];
      if (file) { if (file.type !== 'image/jpeg' || file.size > 5e6) errs.image = 'Потрібен JPG до 5 МБ'; else body.image = await fileData(file); }
    }
    if (Object.keys(errs).length) return showErrors(f, errs);
    if (sec === 'games' && row && !(await confirmWarn({ title: 'Зміни гри', text: GAME_WARN, yes: 'Так, продовжити', danger: false }))) return;
    try {
      await api(`/api/admin/${sec}${row ? '/' + row[pk] : ''}${sec === 'games' && row ? '?confirm=yes' : ''}`, { method: row ? 'PUT' : 'POST', body });
      m.onclose = null; m.close(); toast('Збережено'); await loadLookups(); done();
    } catch (er) { showErrors(f, er.field ? { [er.field]: er.message } : {}, er.message); }
  };
}

async function adminTable(sec, deepId) {
  const D = ADMIN[sec], rows = await api('/api/admin/' + sec), pk = D.pk;
  const done = () => { history.replaceState(null, '', '#/admin/' + sec); if (sec === 'games') refresh(); else adminTable(sec); };
  $('#adm').innerHTML = `<div class="toolbar"><h2>${D.title}</h2>${D.ro ? '' : '<button class="btn" id="add">+ Додати</button>'}</div>
  <div class="tablewrap"><table><thead><tr>${D.cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr>${D.cols.map(c => `<td>${sec === 'customers' && c[0] === 'full_name' ? `<button class="linkbtn" data-prof="${i}">${esc(r.first_name)} ${esc(r.last_name)}</button>` : c[2] ? c[2](r) : esc(r[c[0]])}</td>`).join('')}<td class="act">
    ${sec === 'customers' && r.role === 'admin' ? '' : `<button class="btn sm ghost" data-edit="${i}">Змінити</button>`}${D.noDel || (sec === 'customers' && r.role === 'admin') ? '' : `<button class="btn sm danger" data-del="${i}">Видалити</button>`}</td></tr>`).join('') || `<tr><td colspan="${D.cols.length + 1}" class="empty">Записів немає</td></tr>`}</tbody></table></div>`;
  const add = $('#add'); if (add) add.onclick = () => openForm(sec, null, done);
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(sec, rows[b.dataset.edit], done));
  const delUser = async r => {
    if (!(await confirmDeleteUser())) return;
    await api(`/api/admin/customers/${r.customer_id}?confirm=yes&final=yes`, { method: 'DELETE' });
    toast('Користувача видалено');
    adminTable(sec);
  };
  document.querySelectorAll('[data-prof]').forEach(b => b.onclick = safe(async () => {
    const r = rows[b.dataset.prof], p = await api(`/api/admin/customers/${r.customer_id}/profile`), own = p.role === 'admin';
    const m = modal(`<h3>${esc(p.first_name)} ${esc(p.last_name)}</h3><div class="profile"><div><span>E-mail</span><b>${esc(p.email)}</b></div><div><span>Телефон</span><b>${esc(p.phone)}</b></div><div><span>Роль</span>${badge('role', p.role)}</div><div><span>Оренд</span><b>${p.rentals}</b></div><div><span>Сума рахунків</span><b>${money(p.total)}</b></div></div>
      ${own ? '<p class="hint">Дані адміністратора змінюються лише в його профілі.</p>' : ''}
      <div class="btns"><button class="btn ghost" data-close>Закрити</button>${own ? '' : '<button class="btn ghost" id="pe">Змінити</button><button class="btn danger" id="pd">Видалити</button>'}</div>`);
    if (own) return;
    m.querySelector('#pe').onclick = () => { m.close(); openForm(sec, r, done); };
    m.querySelector('#pd').onclick = safe(async () => { m.close(); await delUser(r); });
  }));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = safe(async () => {
    const r = rows[b.dataset.del];
    if (sec === 'customers') return delUser(r);
    if (!(await confirmDelete(D.name ? D.name(r) : '#' + r[pk]))) return;
    await api(`/api/admin/${sec}/${r[pk]}?confirm=yes`, { method: 'DELETE' });
    toast('Запис видалено'); await loadLookups(); adminTable(sec);
  }));
  if (deepId) { const r = rows.find(x => String(x[pk]) === deepId); if (r) openForm(sec, r, done, true); }
}

async function adminDifficulty() {
  const D = ADMIN.difficulty_levels, rows = await api('/api/admin/difficulty_levels');
  const done = () => adminDifficulty();
  $('#adm').innerHTML = `<div class="toolbar"><h2>${D.title}</h2><button class="btn" id="add">+ Додати</button></div>
    <div class="dcards">${rows.map(r => `<article class="dcard" tabindex="0" data-id="${r.difficulty_id}"><h3>${esc(r.level_name)}</h3><p>${esc(r.description || 'Опис не вказано')}</p>
      <div class="dmeta"><span class="tag">Ігор: ${r.games_count}</span></div>
      <div class="act"><button class="btn sm ghost" data-e="${r.difficulty_id}">Змінити</button><button class="btn sm danger" data-d="${r.difficulty_id}" ${r.games_count ? 'disabled title="До складності прив’язані ігри"' : ''}>Видалити</button></div></article>`).join('')}</div>
    <div class="panel" id="dgames" hidden></div>`;
  $('#add').onclick = () => openForm('difficulty_levels', null, done);
  const show = safe(async id => {
    const r = rows.find(x => x.difficulty_id == id), g = await api('/api/games?difficulty=' + id), box = $('#dgames');
    document.querySelectorAll('.dcard').forEach(c => c.classList.toggle('on', c.dataset.id == id));
    box.hidden = false;
    box.innerHTML = `<h3>${esc(r.level_name)}: ${g.length ? 'ігри' : 'ігор немає'}</h3><div class="tags">${g.map(x => `<a class="tag" href="#/admin/games/${x.game_id}">${esc(x.title)}</a>`).join('')}</div>`;
  });
  document.querySelectorAll('.dcard').forEach(c => { c.onclick = e => { if (!e.target.closest('button')) show(c.dataset.id); }; c.onkeydown = e => { if (e.key === 'Enter' && e.target === c) show(c.dataset.id); }; });
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => openForm('difficulty_levels', rows.find(x => x.difficulty_id == b.dataset.e), done));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = safe(async () => {
    const r = rows.find(x => x.difficulty_id == b.dataset.d);
    if (!(await confirmDelete(r.level_name))) return;
    await api(`/api/admin/difficulty_levels/${r.difficulty_id}?confirm=yes`, { method: 'DELETE' }); toast('Запис видалено'); await loadLookups(); adminDifficulty();
  }));
}

const OPS = { insert: 'Додавання', update: 'Зміна', delete: 'Видалення' };
async function adminChanges() {
  const rows = await api('/api/admin/changes');
  const name = t => (ADMIN[t]?.title || t);
  $('#adm').innerHTML = `<div class="toolbar"><h2>Історія змін</h2></div><div class="tablewrap"><table><thead><tr><th>Час</th><th>Адміністратор</th><th>Розділ</th><th>Операція</th><th>Запис</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.created_at)}</td><td>${esc(r.admin_name || '—')}</td><td>${esc(name(r.tbl))}</td><td>${OPS[r.op]}</td><td>${esc(r.label)}</td>
      <td class="act">${r.undone ? '<span class="badge">Скасовано</span>' : `<button class="btn sm ghost" data-u="${r.change_id}" data-t="${OPS[r.op].toLowerCase()} «${esc(r.label)}»">Скасувати</button>`}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Змін ще немає</td></tr>'}</tbody></table></div>`;
  document.querySelectorAll('[data-u]').forEach(b => b.onclick = safe(async () => {
    const msg = { 'додавання': 'буде видалено доданий запис', 'зміна': 'буде повернено попередні значення', 'видалення': 'буде відновлено видалений запис' }[b.dataset.t.split(' ')[0]];
    if (!(await confirmWarn({ title: 'Скасування зміни', text: `Ви впевнені, що хочете скасувати цю зміну (${b.dataset.t})? Після скасування ${msg}.`, yes: 'Так, скасувати', no: 'Залишити як є', danger: false }))) return;
    await api(`/api/admin/changes/${b.dataset.u}/undo?confirm=yes`, { method: 'POST' });
    toast('Зміну скасовано'); await loadLookups(); adminChanges();
  }));
}
