const T = {
  games: { pk: 'game_id', cols: ['title', 'min_players', 'max_players', 'price_per_day', 'difficulty_id', 'genre_id', 'completeness_note', 'description'], req: ['title'],
    sel: `SELECT g.*, d.level_name, gn.genre_name, (SELECT COUNT(*) FROM game_copies c WHERE c.game_id = g.game_id AND c.status='available') AS available_copies
      FROM games g LEFT JOIN difficulty_levels d ON d.difficulty_id = g.difficulty_id JOIN genres gn ON gn.genre_id = g.genre_id ORDER BY g.title` },
  game_copies: { pk: 'copy_id', cols: ['game_id', 'inventory_number', 'status'], req: ['inventory_number'],
    sel: 'SELECT c.*, g.title FROM game_copies c JOIN games g USING (game_id) ORDER BY c.inventory_number' },
  genres: { pk: 'genre_id', cols: ['genre_name'], req: ['genre_name'], sel: 'SELECT * FROM genres ORDER BY genre_name' },
  difficulty_levels: { pk: 'difficulty_id', cols: ['level_name', 'description'], req: ['level_name'], sel: 'SELECT d.*, (SELECT COUNT(*) FROM games g WHERE g.difficulty_id = d.difficulty_id) AS games_count FROM difficulty_levels d ORDER BY d.difficulty_id' },
  services: { pk: 'service_id', cols: ['service_name', 'cost'], req: ['service_name'], sel: 'SELECT * FROM services ORDER BY service_id' },
  customers: { pk: 'customer_id', cols: ['first_name', 'last_name', 'email', 'phone', 'role'],
    sel: 'SELECT customer_id, first_name, last_name, email, phone, role FROM customers ORDER BY customer_id' },
  invoices: { pk: 'invoice_id', cols: ['payment_status'], noCreate: true, noDelete: true,
    sel: `SELECT i.*, c.first_name || ' ' || c.last_name AS customer_name FROM invoices i JOIN rentals r USING (rental_id) JOIN customers c USING (customer_id) ORDER BY i.invoice_id DESC` },
  damage_reports: { pk: 'damage_id', cols: ['description', 'damage_level', 'report_date'], noCreate: true,
    sel: `SELECT dr.*, g.title AS game_title FROM damage_reports dr JOIN rental_items ri USING (rental_item_id) JOIN game_copies gc USING (copy_id) JOIN games g USING (game_id) ORDER BY dr.report_date DESC` },
};

module.exports = { T };
