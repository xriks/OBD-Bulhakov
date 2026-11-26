const router = require('express').Router();
const db = require('../db/connection');
const { hash } = require('../lib/password');
const { wrap, httpErr, clean } = require('../lib/http');
const { needAdmin } = require('../middleware/session');
const { returnTx, RENTALS_SQL } = require('../services/rentals');
const { getStats } = require('../services/stats');
const { T } = require('../services/adminTables');
const customers = require('../services/customers');
const changes = require('../services/changes');
const { checkGame } = require('../lib/validation');
const { saveImage } = require('../services/images');
const { missingDifficulty } = require('../services/integrity');

const tbl = req => { needAdmin(req); const t = T[req.params.t]; if (!t) throw httpErr(404, 'Невідома таблиця'); return t; };
const pick = (t, body) => t.cols.filter(c => body[c] !== undefined).map(c => [c, clean(body[c])]);

router.get('/api/admin/stats', wrap(req => { needAdmin(req); return getStats(); }));

router.get('/api/admin/rentals', wrap(req => { needAdmin(req); return db.prepare(RENTALS_SQL + ' ORDER BY r.rental_date DESC, r.rental_id DESC').all(); }));
router.post('/api/admin/rentals/:itemId/return', wrap(req => { needAdmin(req); return returnTx(+req.params.itemId, req.body); }));
router.delete('/api/admin/rentals/:id', wrap(req => {
  needAdmin(req);
  if (req.query.confirm !== 'yes') throw httpErr(400, 'Потрібне підтвердження видалення');
  db.transaction(() => {
    db.prepare(`UPDATE game_copies SET status='available' WHERE status='rented' AND copy_id IN
      (SELECT ri.copy_id FROM rental_items ri JOIN rentals r USING (rental_id) WHERE r.rental_id = ? AND r.status='open')`).run(req.params.id);
    if (!db.prepare('DELETE FROM rentals WHERE rental_id = ?').run(req.params.id).changes) throw httpErr(404, 'Оренду не знайдено');
  })();
  return { ok: true };
}));

router.get('/api/integrity', wrap(() => ({ missing: missingDifficulty() })));
router.get('/api/admin/changes', wrap(req => { needAdmin(req); return changes.list(); }));
router.post('/api/admin/changes/:id/undo', wrap(req => {
  needAdmin(req);
  if (req.query.confirm !== 'yes') throw httpErr(400, 'Потрібне підтвердження скасування');
  changes.undo(+req.params.id); return { ok: true };
}));

router.get('/api/admin/customers/:id/profile', wrap(req => { needAdmin(req); return customers.profile(+req.params.id); }));
router.post('/api/admin/customers', wrap(req => { needAdmin(req); return { ok: true, id: customers.create(req.body) }; }));
router.put('/api/admin/customers/:id', wrap(req => {
  needAdmin(req);
  const id = +req.params.id, role = req.body.role === 'admin' ? 'admin' : 'client';
  if (id === 1 && role !== 'admin') throw httpErr(403, 'Головного адміністратора не можна понизити');
  if (customers.profile(id).role === 'admin') throw httpErr(403, 'Дані адміністратора змінюються лише в його профілі');
  customers.updateProfile(id, req.body, role); return { ok: true };
}));
router.delete('/api/admin/customers/:id', wrap((req, res) => {
  needAdmin(req);
  const id = +req.params.id;
  if (req.query.confirm !== 'yes' || req.query.final !== 'yes') throw httpErr(400, 'Потрібне подвійне підтвердження видалення');
  if (id === 1) throw httpErr(403, 'Головного адміністратора видалити не можна');
  if (id !== req.user.customer_id && customers.profile(id).role === 'admin') throw httpErr(403, 'Адміністратор видаляє лише власний акаунт у профілі');
  customers.remove(id);
  if (id === req.user.customer_id) res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  return { ok: true };
}));

router.get('/api/admin/:t', wrap(req => db.prepare(tbl(req).sel).all()));

function fields(n, t, body, existing) {
  let f;
  if (n === 'games') {
    const { d, e } = checkGame({ ...existing, ...body });
    const k = Object.keys(e)[0];
    if (k) throw httpErr(400, e[k], k);
    f = t.cols.map(c => [c, d[c]]);
  } else {
    f = pick(t, body);
    for (const c of t.req || []) if (f.some(x => x[0] === c && !x[1]) || (!existing && !f.some(x => x[0] === c))) throw httpErr(400, 'Заповніть обов’язкові поля', c);
  }
  return f;
}
router.post('/api/admin/:t', wrap(req => {
  const t = tbl(req), n = req.params.t;
  if (t.noCreate) throw httpErr(405, 'Створення недоступне');
  const f = fields(n, t, req.body, null);
  return db.transaction(() => {
    const id = db.prepare(`INSERT INTO ${n} (${f.map(x => x[0])}) VALUES (${f.map(() => '?')})`).run(f.map(x => x[1])).lastInsertRowid;
    if (n === 'games') saveImage(id, req.body.image);
    changes.log(req.user.customer_id, n, id, 'insert', null, changes.TRACK.includes(n) ? changes.rowOf(n, id) : null);
    return { ok: true, id };
  })();
}));
router.put('/api/admin/:t/:id', wrap(req => {
  const t = tbl(req), n = req.params.t, id = +req.params.id;
  if (n === 'games' && req.query.confirm !== 'yes') throw httpErr(400, 'Потрібне підтвердження змін гри');
  const before = db.prepare(`SELECT * FROM ${n} WHERE ${t.pk} = ?`).get(id);
  if (!before) throw httpErr(404, 'Запис не знайдено');
  const f = fields(n, t, req.body, before);
  if (!f.length) throw httpErr(400, 'Немає даних для оновлення');
  db.transaction(() => {
    db.prepare(`UPDATE ${n} SET ${f.map(x => x[0] + ' = ?')} WHERE ${t.pk} = ?`).run([...f.map(x => x[1]), id]);
    if (n === 'games') saveImage(id, req.body.image);
    changes.log(req.user.customer_id, n, id, 'update', before, changes.rowOf(n, id));
  })();
  return { ok: true };
}));
router.delete('/api/admin/:t/:id', wrap(req => {
  const t = tbl(req), n = req.params.t, id = +req.params.id;
  if (t.noDelete) throw httpErr(405, 'Видалення недоступне');
  if (req.query.confirm !== 'yes') throw httpErr(400, 'Потрібне підтвердження видалення');
  if (n === 'difficulty_levels') {
    const c = db.prepare('SELECT COUNT(*) n FROM games WHERE difficulty_id = ?').get(id).n;
    if (c) throw httpErr(409, `Неможливо видалити: до цієї складності прив’язано ігор — ${c}. Спочатку змініть їм складність.`);
  }
  const before = db.prepare(`SELECT * FROM ${n} WHERE ${t.pk} = ?`).get(id);
  if (!before) throw httpErr(404, 'Запис не знайдено');
  db.transaction(() => {
    changes.log(req.user.customer_id, n, id, 'delete', before, null);
    db.prepare(`DELETE FROM ${n} WHERE ${t.pk} = ?`).run(id);
  })();
  return { ok: true };
}));

module.exports = router;
