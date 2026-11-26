const db = require('../db/connection');
const { hash } = require('../lib/password');
const { httpErr } = require('../lib/http');
const { checkProfile } = require('../lib/validation');

function validate(body, exceptId, needPassword) {
  const { d, e, pw } = checkProfile(body, needPassword);
  const first = Object.keys(e)[0];
  if (first) throw httpErr(400, e[first], first);
  const q = db.prepare('SELECT customer_id FROM customers WHERE phone = ? AND customer_id != ?').get(d.phone, exceptId || 0);
  if (q) throw httpErr(409, 'Цей номер телефону вже використовується', 'phone');
  const m = db.prepare('SELECT customer_id FROM customers WHERE email = ? AND customer_id != ?').get(d.email, exceptId || 0);
  if (m) throw httpErr(409, 'Ця електронна пошта вже зареєстрована', 'email');
  return { d, pw };
}

function register(body) {
  const { d, e, pw } = checkProfile(body, true);
  const first = Object.keys(e)[0];
  if (first) throw httpErr(400, e[first], first);
  const same = db.prepare('SELECT * FROM customers WHERE email = ? AND phone = ?').get(d.email, d.phone);
  if (same && same.password_hash === '' && same.role === 'client') {
    db.prepare('UPDATE customers SET first_name=?, last_name=?, password_hash=? WHERE customer_id=?').run(d.first_name, d.last_name, hash(pw), same.customer_id);
    return same.customer_id;
  }
  validate(body, 0, true);
  return db.prepare("INSERT INTO customers (first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (?,?,?,?,?,'client',0)")
    .run(d.first_name, d.last_name, d.email, d.phone, hash(pw)).lastInsertRowid;
}

function updateProfile(id, body, role) {
  const { d, pw } = validate(body, id, false);
  db.transaction(() => {
    db.prepare('UPDATE customers SET first_name=?, last_name=?, email=?, phone=? WHERE customer_id=?').run(d.first_name, d.last_name, d.email, d.phone, id);
    if (role) db.prepare('UPDATE customers SET role=? WHERE customer_id=?').run(role, id);
    if (pw) db.prepare('UPDATE customers SET password_hash=? WHERE customer_id=?').run(hash(pw), id);
  })();
}

function create(body) {
  const { d, pw } = validate(body, 0, false);
  const role = body.role === 'admin' ? 'admin' : 'client';
  return db.prepare('INSERT INTO customers (first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (?,?,?,?,?,?,1)')
    .run(d.first_name, d.last_name, d.email, d.phone, pw ? hash(pw) : '', role).lastInsertRowid;
}

function remove(id) {
  db.transaction(() => {
    db.prepare(`UPDATE game_copies SET status='available' WHERE status='rented' AND copy_id IN
      (SELECT ri.copy_id FROM rental_items ri JOIN rentals r ON r.rental_id = ri.rental_id
       WHERE r.customer_id = ? AND r.status='open' AND ri.rental_item_id NOT IN (SELECT rental_item_id FROM rental_returns))`).run(id);
    if (!db.prepare('DELETE FROM customers WHERE customer_id = ?').run(id).changes) throw httpErr(404, 'Користувача не знайдено');
  })();
}

function profile(id) {
  const u = db.prepare('SELECT customer_id, first_name, last_name, email, phone, role FROM customers WHERE customer_id = ?').get(id);
  if (!u) throw httpErr(404, 'Користувача не знайдено');
  return { ...u, ...db.prepare(`SELECT COUNT(*) rentals, COALESCE(SUM(i.total_amount),0) total FROM rentals r LEFT JOIN invoices i ON i.rental_id = r.rental_id WHERE r.customer_id = ?`).get(id) };
}
module.exports = { register, updateProfile, create, remove, profile };
