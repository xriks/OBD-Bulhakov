const crypto = require('crypto');
const db = require('../db/connection');
const { httpErr } = require('../lib/http');

function attachUser(req, _res, next) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  req.user = m ? db.prepare(`SELECT c.customer_id, c.first_name, c.last_name, c.email, c.phone, c.role, c.onboarded
    FROM sessions s JOIN customers c ON c.customer_id = s.customer_id WHERE s.token = ?`).get(m[1]) : null;
  next();
}
const needUser = req => { if (!req.user) throw httpErr(401, 'Увійдіть в акаунт'); };
const needAdmin = req => { needUser(req); if (req.user.role !== 'admin') throw httpErr(403, 'Доступ лише для адміністратора'); };
const startSession = (res, id) => {
  const t = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, customer_id) VALUES (?, ?)').run(t, id);
  res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
};

module.exports = { attachUser, needUser, needAdmin, startSession };
