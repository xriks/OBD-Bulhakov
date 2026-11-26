const fs = require('fs');
const path = require('path');
const db = require('./connection');
const q = s => db.prepare(s).all();
const dump = process.argv.includes('--dump');

if (dump) {
  const lit = v => (v === null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`);
  let out = '-- Знімок БД Hooked\nPRAGMA foreign_keys = OFF;\nBEGIN;\n';
  q("SELECT name, sql FROM sqlite_master WHERE sql NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'table' DESC, name").forEach(o => { out += o.sql + ';\n'; });
  q("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'sessions'").forEach(({ name }) =>
    q(`SELECT * FROM ${name}`).forEach(r => { out += `INSERT INTO ${name} (${Object.keys(r)}) VALUES (${Object.values(r).map(lit)});\n`; }));
  out += 'COMMIT;\n';
  const f = path.join(__dirname, '..', '..', 'data', 'hooked.sql');
  fs.writeFileSync(f, out);
  console.log('Збережено:', f);
} else {
  const t = n => q(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).map(x => ({ таблиця: x.name, записів: db.prepare(`SELECT COUNT(*) n FROM ${x.name}`).get().n }));
  console.log('\nТаблиці'); console.table(t());
  console.log('Користувачі'); console.table(q("SELECT customer_id id, first_name || ' ' || last_name AS імя, email, phone, role, password_hash != '' AS пароль FROM customers"));
  console.log('Активні сесії'); console.table(q("SELECT s.*, c.email FROM sessions s JOIN customers c USING (customer_id)").map(({ token, ...r }) => ({ ...r, token: token.slice(0, 8) + '…' })));
  console.log('Останні зміни'); console.table(q('SELECT change_id id, created_at, tbl, op, label, undone FROM change_log ORDER BY change_id DESC LIMIT 10'));
}
