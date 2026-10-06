const express = require('express');
const { db } = require('../lib/db');
const { requireUser } = require('../lib/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  next();
}

router.use(requireUser, requireAdmin);

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role FROM users ORDER BY id').all();
  res.json({ users });
});

router.get('/export', (req, res) => {
  const boards = db.prepare('SELECT * FROM boards').all();
  const tasks = db.prepare('SELECT * FROM tasks').all();
  res.json({ boards, tasks });
});

router.post('/users/:id/role', (req, res) => {
  const role = req.body?.role;
  if (!['member', 'admin'].includes(role)) return res.status(400).json({ error: 'bad role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ id: Number(req.params.id), role });
});

module.exports = router;
