const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const jwt = require('jsonwebtoken');

process.env.ORBIT_JWT_SECRET = crypto.randomBytes(32).toString('hex');
const app = require('../src/server');

let server;
const base = () => `http://127.0.0.1:${server.address().port}`;

test.before(async () => {
  require('../scripts/seed');
  server = app.listen(0);
});
test.after(() => server.close());

async function login(email, password) {
  const r = await fetch(base() + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).token;
}

test('login returns a token', async () => {
  assert.ok(await login('ada@orbit.test', 'ada-demo-pw'));
});

test('a user sees only their own boards', async () => {
  const token = await login('ada@orbit.test', 'ada-demo-pw');
  const r = await fetch(base() + '/api/boards', { headers: { authorization: `Bearer ${token}` } });
  const { boards } = await r.json();
  assert.deepStrictEqual(boards.map(b => b.name), ['Ada: Q3 roadmap']);
});

test('a board cannot be renamed by another user', async () => {
  const token = await login('ada@orbit.test', 'ada-demo-pw');
  const r = await fetch(base() + '/api/boards/2', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'hijacked' }),
  });
  assert.strictEqual(r.status, 403);
});

test('members cannot list users', async () => {
  const token = await login('ada@orbit.test', 'ada-demo-pw');
  const r = await fetch(base() + '/api/admin/users', { headers: { authorization: `Bearer ${token}` } });
  assert.strictEqual(r.status, 403);
});

test('a token signed with the old default secret is rejected', async () => {
  const forged = jwt.sign({ sub: 3, role: 'admin' }, 'orbit-dev-secret');
  const r = await fetch(base() + '/api/admin/users', { headers: { authorization: `Bearer ${forged}` } });
  assert.strictEqual(r.status, 401);
});

test('an alg=none token is rejected', async () => {
  const unsigned = jwt.sign({ sub: 3, role: 'admin' }, null, { algorithm: 'none' });
  const r = await fetch(base() + '/api/admin/users', { headers: { authorization: `Bearer ${unsigned}` } });
  assert.strictEqual(r.status, 401);
});

for (const [label, secret] of [['missing', undefined], ['the old default', 'orbit-dev-secret'], ['too short', 'short-secret']]) {
  test(`the server refuses to start when ORBIT_JWT_SECRET is ${label}`, () => {
    const env = { ...process.env, PORT: '0' };
    if (secret === undefined) delete env.ORBIT_JWT_SECRET;
    else env.ORBIT_JWT_SECRET = secret;
    const r = spawnSync(process.execPath, [path.join(__dirname, '../src/server.js')], { env, timeout: 10000 });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr.toString(), /refusing to start: ORBIT_JWT_SECRET/);
  });
}
