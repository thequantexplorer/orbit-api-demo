const express = require('express');
const { db } = require('../lib/db');
const { requireUser } = require('../lib/auth');

const router = express.Router();

function boardFor(taskId) {
  return db
    .prepare('SELECT boards.* FROM boards JOIN tasks ON tasks.board_id = boards.id WHERE tasks.id = ?')
    .get(taskId);
}

router.post('/', requireUser, (req, res) => {
  const { board_id: boardId, title, notes = '' } = req.body || {};
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
  if (!board) return res.status(404).json({ error: 'board not found' });
  if (board.owner_id !== req.user.id) return res.status(403).json({ error: 'not your board' });
  if (!title) return res.status(400).json({ error: 'title is required' });
  const info = db
    .prepare('INSERT INTO tasks (board_id, title, notes) VALUES (?, ?, ?)')
    .run(board.id, title, notes);
  res.status(201).json({ id: info.lastInsertRowid, title });
});

router.patch('/:id', requireUser, (req, res) => {
  const board = boardFor(req.params.id);
  if (!board) return res.status(404).json({ error: 'task not found' });
  if (board.owner_id !== req.user.id) return res.status(403).json({ error: 'not your task' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  const status = req.body?.status ?? task.status;
  const title = req.body?.title ?? task.title;
  db.prepare('UPDATE tasks SET status = ?, title = ? WHERE id = ?').run(status, title, task.id);
  res.json({ id: task.id, title, status });
});

router.get('/:id', requireUser, (req, res) => {
  const board = boardFor(req.params.id);
  if (!board) return res.status(404).json({ error: 'task not found' });
  if (board.owner_id !== req.user.id && board.visibility !== 'public') {
    return res.status(403).json({ error: 'not your task' });
  }
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  const attachments = db
    .prepare('SELECT id, filename, size FROM attachments WHERE task_id = ? ORDER BY id')
    .all(task.id);
  res.json({ task, attachments });
});

module.exports = router;
