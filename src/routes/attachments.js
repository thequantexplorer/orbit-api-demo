const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { UPLOAD_DIR, extensionAllowed, storedPath } = require('../lib/files');

const router = express.Router();
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

function boardForTask(taskId) {
  return db
    .prepare('SELECT boards.* FROM boards JOIN tasks ON tasks.board_id = boards.id WHERE tasks.id = ?')
    .get(taskId);
}

router.post('/', requireUser, upload.single('file'), (req, res) => {
  const board = boardForTask(req.body.task_id);
  if (!board) return res.status(404).json({ error: 'task not found' });
  if (board.owner_id !== req.user.id) return res.status(403).json({ error: 'not your task' });
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  if (!extensionAllowed(req.file.originalname)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'file type not allowed' });
  }
  const storedName = crypto.randomBytes(16).toString('hex') + path.extname(req.file.originalname);
  fs.renameSync(req.file.path, storedPath(storedName));
  const info = db
    .prepare('INSERT INTO attachments (task_id, filename, stored_name, size) VALUES (?, ?, ?, ?)')
    .run(req.body.task_id, req.file.originalname, storedName, req.file.size);
  res.status(201).json({ id: info.lastInsertRowid, filename: req.file.originalname });
});

// Streams an attachment back. The web client asks for the file by the name it was
// stored under, which it gets from GET /api/tasks/:id.
router.get('/download', requireUser, (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const row = db.prepare('SELECT * FROM attachments WHERE stored_name = ?').get(name);
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'file not found' });
  res.setHeader('content-disposition', `attachment; filename="${row ? row.filename : path.basename(name)}"`);
  fs.createReadStream(file).pipe(res);
});

router.delete('/:id', requireUser, (req, res) => {
  const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'attachment not found' });
  const board = boardForTask(row.task_id);
  if (board.owner_id !== req.user.id) return res.status(403).json({ error: 'not your attachment' });
  fs.rmSync(storedPath(row.stored_name), { force: true });
  db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id);
  res.status(204).end();
});

module.exports = router;
