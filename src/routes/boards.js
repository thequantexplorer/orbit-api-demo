const express = require('express');
const { db } = require('../lib/db');
const { requireUser } = require('../lib/auth');

const router = express.Router();

router.get('/', requireUser, (req, res) => {
  const boards = db
    .prepare('SELECT id, name, visibility FROM boards WHERE owner_id = ? ORDER BY id')
    .all(req.user.id);
  res.json({ boards });
});

router.post('/', requireUser, (req, res) => {
  const { name, visibility = 'private' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db
    .prepare('INSERT INTO boards (owner_id, name, visibility) VALUES (?, ?, ?)')
    .run(req.user.id, name, visibility);
  res.status(201).json({ id: info.lastInsertRowid, name, visibility });
});

router.get('/:id', requireUser, (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'board not found' });
  const tasks = db
    .prepare('SELECT id, title, notes, status FROM tasks WHERE board_id = ? ORDER BY id')
    .all(board.id);
  res.json({ board, tasks });
});

router.patch('/:id', requireUser, (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'board not found' });
  if (board.owner_id !== req.user.id) return res.status(403).json({ error: 'not your board' });
  const name = req.body?.name ?? board.name;
  db.prepare('UPDATE boards SET name = ? WHERE id = ?').run(name, board.id);
  res.json({ id: board.id, name });
});

module.exports = router;
