# Deployment runbook

Two paths are supported and both are tested in CI:

1. **Vercel + Neon + Inngest + Resend (recommended)** — managed, EU-residency-ready, ~€100/month at MVP scale.
2. **Self-hosted Docker** — anywhere you can run a container and Postgres.

Pick one and follow the corresponding section. Generic prep (secrets, post-deploy checks) is the same for both.

---

## Generic prep (do this first)

### 1. Generate strong secrets

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -base64 32   # TOKEN_SECRET
openssl rand -base64 32   # CRON_SECRET
openssl rand -base64 24   # EMAIL_WEBHOOK_SECRET
openssl rand -base64 24   # WHATSAPP_VERIFY_TOKEN (only if using WhatsApp Cloud API)
```

The app **refuses to start** in production with the dev-default values for `CRON_SECRET`, `EMAIL_WEBHOOK_SECRET`, or `WHATSAPP_VERIFY_TOKEN`, and refuses `NEXTAUTH_SECRET` / `TOKEN_SECRET` shorter than 32 characters. See `src/lib/env.ts`.

### 2. Pick an email provider

Recommended: **Resend** (`EMAIL_PROVIDER=resend`). Alternatives: SendGrid, Mailgun (set `MAILGUN_DOMAIN` + `MAILGUN_REGION`), or `stub` for sanity testing.

After picking:

- Verify your sending domain (DKIM / SPF / DMARC).
- Set `EMAIL_FROM` to a verified address on that domain.
- Subscribe to the bounce/complaint webhook at `/api/webhooks/email`. Configure the webhook in your provider with the corresponding signing secret:
  - SendGrid: paste their Ed25519 public key into `SENDGRID_WEBHOOK_PUBLIC_KEY`.
  - Resend: paste the Svix signing secret (`whsec_…`) into `RESEND_WEBHOOK_SECRET`.
  - Mailgun / fallback: configure HTTP Basic with `Authorization: Bearer ${EMAIL_WEBHOOK_SECRET}`.

### 3. Configure Zoho CRM (if using)

- Create a Zoho self-client at <https://api-console.zoho.eu/> (or `.com` for non-EU).
- Generate a refresh token with `ZohoCRM.modules.ALL` scope.
- Set `ZOHO_*` env vars and `ZOHO_ENABLED=true`.
- Confirm the module choice (recommendation: **Contacts** — see `docs/decisions.md` §1).

### 4. Decide on Inngest

- **Recommended for production.** Sign up at <https://app.inngest.com>, create an app, copy the event key + signing key into `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`. The app autoswitches to durable jobs as soon as `INNGEST_EVENT_KEY` is set.
- **Without Inngest:** the app falls back to synchronous welcome emails + in-process Zoho sync + the cron-triggered reminder endpoint at `/api/cron/reminders` (Vercel Cron handles this in path 1).

---

## Path 1: Vercel + Neon + Inngest + Resend

### 1. Provision Neon

1. <https://console.neon.tech> → new project, region **EU (Frankfurt)** or **EU (Dublin)**.
2. Copy the pooled connection string (port 6543) for runtime, and the direct connection string (port 5432) for migrations.
3. Save both.

### 2. Connect the GitHub repo to Vercel

1. <https://vercel.com/new> → import `tdmoran/nexus-northwest-platform`.
2. Framework preset: Next.js (auto-detected).
3. **Region**: Frankfurt (`fra1`) or Dublin (`dub1`) — set under Project → Settings → Functions.
4. Build command: `prisma generate && next build`.
5. Output directory: leave default.

### 3. Set environment variables

Project → Settings → Environment Variables. Required for production:

```
DATABASE_URL              <neon pooled connection string>
DIRECT_URL                <neon direct connection string>     # only used by prisma migrate
NEXTAUTH_SECRET           <openssl rand -base64 32>
NEXTAUTH_URL              https://your-domain.example
NEXT_PUBLIC_SITE_URL      https://your-domain.example
NEXT_PUBLIC_SITE_NAME     Nexus Northwest
TOKEN_SECRET              <openssl rand -base64 32>
CRON_SECRET               <openssl rand -base64 32>
EMAIL_WEBHOOK_SECRET      <openssl rand -base64 24>

EMAIL_FROM                hello@yourdomain.example
EMAIL_PROVIDER            resend
EMAIL_API_KEY             <resend API key>
RESEND_WEBHOOK_SECRET     whsec_...

INNGEST_EVENT_KEY         <inngest event key>
INNGEST_SIGNING_KEY       <inngest signing key>

ZOHO_ENABLED              true
ZOHO_CLIENT_ID            ...
ZOHO_CLIENT_SECRET        ...
ZOHO_REFRESH_TOKEN        ...
ZOHO_API_DOMAIN           https://www.zohoapis.eu
ZOHO_MODULE               Contacts

SENTRY_DSN                <server DSN>
NEXT_PUBLIC_SENTRY_DSN    <browser DSN>
SENTRY_ENVIRONMENT        production

LOG_LEVEL                 info
```

Optional: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` to turn on SSO. Optional: `WHATSAPP_*` to turn on Cloud API messaging.

### 4. Run the first migration

Vercel doesn't run shell during deploy. Run it once locally against Neon:

```bash
DATABASE_URL=<direct connection string> npx prisma migrate deploy
```

(Or wire `prisma migrate deploy` into the build command — but watch for migration order issues if you have multiple environments sharing one DB.)

### 5. Seed an initial Super Admin

```bash
DATABASE_URL=<direct connection string> npx prisma db seed
```

This creates `admin@nexusnorthwest.local`. **Sign in immediately, change the password, then disable or delete the seeded account.**

### 6. Configure Inngest

1. <https://app.inngest.com> → your app → "Sync app".
2. URL: `https://your-domain.example/api/inngest`.
3. Inngest will discover the four functions (`member-welcome-email`, `zoho-member-sync`, `reminders-cron`, `announcement-dispatch`).
4. Confirm the cron is scheduled.

### 7. Vercel Cron (fallback if Inngest is not used)

`vercel.json` already wires `/api/cron/reminders` every 10 minutes. Vercel injects `Authorization: Bearer ${CRON_SECRET}` automatically when `CRON_SECRET` is set.

### 8. Webhooks — configure in providers

- **Email provider**: webhook URL `https://your-domain.example/api/webhooks/email` with the signing secret.
- **WhatsApp Cloud API** (optional): `https://your-domain.example/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`.

### 9. Smoke test

- `GET /api/health` → 200 with `db.ok: true`.
- Sign up at `/?utm_source=smoketest`.
- Confirm the welcome email arrives (check Resend logs).
- Sign in, create an event, send an announcement to yourself.
- Click the RSVP link from the email — confirm the page renders and the RSVP appears in the dashboard.
- Click the unsubscribe link — confirm it works once and then 404s.

---

## Path 2: Self-hosted Docker

The repo ships a multi-stage `Dockerfile` and a production compose file. Suitable for a single VPS, ECS Fargate, Fly.io, etc.

### 1. Build

```bash
docker build -t nexus-northwest .
```

### 2. Run with docker-compose

```bash
cp .env.example .env
# Fill in production secrets (see "Generic prep").
docker compose -f docker-compose.prod.yml up -d
```

The compose file:
- Brings up Postgres 16 with a persistent volume.
- Builds and starts the app, which runs `prisma migrate deploy` then `node server.js`.
- Strict-fails if any required secret is unset.

### 3. Put TLS in front

Run a reverse proxy (Caddy / nginx / Cloudflare Tunnel) that terminates TLS and forwards to port 3000.

### 4. Inngest

Inngest works against any HTTPS endpoint. After domain + TLS are live, sync the app from <https://app.inngest.com> exactly as in Path 1 step 6.

### 5. Backups

`docker exec nexus-postgres pg_dump -U nexus nexus > backup-$(date +%F).sql` on a cron. Test restores quarterly.

---

## Day-2 operations

### Rotate `TOKEN_SECRET`

This invalidates every outstanding RSVP, preferences, and unsubscribe link. Use sparingly — typically only after a suspected leak.

1. Generate a new value.
2. Update env var.
3. Restart the app.
4. (Optional) `DELETE FROM "Token";` to drop stale rows from the index.

### Rotate `NEXTAUTH_SECRET`

This logs out every organiser. Same procedure as above, no DB cleanup needed.

### Re-run a failed Zoho sync

Open the dashboard overview. The amber banner shows unresolved Zoho sync failures with a "Retry now" button. With Inngest enabled, durable retries with exponential backoff happen automatically; the manual retry is a fast-forward.

### Rollback

- **Vercel**: `vercel rollback` — Vercel keeps deployment immutability, so this is instant. Database migrations are NOT rolled back; if a migration is incompatible, restore from a Neon point-in-time backup first, then redeploy.
- **Self-hosted**: `docker compose down && docker compose -f docker-compose.prod.yml up -d` against a previous image tag.

### Check audit log

`/dashboard/audit` lists the last 250 events, gated by RBAC (`audit.view`). For deeper history, query the `AuditLog` table directly.

### Health check / uptime monitor

Point any HTTP monitor (BetterStack, UptimeRobot, Pingdom) at `/api/health`. Alert on non-200.

---

## Pre-launch checklist

- [ ] All env vars set; production safety checks passing
- [ ] Neon Postgres provisioned in EU; backups enabled (Neon does this by default)
- [ ] Email DKIM/SPF/DMARC verified
- [ ] Email bounce/complaint webhook subscribed and signature secret configured
- [ ] First migration applied (`prisma migrate deploy`)
- [ ] Seeded Super Admin password changed; seeded Manager/Viewer disabled if not used
- [ ] Inngest app synced; functions visible in Inngest dashboard
- [ ] Vercel Cron showing green (if not using Inngest)
- [ ] Sentry receiving a test error from the app
- [ ] `/api/health` reachable from the uptime monitor
- [ ] Sign-up → welcome email → RSVP loop tested end-to-end with a real address
- [ ] Privacy page reviewed by legal / updated to actual policy
- [ ] DNS for `NEXT_PUBLIC_SITE_URL` pointed at the app and confirmed HTTPS
- [ ] (If WhatsApp Cloud API) Meta-approved template variable order matches `deliverWhatsApp` in `src/server/announcements.ts` / `src/inngest/functions.ts`
- [ ] (If SSO) Google / Azure redirect URIs whitelisted in the provider console

When all boxes are ticked, you're ready.
