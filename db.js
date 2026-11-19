const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(process.env.DB_FILE || path.join(__dirname, 'hooked.db'));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

const httpErr = (status, message) => Object.assign(new Error(message), { status });
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
const hash = (pw) => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); };
const verify = (pw, h) => { const [s, k] = (h || '').split(':'); return !!k && crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(pw, s, 32)); };

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  customer_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin'))
);
CREATE TABLE IF NOT EXISTS difficulty_levels (
  difficulty_id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_name    TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS genres (
  genre_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  genre_name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS games (
  game_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL UNIQUE,
  min_players   INTEGER NOT NULL CHECK (min_players > 0),
  max_players   INTEGER NOT NULL,
  price_per_day REAL NOT NULL CHECK (price_per_day > 0),
  difficulty_id INTEGER NOT NULL REFERENCES difficulty_levels(difficulty_id) ON DELETE RESTRICT,
  genre_id      INTEGER NOT NULL REFERENCES genres(genre_id) ON DELETE RESTRICT,
  completeness_note TEXT DEFAULT 'Повний комплект',
  CHECK (max_players >= min_players)
);
CREATE TABLE IF NOT EXISTS game_copies (
  copy_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id          INTEGER NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  inventory_number TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','rented','repair'))
);
CREATE TABLE IF NOT EXISTS services (
  service_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  cost         REAL NOT NULL CHECK (cost >= 0)
);
CREATE TABLE IF NOT EXISTS rentals (
  rental_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  rental_date TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);
CREATE TABLE IF NOT EXISTS rental_items (
  rental_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_id      INTEGER NOT NULL REFERENCES rentals(rental_id) ON DELETE CASCADE,
  copy_id        INTEGER NOT NULL REFERENCES game_copies(copy_id) ON DELETE RESTRICT,
  due_date       TEXT NOT NULL,
  price_per_day  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS rental_returns (
  return_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_item_id    INTEGER NOT NULL UNIQUE REFERENCES rental_items(rental_item_id) ON DELETE CASCADE,
  return_date       TEXT NOT NULL,
  condition_on_return TEXT NOT NULL,
  penalty_amount    REAL NOT NULL DEFAULT 0 CHECK (penalty_amount >= 0)
);
CREATE TABLE IF NOT EXISTS rental_services (
  rental_service_id INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_id    INTEGER NOT NULL REFERENCES rentals(rental_id) ON DELETE CASCADE,
  service_id   INTEGER NOT NULL REFERENCES services(service_id) ON DELETE RESTRICT,
  service_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_id      INTEGER NOT NULL UNIQUE REFERENCES rentals(rental_id) ON DELETE CASCADE,
  total_amount   REAL NOT NULL CHECK (total_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending','Paid','Cancelled')),
  issue_date     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS damage_reports (
  damage_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_item_id INTEGER NOT NULL REFERENCES rental_items(rental_item_id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  report_date    TEXT NOT NULL,
  damage_level   TEXT NOT NULL CHECK (damage_level IN ('Незначне','Середнє','Критичне'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE VIEW IF NOT EXISTS available_games AS
  SELECT g.game_id, g.title, g.min_players, g.max_players, g.price_per_day,
         COUNT(gc.copy_id) AS available_copies
  FROM games g JOIN game_copies gc ON gc.game_id = g.game_id
  WHERE gc.status = 'available'
  GROUP BY g.game_id, g.title, g.min_players, g.max_players, g.price_per_day;
`);

// ---------- транзакція: оформлення оренди ----------
const rentTx = db.transaction((customerId, gameId, days, serviceIds = [], startDate = today()) => {
  days = parseInt(days, 10);
  if (!(days >= 1 && days <= 30)) throw httpErr(400, 'Термін оренди — від 1 до 30 діб');
  const game = db.prepare('SELECT * FROM games WHERE game_id = ?').get(gameId);
  if (!game) throw httpErr(404, 'Гру не знайдено');
  const copy = db.prepare("SELECT copy_id FROM game_copies WHERE game_id = ? AND status = 'available' ORDER BY copy_id LIMIT 1").get(gameId);
  if (!copy) throw httpErr(409, 'Усі копії цієї гри зараз видані');
  const rentalId = db.prepare("INSERT INTO rentals (customer_id, rental_date, status) VALUES (?, ?, 'open')").run(customerId, startDate).lastInsertRowid;
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

// ---------- транзакція: оформлення повернення (ЛР7, п.5) ----------
const returnTx = db.transaction((itemId, o = {}) => {
  const item = db.prepare('SELECT * FROM rental_items WHERE rental_item_id = ?').get(itemId);
  if (!item) throw httpErr(404, 'Позицію оренди не знайдено');
  if (db.prepare('SELECT 1 FROM rental_returns WHERE rental_item_id = ?').get(itemId)) throw httpErr(409, 'Цю гру вже повернуто');
  const date = o.date || today();
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

// ---------- тестові дані (≥5 записів у кожній таблиці, ≥10 в основних) ----------
function seed() {
  if (db.prepare('SELECT COUNT(*) n FROM customers').get().n) return;
  const run = db.transaction(() => {
    const cust = db.prepare('INSERT INTO customers (first_name,last_name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)');
    cust.run('Головний', 'Адміністратор', 'admin@hooked.ua', '+380441112233', hash('admin123'), 'admin');
    [['Олена', 'Коваленко', 'olena@example.com', '+380501110001'], ['Максим', 'Шевчук', 'maksym@example.com', '+380671110002'],
     ['Ірина', 'Бондаренко', 'iryna@example.com', '+380931110003'], ['Андрій', 'Мельник', 'andrii@example.com', '+380631110004'],
     ['Софія', 'Ткаченко', 'sofia@example.com', '+380731110005'], ['Дмитро', 'Лисенко', 'dmytro@example.com', '+380991110006']]
      .forEach(c => cust.run(...c, hash('client123'), 'client'));
    ['Легка', 'Середня', 'Складна'].forEach(n => db.prepare('INSERT INTO difficulty_levels (level_name) VALUES (?)').run(n));
    ['Стратегія', 'Кооператив', 'Карткова', 'Економічна', 'Вечірки'].forEach(n => db.prepare('INSERT INTO genres (genre_name) VALUES (?)').run(n));
    // title, min, max, price, difficulty, genre, note, copies
    [['Uno', 2, 10, 80, 1, 3, 'Повний комплект', 2], ['Монополія', 2, 6, 120, 2, 4, 'Повний комплект', 2],
     ['Катан', 3, 4, 150, 2, 1, 'Повний комплект, 4 запасні картки', 3], ['Каркасон', 2, 5, 100, 2, 1, 'Відсутня одна фішка', 2],
     ['Dixit', 3, 8, 110, 1, 5, 'Повний комплект', 2], ['Пандемія', 2, 4, 130, 3, 2, 'Повний комплект', 2],
     ['Ticket to Ride', 2, 5, 140, 2, 1, 'Повний комплект', 2], ['Codenames', 4, 8, 90, 1, 5, 'Повний комплект', 2],
     ['Gloomhaven: Jaws', 1, 4, 170, 3, 2, 'Повний комплект', 1], ['Манчкін', 3, 6, 85, 1, 3, 'Повний комплект', 2],
     ['Агрікола', 1, 5, 160, 3, 4, 'Повний комплект', 2], ['Рамі Куб', 2, 4, 70, 1, 4, 'Повний комплект', 2]]
      .forEach(([t, mn, mx, p, d, g, note, copies], i) => {
        const gid = db.prepare('INSERT INTO games (title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note) VALUES (?,?,?,?,?,?,?)').run(t, mn, mx, p, d, g, note).lastInsertRowid;
        for (let c = 1; c <= copies; c++) db.prepare('INSERT INTO game_copies (game_id,inventory_number) VALUES (?,?)').run(gid, `BG-${String(i + 1).padStart(2, '0')}${c}`);
      });
    [['Доставка по місту', 100], ['Ігромайстер (поясніть правила)', 300], ['Подарункова упаковка', 50], ['Захисні протектори для карт', 60]]
      .forEach(s => db.prepare('INSERT INTO services (service_name,cost) VALUES (?,?)').run(...s));

    const T = today(), d = n => addDays(T, n);
    const ret = (cust, game, days, svc, start, r) => {
      const x = rentTx(cust, game, days, svc, d(start));
      if (r) { returnTx(x.rental_item_id, { date: d(r.day), condition: r.cond, damage_level: r.lvl, damage_description: r.dmg }); db.prepare("UPDATE invoices SET payment_status='Paid' WHERE rental_id=?").run(x.rental_id); }
    };
    ret(2, 2, 5, [1], -40, { day: -35, cond: 'добра' });
    ret(3, 1, 3, [], -33, { day: -30, cond: 'добра' });
    ret(4, 3, 7, [2], -25, { day: -18, cond: 'задовільна', lvl: 'Незначне', dmg: 'Потерті краї карт' });
    ret(2, 4, 4, [], -20, { day: -16, cond: 'добра' });
    ret(5, 2, 3, [3], -12, { day: -8, cond: 'пошкоджена', lvl: 'Середнє', dmg: 'Пошкоджена коробка, відсутня одна фішка' });
    ret(6, 5, 2, [], -10, { day: -8, cond: 'добра' });
    ret(3, 3, 5, [1, 4], -3, null);   // відкрита
    ret(7, 6, 4, [], -6, null);       // відкрита, прострочена
    ret(4, 1, 3, [], -1, null);       // відкрита
  });
  run();
}

module.exports = { db, hash, verify, rentTx, returnTx, seed, today, httpErr };
