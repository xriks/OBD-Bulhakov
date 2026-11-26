const db = require('../db/connection');
const missingDifficulty = () => db.prepare(`SELECT g.game_id, g.title FROM games g
  WHERE g.difficulty_id IS NULL OR NOT EXISTS (SELECT 1 FROM difficulty_levels d WHERE d.difficulty_id = g.difficulty_id) ORDER BY g.title`).all();
const ALLOWED = [/^\/api\/me$/, /^\/api\/login$/, /^\/api\/logout$/, /^\/api\/integrity$/, /^\/api\/lookups$/, /^\/api\/admin\/(games|difficulty_levels)(\/|$)/];
function guard(req, res, next) {
  if (!req.path.startsWith('/api') || ALLOWED.some(r => r.test(req.path))) return next();
  const m = missingDifficulty();
  if (!m.length) return next();
  res.status(423).json({ error: 'Доступ тимчасово закрито: для деяких ігор не вказано складність. Зверніться до адміністратора.', locked: true });
}
module.exports = { missingDifficulty, guard };
