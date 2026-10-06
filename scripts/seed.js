const { db } = require('../src/lib/db');
const { hash } = require('../src/lib/auth');

db.exec('DELETE FROM attachments; DELETE FROM tasks; DELETE FROM boards; DELETE FROM users;');

const insertUser = db.prepare('INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)');
insertUser.run(1, 'ada@orbit.test', 'Ada', hash('ada-demo-pw'), 'member');
insertUser.run(2, 'grace@orbit.test', 'Grace', hash('grace-demo-pw'), 'member');
insertUser.run(3, 'ops@orbit.test', 'Orbit Ops', hash('ops-demo-pw'), 'admin');

const insertBoard = db.prepare('INSERT INTO boards (id, owner_id, name, visibility) VALUES (?, ?, ?, ?)');
insertBoard.run(1, 1, 'Ada: Q3 roadmap', 'private');
insertBoard.run(2, 2, 'Grace: compiler rewrite', 'private');
insertBoard.run(3, 2, 'Grace: public changelog', 'public');

const insertTask = db.prepare('INSERT INTO tasks (id, board_id, title, notes, status) VALUES (?, ?, ?, ?, ?)');
insertTask.run(1, 1, 'Pick launch date', 'Waiting on marketing', 'todo');
insertTask.run(2, 2, 'Port the optimizer', 'Internal: contract renewal numbers in the notes', 'doing');
insertTask.run(3, 3, 'Write release notes', '', 'done');

console.log('seeded', require('../src/lib/db').DB_PATH);
