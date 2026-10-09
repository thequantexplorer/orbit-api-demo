const test = require('node:test');
const assert = require('node:assert');
process.env.ORBIT_PROXY_SECRET = 'test-proxy-secret';
const app = require('../src/server');
const { signForwardedUser } = require('../src/lib/auth');

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

test('an unsigned X-Forwarded-User header is not trusted', async () => {
  const r = await fetch(base() + '/api/admin/users', { headers: { 'x-forwarded-user': 'ops@orbit.test' } });
  assert.strictEqual(r.status, 401);
});

test('a forged X-Forwarded-User signature is not trusted', async () => {
  const r = await fetch(base() + '/api/admin/users', {
    headers: { 'x-forwarded-user': 'ops@orbit.test', 'x-forwarded-user-signature': signForwardedUser('ada@orbit.test') },
  });
  assert.strictEqual(r.status, 401);
});

test('a proxy-signed X-Forwarded-User header is accepted', async () => {
  const r = await fetch(base() + '/api/admin/users', {
    headers: { 'x-forwarded-user': 'ops@orbit.test', 'x-forwarded-user-signature': signForwardedUser('ops@orbit.test') },
  });
  assert.strictEqual(r.status, 200);
});
