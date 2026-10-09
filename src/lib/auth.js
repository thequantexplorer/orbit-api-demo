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

const PROXY_MAX_SKEW_SECONDS = 300;

function signForwardedUser(email, timestamp, secret = process.env.ORBIT_PROXY_SECRET) {
  return crypto.createHmac('sha256', secret).update(`${email}\n${timestamp}`).digest('hex');
}

// Requests that reach us from inside the cluster come through the reverse proxy,
// which authenticates the service and sets X-Forwarded-User, X-Forwarded-User-Timestamp
// (unix seconds) and X-Forwarded-User-Signature = hex(HMAC-SHA256(ORBIT_PROXY_SECRET,
// "<email>\n<timestamp>")). The headers are ignored unless ORBIT_PROXY_SECRET is set,
// the timestamp is fresh and the signature matches.
function internalUser(req) {
  const secret = process.env.ORBIT_PROXY_SECRET;
  if (!secret) return null;
  const forwarded = req.get('x-forwarded-user');
  const timestamp = req.get('x-forwarded-user-timestamp');
  const signature = req.get('x-forwarded-user-signature');
  if (!forwarded || !timestamp || !signature) return null;
  if (!/^\d{1,12}$/.test(timestamp)) return null;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > PROXY_MAX_SKEW_SECONDS) return null;
  const expected = Buffer.from(signForwardedUser(forwarded, timestamp, secret), 'utf8');
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
