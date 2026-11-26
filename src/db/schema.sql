CREATE TABLE IF NOT EXISTS customers (
  customer_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin')),
  onboarded     INTEGER NOT NULL DEFAULT 0 CHECK (onboarded IN (0,1))  -- 1 = вже бачив вітальне вікно
);
CREATE TABLE IF NOT EXISTS difficulty_levels (
  difficulty_id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_name    TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS genres (
  genre_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  genre_name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS games (
  game_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL UNIQUE,
  min_players   INTEGER NOT NULL,
  max_players   INTEGER NOT NULL,
  price_per_day REAL NOT NULL CHECK (price_per_day > 0),
  difficulty_id INTEGER REFERENCES difficulty_levels(difficulty_id) ON DELETE RESTRICT,
  genre_id      INTEGER NOT NULL REFERENCES genres(genre_id) ON DELETE RESTRICT,
  completeness_note TEXT DEFAULT 'Повний комплект',
  description   TEXT NOT NULL DEFAULT '',
  CHECK (max_players >= min_players AND min_players >= 1 AND max_players <= 12)
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
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS change_log (
  change_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  admin_id   INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
  tbl        TEXT NOT NULL,
  row_id     INTEGER NOT NULL,
  label      TEXT NOT NULL DEFAULT '',
  op         TEXT NOT NULL CHECK (op IN ('insert','update','delete')),
  before     TEXT,
  after      TEXT,
  undone     INTEGER NOT NULL DEFAULT 0 CHECK (undone IN (0,1))
);
CREATE VIEW IF NOT EXISTS available_games AS
  SELECT g.game_id, g.title, g.min_players, g.max_players, g.price_per_day,
         COUNT(gc.copy_id) AS available_copies
  FROM games g JOIN game_copies gc ON gc.game_id = g.game_id
  WHERE gc.status = 'available'
  GROUP BY g.game_id, g.title, g.min_players, g.max_players, g.price_per_day;

CREATE INDEX IF NOT EXISTS idx_games_difficulty ON games(difficulty_id);
CREATE INDEX IF NOT EXISTS idx_games_genre ON games(genre_id);
CREATE INDEX IF NOT EXISTS idx_copies_game ON game_copies(game_id);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_rental ON rental_items(rental_id);
CREATE INDEX IF NOT EXISTS idx_items_copy ON rental_items(copy_id);
CREATE INDEX IF NOT EXISTS idx_rsvc_rental ON rental_services(rental_id);
CREATE INDEX IF NOT EXISTS idx_damage_item ON damage_reports(rental_item_id);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_changes_created ON change_log(created_at);
