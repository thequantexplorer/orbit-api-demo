# Orbit API

Backend for Orbit, a small kanban app. Users own boards, boards hold tasks, tasks can
have file attachments.

## Run it

```bash
npm install
npm run seed      # creates data/orbit.db with two demo users and their boards
npm start         # listens on :4000
```

Sign in to get a token:

```bash
curl -s localhost:4000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"ada@orbit.test","password":"ada-demo-pw"}'
```

Then call the API with `Authorization: Bearer <token>`.

## Layout

- `src/server.js` — app wiring and middleware order
- `src/lib/auth.js` — token issuing and the `requireUser` middleware
- `src/lib/db.js` — SQLite handle and schema
- `src/lib/files.js` — attachment storage helpers
- `src/routes/` — boards, tasks, attachments, admin

## Story points

Tasks carry an optional `story_points` estimate on the Fibonacci scale: `1`, `2`, `3`, `5`,
`8` or `13`. Send it on `POST /api/tasks` or `PATCH /api/tasks/:id`; `null` (the default)
means not estimated and clears an existing estimate. Any other value returns `400`.
`GET /api/tasks/:id` and `GET /api/boards/:id` include it on each task. Existing databases
get the column added on startup.

## Notes

Internal services (the metrics collector and the nightly reporter) call the API from
inside the cluster through the reverse proxy, which sets `X-Forwarded-User`.
