
export const $ = s => document.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = n => `${Math.round(Number(n) * 100) / 100} грн`;
export const today = () => new Date().toISOString().slice(0, 10);
export function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
}
export const safe = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

export function modal(html) {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const onKey = e => { if (e.key === 'Escape') o.close(); };
  o.close = () => { if (!o.isConnected) return; o.remove(); document.removeEventListener('keydown', onKey); o.onclose?.(); };
  o.addEventListener('mousedown', e => { if (e.target === o) o.close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(o);
  o.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => o.close()));
  return o;
}
export function confirmDelete(what) {
  return new Promise(res => {
    const m = modal(`<h3>Видалити запис?</h3>
      <div class="warnbox"><div>Ви впевнені, що хочете видалити <b>«${esc(what)}»</b>?<br>Цю дію неможливо скасувати.</div></div>
      <div class="btns"><button class="btn ghost" id="no">Скасувати</button><button class="btn danger" id="yes">Так, видалити</button></div>`);
    m.onclose = () => res(false); // Esc, клік поза вікном, «Скасувати»
    m.querySelector('#no').onclick = () => m.close();
    m.querySelector('#yes').onclick = () => { res(true); m.close(); };
    m.querySelector('#no').focus();
  });
}

export const STATUS = {
  copy: { available: ['Вільна', 'ok'], rented: ['Видана', 'warn'], repair: ['Ремонт', 'bad'] },
  rental: { open: ['Відкрита', 'warn'], closed: ['Закрита', 'ok'] },
  pay: { Pending: ['Очікує оплати', 'warn'], Paid: ['Сплачено', 'ok'], Cancelled: ['Скасовано', 'bad'] },
  role: { admin: ['Адміністратор', 'bad'], client: ['Клієнт', ''] },
};
export const badge = (k, v) => { const [t, c] = (STATUS[k][v] || [v, '']); return `<span class="badge ${c}">${esc(t)}</span>`; };
export const overdue = r => r.status === 'open' && r.due_date < today();

export const refresh = to => document.dispatchEvent(new CustomEvent('app:refresh', { detail: to }));

export function confirmWarn({ title = 'Підтвердження', text, yes, no = 'Скасувати', danger = true }) {
  return new Promise(res => {
    let ok = false;
    const m = modal(`<h3>${esc(title)}</h3><div class="warnbox"><div>${esc(text)}</div></div>
      <div class="btns"><button class="btn ghost" id="no">${esc(no)}</button><button class="btn ${danger ? 'danger' : ''}" id="yes">${esc(yes)}</button></div>`);
    m.onclose = () => res(ok);
    m.querySelector('#no').onclick = () => m.close();
    m.querySelector('#yes').onclick = () => { ok = true; m.close(); };
    m.querySelector('#no').focus();
  });
}
export async function confirmDeleteUser() {
  if (!(await confirmWarn({ title: 'Видалення користувача', text: 'Ви впевнені, що хочете видалити цього користувача?', yes: 'Так, продовжити', danger: false }))) return false;
  return confirmWarn({ title: 'Остаточне видалення', text: 'Увага! Після видалення облікового запису всі пов’язані дані користувача будуть видалені. Цю дію неможливо скасувати. Ви впевнені, що хочете продовжити?', yes: 'Видалити остаточно' });
}
export const GAME_WARN = 'Увага! Зміни вплинуть на всі наявні записи та відображення цієї гри. Ви впевнені, що хочете продовжити?';
