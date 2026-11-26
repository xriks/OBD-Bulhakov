const router = require('express').Router();
const db = require('../db/connection');
const { wrap, httpErr } = require('../lib/http');
const { needUser } = require('../middleware/session');
const { rentTx, RENTALS_SQL } = require('../services/rentals');
const { today, addDays } = require('../lib/dates');

router.post('/api/rent', wrap(req => {
  needUser(req);
  const { game_id, days, service_ids, start_date } = req.body;
  const d = parseInt(days, 10), start = start_date || today();
  if (!(d >= 1 && d <= 30)) throw httpErr(400, 'Оберіть період від 1 до 30 діб', 'days');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start < today() || start > addDays(today(), 60)) throw httpErr(400, 'Оберіть коректну дату початку', 'start_date');
  const ids = Array.isArray(service_ids) ? service_ids.map(Number) : [];
  const delivery = ids.some(id => /^Доставка/.test(db.prepare('SELECT service_name n FROM services WHERE service_id = ?').get(id)?.n || ''));
  const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
  if (delivery && address.length < 5) throw httpErr(400, 'Вкажіть вулицю та номер будинку для доставки', 'address');
  return rentTx(req.user.customer_id, +game_id, d, ids, start, delivery ? address : '');
}));
router.get('/api/my/rentals', wrap(req => { needUser(req);
  return db.prepare(RENTALS_SQL + ' WHERE r.customer_id = ? ORDER BY r.rental_date DESC, r.rental_id DESC').all(req.user.customer_id); }));
router.post('/api/invoices/:id/pay', wrap(req => {
  needUser(req);
  const inv = db.prepare('SELECT i.*, r.customer_id FROM invoices i JOIN rentals r ON r.rental_id = i.rental_id WHERE invoice_id = ?').get(req.params.id);
  if (!inv || (inv.customer_id !== req.user.customer_id && req.user.role !== 'admin')) throw httpErr(404, 'Рахунок не знайдено');
  if (inv.payment_status !== 'Pending') throw httpErr(409, 'Рахунок уже не очікує оплати');
  db.prepare("UPDATE invoices SET payment_status = 'Paid' WHERE invoice_id = ?").run(inv.invoice_id);
  return { ok: true };
}));

module.exports = router;
