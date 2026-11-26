const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const file = process.env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'hooked.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
class Db {
  constructor() { this.depth = 0; this.raw = new DatabaseSync(file); this.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;'); this.exec(schema); }
  exec(sql) { this.raw.exec(sql); }
  close() { this.raw.close(); }
  prepare(sql) {
    const st = this.raw.prepare(sql), a = p => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
    return { get: (...p) => st.get(...a(p)), all: (...p) => st.all(...a(p)), run: (...p) => st.run(...a(p)) };
  }
  pragma(q, o) {
    const r = this.raw.prepare('PRAGMA ' + q).all();
    return o && o.simple ? Object.values(r[0] || {})[0] : r;
  }
  transaction(fn) {
    return (...args) => {
      const sp = 'sp' + this.depth++;
      this.exec(this.depth === 1 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      try { const r = fn(...args); this.exec(this.depth === 1 ? 'COMMIT' : `RELEASE ${sp}`); return r; }
      catch (e) { this.exec(this.depth === 1 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`); throw e; }
      finally { this.depth--; }
    };
  }
}
const open = () => new Db();
let db = open();
if (!db.prepare("SELECT 1 FROM pragma_table_info('rentals') WHERE name='delivery_address'").get()) db.exec("ALTER TABLE rentals ADD COLUMN delivery_address TEXT NOT NULL DEFAULT ''");
if (!db.prepare("SELECT 1 FROM pragma_table_info('games') WHERE name='description'").get()) {
  db.close();
  for (const x of ['', '-wal', '-shm']) if (fs.existsSync(file + x)) fs.renameSync(file + x, file + '.old' + x);
  db = open();
}

const cols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
if (!cols.includes('onboarded')) db.exec('ALTER TABLE customers ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 1');

module.exports = db;
