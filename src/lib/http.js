const httpErr = (status, message, field) => Object.assign(new Error(message), { status, field });
const clean = v => (typeof v === 'string' ? v.trim() : v);

function sendError(res, e) {
  let status = e.status || 500, msg = e.message, field = e.field;
  if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
    if (/FOREIGN KEY/.test(msg)) { status = 409; msg = 'Неможливо виконати: запис пов’язаний з іншими даними (оренди, копії тощо).'; }
    else if (/customers\.phone/.test(msg)) { status = 409; field = 'phone'; msg = 'Цей номер телефону вже використовується'; }
    else if (/customers\.email/.test(msg)) { status = 409; field = 'email'; msg = 'Ця електронна пошта вже зареєстрована'; }
    else if (/UNIQUE/.test(msg)) { status = 409; msg = 'Таке значення вже існує.'; }
    else { status = 400; msg = 'Некоректні дані: перевірте заповнення полів.'; }
  }
  if (status === 500) console.error(e);
  res.status(status).json({ error: msg, field });
}

const wrap = fn => (req, res) => {
  try { const r = fn(req, res); if (r !== undefined) res.json(r); }
  catch (e) { sendError(res, e); }
};

module.exports = { httpErr, clean, sendError, wrap };
