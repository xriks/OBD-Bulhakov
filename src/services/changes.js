const db = require('../db/connection');
const { httpErr } = require('../lib/http');
const { T } = require('./adminTables');

const TRACK = ['games', 'game_copies', 'genres', 'difficulty_levels', 'services'];
const LABEL = { games: 'title', game_copies: 'inventory_number', genres: 'genre_name', difficulty_levels: 'level_name', services: 'service_name' };
const rowOf = (n, id) => db.prepare(`SELECT * FROM ${n} WHERE ${T[n].pk} = ?`).get(id);
const copiesOf = id => db.prepare('SELECT * FROM game_copies WHERE game_id = ?').all(id);

function log(admin, n, id, op, before, after) {
  if (!TRACK.includes(n)) return;
  const r = after || before;
  const b = before && n === 'games' && op === 'delete' ? { ...before, _copies: copiesOf(id) } : before;
  db.prepare('INSERT INTO change_log (admin_id,tbl,row_id,label,op,before,after) VALUES (?,?,?,?,?,?,?)')
    .run(admin, n, id, String(r[LABEL[n]] || ''), op, b ? JSON.stringify(b) : null, after ? JSON.stringify(after) : null);
}

const list = () => db.prepare(`SELECT l.*, c.first_name || ' ' || c.last_name AS admin_name FROM change_log l LEFT JOIN customers c ON c.customer_id = l.admin_id ORDER BY change_id DESC LIMIT 100`)
  .all().map(({ before, after, ...x }) => x);

const ins = (n, o) => { const k = Object.keys(o); db.prepare(`INSERT INTO ${n} (${k}) VALUES (${k.map(() => '?')})`).run(k.map(x => o[x])); };

function undo(id) {
  db.transaction(() => {
    const c = db.prepare('SELECT * FROM change_log WHERE change_id = ?').get(id);
    if (!c) throw httpErr(404, 'Запис історії не знайдено');
    if (c.undone) throw httpErr(409, 'Цю зміну вже скасовано');
    const t = T[c.tbl], b = c.before ? JSON.parse(c.before) : null;
    if (c.op === 'insert') {
      if (!db.prepare(`DELETE FROM ${c.tbl} WHERE ${t.pk} = ?`).run(c.row_id).changes) throw httpErr(409, 'Запис уже не існує');
    } else if (c.op === 'update') {
      const cur = rowOf(c.tbl, c.row_id);
      if (!cur) throw httpErr(409, 'Запис уже не існує');
      const f = t.cols.filter(k => k in b);
      db.prepare(`UPDATE ${c.tbl} SET ${f.map(k => k + ' = ?')} WHERE ${t.pk} = ?`).run([...f.map(k => b[k]), c.row_id]);
    } else {
      const { _copies, ...row } = b;
      if (rowOf(c.tbl, c.row_id)) throw httpErr(409, 'Запис із таким ідентифікатором уже існує');
      ins(c.tbl, row);
      (_copies || []).forEach(x => ins('game_copies', x));
    }
    db.prepare('UPDATE change_log SET undone = 1 WHERE change_id = ?').run(id);
  })();
}
module.exports = { TRACK, rowOf, log, list, undo };
