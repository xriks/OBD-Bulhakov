const router = require('express').Router();
const db = require('../db/connection');
const { wrap } = require('../lib/http');

router.get('/api/lookups', wrap(() => ({
  genres: db.prepare('SELECT * FROM genres ORDER BY genre_name').all(),
  difficulty_levels: db.prepare('SELECT * FROM difficulty_levels ORDER BY difficulty_id').all(),
  services: db.prepare('SELECT * FROM services ORDER BY service_id').all(),
  games: db.prepare('SELECT game_id, title FROM games ORDER BY title').all(),
})));

router.get('/api/games', wrap(req => {
  const { q, genre, difficulty, players, available } = req.query;
  const w = [], p = [];
  if (q) { w.push('g.title LIKE ?'); p.push(`%${q}%`); }
  if (genre) { w.push('g.genre_id = ?'); p.push(+genre); }
  if (difficulty) { w.push('g.difficulty_id = ?'); p.push(+difficulty); }
  if (players) { w.push('g.min_players <= ? AND g.max_players >= ?'); p.push(+players, +players); }
  if (available === '1') w.push('g.game_id IN (SELECT game_id FROM available_games)');
  return db.prepare(`SELECT g.*, d.level_name, gn.genre_name,
      COALESCE((SELECT available_copies FROM available_games a WHERE a.game_id = g.game_id), 0) AS available_copies
    FROM games g LEFT JOIN difficulty_levels d ON d.difficulty_id = g.difficulty_id JOIN genres gn ON gn.genre_id = g.genre_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY g.title`).all(...p);
}));

module.exports = router;
