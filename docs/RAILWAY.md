# Deploying Genie on Railway

One Railway service per backend service, all built from this repository with the same `Dockerfile`.
Each service restarts, scales and deploys on its own, so one crashing does not take the others with it.

Checked against Railway's docs on 2026-10-17 (config-as-code, private networking, healthchecks, monorepos).
Dashboard labels move around; if one is missing, the setting is in the service's **Settings** tab.

## 1. Services

| Railway service name | `SERVICE` | `PORT` | Public domain | Config file |
|---|---|---|---|---|
| `api-gateway` | `api-gateway` | 4000 | **yes** (the only one) | `/railway/api-gateway.json` |
| `authentication` | `authentication` | 4001 | no | `/railway/authentication.json` |
| `user` | `user` | 4002 | no | `/railway/user.json` |
| `property` | `property` | 4003 | no | `/railway/property.json` |
| `chat` | `chat` | 4004 | no | `/railway/chat.json` |
| `payment` | `payment` | 4005 | no | `/railway/payment.json` |
| `Redis` | n/a | n/a | no | Railway's Redis database service |

Name the services exactly as above: the private addresses below are built from the names.

## 2. Settings that are the same for every backend service

In **Settings** of each service:

- **Source**: this GitHub repo and branch. Leave **Root Directory** empty (the repo root): the `shared`
  library and the lockfile are at the root, so a per-service root directory would break the build.
- **Config-as-code file path**: the file from the table, e.g. `/railway/property.json`. The path is
  absolute from the repo root because config files ignore the Root Directory. The file already sets the
  Dockerfile builder, the watch paths, the `/health` check and the restart policy.
- **Watch paths** (already in the config file): a service redeploys only when its own folder, `shared`,
  `prisma`, the lockfile or the `Dockerfile` change. A fix in `chat` no longer redeploys `payment`.
- **Healthcheck**: `/health`, 60 s. Railway runs it **only while deploying**: a bad build never replaces the
  working one. It does not watch a running service, so add an uptime monitor too (section 7).
- **Restart policy**: `ALWAYS`. A crashed service is restarted until it comes back, for example after a
  short database outage at boot.
- **Public networking**: generate a domain for `api-gateway` only. Every other service must have none:
  they trust the `x-user-id` header, which only the gateway may set.
- **Scale**: 1 replica for all of them to start. See section 6 before raising it.

## 3. Variables

Use Railway's **Shared Variables** (project level) for values several services need, and **reference
variables** for addresses, so nothing is typed twice.

Shared (add to every service that lists them below):

| Name | Value |
|---|---|
| `DATABASE_URL` | the Supabase pooler URL you use today |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | as today |
| `JWT_PUBLIC_KEY` | as today (newlines as `\n`) |
| `INTERNAL_SERVICE_SECRET` | **new**, 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

Per service (everything else comes from the shared list):

| Service | Variables |
|---|---|
| all six | `SERVICE=<its name>`, `PORT=<its port>`, `HOST=::` (see the note below) |
| `api-gateway` | `JWT_PUBLIC_KEY`, `REDIS_URL`, `CORS_ORIGINS`, and the five addresses: `AUTH_SERVICE_URL=http://authentication.railway.internal:4001`, `USER_SERVICE_URL=http://user.railway.internal:4002`, `PROPERTY_SERVICE_URL=http://property.railway.internal:4003`, `CHAT_SERVICE_URL=http://chat.railway.internal:4004`, `PAYMENT_SERVICE_URL=http://payment.railway.internal:4005` |
| `authentication` | as today: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `SUPABASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, email provider keys, `REDIS_URL`, `IP_LOCATION_API_URL`, plus `USER_SERVICE_URL` |
| `user` | `DATABASE_URL`, `DATABASE_POOL_MAX=3`, `SUPABASE_*`, `JWT_PUBLIC_KEY`, `REDIS_URL`, `INTERNAL_SERVICE_SECRET`, `PROPERTY_SERVICE_URL`, `CHAT_SERVICE_URL` |
| `property` | `DATABASE_URL`, `DATABASE_POOL_MAX=5`, `SUPABASE_*`, `JWT_PUBLIC_KEY`, `REDIS_URL`, `INTERNAL_SERVICE_SECRET`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_REGION_CODES` |
| `chat` | `DATABASE_URL`, `DATABASE_POOL_MAX=5`, `SUPABASE_*`, `JWT_PUBLIC_KEY`, `REDIS_URL`, `INTERNAL_SERVICE_SECRET`, `CHAT_BACKUP_SECRET` |
| `payment` | `DATABASE_URL`, `DATABASE_POOL_MAX=3`, `JWT_PUBLIC_KEY`, `INTERNAL_SERVICE_SECRET`, `PROPERTY_SERVICE_URL`, `PAYMENT_WEBHOOK_SECRET` (no Redis, no Supabase) |

Rules that matter:

- `JWT_PRIVATE_KEY` goes **only** on `authentication`.
- `SERVICE` is also a Docker build argument: Railway passes variables to the build, and the `Dockerfile`
  picks the service to build from it. A missing `SERVICE` fails the build with a clear message.
- **Connection budget.** Each service opens its own database pool. Supabase's pooler allows few
  connections on small plans, so `DATABASE_POOL_MAX` is 3-5 here (total 16) instead of the default 10
  (which would be 40). Raise a number only when that service's logs show waiting for a connection.
- **`HOST=::`** makes a service listen on IPv6 and IPv4. Railway environments created before
  2025-10-16 resolve `*.railway.internal` to IPv6 only, and a service that listens only on IPv4 cannot be
  reached from the gateway there. It is harmless on newer environments. The gateway does not need it.
- Private addresses always include the port the service listens on (its `PORT`).

## 4. Redis

Add Railway's Redis database to the project and point every service that uses it at it with
`${{Redis.REDIS_URL}}` (use its private URL, not the public proxy). Redis here is cache, rate limits, signed-out
sessions and chat fan-out between instances; nothing stores its only copy there, so a Redis restart costs
speed, not data. Do **not** run Redis inside a service container any more: that was a single point of failure.

## 5. Moving from the single container to six services

1. **Staging first** (Railway **Environments**): create `staging`, add the seven services with staging
   variables, deploy, and point a debug build of the app at the staging gateway domain. Walk the main flows:
   login, listings, map, search, chat (WebSocket), checkout + webhook, profile edit, account deactivate.
2. **Production**: create the services in the production environment under their final names. They sit
   idle and unreachable until the gateway gets the public domain, so the live app is not affected.
3. **Cutover**: move the public domain (the one in the app's `.env.production` and the payment provider's
   webhook URL) from the old single service to `api-gateway`. The paths are unchanged, so the app needs no
   release. If the app uses the old service's generated `*.up.railway.app` address instead, add a custom
   domain to the gateway and change the app once.
4. **Rollback**: keep the old service stopped but not deleted for a few days. Moving the domain back restores
   the old setup in a minute.
5. Delete the old service when you are satisfied. Remember the earlier deploys ran older pushed code: this
   change assumes your database already has the migrations listed in the project notes (14-16).

## 6. Scaling and cost

- Start every service at 1 replica with a **resource limit** (Settings): about 512 MB for `property`,
  `chat`, `authentication`, 256-512 MB for `user`, `payment`, `api-gateway`. A Node service idles near 100 MB, and
  Railway bills for what is used, so six small services cost little more than one large one.
- The first service to need a second replica is **`api-gateway`** (stateless; its limits are in Redis), then
  **`property`** (the read-heavy path; its cache is in Redis). Both are safe to scale now.
- **`chat`**: more than one replica needs the Redis adapter (already used) and WebSocket-only transport
  from the app. Test with two replicas in staging before doing it in production.
- **`payment` and `authentication`**: keep at 1 until you need more. Both are safe to repeat (webhooks settle
  once), but they carry little traffic.
- Never enable Railway's serverless / app-sleeping for these: a sleeping service answers its first request
  slowly and its WebSocket/health behaviour is not what the app expects.

## 7. Reliability checklist

- [ ] Only `api-gateway` has a public domain.
- [ ] `restartPolicyType` is `ALWAYS` for all six (from the config files).
- [ ] An uptime monitor (Better Stack, UptimeRobot, Uptime Kuma) calls `https://<gateway>/health` every minute
      and alerts you. Because Railway healthchecks only run at deploy time, this is what tells you a service
      died at 3 a.m. For per-service visibility also monitor the 503s: the gateway names the failing service in
      the body (`{"service": "chat", ...}`).
- [ ] Deploy notifications are on for the project (Settings, Notifications / webhooks) so a failed deploy reaches you.
- [ ] `INTERNAL_SERVICE_SECRET` is identical in `user`, `property`, `chat` and `payment`.
- [ ] A `staging` environment exists and every change is deployed there first.
- [ ] Database migrations are applied **before** deploying code that needs them (Railway does not run them).

## 8. What happens when a service dies

| Down | The app still | Fails with |
|---|---|---|
| `authentication` | everything for signed-in users until their 15-minute token expires | login, register, refresh, password reset |
| `user` | browsing, search, chat, payments | own profile, profile picture, username check |
| `property` | profile, chat, login | listings, map, search; checkout and webhooks answer `503` so the provider retries |
| `chat` | everything else | messages; account deletion is refused (`503`) so no files are left behind |
| `payment` | everything else | starting a payment |
| `Redis` | everything (slower; limits are counted per instance) | nothing |
| `api-gateway` | nothing | everything: keep it tiny, stateless and first in line for a second replica |

The gateway answers `503` (`504` for a service that hangs for 30 s) with the service named in the JSON body,
so the app can show "chat is unavailable" instead of a generic error.
