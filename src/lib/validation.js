const EMAIL = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
const PHONE = /^\+380\d{9}$/;
const str = v => (typeof v === 'string' ? v.trim() : '');

function checkProfile(b, needPassword) {
  const e = {};
  const d = { first_name: str(b.first_name), last_name: str(b.last_name), email: str(b.email).toLowerCase(), phone: str(b.phone) };
  if (!d.first_name) e.first_name = 'Вкажіть ім’я';
  if (!d.last_name) e.last_name = 'Вкажіть прізвище';
  if (!d.email) e.email = 'Вкажіть електронну пошту';
  else if (!EMAIL.test(d.email) || d.email.length > 254) e.email = 'Некоректна електронна пошта';
  if (!d.phone) e.phone = 'Вкажіть номер телефону';
  else if (!PHONE.test(d.phone)) e.phone = 'Формат телефону: +380XXXXXXXXX';
  const pw = typeof b.password === 'string' ? b.password : '';
  if ((needPassword || pw) && pw.length < 6) e.password = 'Пароль — щонайменше 6 символів';
  return { d, e, pw };
}

function checkGame(b) {
  const e = {};
  const n = v => (v === '' || v === null || v === undefined ? NaN : Number(v));
  const d = { title: str(b.title), min_players: n(b.min_players), max_players: n(b.max_players), price_per_day: n(b.price_per_day),
    difficulty_id: n(b.difficulty_id), genre_id: n(b.genre_id), completeness_note: str(b.completeness_note), description: str(b.description) };
  if (!d.title) e.title = 'Вкажіть назву гри';
  for (const k of ['min_players', 'max_players']) if (!Number.isInteger(d[k]) || d[k] < 1 || d[k] > 12) e[k] = 'Кількість гравців — від 1 до 12';
  if (!e.min_players && !e.max_players && d.max_players < d.min_players) e.max_players = 'Максимум не може бути меншим за мінімум';
  if (!(d.price_per_day > 0)) e.price_per_day = 'Ціна має бути більшою за 0';
  if (!Number.isInteger(d.difficulty_id)) e.difficulty_id = 'Оберіть складність';
  if (!Number.isInteger(d.genre_id)) e.genre_id = 'Оберіть жанр';
  return { d, e };
}
module.exports = { checkProfile, checkGame };
