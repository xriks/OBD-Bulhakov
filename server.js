const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { db, hash, verify, rentTx, returnTx, seed, httpErr } = require('./db');

seed();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res) => {
  try { const r = fn(req, res); if (r !== undefined) res.json(r); }
  catch (e) {
    let status = e.status || 500, msg = e.message;
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
      if (/FOREIGN KEY/.test(msg)) { status = 409; msg = 'Неможливо виконати: запис пов’язаний з іншими даними (оренди, копії тощо).'; }
      else if (/UNIQUE/.test(msg)) { status = 409; msg = 'Таке значення вже існує.'; }
      else { status = 400; msg = 'Некоректні дані: перевірте заповнення полів.'; }
    }
    if (status === 500) console.error(e);
    res.status(status).json({ error: msg });
  }
};

app.use((req, _res, next) => {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  req.user = m ? db.prepare(`SELECT c.customer_id, c.first_name, c.last_name, c.email, c.phone, c.role
    FROM sessions s JOIN customers c ON c.customer_id = s.customer_id WHERE s.token = ?`).get(m[1]) : null;
  next();
});
const needUser = req => { if (!req.user) throw httpErr(401, 'Увійдіть в акаунт'); };
const needAdmin = req => { needUser(req); if (req.user.role !== 'admin') throw httpErr(403, 'Доступ лише для адміністратора'); };
const startSession = (res, id) => {
  const t = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, customer_id) VALUES (?, ?)').run(t, id);
  res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
};
const clean = v => (typeof v === 'string' ? v.trim() : v);

app.post('/api/register', wrap((req, res) => {
  const { first_name, last_name, email, phone, password } = Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, clean(v)]));
  if (!first_name || !last_name || !email || !phone || !password) throw httpErr(400, 'Заповніть усі поля');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpErr(400, 'Некоректний e-mail');
  if (password.length < 6) throw httpErr(400, 'Пароль — щонайменше 6 символів');
  const id = db.prepare("INSERT INTO customers (first_name,last_name,email,phone,password_hash,role) VALUES (?,?,?,?,?, 'client')")
    .run(first_name, last_name, email.toLowerCase(), phone, hash(password)).lastInsertRowid;
  startSession(res, id);
  return { ok: true };
}));
app.post('/api/login', wrap((req, res) => {
  const u = db.prepare('SELECT * FROM customers WHERE email = ?').get(String(req.body.email || '').trim().toLowerCase());
  if (!u || !verify(req.body.password || '', u.password_hash)) throw httpErr(401, 'Невірний e-mail або пароль');
  startSession(res, u.customer_id);
  return { ok: true };
}));
app.post('/api/logout', wrap((req, res) => {
  const m = /sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1]);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  return { ok: true };
}));
app.get('/api/me', wrap(req => ({ user: req.user })));

app.get('/api/lookups', wrap(() => ({
  genres: db.prepare('SELECT * FROM genres ORDER BY genre_name').all(),
  difficulty_levels: db.prepare('SELECT * FROM difficulty_levels ORDER BY difficulty_id').all(),
  services: db.prepare('SELECT * FROM services ORDER BY service_id').all(),
  games: db.prepare('SELECT game_id, title FROM games ORDER BY title').all(),
})));

app.get('/api/games', wrap(req => {
  const { q, genre, difficulty, players, available } = req.query;
  const w = [], p = [];
  if (q) { w.push('g.title LIKE ?'); p.push(`%${q}%`); }
  if (genre) { w.push('g.genre_id = ?'); p.push(+genre); }
  if (difficulty) { w.push('g.difficulty_id = ?'); p.push(+difficulty); }
  if (players) { w.push('g.min_players <= ? AND g.max_players >= ?'); p.push(+players, +players); }
  if (available === '1') w.push('g.game_id IN (SELECT game_id FROM available_games)');
  return db.prepare(`SELECT g.*, d.level_name, gn.genre_name,
      COALESCE((SELECT available_copies FROM available_games a WHERE a.game_id = g.game_id), 0) AS available_copies
    FROM games g JOIN difficulty_levels d ON d.difficulty_id = g.difficulty_id JOIN genres gn ON gn.genre_id = g.genre_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY g.title`).all(...p);
}));

const RENTALS_SQL = `SELECT r.rental_id, ri.rental_item_id, c.first_name || ' ' || c.last_name AS customer_name,
    g.title AS game_title, gc.inventory_number, r.rental_date, ri.due_date, rr.return_date,
    rr.condition_on_return, rr.penalty_amount, r.status, inv.invoice_id, inv.total_amount, inv.payment_status
  FROM rentals r
  JOIN customers c ON c.customer_id = r.customer_id
  JOIN rental_items ri ON ri.rental_id = r.rental_id
  JOIN game_copies gc ON gc.copy_id = ri.copy_id
  JOIN games g ON g.game_id = gc.game_id
  LEFT JOIN rental_returns rr ON rr.rental_item_id = ri.rental_item_id
  LEFT JOIN invoices inv ON inv.rental_id = r.rental_id`;

app.post('/api/rent', wrap(req => {
  needUser(req);
  const { game_id, days, service_ids } = req.body;
  return rentTx(req.user.customer_id, +game_id, days, Array.isArray(service_ids) ? service_ids.map(Number) : []);
}));
app.get('/api/my/rentals', wrap(req => { needUser(req); return db.prepare(RENTALS_SQL + ' WHERE r.customer_id = ? ORDER BY r.rental_date DESC, r.rental_id DESC').all(req.user.customer_id); }));
app.post('/api/invoices/:id/pay', wrap(req => {
  needUser(req);
  const inv = db.prepare('SELECT i.*, r.customer_id FROM invoices i JOIN rentals r ON r.rental_id = i.rental_id WHERE invoice_id = ?').get(req.params.id);
  if (!inv || (inv.customer_id !== req.user.customer_id && req.user.role !== 'admin')) throw httpErr(404, 'Рахунок не знайдено');
  if (inv.payment_status !== 'Pending') throw httpErr(409, 'Рахунок уже не очікує оплати');
  db.prepare("UPDATE invoices SET payment_status = 'Paid' WHERE invoice_id = ?").run(inv.invoice_id);
  return { ok: true };
}));

const T = {
  games: { pk: 'game_id', cols: ['title', 'min_players', 'max_players', 'price_per_day', 'difficulty_id', 'genre_id', 'completeness_note'],
    sel: `SELECT g.*, d.level_name, gn.genre_name, (SELECT COUNT(*) FROM game_copies c WHERE c.game_id = g.game_id AND c.status='available') AS available_copies
      FROM games g JOIN difficulty_levels d USING (difficulty_id) JOIN genres gn USING (genre_id) ORDER BY g.title` },
  game_copies: { pk: 'copy_id', cols: ['game_id', 'inventory_number', 'status'],
    sel: 'SELECT c.*, g.title FROM game_copies c JOIN games g USING (game_id) ORDER BY c.inventory_number' },
  genres: { pk: 'genre_id', cols: ['genre_name'], sel: 'SELECT * FROM genres ORDER BY genre_name' },
  difficulty_levels: { pk: 'difficulty_id', cols: ['level_name'], sel: 'SELECT * FROM difficulty_levels ORDER BY difficulty_id' },
  services: { pk: 'service_id', cols: ['service_name', 'cost'], sel: 'SELECT * FROM services ORDER BY service_id' },
  customers: { pk: 'customer_id', cols: ['first_name', 'last_name', 'email', 'phone', 'role'],
    sel: 'SELECT customer_id, first_name, last_name, email, phone, role FROM customers ORDER BY customer_id' },
  invoices: { pk: 'invoice_id', cols: ['payment_status'], noCreate: true, noDelete: true,
    sel: `SELECT i.*, c.first_name || ' ' || c.last_name AS customer_name FROM invoices i JOIN rentals r USING (rental_id) JOIN customers c USING (customer_id) ORDER BY i.invoice_id DESC` },
  damage_reports: { pk: 'damage_id', cols: ['description', 'damage_level', 'report_date'], noCreate: true,
    sel: `SELECT dr.*, g.title AS game_title FROM damage_reports dr JOIN rental_items ri USING (rental_item_id) JOIN game_copies gc USING (copy_id) JOIN games g USING (game_id) ORDER BY dr.report_date DESC` },
};
const tbl = req => { needAdmin(req); const t = T[req.params.t]; if (!t) throw httpErr(404, 'Невідома таблиця'); return t; };
const pick = (t, body) => t.cols.filter(c => body[c] !== undefined).map(c => [c, clean(body[c])]);

app.get('/api/admin/stats', wrap(req => {
  needAdmin(req);
  const one = s => db.prepare(s).get();
  return {
    totals: one(`SELECT (SELECT COUNT(*) FROM games) games, (SELECT COUNT(*) FROM game_copies) copies,
      (SELECT COUNT(*) FROM customers WHERE role='client') clients, (SELECT COUNT(*) FROM rentals WHERE status='open') open_rentals,
      (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE payment_status='Paid') revenue,
      (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE payment_status='Pending') pending,
      (SELECT COUNT(*) FROM rental_items ri JOIN rentals r USING (rental_id) WHERE r.status='open' AND ri.due_date < date('now')) overdue`),
    popular: db.prepare(`SELECT g.title, COUNT(ri.rental_item_id) AS rentals_count FROM games g
      JOIN game_copies gc ON gc.game_id = g.game_id JOIN rental_items ri ON ri.copy_id = gc.copy_id
      GROUP BY g.title ORDER BY rentals_count DESC, g.title LIMIT 8`).all(),
    byGenre: db.prepare(`SELECT gn.genre_name, COUNT(ri.rental_item_id) AS total_rentals FROM genres gn
      LEFT JOIN games g ON g.genre_id = gn.genre_id LEFT JOIN game_copies gc ON gc.game_id = g.game_id
      LEFT JOIN rental_items ri ON ri.copy_id = gc.copy_id GROUP BY gn.genre_name ORDER BY total_rentals DESC`).all(),
    damaged: db.prepare(`SELECT g.title, COUNT(dr.damage_id) AS damage_count, MAX(dr.report_date) AS last_report FROM damage_reports dr
      JOIN rental_items ri ON ri.rental_item_id = dr.rental_item_id JOIN game_copies gc ON gc.copy_id = ri.copy_id
      JOIN games g ON g.game_id = gc.game_id GROUP BY g.title ORDER BY damage_count DESC`).all(),
    idle: db.prepare(`SELECT g.title FROM games g WHERE g.game_id NOT IN (SELECT DISTINCT gc.game_id FROM rental_items ri
      JOIN game_copies gc ON gc.copy_id = ri.copy_id JOIN rentals r ON r.rental_id = ri.rental_id WHERE r.rental_date >= date('now','-30 day')) ORDER BY g.title`).all(),
  };
}));

app.get('/api/admin/rentals', wrap(req => { needAdmin(req); return db.prepare(RENTALS_SQL + ' ORDER BY r.rental_date DESC, r.rental_id DESC').all(); }));
app.post('/api/admin/rentals/:itemId/return', wrap(req => { needAdmin(req); return returnTx(+req.params.itemId, req.body); }));
app.delete('/api/admin/rentals/:id', wrap(req => {
  needAdmin(req);
  if (req.query.confirm !== 'yes') throw httpErr(400, 'Потрібне підтвердження видалення');
  db.transaction(() => {
    db.prepare(`UPDATE game_copies SET status='available' WHERE status='rented' AND copy_id IN
      (SELECT ri.copy_id FROM rental_items ri JOIN rentals r USING (rental_id) WHERE r.rental_id = ? AND r.status='open')`).run(req.params.id);
    if (!db.prepare('DELETE FROM rentals WHERE rental_id = ?').run(req.params.id).changes) throw httpErr(404, 'Оренду не знайдено');
  })();
  return { ok: true };
}));

app.get('/api/admin/:t', wrap(req => db.prepare(tbl(req).sel).all()));
app.post('/api/admin/:t', wrap(req => {
  const t = tbl(req);
  if (t.noCreate) throw httpErr(405, 'Створення недоступне');
  const f = pick(t, req.body);
  if (req.params.t === 'customers') f.push(['password_hash', hash(req.body.password || 'client123')]);
  db.prepare(`INSERT INTO ${req.params.t} (${f.map(x => x[0])}) VALUES (${f.map(() => '?')})`).run(f.map(x => x[1]));
  return { ok: true };
}));
app.put('/api/admin/:t/:id', wrap(req => {
  const t = tbl(req), f = pick(t, req.body);
  if (req.params.t === 'customers' && +req.params.id === 1 && req.body.role !== 'admin') throw httpErr(403, 'Головного адміністратора не можна понизити');
  if (!f.length) throw httpErr(400, 'Немає даних для оновлення');
  const r = db.prepare(`UPDATE ${req.params.t} SET ${f.map(x => x[0] + ' = ?')} WHERE ${t.pk} = ?`).run([...f.map(x => x[1]), req.params.id]);
  if (!r.changes) throw httpErr(404, 'Запис не знайдено');
  return { ok: true };
}));
app.delete('/api/admin/:t/:id', wrap(req => {
  const t = tbl(req);
  if (t.noDelete) throw httpErr(405, 'Видалення недоступне');
  if (req.query.confirm !== 'yes') throw httpErr(400, 'Потрібне підтвердження видалення');
  if (req.params.t === 'customers' && (+req.params.id === 1 || +req.params.id === req.user.customer_id)) throw httpErr(403, 'Цей акаунт видалити не можна');
  if (!db.prepare(`DELETE FROM ${req.params.t} WHERE ${t.pk} = ?`).run(req.params.id).changes) throw httpErr(404, 'Запис не знайдено');
  return { ok: true };
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Не знайдено' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hooked працює: http://localhost:${PORT}`));
