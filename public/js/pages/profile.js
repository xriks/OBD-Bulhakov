import { api } from '../core/api.js';
import { $, confirmDeleteUser, refresh, toast } from '../core/ui.js';
import { loadMe, state } from '../core/state.js';
import { checkProfile, phoneMask, showErrors } from '../core/validate.js';

export function pageProfile() {
  const u = state.me, v = k => u[k].replace(/"/g, '&quot;');
  const canDel = u.role === 'admin' && u.customer_id !== 1;
  $('#view').innerHTML = `<div class="panel authbox"><h2>${v('first_name')} ${v('last_name')}</h2>
    <form id="pf" novalidate><div class="formerr" role="alert" hidden></div>
      <label class="field">Ім’я<input name="first_name" value="${v('first_name')}"></label>
      <label class="field">Прізвище<input name="last_name" value="${v('last_name')}"></label>
      <label class="field">Електронна пошта<input name="email" type="email" value="${v('email')}"></label>
      <label class="field">Телефон<input name="phone" type="tel" value="${v('phone')}"></label>
      <label class="field">Новий пароль (необов’язково)<input name="password" type="password" autocomplete="new-password"></label>
      <button class="btn">Зберегти зміни</button></form>
    ${canDel ? '<p><button class="btn danger" id="del">Видалити мій акаунт</button></p>' : ''}</div>`;
  phoneMask($('#pf').elements.phone);
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, body = Object.fromEntries(new FormData(f)), errs = checkProfile(body, false);
    if (Object.keys(errs).length) return showErrors(f, errs);
    try { await api('/api/profile', { method: 'PUT', body }); await loadMe(); toast('Профіль оновлено'); refresh(); }
    catch (er) { showErrors(f, er.field ? { [er.field]: er.message } : {}, er.message); }
  };
  const d = $('#del');
  if (d) d.onclick = async () => {
    if (!(await confirmDeleteUser())) return;
    try { await api(`/api/admin/customers/${u.customer_id}?confirm=yes&final=yes`, { method: 'DELETE' }); state.me = null; toast('Акаунт видалено'); refresh('#/'); }
    catch (er) { toast(er.message, true); }
  };
}
