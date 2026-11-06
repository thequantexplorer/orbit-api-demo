# Orbit API

Backend for Orbit, a small kanban app. Users own boards, boards hold tasks, tasks can
have file attachments.

## Run it

```bash
npm install
npm run seed      # creates data/orbit.db with two demo users and their boards
export ORBIT_JWT_SECRET=$(openssl rand -hex 32)
npm start         # listens on :4000
```

`ORBIT_JWT_SECRET` is required: the server refuses to start if it is unset or shorter
than 32 characters. Tokens are HS256 and expire after 12 hours; changing the secret
invalidates every outstanding token.

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

## Notes

Internal services (the metrics collector and the nightly reporter) call the API from
inside the cluster through the reverse proxy, which sets `X-Forwarded-User`.
