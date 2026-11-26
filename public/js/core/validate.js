const EMAIL = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
const PHONE = /^\+380\d{9}$/;

export function checkProfile(b, needPassword) {
  const e = {}, v = k => String(b[k] ?? '').trim();
  if (!v('first_name')) e.first_name = 'Вкажіть ім’я';
  if (!v('last_name')) e.last_name = 'Вкажіть прізвище';
  if (!v('email')) e.email = 'Вкажіть електронну пошту';
  else if (!EMAIL.test(v('email'))) e.email = 'Некоректна електронна пошта';
  if (!v('phone')) e.phone = 'Вкажіть номер телефону';
  else if (!PHONE.test(v('phone'))) e.phone = 'Формат телефону: +380XXXXXXXXX';
  const pw = String(b.password ?? '');
  if ((needPassword || pw) && pw.length < 6) e.password = 'Пароль — щонайменше 6 символів';
  return e;
}

export function limitPlayers(input) {
  input.addEventListener('input', () => {
    const n = Number(input.value);
    if (input.value === '') return;
    if (!Number.isFinite(n) || n < 1) input.value = '';
    else if (n > 12) input.value = '12';
    else if (!Number.isInteger(n)) input.value = String(Math.floor(n));
  });
}

export function phoneMask(input) {
  input.addEventListener('input', () => { input.value = input.value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 13); });
}

export function showErrors(form, errs, top) {
  form.querySelectorAll('.ferr').forEach(x => x.remove());
  form.querySelectorAll('.bad').forEach(x => x.classList.remove('bad'));
  const box = form.querySelector('.formerr');
  if (box) { box.textContent = top || ''; box.hidden = !top; }
  Object.entries(errs).forEach(([k, m]) => {
    const i = form.elements[k]; if (!i) return;
    i.classList.add('bad');
    const s = document.createElement('small'); s.className = 'ferr'; s.textContent = m;
    (i.closest('.field') || i.parentNode).appendChild(s);
  });
  const f = form.querySelector('.bad'); if (f) f.focus();
}
