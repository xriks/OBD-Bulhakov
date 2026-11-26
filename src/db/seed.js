const db = require('./connection');
const { hash, verify } = require('../lib/password');
const { today, addDays } = require('../lib/dates');
const { rentTx, returnTx } = require('../services/rentals');

const GUESTS = [['Оксана', 'Слишко', 'okslish@gmail.com', '+380501234567'], ['Карина', 'Шевченко', 'k.shevchenko@gmail.com', '+380672345678'],
  ['Ярослава', 'Семенова', 'ya.semenova@ukr.net', '+380933456789'], ['Анастасія', 'Булавіна', 'a.bulav@gmail.com', '+380504567890'],
  ['Максим', 'Мирошніченко', 'm.miroshnichenko@ukr.net', '+380685678901'], ['Данило', 'Жарков', 'zarptica@ukr.net', '+380667837340']];
const ADMIN_PW = process.env.ADMIN_PASSWORD || 'Admin#2026';
const guestPw = g => 'Hooked-' + g[3].slice(-4);
const ADMIN = ['Маргарита', 'Булгакова', 'bulhakovam@gmail.com', '+380955181180'];
const DIFF = [['Легка', 'Для новачків і сімей: правила пояснюються за 5 хвилин, партія — до 30 хвилин.'],
  ['Середня', 'Для компанії з базовим досвідом: потрібні планування та трохи терпіння.'],
  ['Складна', 'Для досвідчених гравців: довгі партії, багато правил і серйозна стратегія.']];
const DESC = ['Динамічна карткова гра: збувайся карт першим і не забудь крикнути «Уно!».', 'Класика економічних ігор: купуй вулиці, збирай оренду й розори суперників.',
  'Розвивай поселення, торгуй ресурсами й будуй дороги на острові Катан.', 'Викладай тайли, будуй міста, дороги й монастирі та захоплюй землі.',
  'Образні ілюстрації та асоціації: намагайся, щоб тебе зрозуміли — але не всі.', 'Кооператив: разом зупиніть чотири епідемії, поки світ не захлинувся.',
  'Прокладай залізничні маршрути через країну та з’єднуй міста.', 'Командна гра слів: капітани підказують агентам, хто з них шпигун.',
  'Кооперативна тактична пригода з картками дій та боями з монстрами.', 'Жартівливий карткований квест: підставляй друзів і здобувай рівні.',
  'Фермерська стратегія: засівай поля, розводь тварин і розбудовуй господарство.', 'Складай комбінації з плиток та першим позбудься всіх.'];

function ensureUsers() {
  const exists = db.prepare('SELECT 1 FROM customers WHERE email = ? OR phone = ?');
  const ins = db.prepare('INSERT INTO customers (first_name,last_name,email,phone,password_hash,role,onboarded) VALUES (?,?,?,?,?,?,1)');
  if (!exists.get(ADMIN[2], ADMIN[3])) ins.run(...ADMIN, hash(ADMIN_PW), 'admin');
  if (db.pragma('user_version', { simple: true }) === 0) {
    GUESTS.forEach(g => { if (!exists.get(g[2], g[3])) ins.run(...g, hash(guestPw(g)), 'client'); });
    db.pragma('user_version = 1');
  }
}

function demoAccounts() {
  const list = [[ADMIN[2], ADMIN_PW, 'admin'], ...GUESTS.map(g => [g[2], guestPw(g), 'client'])];
  const ok = list.filter(([e, p]) => { const u = db.prepare('SELECT password_hash FROM customers WHERE email = ?').get(e); return u && verify(p, u.password_hash); });
  const guests = ok.filter(x => x[2] === 'client');
  return [...ok.filter(x => x[2] === 'admin'), ...(guests.length ? [guests[Math.floor(Math.random() * guests.length)]] : [])]
    .map(([email, password, role]) => ({ email, password, role }));
}

function seed() {
  db.transaction(ensureUsers)();
  if (db.prepare('SELECT COUNT(*) n FROM games').get().n) return;
  const run = db.transaction(() => {
    DIFF.forEach(d => db.prepare('INSERT OR IGNORE INTO difficulty_levels (level_name,description) VALUES (?,?)').run(...d));
    ['Стратегія', 'Кооператив', 'Карткова', 'Економічна', 'Вечірки'].forEach(n => db.prepare('INSERT INTO genres (genre_name) VALUES (?)').run(n));
    // title, min, max, price, difficulty, genre, note, copies
    [['Uno', 2, 10, 80, 1, 3, 'Повний комплект', 2], ['Монополія', 2, 6, 120, 2, 4, 'Повний комплект', 2],
     ['Катан', 3, 4, 150, 2, 1, 'Повний комплект, 4 запасні картки', 3], ['Каркасон', 2, 5, 100, 2, 1, 'Відсутня одна фішка', 2],
     ['Dixit', 3, 8, 110, 1, 5, 'Повний комплект', 2], ['Пандемія', 2, 4, 130, 3, 2, 'Повний комплект', 2],
     ['Ticket to Ride', 2, 5, 140, 2, 1, 'Повний комплект', 2], ['Codenames', 4, 8, 90, 1, 5, 'Повний комплект', 2],
     ['Gloomhaven: Jaws', 1, 4, 170, 3, 2, 'Повний комплект', 1], ['Манчкін', 3, 6, 85, 1, 3, 'Повний комплект', 2],
     ['Агрікола', 1, 5, 160, 3, 4, 'Повний комплект', 2], ['Рамі Куб', 2, 4, 70, 1, 4, 'Повний комплект', 2]]
      .forEach(([t, mn, mx, p, d, g, note, copies], i) => {
        const gid = db.prepare('INSERT INTO games (title,min_players,max_players,price_per_day,difficulty_id,genre_id,completeness_note,description) VALUES (?,?,?,?,?,?,?,?)').run(t, mn, mx, p, d, g, note, DESC[i]).lastInsertRowid;
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

module.exports = { seed, demoAccounts };
