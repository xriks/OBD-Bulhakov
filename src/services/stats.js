// Аналітичні SQL-запити для вкладки «Огляд» (JOIN, GROUP BY, підзапити)
const db = require('../db/connection');

function getStats() {
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
}

module.exports = { getStats };
