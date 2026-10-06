const express = require('express');
const { db } = require('../lib/db');
const { hash, issueToken, requireUser } = require('../lib/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || user.password_hash !== hash(password || '')) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  res.json({ token: issueToken(user), user: { id: user.id, email: user.email, name: user.name } });
});

router.get('/me', requireUser, (req, res) => {
  const { id, email, name, role } = req.user;
  res.json({ id, email, name, role });
});

module.exports = router;
