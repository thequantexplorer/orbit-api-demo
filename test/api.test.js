const test = require('node:test');
const assert = require('node:assert');
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

async function api(token, method, path, body) {
  const r = await fetch(base() + path, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

test('tasks store, update and clear story points', async () => {
  const token = await login('ada@orbit.test', 'ada-demo-pw');
  const created = await api(token, 'POST', '/api/tasks', { board_id: 1, title: 'Estimate me', story_points: 5 });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.body.story_points, 5);

  const renamed = await api(token, 'PATCH', `/api/tasks/${created.body.id}`, { title: 'Estimated' });
  assert.strictEqual(renamed.body.story_points, 5);

  const updated = await api(token, 'PATCH', `/api/tasks/${created.body.id}`, { story_points: 13 });
  assert.strictEqual(updated.body.story_points, 13);
  const fetched = await api(token, 'GET', `/api/tasks/${created.body.id}`);
  assert.strictEqual(fetched.body.task.story_points, 13);

  const cleared = await api(token, 'PATCH', `/api/tasks/${created.body.id}`, { story_points: null });
  assert.strictEqual(cleared.body.story_points, null);
});

test('tasks default to no estimate and boards list story points', async () => {
  const token = await login('ada@orbit.test', 'ada-demo-pw');
  const created = await api(token, 'POST', '/api/tasks', { board_id: 1, title: 'No estimate yet' });
  assert.strictEqual(created.body.story_points, null);
  const board = await api(token, 'GET', '/api/boards/1');
  const points = Object.fromEntries(board.body.tasks.map((task) => [task.id, task.story_points]));
  assert.strictEqual(points[1], 2);
  assert.strictEqual(points[created.body.id], null);
});

test('story points must be on the 1, 2, 3, 5, 8, 13 scale', async () => {
  const token = await login('ada@orbit.test', 'ada-demo-pw');
  for (const story_points of [0, 4, 21, 2.5, '3', -1]) {
    const r = await api(token, 'POST', '/api/tasks', { board_id: 1, title: 'Bad', story_points });
    assert.strictEqual(r.status, 400, `expected 400 for ${JSON.stringify(story_points)}`);
  }
  const patched = await api(token, 'PATCH', '/api/tasks/1', { story_points: 7 });
  assert.strictEqual(patched.status, 400);
  const task = await api(token, 'GET', '/api/tasks/1');
  assert.strictEqual(task.body.task.story_points, 2);
});
