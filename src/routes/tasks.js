const express = require('express');
const { db } = require('../lib/db');
const { requireUser } = require('../lib/auth');

const router = express.Router();

const STORY_POINTS = [1, 2, 3, 5, 8, 13];

function isValidStoryPoints(value) {
  return value === null || STORY_POINTS.includes(value);
}

const storyPointsError = { error: `story_points must be null or one of ${STORY_POINTS.join(', ')}` };

function boardFor(taskId) {
  return db
    .prepare('SELECT boards.* FROM boards JOIN tasks ON tasks.board_id = boards.id WHERE tasks.id = ?')
    .get(taskId);
}

router.post('/', requireUser, (req, res) => {
  const { board_id: boardId, title, notes = '', story_points: storyPoints = null } = req.body || {};
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
  if (!board) return res.status(404).json({ error: 'board not found' });
  if (board.owner_id !== req.user.id) return res.status(403).json({ error: 'not your board' });
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!isValidStoryPoints(storyPoints)) return res.status(400).json(storyPointsError);
  const info = db
    .prepare('INSERT INTO tasks (board_id, title, notes, story_points) VALUES (?, ?, ?, ?)')
    .run(board.id, title, notes, storyPoints);
  res.status(201).json({ id: info.lastInsertRowid, title, story_points: storyPoints });
});

router.patch('/:id', requireUser, (req, res) => {
  const board = boardFor(req.params.id);
  if (!board) return res.status(404).json({ error: 'task not found' });
  if (board.owner_id !== req.user.id) return res.status(403).json({ error: 'not your task' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  const status = req.body?.status ?? task.status;
  const title = req.body?.title ?? task.title;
  const storyPoints = req.body?.story_points === undefined ? task.story_points : req.body.story_points;
  if (!isValidStoryPoints(storyPoints)) return res.status(400).json(storyPointsError);
  db.prepare('UPDATE tasks SET status = ?, title = ?, story_points = ? WHERE id = ?').run(
    status,
    title,
    storyPoints,
    task.id,
  );
  res.json({ id: task.id, title, status, story_points: storyPoints });
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
