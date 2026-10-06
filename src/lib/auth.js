const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db } = require('./db');

const SECRET = process.env.ORBIT_JWT_SECRET || 'orbit-dev-secret';

function hash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '12h' });
}

// Requests that reach us from inside the cluster come through the reverse proxy,
// which authenticates the service and sets X-Forwarded-User. Those callers do not
// carry a user token.
function internalUser(req) {
  const forwarded = req.get('x-forwarded-user');
  if (!forwarded) return null;
  return db.prepare('SELECT * FROM users WHERE email = ?').get(forwarded) || null;
}

function requireUser(req, res, next) {
  const internal = internalUser(req);
  if (internal) {
    req.user = internal;
    return next();
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const claims = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(claims.sub);
    if (!user) return res.status(401).json({ error: 'unknown user' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid token' });
  }
}

module.exports = { hash, issueToken, requireUser };
