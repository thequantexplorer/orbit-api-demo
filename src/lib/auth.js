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

const PROXY_SECRET = process.env.ORBIT_PROXY_SECRET || '';

function signForwardedUser(email) {
  return crypto.createHmac('sha256', PROXY_SECRET).update(email).digest('hex');
}

// Requests that reach us from inside the cluster come through the reverse proxy,
// which authenticates the service and sets X-Forwarded-User plus
// X-Forwarded-User-Signature = hex(HMAC-SHA256(ORBIT_PROXY_SECRET, email)).
// The header is ignored unless ORBIT_PROXY_SECRET is set and the signature matches.
function internalUser(req) {
  if (!PROXY_SECRET) return null;
  const forwarded = req.get('x-forwarded-user');
  const signature = req.get('x-forwarded-user-signature');
  if (!forwarded || !signature) return null;
  const expected = Buffer.from(signForwardedUser(forwarded), 'utf8');
  const given = Buffer.from(signature, 'utf8');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
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

module.exports = { hash, issueToken, requireUser, signForwardedUser };
