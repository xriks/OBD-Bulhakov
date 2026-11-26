import { api } from '../core/api.js';
import { $, refresh } from '../core/ui.js';
import { loadMe, state } from '../core/state.js';
import { checkProfile, phoneMask, showErrors } from '../core/validate.js';

export function pageAuth() {
  let reg = location.hash.includes('register');
  const field = (n, l, t = 'text', extra = '') => `<label class="field">${l}<input name="${n}" type="${t}" ${extra}></label>`;
  const draw = () => {
    $('#view').innerHTML = `<div class="panel authbox">
      <div class="tabs" role="tablist"><button type="button" role="tab" class="${reg ? '' : 'on'}" data-t="login" aria-selected="${!reg}">Увійти</button><button type="button" role="tab" class="${reg ? 'on' : ''}" data-t="reg" aria-selected="${reg}">Реєстрація</button></div>
      <form id="af" novalidate><div class="formerr" role="alert" hidden></div>
        ${reg ? field('first_name', 'Ім’я', 'text', 'autocomplete="given-name"') + field('last_name', 'Прізвище', 'text', 'autocomplete="family-name"') + field('phone', 'Телефон', 'tel', 'placeholder="+380XXXXXXXXX" autocomplete="tel"') : ''}
        ${field('email', 'Електронна пошта', 'email', 'autocomplete="username" placeholder="name@example.com"')}
        ${field('password', 'Пароль', 'password', `autocomplete="${reg ? 'new-password' : 'current-password'}"`)}
        <button class="btn">${reg ? 'Зареєструватися' : 'Увійти'}</button></form>${reg ? '' : '<div class="demo" id="demo" hidden></div>'}</div>`;
    if (!reg) api('/api/demo-accounts').then(l => { const d = $('#demo'); if (!d || !l.length) return; d.hidden = false; d.innerHTML = '<b>Демо-доступ</b>' + l.map(a => `<button type="button" class="demobtn" data-e="${a.email}" data-p="${a.password}"><b>${a.role === 'admin' ? 'Адміністратор' : 'Користувач'}</b><span>Логін: ${a.email}</span><span>Пароль: ${a.password}</span></button>`).join(''); d.querySelectorAll('button').forEach(b => b.onclick = () => { const f = $('#af'); f.elements.email.value = b.dataset.e; f.elements.password.value = b.dataset.p; f.requestSubmit(); }); }).catch(() => {});
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { reg = b.dataset.t === 'reg'; draw(); });
    const ph = $('#af').elements.phone; if (ph) phoneMask(ph);
    $('#af').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, body = Object.fromEntries(new FormData(f));
      const errs = reg ? checkProfile(body, true) : { ...(body.email.trim() ? {} : { email: 'Вкажіть електронну пошту' }), ...(body.password ? {} : { password: 'Вкажіть пароль' }) };
      if (Object.keys(errs).length) return showErrors(f, errs);
      try {
        await api(reg ? '/api/register' : '/api/login', { method: 'POST', body });
        await loadMe(); refresh(state.me.role === 'admin' ? '#/admin/overview' : '#/');
      } catch (er) { showErrors(f, er.field ? { [er.field]: er.message } : {}, er.message); }
    };
  };
  draw();
}
