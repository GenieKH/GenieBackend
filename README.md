# Genie Backend

Backend for the Genie property marketplace (NestJS monorepo, PostgreSQL via Supabase, Prisma, Redis).

## Services

| Service | Port | Responsibility |
|---|---|---|
| `api-gateway` | 4000 | Only public entry point. Rate limiting, CORS, security headers, JWT check, reverse proxy. |
| `authentication` | 4001 | Register, login, Google (Firebase) login, token refresh, password reset. |
| `user` | 4002 | Properties, profile, chat (REST + WebSocket), payments. |

Only the gateway is exposed. The other two trust the `x-user-id` header the gateway sets after
verifying the JWT, so they must never be reachable from the internet.

```
Flutter app ──► api-gateway ──► authentication   (/auth/*)
                            └─► user             (/public/*, /properties/*, /users/*, /chat/*, /payments/*)
```

### Code layout (per service: feature first, then layer)

```
authentication/src/auth/
  credentials/     register + login with password
  social/          Google login via Firebase
  sessions/        token issuing, refresh rotation, logout, session list
  password-reset/  forgot / verify / reset
  mail/            delivering the reset code
  users/           the only place that touches the `users` table
user/src/
  properties/      services/ (query, lifecycle, images, engagement, guest sessions)
  payments/        checkout, webhook, provider adapter
  chat/            REST, WebSocket gateway, E2EE message storage
  users/           profile
```

Rule of thumb: controllers only validate and delegate, services hold business rules,
repositories (or Prisma/Supabase calls) hold persistence.

## Run locally

```bash
cp .env.example .env            # then fill in the values
npm ci
node scripts/generate-jwt-keys.js   # paste the output into .env
npx prisma generate
npm run start:auth & npm run start:user & npm run start:gateway
```

### With Docker (one container, everything included)

```bash
docker compose up -d --build      # build + start (needs a filled-in .env)
docker compose logs -f            # follow logs
docker compose down               # stop
```

One container runs Redis, authentication (:4001), user (:4002) and the api-gateway (:4000).
Only port 4000 is published. If any process dies the container exits and Docker restarts it
(`restart: unless-stopped`), so everything comes back whenever Docker Desktop opens.
To use an external Redis instead, set `REDIS_URL` in `.env` to a non-local address.

Check it: `curl http://localhost:4000/health` should return `{"status":"ok"}`.

## Tests

```bash
npm test          # runs the tests of every service
```

## Database migrations

`prisma/schema.prisma` is the source of truth; every change needs a migration in `prisma/migrations`.

```bash
npx prisma migrate dev --name <what_changed>   # create + apply locally
npx prisma migrate deploy                      # apply on staging / production
```

`2_complete_schema` is idempotent: it creates whatever is missing and skips what already exists.
If a database was built by hand and `_prisma_migrations` does not list `0_init`, mark it first:
`npx prisma migrate resolve --applied 0_init`.

## API overview

All routes go through the gateway. JWT = `Authorization: Bearer <accessToken>`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | – | `{email|phone, password}` |
| POST | `/auth/login` | – | `{email|phone, password}` → `{accessToken, refreshToken}` |
| POST | `/auth/firebase-login` | – | `{idToken}` → tokens |
| POST | `/auth/refresh` | – | `{refreshToken}` → new pair (old one is revoked) |
| POST | `/auth/logout` | – | `{refreshToken}` |
| GET / POST | `/auth/sessions`, `/auth/logout-all` | JWT | list / revoke sessions |
| POST | `/auth/forgot-password`, `/auth/verify-otp`, `/auth/reset-password` | – | password reset |
| GET | `/public/properties/map` | optional | `minLat,maxLat,minLng,maxLng` |
| GET | `/public/properties/:id` | – | published property |
| POST | `/public/properties/guest-session` | – | `{deviceId}` |
| `*` | `/properties/...` | JWT | own listings, images, like, favorite, contact |
| GET / PATCH | `/users/me` | JWT | profile |
| `*` | `/chat/...` | JWT | keys, backup, conversations, messages |
| POST | `/payments/checkout` | JWT | `{propertyId}` → `{checkoutUrl, transactionId}` |
| POST | `/payments/webhook` | signature | called by the payment provider |
| GET | `/health` | – | liveness |

Errors use Nest's standard shape: `{ statusCode, message, error }`.
Unknown body fields are dropped and invalid ones return `400`.

## Chat (end-to-end encrypted)

Messages are encrypted on the device; the server stores and forwards ciphertext only.

REST (JWT):

| Method | Path | Purpose |
|---|---|---|
| POST | `/chat/keys` | `{identityPublicKey}`: publish own public key |
| GET | `/chat/keys/:userId` | a user's public key, `404` if they have none |
| POST | `/chat/backup` | `{backupBlob, backupSalt, backupNonce, backupVerifier}`: store the PIN-encrypted key backup |
| GET | `/chat/backup` | `{backupSalt}`, `404` if there is none (5 per 15 min) |
| POST | `/chat/backup/unlock` | `{backupVerifier}` → `{backupBlob, backupNonce}` for the right PIN |
| GET | `/chat/conversations` | one row per partner: last message + `unreadCount` |
| GET | `/chat/messages/:participantId?limit=&before=` | newest page (default 50, max 100), oldest first; `before` = ISO time for older pages |
| POST | `/chat/messages/:participantId/read` | mark that partner's messages as read |

Socket.IO, namespace `/chat`, connected through the gateway with `auth: { token: <accessToken> }`:

- An invalid or expired token fails the handshake with `connect_error` `unauthorized`.
  The token is checked again on every message; once it expires the server disconnects the
  socket and the client reconnects with a renewed token.
- Client emits `sendMessage` `{ id?, recipientId, ciphertext, nonce }` and gets an ack:
  `{ status: 'ok', messageId, message }` or `{ status: 'error', message }`.
  `id` is a UUID chosen by the client; sending the same `id` again returns the stored
  message instead of creating a duplicate, so a retry is safe.
- Server emits `newMessage` (the stored message) to every device of the recipient and to
  the sender's other devices, never back to the socket that sent it.
- `sendMessage` is limited to 30 messages per 10 seconds per user.
- Client emits `watchPresence` `{ userId }` and gets
  `{ status: 'ok', presence: { userId, online, lastSeenAt } }`. From then on the server emits
  `presence` with the same shape whenever that user's first device connects or last device
  disconnects (`users.last_seen_at` is written at that moment). `unwatchPresence` `{ userId }`
  stops it. Watching ends with the connection, so clients ask again after reconnecting.

The key backup is protected by a 6-digit PIN, so the server counts every try. The device turns
the PIN and the salt into two values (Argon2id): a key that encrypts the backup and never leaves
the device, and `backupVerifier` (32 bytes, base64), which proves the PIN to the server.

- `POST /chat/backup/unlock` answers `403` `{ message, attemptsLeft }` for a wrong PIN and `429`
  `{ message, retryAfterSeconds }` while locked. Every 5th wrong PIN in a row locks the backup:
  15 minutes, then 30, then double each time up to 24 hours. A correct PIN clears the count.
  The count is stored in `chat_key_backups`, so restarts and deploys do not reset it.
- Stored backups are sealed with `CHAT_BACKUP_SECRET` (the proof as a keyed hash, the encrypted
  key encrypted once more), so a copy of the database alone cannot be used to try PINs. Without
  that variable saving and unlocking answer `503`. Losing or changing it makes stored backups
  unreadable; users then need "Reset keys".
- A backup saved before this (in `users.backup_*`) is still returned whole by `GET /chat/backup`
  as `{backupSalt, backupBlob, backupNonce}`. The app opens it with the PIN and saves it again in
  the protected form, which removes the old copy.

Pictures are encrypted on the sender's device with a one-time key that travels inside the
encrypted message. The server only stores unreadable bytes in the private `chat-attachments`
bucket (25 MB per file):

- `POST /chat/attachments` `{ recipientId }` → `{ path, uploadUrl }`: a signed URL to PUT one
  encrypted file to (20 requests per user per minute). `path` is `sender/recipient/fileId`.
- `GET /chat/attachments/:senderId/:recipientId/:fileId` → `{ url }`: a download link valid for
  one minute, given only to the sender or the recipient (`403` for anyone else).

`GET /users/:id` (JWT) returns another user's public profile: `{ id, username, avatarUrl,
createdAt }`, never contact details.

What the server cannot do: read messages, show one person's message as the other's (sender
and recipient are sealed inside each message), or swap a user's public key unnoticed (the app
remembers the key first seen for each contact, warns when it changes, and shows a security
code both people can compare).

Delivery and presence are tracked per process (Socket.IO rooms). Running more than one `user`
instance requires the Socket.IO Redis adapter first.

## Payments (mock)

The provider adapter (`user/src/payments/aba-payway.provider.ts`) is a mock; no real gateway is
integrated yet. The flow around it is production-shaped:

- only the owner can start checkout, and only from a publishable status;
- the webhook must carry `x-signature` = hex `HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, "<transactionId>|<status>")`;
  without `PAYMENT_WEBHOOK_SECRET` every webhook is rejected;
- a transaction is settled once; repeated or racing webhooks are ignored;
- on failure the property goes back to `Draft`.

## Security notes

- Secrets live only in environment variables (see `.env.example`). Never commit `.env`.
- Refresh tokens rotate on every use; reuse of a revoked token revokes all of the user's sessions.
- Self-registration always creates role `user`.
- Password-reset codes are generated with a CSPRNG and stored hashed.
