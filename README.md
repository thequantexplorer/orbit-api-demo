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

## Notes

Internal services (the metrics collector and the nightly reporter) call the API from
inside the cluster through the reverse proxy, which sets `X-Forwarded-User` and
`X-Forwarded-User-Signature` (hex HMAC-SHA256 of the email keyed with `ORBIT_PROXY_SECRET`).
The API only honours `X-Forwarded-User` when `ORBIT_PROXY_SECRET` is set and the signature
matches; otherwise the header is ignored and a bearer token is required. The proxy must strip
any client-supplied `X-Forwarded-User*` headers.
