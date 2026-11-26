PRAGMA foreign_keys = OFF;
BEGIN;
CREATE TABLE change_log (
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
CREATE TABLE customers (
  customer_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin')),
  onboarded     INTEGER NOT NULL DEFAULT 0 CHECK (onboarded IN (0,1))  -- 1 = вже бачив вітальне вікно
);
CREATE TABLE damage_reports (
  damage_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_item_id INTEGER NOT NULL REFERENCES rental_items(rental_item_id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  report_date    TEXT NOT NULL,
  damage_level   TEXT NOT NULL CHECK (damage_level IN ('Незначне','Середнє','Критичне'))
);
CREATE TABLE difficulty_levels (
  difficulty_id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_name    TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT ''
);
CREATE TABLE game_copies (
  copy_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id          INTEGER NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  inventory_number TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','rented','repair'))
);
CREATE TABLE games (
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
CREATE TABLE genres (
  genre_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  genre_name TEXT NOT NULL UNIQUE
);
CREATE TABLE invoices (
  invoice_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_id      INTEGER NOT NULL UNIQUE REFERENCES rentals(rental_id) ON DELETE CASCADE,
  total_amount   REAL NOT NULL CHECK (total_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending','Paid','Cancelled')),
  issue_date     TEXT NOT NULL
);
CREATE TABLE rental_items (
  rental_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_id      INTEGER NOT NULL REFERENCES rentals(rental_id) ON DELETE CASCADE,
  copy_id        INTEGER NOT NULL REFERENCES game_copies(copy_id) ON DELETE RESTRICT,
  due_date       TEXT NOT NULL,
  price_per_day  REAL NOT NULL
);
CREATE TABLE rental_returns (
  return_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_item_id    INTEGER NOT NULL UNIQUE REFERENCES rental_items(rental_item_id) ON DELETE CASCADE,
  return_date       TEXT NOT NULL,
  condition_on_return TEXT NOT NULL,
  penalty_amount    REAL NOT NULL DEFAULT 0 CHECK (penalty_amount >= 0)
);
CREATE TABLE rental_services (
  rental_service_id INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_id    INTEGER NOT NULL REFERENCES rentals(rental_id) ON DELETE CASCADE,
  service_id   INTEGER NOT NULL REFERENCES services(service_id) ON DELETE RESTRICT,
  service_date TEXT NOT NULL
);
CREATE TABLE rentals (
  rental_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  rental_date TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
, delivery_address TEXT NOT NULL DEFAULT '');
CREATE TABLE services (
  service_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  cost         REAL NOT NULL CHECK (cost >= 0)
);
CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE VIEW available_games AS
  SELECT g.game_id, g.title, g.min_players, g.max_players, g.price_per_day,
         COUNT(gc.copy_id) AS available_copies
  FROM games g JOIN game_copies gc ON gc.game_id = g.game_id
  WHERE gc.status = 'available'
  GROUP BY g.game_id, g.title, g.min_players, g.max_players, g.price_per_day;
CREATE INDEX idx_changes_created ON change_log(created_at);
CREATE INDEX idx_copies_game ON game_copies(game_id);
CREATE INDEX idx_damage_item ON damage_reports(rental_item_id);
CREATE INDEX idx_games_difficulty ON games(difficulty_id);
CREATE INDEX idx_games_genre ON games(genre_id);
CREATE INDEX idx_items_copy ON rental_items(copy_id);
CREATE INDEX idx_items_rental ON rental_items(rental_id);
CREATE INDEX idx_rentals_customer ON rentals(customer_id);
CREATE INDEX idx_rsvc_rental ON rental_services(rental_id);
CREATE INDEX idx_sessions_customer ON sessions(customer_id);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (1,'Маргарита','Булгакова','bulhakovam@gmail.com','+380955181180','132566a3534ca72fbe8fd63e87a46bc8:0d1e8e4dcf6e778de30923c0ab54eec3469f47d7adc22fd5756a3840e6a0dd54','admin',1);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (2,'Оксана','Слишко','okslish@gmail.com','+380501234567','211c80231d5092c104b98c8b27df8c98:7cd9dff8352db287dafdaaeef4aabfb341c00f1ae3c20f9e0330ae721894a7c9','client',1);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (3,'Карина','Шевченко','k.shevchenko@gmail.com','+380672345678','500265f6ebe698a82cbcd37c6643fd56:73252fae0bce5f0e07008cef6f594cb23977559be95d2420cb996b028ba7e114','client',1);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (4,'Ярослава','Семенова','ya.semenova@ukr.net','+380933456789','2102c967c4df14a43dfd8e3378937b7e:83fb635496528749cac2f9ce07b818d33cb9cacfb745aeacf56d0d8bf54230cd','client',1);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (5,'Анастасія','Булавіна','a.bulav@gmail.com','+380504567890','4769b641a98b24253a12708b9d891578:3f14fdc2c9a62f1ee780674eab4535e74f84654690440d927d5a6f2acceba590','client',1);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (6,'Максим','Мирошніченко','m.miroshnichenko@ukr.net','+380685678901','034992eb5f3dbab4a0b0adf44a681d9c:6ff9ad281aeb452a431c31c5b4c384d2ebf03e542872f3ab2b958d0c6d2d7054','client',1);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (7,'Данило','Жарков','zarptica@ukr.net','+380667837340','3419923ce79404a9c15c2b114c82d836:b626fef6ad0c51f2b95de184ad9cd93b2fdfde96fee24597abf088d2de5c9c45','client',1);
INSERT INTO customers (customer_id,first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (9,'Софья','Полева','sofiapov@gmail.com','+380953437276','b6ea3bab3e1b177f2ddaa7db765125fb:f5834489363fe079be7506684fe534150720e52604eca2d92a591c1f7ac3781d','client',1);
INSERT INTO difficulty_levels (difficulty_id,level_name,description) VALUES (1,'Легка','Для новачків і сімей: правила пояснюються за 5 хвилин, партія — до 30 хвилин.');
INSERT INTO difficulty_levels (difficulty_id,level_name,description) VALUES (2,'Середня','Для компанії з базовим досвідом: потрібні планування та трохи терпіння.');
INSERT INTO difficulty_levels (difficulty_id,level_name,description) VALUES (3,'Складна','Для досвідчених гравців: довгі партії, багато правил і серйозна стратегія.');
INSERT INTO genres (genre_id,genre_name) VALUES (1,'Стратегія');
INSERT INTO genres (genre_id,genre_name) VALUES (2,'Кооператив');
INSERT INTO genres (genre_id,genre_name) VALUES (3,'Карткова');
INSERT INTO genres (genre_id,genre_name) VALUES (4,'Економічна');
INSERT INTO genres (genre_id,genre_name) VALUES (5,'Вечірки');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (1,'Uno',2,10,80,1,3,'Повний комплект','Динамічна карткова гра: збувайся карт першим і не забудь крикнути «Уно!».');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (2,'Монополія',2,6,120,2,4,'Повний комплект','Класика економічних ігор: купуй вулиці, збирай оренду й розори суперників.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (3,'Катан',3,4,150,2,1,'Повний комплект, 4 запасні картки','Розвивай поселення, торгуй ресурсами й будуй дороги на острові Катан.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (4,'Каркасон',2,5,100,2,1,'Відсутня одна фішка','Викладай тайли, будуй міста, дороги й монастирі та захоплюй землі.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (5,'Dixit',4,8,110,1,5,'Повний комплект','Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (6,'Пандемія',2,4,130,3,2,'Повний комплект','Кооператив: разом зупиніть чотири епідемії, поки світ не захлинувся.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (7,'Ticket to Ride',2,5,140,2,1,'Повний комплект','Прокладай залізничні маршрути через країну та з’єднуй міста.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (8,'Codenames',4,8,90,1,5,'Повний комплект','Командна гра слів: капітани підказують агентам, хто з них шпигун.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (9,'Gloomhaven: Jaws',1,4,170,3,2,'Повний комплект','Кооперативна тактична пригода з картками дій та боями з монстрами.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (10,'Манчкін',3,6,85,1,3,'Повний комплект','Жартівливий карткований квест: підставляй друзів і здобувай рівні.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (11,'Агрікола',1,5,160,3,4,'Повний комплект','Фермерська стратегія: засівай поля, розводь тварин і розбудовуй господарство.');
INSERT INTO games (game_id,title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (12,'Рамі Куб',2,4,70,1,4,'Повний комплект','Складай комбінації з плиток та першим позбудься всіх.');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (1,1,'BG-011','rented');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (2,1,'BG-012','rented');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (3,2,'BG-021','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (4,2,'BG-022','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (5,3,'BG-031','rented');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (6,3,'BG-032','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (7,3,'BG-033','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (8,4,'BG-041','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (9,4,'BG-042','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (10,5,'BG-051','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (11,5,'BG-052','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (12,6,'BG-061','rented');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (13,6,'BG-062','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (14,7,'BG-071','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (15,7,'BG-072','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (16,8,'BG-081','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (17,8,'BG-082','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (18,9,'BG-091','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (19,10,'BG-101','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (20,10,'BG-102','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (21,11,'BG-111','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (22,11,'BG-112','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (23,12,'BG-121','available');
INSERT INTO game_copies (copy_id,game_id,inventory_number,status) VALUES (24,12,'BG-122','available');
INSERT INTO services (service_id,service_name,cost) VALUES (1,'Доставка по місту',120.5);
INSERT INTO services (service_id,service_name,cost) VALUES (2,'Ігромайстер (поясніть правила)',300);
INSERT INTO services (service_id,service_name,cost) VALUES (3,'Подарункова упаковка',50);
INSERT INTO services (service_id,service_name,cost) VALUES (4,'Захисні протектори для карт',60);
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (1,2,'2026-10-13','closed','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (2,3,'2026-10-20','closed','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (3,4,'2026-10-28','closed','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (4,2,'2026-11-02','closed','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (5,5,'2026-11-10','closed','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (6,6,'2026-11-12','closed','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (7,3,'2026-11-19','open','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (8,7,'2026-11-16','open','');
INSERT INTO rentals (rental_id,customer_id,rental_date,status,delivery_address) VALUES (9,4,'2026-11-21','open','');
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (1,1,3,'2026-10-18',120);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (2,2,1,'2026-10-23',80);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (3,3,5,'2026-11-04',150);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (4,4,8,'2026-11-06',100);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (5,5,3,'2026-11-13',120);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (6,6,10,'2026-11-14',110);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (7,7,5,'2026-11-24',150);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (8,8,12,'2026-11-20',130);
INSERT INTO rental_items (rental_item_id,rental_id,copy_id,due_date,price_per_day) VALUES (9,9,1,'2026-11-24',80);
INSERT INTO rental_returns (return_id,rental_item_id,return_date,condition_on_return,penalty_amount) VALUES (1,1,'2026-10-18','добра',0);
INSERT INTO rental_returns (return_id,rental_item_id,return_date,condition_on_return,penalty_amount) VALUES (2,2,'2026-10-23','добра',0);
INSERT INTO rental_returns (return_id,rental_item_id,return_date,condition_on_return,penalty_amount) VALUES (3,3,'2026-11-04','задовільна',0);
INSERT INTO rental_returns (return_id,rental_item_id,return_date,condition_on_return,penalty_amount) VALUES (4,4,'2026-11-06','добра',0);
INSERT INTO rental_returns (return_id,rental_item_id,return_date,condition_on_return,penalty_amount) VALUES (5,5,'2026-11-14','пошкоджена',60);
INSERT INTO rental_returns (return_id,rental_item_id,return_date,condition_on_return,penalty_amount) VALUES (6,6,'2026-11-14','добра',0);
INSERT INTO rental_services (rental_service_id,rental_id,service_id,service_date) VALUES (1,1,1,'2026-10-13');
INSERT INTO rental_services (rental_service_id,rental_id,service_id,service_date) VALUES (2,3,2,'2026-10-28');
INSERT INTO rental_services (rental_service_id,rental_id,service_id,service_date) VALUES (3,5,3,'2026-11-10');
INSERT INTO rental_services (rental_service_id,rental_id,service_id,service_date) VALUES (4,7,1,'2026-11-19');
INSERT INTO rental_services (rental_service_id,rental_id,service_id,service_date) VALUES (5,7,4,'2026-11-19');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (1,1,700,'Paid','2026-10-13');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (2,2,240,'Paid','2026-10-20');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (3,3,1350,'Paid','2026-10-28');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (4,4,400,'Paid','2026-11-02');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (5,5,470,'Paid','2026-11-10');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (6,6,220,'Paid','2026-11-12');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (7,7,910,'Pending','2026-11-19');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (8,8,520,'Pending','2026-11-16');
INSERT INTO invoices (invoice_id,rental_id,total_amount,payment_status,issue_date) VALUES (9,9,240,'Pending','2026-11-21');
INSERT INTO damage_reports (damage_id,rental_item_id,description,report_date,damage_level) VALUES (1,3,'Потерті краї карт','2026-11-04','Незначне');
INSERT INTO damage_reports (damage_id,rental_item_id,description,report_date,damage_level) VALUES (2,5,'Пошкоджена коробка, відсутня одна фішка','2026-11-14','Середнє');
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (1,'2026-11-22 15:35:17',1,'games',8,'Codenames','update','{"game_id":8,"title":"Codenames","min_players":4,"max_players":8,"price_per_day":90,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Командна гра слів: капітани підказують агентам, хто з них шпигун."}','{"game_id":8,"title":"Codenames","min_players":4,"max_players":8,"price_per_day":90,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Командна гра слів: капітани підказують агентам, хто з них шпигун."}',1);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (2,'2026-11-22 15:35:29',1,'games',8,'Codenames','update','{"game_id":8,"title":"Codenames","min_players":4,"max_players":8,"price_per_day":90,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Командна гра слів: капітани підказують агентам, хто з них шпигун."}','{"game_id":8,"title":"Codenames","min_players":4,"max_players":8,"price_per_day":90,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Командна гра слів: капітани підказують агентам, хто з них шпигун."}',1);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (3,'2026-11-22 15:36:33',1,'game_copies',3,'BG-021','update','{"copy_id":3,"game_id":2,"inventory_number":"BG-021","status":"repair"}','{"copy_id":3,"game_id":2,"inventory_number":"BG-021","status":"available"}',0);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (4,'2026-11-22 15:37:15',1,'genres',6,'123','insert',NULL,'{"genre_id":6,"genre_name":"123"}',0);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (5,'2026-11-22 15:37:37',1,'games',5,'Dixit','update','{"game_id":5,"title":"Dixit","min_players":3,"max_players":8,"price_per_day":110,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі."}','{"game_id":5,"title":"Dixit","min_players":3,"max_players":8,"price_per_day":110,"difficulty_id":1,"genre_id":6,"completeness_note":"Повний комплект","description":"Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі."}',0);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (6,'2026-11-22 15:37:44',1,'games',5,'Dixit','update','{"game_id":5,"title":"Dixit","min_players":3,"max_players":8,"price_per_day":110,"difficulty_id":1,"genre_id":6,"completeness_note":"Повний комплект","description":"Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі."}','{"game_id":5,"title":"Dixit","min_players":3,"max_players":8,"price_per_day":110,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі."}',0);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (7,'2026-11-22 15:37:49',1,'genres',6,'123','delete','{"genre_id":6,"genre_name":"123"}',NULL,0);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (8,'2026-11-22 15:38:25',1,'services',1,'Доставка по місту','update','{"service_id":1,"service_name":"Доставка по місту","cost":100}','{"service_id":1,"service_name":"Доставка по місту","cost":120.5}',0);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (9,'2026-11-22 17:35:17',1,'games',8,'Codenames','update','{"game_id":8,"title":"Codenames","min_players":4,"max_players":8,"price_per_day":90,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Командна гра слів: капітани підказують агентам, хто з них шпигун."}','{"game_id":8,"title":"Codenames","min_players":4,"max_players":8,"price_per_day":90,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Командна гра слів: капітани підказують агентам, хто з них шпигун."}',0);
INSERT INTO change_log (change_id,created_at,admin_id,tbl,row_id,label,op,before,after,undone) VALUES (10,'2026-11-22 17:35:28',1,'games',5,'Dixit','update','{"game_id":5,"title":"Dixit","min_players":3,"max_players":8,"price_per_day":110,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі."}','{"game_id":5,"title":"Dixit","min_players":4,"max_players":8,"price_per_day":110,"difficulty_id":1,"genre_id":5,"completeness_note":"Повний комплект","description":"Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі."}',0);
COMMIT;
