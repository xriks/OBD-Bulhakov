const db = require('../db/connection');
const { httpErr } = require('../lib/http');
const { today, addDays, diffDays } = require('../lib/dates');

const rentTx = db.transaction((customerId, gameId, days, serviceIds = [], startDate = today(), address = '') => {
  days = parseInt(days, 10);
  if (!(days >= 1 && days <= 30)) throw httpErr(400, 'Термін оренди — від 1 до 30 діб');
  const game = db.prepare('SELECT * FROM games WHERE game_id = ?').get(gameId);
  if (!game) throw httpErr(404, 'Гру не знайдено');
  const copy = db.prepare("SELECT copy_id FROM game_copies WHERE game_id = ? AND status = 'available' ORDER BY copy_id LIMIT 1").get(gameId);
  if (!copy) throw httpErr(409, 'Усі копії цієї гри зараз видані');
  const rentalId = db.prepare("INSERT INTO rentals (customer_id, rental_date, status, delivery_address) VALUES (?, ?, 'open', ?)").run(customerId, startDate, address).lastInsertRowid;
  const itemId = db.prepare('INSERT INTO rental_items (rental_id, copy_id, due_date, price_per_day) VALUES (?, ?, ?, ?)')
    .run(rentalId, copy.copy_id, addDays(startDate, days), game.price_per_day).lastInsertRowid;
  db.prepare("UPDATE game_copies SET status = 'rented' WHERE copy_id = ?").run(copy.copy_id);
  let total = days * game.price_per_day;
  for (const sid of [...new Set(serviceIds)]) {
    const s = db.prepare('SELECT cost FROM services WHERE service_id = ?').get(sid);
    if (!s) throw httpErr(400, 'Невідома послуга');
    db.prepare('INSERT INTO rental_services (rental_id, service_id, service_date) VALUES (?, ?, ?)').run(rentalId, sid, startDate);
    total += s.cost;
  }
  db.prepare("INSERT INTO invoices (rental_id, total_amount, payment_status, issue_date) VALUES (?, ?, 'Pending', ?)").run(rentalId, total, startDate);
  return { rental_id: rentalId, rental_item_id: itemId, total };
});

const returnTx = db.transaction((itemId, o = {}) => {
  const item = db.prepare('SELECT * FROM rental_items WHERE rental_item_id = ?').get(itemId);
  if (!item) throw httpErr(404, 'Позицію оренди не знайдено');
  if (db.prepare('SELECT 1 FROM rental_returns WHERE rental_item_id = ?').get(itemId)) throw httpErr(409, 'Цю гру вже повернуто');
  const date = o.date || today();
  const started = db.prepare('SELECT rental_date FROM rentals WHERE rental_id = ?').get(item.rental_id).rental_date;
  if (started > date) throw httpErr(409, `Гру ще не видано: оренда починається ${started}`);
  const cond = o.condition || 'добра';
  const late = Math.max(0, diffDays(date, item.due_date));
  const penalty = o.penalty !== undefined && o.penalty !== '' && o.penalty !== null ? Number(o.penalty) : Math.round(late * item.price_per_day * 0.5);
  if (!(penalty >= 0)) throw httpErr(400, 'Некоректна сума штрафу');
  db.prepare('INSERT INTO rental_returns (rental_item_id, return_date, condition_on_return, penalty_amount) VALUES (?, ?, ?, ?)').run(itemId, date, cond, penalty);
  if (o.damage_description && o.damage_description.trim()) {
    db.prepare('INSERT INTO damage_reports (rental_item_id, description, report_date, damage_level) VALUES (?, ?, ?, ?)')
      .run(itemId, o.damage_description.trim(), date, o.damage_level || 'Незначне');
  }
  db.prepare('UPDATE game_copies SET status = ? WHERE copy_id = ?').run(cond === 'пошкоджена' ? 'repair' : 'available', item.copy_id);
  db.prepare("UPDATE rentals SET status = 'closed' WHERE rental_id = ? AND NOT EXISTS (SELECT 1 FROM rental_items ri WHERE ri.rental_id = rentals.rental_id AND NOT EXISTS (SELECT 1 FROM rental_returns rr WHERE rr.rental_item_id = ri.rental_item_id))").run(item.rental_id);
  if (penalty > 0) db.prepare('UPDATE invoices SET total_amount = total_amount + ? WHERE rental_id = ?').run(penalty, item.rental_id);
  return { penalty };
});

const RENTALS_SQL = `SELECT r.rental_id, ri.rental_item_id, c.first_name || ' ' || c.last_name AS customer_name,
    g.title AS game_title, gc.inventory_number, r.rental_date, r.delivery_address, ri.due_date, rr.return_date,
    rr.condition_on_return, rr.penalty_amount, r.status, inv.invoice_id, inv.total_amount, inv.payment_status
  FROM rentals r
  JOIN customers c ON c.customer_id = r.customer_id
  JOIN rental_items ri ON ri.rental_id = r.rental_id
  JOIN game_copies gc ON gc.copy_id = ri.copy_id
  JOIN games g ON g.game_id = gc.game_id
  LEFT JOIN rental_returns rr ON rr.rental_item_id = ri.rental_item_id
  LEFT JOIN invoices inv ON inv.rental_id = r.rental_id`;

module.exports = { rentTx, returnTx, RENTALS_SQL };
