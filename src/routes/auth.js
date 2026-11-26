const router = require('express').Router();
const db = require('../db/connection');
const { hash, verify } = require('../lib/password');
const { wrap, httpErr } = require('../lib/http');
const { needUser, startSession } = require('../middleware/session');
const customers = require('../services/customers');

router.get('/api/demo-accounts', wrap(() => (process.env.DEMO_HINT === '0' ? [] : require('../db/seed').demoAccounts())));
router.post('/api/register', wrap((req, res) => {
  startSession(res, customers.register(req.body || {}));
  return { ok: true };
}));
router.put('/api/profile', wrap(req => {
  needUser(req);
  customers.updateProfile(req.user.customer_id, req.body || {}, null);
  return { ok: true };
}));
router.post('/api/login', wrap((req, res) => {
  const u = db.prepare('SELECT * FROM customers WHERE email = ?').get(String(req.body.email || '').trim().toLowerCase());
  if (!u || !verify(req.body.password || '', u.password_hash)) throw httpErr(401, 'Невірний e-mail або пароль');
  startSession(res, u.customer_id);
  return { ok: true };
}));
router.post('/api/logout', wrap((req, res) => {
  const m = /sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1]);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  return { ok: true };
}));
router.get('/api/me', wrap(req => ({ user: req.user })));
// Користувач закрив вітальне вікно — більше його не показуємо
router.post('/api/onboarded', wrap(req => { needUser(req); db.prepare('UPDATE customers SET onboarded = 1 WHERE customer_id = ?').run(req.user.customer_id); return { ok: true }; }));

module.exports = router;
