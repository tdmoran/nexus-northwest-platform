# CLAUDE.md — Nexus Northwest Platform

> Read this whole file before touching anything. It's the operating manual for a fresh Claude Code session inheriting this codebase. The previous session built this from a one-line spec into a deployed production app over many rounds. Most decisions are deliberate — change them only when you understand why they were made.

## 0 · Read this first

- Live URL: **https://nnw-platform.vercel.app**
- Repo: **https://github.com/tdmoran/nexus-northwest-platform**
- Deployment platform: **Vercel** (Hobby tier, project name `nnw-platform`)
- Database: **Neon Postgres**, region `aws-eu-central-1` (Frankfurt)
- Email: **Resend**, currently using their `onboarding@resend.dev` sender (no custom domain verified yet)
- Branding: Poppins type, navy `#0c243f` + teal `#2ea39a`, logo at `public/logo.png`
- The owner is **Tom Moran** (`tdmoran` on GitHub); their organisation is **Nexus Northwest** (formerly Sligo Tech Meetup, Ireland)

There is **no staging environment**. `main` deploys directly to production. Treat it accordingly: typecheck, build, run integration tests locally before pushing if you can, and read [§ Gotchas](#15-gotchas--lessons-from-the-deploy) before making structural changes.

## 1 · What this is

A community management platform for the **Nexus Northwest** technology meetup group. It replaces Sligo Tech Meetup's manual workflow (Meetup.com + spreadsheets) with a single web property that does:

- **Public landing + sign-up** with `name + email + consent` only (and UTM/referral capture)
- **Tokenised one-click RSVP** delivered by email — no member account needed
- **Organiser dashboard** with RBAC: events, announcements, members, actions, surveys, reports, GDPR compliance
- **Email + WhatsApp** messaging with member-managed preferences via tokenised links
- **Recurring event series**, **capacity waitlists**, **post-event surveys**, **CSV import/export**, **referral tracking**, **opt-in member directory**

Everything is built against the *Nexus Northwest Platform — Functional Specification v1.2* (the source doc the owner provided). The MVP scope (FR-001 through FR-010) and most Phase 2 items (FR-011, FR-012) are implemented.

## 2 · Where we are right now

### Working in production
- ✅ All public pages render: `/`, `/events`, `/community`, `/privacy`, `/welcome`, `/api/health`
- ✅ `/login` and NextAuth endpoints return 200; bcrypt password verification works
- ✅ Database connected; ~470 ms cold-start latency to Neon (free tier scale-to-zero)
- ✅ Sign-up flow writes to DB
- ✅ Seeded organiser users exist with bcrypt password hashes:
  - `admin@nexusnorthwest.local` · `ChangeMe!123` · SUPER_ADMIN
  - `manager@nexusnorthwest.local` · `ChangeMe!123` · MANAGER
  - `viewer@nexusnorthwest.local` · `ChangeMe!123` · VIEWER

### Pending / not yet validated end-to-end
- ⏳ **Email delivery** — Resend API key works but no domain is verified, so emails only deliver to the email address that owns the Resend account. Fix: verify `nexusnorthwest.org` in Resend (add 3 DNS records) and update `EMAIL_FROM` env var
- ⏳ **Inngest** — `INNGEST_EVENT_KEY` env var was set up to be optional; the app falls back to synchronous welcome emails when unset. Inngest functions are defined in `src/inngest/functions.ts` and registered at `/api/inngest`, but the app at app.inngest.com hasn't been synced
- ⏳ **Vercel Cron** — daily-only schedules are configured (Hobby tier limit). Functional but coarse-grained
- ⏳ **WhatsApp Cloud API** — code path exists, gated behind `WHATSAPP_ENABLED=false`
- ⏳ **Zoho CRM** — gated behind `ZOHO_ENABLED=false`; integration boundary in `src/lib/zoho.ts` will activate once enabled
- ⏳ **Custom domain** — currently on `*.vercel.app` subdomain
- ⏳ **MFA enrolment for the seeded admin** — feature exists but no admin has set up TOTP yet

### Recently shipped (last session)
- Brand-led UI overhaul (Poppins, navy/teal, animated hero, glass cards, slick login split-screen)
- Logo wired into landing + dashboard
- Token pages (RSVP, welcome, unsubscribe, preferences, survey) on a consistent shell
- Production deploy, including Vercel + Neon + Resend wiring

## 3 · Repo + tooling

### Top-level layout

```
nexus-northwest/
├── prisma/
│   ├── schema.prisma          ← single source of truth for the DB
│   ├── seed.ts                ← creates the 3 seeded organiser users
│   └── migrations/            ← 21 committed migrations, hand-aligned
├── src/
│   ├── app/                   ← Next.js App Router
│   │   ├── (public pages)     ← /, /events, /community, /privacy, /welcome, /login
│   │   ├── (token pages)      ← /rsvp/[token]/, /preferences/[token]/, /unsubscribe/[token]/, /survey/[token]/, /auth/magic/[token]/
│   │   ├── dashboard/         ← organiser-only, RBAC-gated
│   │   └── api/               ← REST routes + cron + webhooks + inngest + auth
│   ├── components/
│   │   ├── ui/                ← Button, Field — shared primitives
│   │   └── layout/            ← PublicShell + TokenPageShell
│   ├── lib/                   ← env, db, auth, rbac, tokens, email, zoho, whatsapp, logger, csv, totp, etc.
│   ├── server/                ← service modules: members, announcements, reminders, surveys, etc.
│   └── inngest/               ← Inngest client + function definitions
├── docs/
│   ├── decisions.md           ← spec §16 product decisions, fully reasoned
│   └── build-summary.html     ← generated PDF source
├── e2e/                       ← Playwright + axe-core specs
├── scripts/preflight.sh       ← post-deploy smoke probe
├── DEPLOY.md                  ← deployment runbook
├── README.md                  ← quick-start + feature index
├── CLAUDE.md                  ← this file
├── docker-compose.yml         ← local Postgres on port 5433
├── docker-compose.prod.yml    ← self-hosted production option
├── Dockerfile                 ← multi-stage, Next.js standalone, non-root
└── vercel.json                ← cron schedules (daily, Hobby-tier-friendly)
```

### Build commands

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server. Uses `.env`. |
| `npm run build` | `prisma generate && next build`. |
| `npm test` | Vitest unit suite (excludes `*.integration.test.ts`). |
| `npm run test:integration` | Vitest against a real Postgres (uses `DATABASE_URL`). |
| `npm run test:e2e` | Playwright + axe. |
| `npm run typecheck` | `tsc --noEmit`. **Run before committing.** Vercel's typecheck is stricter than dev-mode hot-reload. |
| `npm run db:seed` | `tsx prisma/seed.ts` — re-creates the 3 admin users with bcrypt hashes. |

### Postinstall hook

`package.json` runs `prisma generate` on `postinstall` — required because Vercel caches `node_modules` between deploys. Don't remove it; you'll get `PrismaClientInitializationError` in production if you do.

## 4 · Architecture

```
            ┌────────────────────────────────────────────┐
            │     Public surface (Next.js App Router)    │
            │  /  /events  /community  /privacy  /login  │
            │       /rsvp/[token]  /preferences/[token]   │
            │  /unsubscribe/[token]  /welcome  /survey/…  │
            └────────────────┬───────────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────────────┐
            │   Server components + API routes (Next)    │
            └─────┬──────────────────┬──────────────┬────┘
                  │                  │              │
        ┌─────────▼──────┐  ┌────────▼──────┐  ┌───▼────────────┐
        │  src/server/*  │  │  src/lib/*    │  │  src/inngest/* │
        │  (orchestration)│  │  (primitives) │  │  (durable jobs)│
        └─────────┬──────┘  └────────┬──────┘  └───┬────────────┘
                  │                  │             │
                  └─────────┬────────┴─────────────┘
                            ▼
                ┌──────────────────────┐         ┌────────────────────┐
                │  Postgres (Neon EU)  │         │  External services │
                │  via Prisma 5         │         │  Resend · Zoho ·   │
                └──────────────────────┘         │  WhatsApp · Sentry │
                                                 └────────────────────┘
```

### Layering rules

- **`src/lib/*`** — small, dependency-free primitives. No Prisma in `lib/` *unless* the file directly wraps Prisma (`db.ts`, `tokens.ts`, `audit.ts`). Pure logic goes here (`engagement.ts`, `csv-parse.ts`, `token-crypto.ts`, `totp.ts`, `webhook-verify.ts`, `rbac.ts`).
- **`src/server/*`** — orchestration: composes `lib` + Prisma + side effects. Used by API routes and server components. *Don't* import `server/*` from `lib/*` (avoid the cycle).
- **`src/inngest/functions.ts`** — wraps `src/server/*` calls in `step.run()` for durable retries. Each function is a thin shim. **Service code stays plain and synchronous.**
- **`src/app/dashboard/layout.tsx`** has `export const dynamic = "force-dynamic"`. **Never remove this.** Without it, dashboard pages try to pre-render at build time and hang on DB reads in Vercel's build sandbox.

## 5 · Data model

21 migrations, all in `prisma/migrations/`. Schema is in `prisma/schema.prisma`.

### Entities

- **`OrganiserUser`** — dashboard accounts (Super Admin / Admin / Manager / Viewer). bcrypt password hash. MFA fields: `mfaEnrolled` + `mfaSecret` (TOTP base32).
- **`Member`** — public sign-ups. Email is the dedupe key. Tracks consent timestamps for both email and WhatsApp, opt-out timestamps, bounce flag, GDPR `deletionRequestedAt` + `deletedAt`, public-directory toggle (`publicProfile`, `headline`, `bio`), referral code (inbound) and `inviteSlug` (outbound).
- **`Event`** — title, description, startsAt, location, capacity, reminder offsets + audience, optional `seriesId`. RSVP enabled by default.
- **`EventSeries`** — recurring template (weekly / biweekly / monthly cadence) that materialises future Events via the cron worker.
- **`RSVP`** — unique on `(eventId, memberId)`. Status enum includes `WAITLISTED`. Tracks `attendedAt` + `noShow` for check-in, `waitlistedAt` + `promotedAt` for waitlist ordering.
- **`Announcement`** — per send instance. Status lifecycle: `DRAFT → SCHEDULED → QUEUED → SENT/FAILED/CANCELLED`. `scheduledFor` for future sends. `audienceTag` accepts `"all"`, `"rsvp_yes"`, or `"tag:<name>"`.
- **`ActionItem`** — tasks + speaker/contributor/theme prospects with status pipeline.
- **`Token`** — HMAC-signed tokens for RSVP / PREFERENCES / UNSUBSCRIBE / SURVEY_RESPONSE. `consumedAt` is set only for single-use tokens (currently UNSUBSCRIBE).
- **`Reminder`** — fired-once-per-event-per-offset record. Unique on `(eventId, offsetMinutes)` for idempotency.
- **`WhatsAppMessage`** — tracks every Cloud API send with status lifecycle.
- **`AuditLog`** — append-only. Keyed by `actorId` (organiser) and/or `memberId`. `meta` is `Json` (cast as `Prisma.InputJsonValue` at write).
- **`ZohoSyncFailure`** — persisted so the dashboard can retry; resolved automatically on success.
- **`MagicLink`** — single-use 15-min organiser sign-in link.
- **`EventSurvey`** + **`EventSurveyResponse`** — post-event feedback. One survey per event; one response per member.

### Migrations

Migrations are hand-written SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`. The initial migration (`20260509120000_init`) was hand-written so `prisma migrate deploy` works against a fresh DB without an interactive `prisma migrate dev` round-trip. **All subsequent migrations were also hand-written in the same dir.** This is unusual but intentional — it lets the deploy story be deterministic.

When adding a new migration: create the directory, write the SQL by hand, then update `prisma/schema.prisma` to match. Verify with `npx prisma validate` before pushing.

### Connection strings

Two separate URLs because Neon's pooler is in transaction mode (PgBouncer):

```
DATABASE_URL  = postgresql://...-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&pgbouncer=true
DIRECT_URL    = postgresql://...           .eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

`directUrl` in `prisma/schema.prisma` ensures migrations target the unpooled host.

## 6 · Auth + RBAC

### Providers

NextAuth credentials provider in `src/lib/auth.ts` accepts:
- `email + password + mfaCode` (password via `bcrypt.compare`)
- OR `magicToken` (consumes a single-use HMAC link)

Optional SSO providers conditionally added when env vars are set:
- Google OAuth (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`)
- Azure AD / Entra ID (`AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID`)

SSO is **invite-only**: `signIn()` callback rejects if no `OrganiserUser` row matches the OAuth email.

### MFA

Custom RFC 6238 TOTP implementation in `src/lib/totp.ts` (no external dep). Base32 secret stored on `OrganiserUser.mfaSecret`. Enrolment flow at `/dashboard/settings/mfa`. Login form auto-prompts when an account has MFA enrolled.

### Capability matrix

`src/lib/rbac.ts` mirrors the spec §4 RBAC table exactly. Use `can(role, capability)` for boolean checks and `requireCap(role, capability)` to throw 403. Capabilities are typed; adding a new one means adding it to the `Capability` union and the matrix.

User-management capabilities (who can manage whom) live in `src/lib/rbac-users.ts`. SUPER_ADMIN can manage all roles incl. other Super Admins; ADMIN can manage MANAGER + VIEWER only.

### Sessions

JWT strategy, 8-hour expiry. NextAuth doesn't use the database for sessions, so the `Account` / `Session` tables don't exist. **Don't add a Prisma adapter** — it'll break the magic-link callback path (which uses the credentials provider with `magicToken` instead of NextAuth's `EmailProvider`).

## 7 · Background jobs

### Two modes

Most workflows have **synchronous and Inngest-backed** versions, gated by `env.INNGEST_EVENT_KEY`:

```ts
if (env.INNGEST_EVENT_KEY) {
  await inngest.send([{ name: "member/welcome.send", data: { memberId } }]);
} else {
  await sendWelcomeSync(...);
}
```

Pattern: when Inngest is configured, fire-and-forget. Otherwise, call the service directly. **Don't** force everything onto Inngest — local dev and tests run faster and simpler without it.

### Inngest functions (in `src/inngest/functions.ts`)

| Function | Trigger | Purpose |
| --- | --- | --- |
| `sendWelcomeEmail` | event `member/welcome.send` | Welcome email after sign-up |
| `syncMemberToZoho` | event `zoho/member.sync` | Zoho CRM upsert with bounded concurrency + 8 retries |
| `dispatchAnnouncement` | event `announcement/dispatch` | Per-recipient delivery in `step.run()` for retries |
| `remindersCron` | cron `*/10 * * * *` | Reminder dispatch (every 10 min) |
| `scheduledAnnouncementsCron` | cron `*/2 * * * *` | Fires due scheduled announcements |
| `gdprDeletionCron` | cron `0 3 * * *` | Hard-deletes members past grace |
| `eventSeriesCron` | cron `0 */6 * * *` | Materialises upcoming series occurrences |
| `surveyDispatchCron` | cron `0 * * * *` | Sends post-event surveys 24h after end |

### Vercel Cron fallback

`vercel.json` has equivalent cron entries that hit `/api/cron/*` routes. **All schedules are daily** because Vercel Hobby tier doesn't allow sub-daily crons. Routes are bearer-protected by `CRON_SECRET`. Vercel auto-injects the bearer when the env var is set on the project.

### Critical: dashboard `force-dynamic`

`src/app/dashboard/layout.tsx` has `export const dynamic = "force-dynamic"`. This cascades to every nested route. Without it, Next.js attempts to pre-render dashboard pages at build time, which **hangs forever** because they query Prisma during render and Vercel's build sandbox can't reach the production DB.

## 8 · Email + WhatsApp

### Email

Pluggable provider in `src/lib/email.ts`:
- `stub` (default in dev) — writes to `.mail/<id>.eml`
- `sendgrid`, `resend`, `mailgun` — production providers

Resend is the production choice. **Currently unverified** — `EMAIL_FROM` is `onboarding@resend.dev` and Resend will only deliver to the email address that owns the Resend account.

To unblock real delivery:
1. Resend dashboard → Domains → Add `nexusnorthwest.org`
2. Add the SPF + DKIM + DMARC records to the domain's DNS
3. Wait for Resend to verify (usually <5 min)
4. Update `EMAIL_FROM` env var on Vercel to `hello@nexusnorthwest.org`
5. Redeploy

### Email templates

Hand-written HTML strings in `src/lib/templates.ts`. There used to be React Email components in `src/emails/` but they were removed because Next 14 forbids `react-dom/server` from leaking into route trees and `@react-email/render` v1 is async-only. Hand-rolled HTML is sync, dependency-free, and the existing tests cover XSS escaping.

If you want to migrate back to React Email later, do it via `@react-email/render`'s async API and convert callsites to `await welcomeEmail(...)`.

### Email webhooks

`/api/webhooks/email` accepts SendGrid array shape, Resend single-event shape. Verifies in this order:
1. SendGrid Ed25519 signature (when `SENDGRID_WEBHOOK_PUBLIC_KEY` is set)
2. Resend / Svix HMAC (when `RESEND_WEBHOOK_SECRET` is set)
3. Fallback: `Authorization: Bearer ${EMAIL_WEBHOOK_SECRET}`

Replay protection: 5-minute timestamp window.

### WhatsApp

`src/lib/whatsapp.ts` wraps the WhatsApp Business Cloud API. Stub mode by default (`WHATSAPP_ENABLED=false`). Real mode requires Meta Business credentials + a pre-approved template. Webhook at `/api/webhooks/whatsapp` handles Meta's subscription handshake (`hub.challenge`), status receipts, and STOP-keyword opt-outs.

## 9 · Tokens (no-login flows)

`src/lib/token-crypto.ts` is the pure HMAC core (testable without DB). `src/lib/tokens.ts` wraps it with Prisma persistence.

| Purpose | Single-use? | TTL |
| --- | --- | --- |
| `RSVP` | No (members can flip Yes ↔ No) | None — until token rotated |
| `PREFERENCES` | No | None |
| `UNSUBSCRIBE` | **Yes** | None |
| `SURVEY_RESPONSE` | No | 30 days |

**Don't change RSVP to single-use** without updating the email template — every announcement email contains all three RSVP buttons (Yes / Maybe / No), so the token must support all three responses.

Tokens are HMAC-signed with `TOKEN_SECRET`. Rotating that env var invalidates every outstanding link in the wild. Use sparingly.

## 10 · GDPR

### Member-side

From `/preferences/[token]`:
- **Article 20 (portability)** — JSON download via `/api/preferences/[token]/export`
- **Article 17 (erasure)** — `POST /api/preferences/[token]/delete` starts the 30-day grace window

When deletion is requested:
1. Member's `deletionRequestedAt` is set immediately
2. All consent flags are immediately cleared
3. Outstanding tokens are deleted (so old links can't undo it)
4. After 30 days, the daily cron at `/api/cron/gdpr` scrubs PII (name → `redacted-<id>`, email → `redacted-<id>@deleted.invalid`, etc.) and sets `deletedAt`

### Recipient queries

**Every recipient query in `src/server/announcements.ts`, `src/server/reminders.ts`, `src/server/surveys.ts` filters by**:

```ts
deletionRequestedAt: null,
deletedAt: null
```

If you add a new send path, **you must include those filters**. Failure to do so is a GDPR violation.

### Organiser visibility

`/dashboard/compliance` lists pending deletion requests. Visible to anyone with `audit.view` capability.

## 11 · Testing strategy

Three layers, all in CI:

### Unit (vitest, no DB)

`src/**/*.test.ts`. Pure logic only. Currently covers:
- `token-crypto` (HMAC sign/verify, RFC 6238 vectors)
- `rbac` (capability matrix, all roles)
- `rbac-users` (manageable-roles matrix)
- `validation` (Zod schemas, including honeypot)
- `csv` (escape, rowsToCsv)
- `csv-parse` (RFC 4180 parser, malformed inputs)
- `rate-limit` (windowing, key isolation)
- `templates` (HTML escaping, XSS prevention)
- `totp` (RFC 6238 known vectors)
- `webhook-verify` (Svix HMAC happy path + tamper, SendGrid fail-closed)
- `engagement` (scoring + bands)

When you add a new pure module, add a test file with the same root name. Tests run silently (`LOG_LEVEL=silent` in `vitest.setup.ts`).

### Integration (vitest, real Postgres)

`src/**/*.integration.test.ts`. Need a Postgres instance. CI spins one up; locally you'd point at the docker-compose Postgres.

Currently covers:
- `signupMember` happy path + idempotent duplicate
- Token round-trip (PREFERENCES reusable, UNSUBSCRIBE single-use, purpose mismatch)
- `sendEventAnnouncement` filters by consent / opt-out / bounced
- RSVP-Yes audience filter
- WhatsApp stub-mode logging
- Reminder dispatcher idempotency
- `recordBounces` updates consent flags

When you add a new server-side flow, add an integration test. Wipe relevant tables in `beforeEach`.

### E2E (Playwright + axe-core)

`e2e/*.spec.ts`. Spins a built Next server in CI. Currently covers landing, login, privacy with WCAG 2.1 AA assertions. Desktop Chrome + Mobile Safari profiles.

## 12 · CI/CD

`.github/workflows/ci.yml` has three jobs:

1. **`validate`** — `prisma generate` + `prisma validate` + `npm run typecheck` + `npm test` + `npm run build`
2. **`integration`** — Postgres service container, `prisma migrate deploy`, `npm run test:integration`
3. **`e2e`** — Postgres service, Playwright browsers, `npm run test:e2e`

All env vars in CI are placeholders; no real secrets needed.

Production deploy is **direct push to main → Vercel auto-deploys**. There's no PR review gate or staging branch. If you want safety, push to a feature branch first and let Vercel's preview deploy run.

## 13 · Production environment

### Vercel

Project: `nnw-platform` (Hobby tier). Environment variables are set on the project.

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection (with `pgbouncer=true`) |
| `DIRECT_URL` | Neon unpooled connection (for migrations) |
| `NEXTAUTH_SECRET` | JWT signing for sessions (≥32 chars in prod) |
| `NEXTAUTH_URL` | `https://nnw-platform.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | Same as above (used in tokenised links) |
| `NEXT_PUBLIC_SITE_NAME` | `Nexus Northwest` |
| `TOKEN_SECRET` | HMAC for tokenised links (≥32 chars) |
| `CRON_SECRET` | Bearer for `/api/cron/*` endpoints |
| `EMAIL_*` | Resend setup |
| `EMAIL_WEBHOOK_SECRET` | Bearer for `/api/webhooks/email` |
| `WHATSAPP_*` | All currently stubbed (`WHATSAPP_ENABLED=false`) |
| `ZOHO_*` | All currently stubbed (`ZOHO_ENABLED=false`) |
| `LOG_LEVEL` | `info` |
| `SENTRY_ENVIRONMENT` | `production` (DSN unset, so Sentry is no-op) |

**Production safety check** in `src/lib/env.ts` refuses to start with dev-default `CRON_SECRET`, `EMAIL_WEBHOOK_SECRET`, or `WHATSAPP_VERIFY_TOKEN`, and rejects `NEXTAUTH_SECRET` / `TOKEN_SECRET` shorter than 32 chars. Don't loosen this.

### Neon

Project name `nexus-northwest`, region `eu-central-1` (Frankfurt). Free tier scale-to-zero — first request after idle takes ~500 ms to wake. If you see DB latency spikes, that's why.

To run a one-off query: `npx prisma studio` with the right `DATABASE_URL` env. Or use Neon's web console.

### Resend

Account email tied to `tdmoran@gmail.com`. **No domain verified yet.** API key has full access. Replace it via Resend dashboard if rotated.

## 14 · Local dev setup

The dev server should already be running on port 3001 (port 3000 was taken by something else when set up). To start fresh:

```bash
# 1. Postgres on port 5433 (5432 is taken by a host install on this machine)
docker compose up -d postgres

# 2. Apply migrations + seed (one-time)
npx prisma migrate deploy
npm run db:seed

# 3. Run
npm run dev
```

`.env` should already exist in the project root with dev-friendly defaults pointing at `localhost:5433`.

### Things to remember

- The local Postgres is on **port 5433**, not the default 5432, because the laptop already has a host Postgres running. `docker-compose.yml` reflects this.
- The dev server runs on **port 3001** (something owns 3000). `.env` reflects this in `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`.
- Email sends in dev write to `.mail/*.eml`. Open with `open .mail/<id>.eml` in macOS to render.

## 15 · Gotchas — lessons from the deploy

These are the actual issues hit during the production deploy. Read these before changing related code.

### 1. `argon2` doesn't ship binaries for Node 24

Vercel's runtime jumped to Node 24.14.1 (ABI 137) and `argon2` 0.41.1 only had prebuilt binaries up to ABI 131. Symptom: every auth route 500'd at module load.

**Fix taken**: replaced with `bcryptjs` (pure JS). Don't reintroduce `argon2` unless you're prepared to deal with this every time Node ABI bumps.

### 2. React Email + `react-dom/server` boundary

Next 14 forbids `react-dom/server` from leaking into route trees. The `@react-email/components` library imports it transitively. We initially used `renderToStaticMarkup` to keep templates synchronous — but Next refuses that pattern at compile time.

**Fix taken**: hand-written HTML in `src/lib/templates.ts`. The React Email components in `src/emails/` were deleted because they were dead code that still type-checked.

### 3. Prisma needs `prisma generate` on every install

Vercel caches `node_modules`, so `prisma generate` doesn't auto-run on subsequent deploys. Symptom: outdated Prisma client at runtime.

**Fix in place**: `package.json` has both `postinstall: "prisma generate"` and `build: "prisma generate && next build"`. Belt + braces. Don't remove.

### 4. Neon pooled vs direct connections

Neon's pooled endpoint is PgBouncer in transaction mode. Prisma queries fail unless `pgbouncer=true` is on the connection string (disables prepared statements). And migrations need the unpooled host (PgBouncer doesn't support migration ops).

**Fix in place**: `DATABASE_URL` has `pgbouncer=true`, `DIRECT_URL` has the unpooled host. `prisma/schema.prisma` `datasource` has `directUrl = env("DIRECT_URL")`. Do not remove either.

### 5. `dashboard/layout.tsx` must be `force-dynamic`

Without it, build hangs at "Generating static pages 27/37" forever. See [§ 7](#7--background-jobs).

### 6. `useSearchParams` on a server-rendered page

`JoinForm` uses `useSearchParams` to capture UTM params at sign-up. That bails out of static generation. Wrap in `<Suspense>` or the build fails with a CSR-bailout error.

**Fix in place**: `src/app/page.tsx` wraps the JoinForm in `<Suspense>`. Same applies if you add another client-side `useSearchParams` user.

### 7. Vercel Hobby cron limits

Hobby tier: **daily crons only**. Sub-daily schedules cause the project to refuse to deploy with a clear error. `vercel.json` schedules everything daily. If/when the user upgrades to Pro, you can change to the original 10-minute / 2-minute / hourly schedules.

### 8. Prisma `Json` field input

`Prisma.InputJsonValue` is stricter than `Record<string, unknown>`. Cast at the writeside:

```ts
meta: (opts.meta ?? undefined) as Prisma.InputJsonValue | undefined
```

`src/lib/audit.ts` does this. Don't remove the cast.

### 9. Vercel parses env vars with `=` correctly

We worried about base64 secrets ending in `=` being truncated. They aren't — Vercel's parser splits on the first `=` only. Don't waste time URL-encoding secrets.

### 10. Date inputs in Safari

`<input type="datetime-local">` is text-only on macOS Safari. Users can't pick easily. Use **separate `type="date" + type="time"` inputs** and combine in the server action. `src/app/dashboard/events/_components/EventForm.tsx` does this.

### 11. Inngest `step.run` JSON-serialises Date

Anything you return from `step.run()` is JSON-serialised. Dates come back as strings. Re-hydrate before passing to helpers that expect `Date`:

```ts
const ev = { ...target, startsAt: new Date(target.startsAt), endsAt: target.endsAt ? new Date(target.endsAt) : null };
```

`src/inngest/functions.ts` does this around the announcement dispatch. Same applies if you add new step.run wrappers around DB models with Date fields.

## 16 · Design system + UI conventions

### Colours

Every Tailwind colour utility uses our scoped palette:

- `brand-50 … brand-900` — navy spine, primary
- `accent-50 … accent-700` — teal, the logo's gradient mark
- standard greys / rose / amber / emerald for semantic states

`brand-800` is the primary navy (`#0c243f`). `accent-500` is the teal (`#2ea39a`). Don't introduce arbitrary hex colours; extend the palette in `tailwind.config.ts` if you need a new shade.

### Typography

Poppins via `next/font/google`, exposed as `--font-poppins`. The `sans` and `display` font families both reference it. Don't add additional Google Fonts — the loading cost stacks.

### Components

- `src/components/ui/Button.tsx` — variants `primary | accent | secondary | ghost | danger`; sizes `sm | md | lg`. Always use these. Don't write `className="bg-brand-..."` for buttons inline.
- `src/components/ui/Field.tsx` — text inputs with consistent focus rings + error states.
- `src/components/layout/PublicShell.tsx` — full-bleed wrapper for non-landing public pages (events, community, privacy). Has a sticky header + brand footer.
- `src/components/layout/PublicShell.tsx` also exports `TokenPageShell` — used for welcome / RSVP / unsubscribe / preferences / survey. Soft gradient bg, glass card, fade-up animation.

### Animations

CSS-only (`animate-fade-up`, `glow-blob` in `globals.css`). All wrapped in `prefers-reduced-motion: reduce` overrides. Don't add JS-driven animation libraries.

### Skip link

`src/app/layout.tsx` has a skip-to-main-content link. Every `<main>` element in the codebase has `id="main"` so the skip link works. **If you create a new page, give the main element `id="main"`.**

## 17 · Code style + patterns

### Immutability

The user's global rules require immutable updates. Use spreads, not mutation:

```ts
// WRONG
state.foo = bar
// CORRECT
return { ...state, foo: bar }
```

### File length

Files cap at ~800 lines. Most are <400. Split rather than extend.

### Logging

Always `import { log } from "@/lib/logger"`. Never `console.log` in source code (other than the one allowed location in `env.ts` because env validation runs before the logger can boot — and it's annotated with `eslint-disable-next-line no-console`).

`log.error("dotted.event.name", { err: String(err), context })` — use dotted event names, structured meta.

### Error handling

- Audit writes are wrapped in `try/catch` to never break user flows
- External calls (Zoho, Resend) wrap throws into `result.error` strings rather than re-throwing — caller decides what to do
- Sign-up never blocks on email or Zoho failures; failures are persisted for retry visibility

### Validation

Every API route validates with Zod. Schemas live in `src/lib/validation.ts`. The honeypot field on `signupSchema` is `website: z.string().max(0).optional().default("")` — keep it.

### Audit

Every state-changing operation that affects a member or organiser writes to `audit`:

```ts
await audit({ action: "rsvp.recorded", memberId: m.id, channel: "email", meta: {...} });
```

Action names are dotted, namespaced, past-tense. Don't skip audit calls — the spec NFR-004 mandates them.

## 18 · Recently changed (latest sessions)

The most recent commits, in order. The `git log --oneline` is the long-form truth.

1. **Initial MVP** — landing, sign-up, dashboard scaffold, RBAC, Prisma schema
2. **Production hardening** — tests, CI, Vercel cron, signed webhooks, anti-abuse
3. **Deploy + ops** — Docker, migrations, reports, QR, attendance, Zoho resilience
4. **Security/auth** — TOTP MFA, signed email webhooks, pluggable rate limiter
5. **SSO + ops** — Google + Azure AD, health endpoint, robots/sitemap, integration tests
6. **WhatsApp + decisions** — Cloud API, decisions doc, expanded integration tests
7. **Inngest + Sentry** — durable jobs, Mailgun provider, prod hardening, DEPLOY runbook
8. **Final remaining work** — a11y, magic-link, React Email migration, preflight, LinkedIn doc
9. **More features** — scheduled announcements, CSV import, public events, waitlist, calendar feed
10. **GDPR + tags + series** — Article 17/20 workflow, tag segments, recurring series
11. **Surveys + directory + scoring + referrals** — feedback loop, opt-in directory, engagement bands, invite slugs
12. **UI polish + brand** — logo wired in, separate date/time inputs, hand-written templates
13. **Brand-led overhaul** — Poppins, navy/teal, hero animations, glass shells, login redesign
14. **Production deploy** — Neon + Resend wired up, env-var fixes, build whack-a-mole resolved

## 19 · Open questions / known limitations

- **Email domain unverified**. `onboarding@resend.dev` only delivers to the Resend account email. Production is one DNS pass away.
- **No real cron concurrency**. Hobby tier = daily only.
- **Inngest not synced**. The functions are defined but `app.inngest.com` doesn't know about the deploy URL.
- **No Sentry DSN**. Errors land in Vercel logs only.
- **Custom domain not added**. App is on `*.vercel.app`.
- **Bundle size warnings** from `@opentelemetry/instrumentation` (Sentry transitive). Cosmetic, not blocking.
- **Next 14.2.13 has a security advisory**. Upgrade is a sub-day task.
- **`@react-email/components` is in deps but unused**. Could be uninstalled cleanly if you're reducing bundle weight.

## 20 · What an operator usually wants next

In rough priority order — don't do all of these, just the ones that match what they ask for.

- **Verify the Resend domain** so welcome / RSVP / reminder emails actually deliver
- **Onboard a real organiser** — invite via the seeded admin, change passwords, enable MFA
- **Connect a custom domain** — Vercel project settings → Domains
- **Wire Inngest** — sign in to app.inngest.com → sync app, then `INNGEST_EVENT_KEY` activates
- **Enable Zoho** — provide CRM creds, set `ZOHO_ENABLED=true`
- **Field-test with a real event** — create one, send announcement to themselves, watch the RSVP land
- **Upgrade Vercel to Pro** if cron granularity matters

If they don't tell you, **don't pre-emptively** start any of these. The project is at a "show it to a real organiser" stage — feedback should drive the next move.

## 21 · Key files cheat sheet

| File | Role |
| --- | --- |
| `prisma/schema.prisma` | Source of truth for the data model |
| `src/lib/env.ts` | Zod-validated env, with production safety checks |
| `src/lib/auth.ts` | NextAuth config, providers, signIn callback for SSO invite-only |
| `src/lib/rbac.ts` | Capability matrix |
| `src/lib/tokens.ts` + `token-crypto.ts` | HMAC tokens |
| `src/server/members.ts` | Sign-up flow (audit, Zoho sync, welcome email) |
| `src/server/announcements.ts` | Announcement send + scheduling |
| `src/server/reminders.ts` | Reminder dispatcher (idempotent per offset) |
| `src/server/waitlist.ts` | Capacity + auto-promotion logic |
| `src/server/gdpr.ts` | Article 17/20 workflows |
| `src/server/event-series.ts` | Recurring event materialisation |
| `src/server/surveys.ts` | Post-event survey dispatch + question schema |
| `src/inngest/functions.ts` | All durable jobs |
| `src/app/page.tsx` | Landing page |
| `src/app/dashboard/layout.tsx` | Auth gate + nav (`force-dynamic` lives here) |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `vercel.json` | Cron schedules |
| `docs/decisions.md` | Spec §16 decisions, fully reasoned |
| `DEPLOY.md` | Deployment runbook |
| `scripts/preflight.sh` | Post-deploy probe |

## 22 · Quick recipes

### Add a new dashboard page

1. Create `src/app/dashboard/<name>/page.tsx`
2. Use `await requireUser()` (or `requireCapability("foo")`) at the top
3. Add to `BASE_NAV` in `src/app/dashboard/layout.tsx`
4. The `force-dynamic` cascades from the layout — no need to add it per-page

### Add a new Prisma model

1. Edit `prisma/schema.prisma`
2. Hand-write the SQL: `mkdir -p prisma/migrations/<timestamp>_<name> && touch prisma/migrations/<timestamp>_<name>/migration.sql`
3. Apply locally: `DATABASE_URL=... npx prisma migrate deploy`
4. Re-run `npx prisma generate`
5. Don't forget to apply against Neon production (run `prisma migrate deploy` with the prod URL)

### Add a new API route

1. `src/app/api/.../route.ts` exporting `GET` / `POST` etc.
2. Use `getServerSession(authOptions)` if auth-protected
3. Use Zod for body validation
4. Always `audit(...)` mutating ops
5. For long-running work, fire an Inngest event instead of doing it inline

### Add a new email send path

1. Compose in `src/lib/templates.ts` (sync HTML string functions)
2. Call `sendEmail({ to, subject, html })` from `src/lib/email.ts`
3. **Filter recipients by `deletionRequestedAt: null, deletedAt: null`**
4. Filter by `emailConsent: true, emailOptOutAt: null, emailBouncedAt: null`
5. Audit `email.<purpose>.sent` per recipient

### Re-seed production

```bash
DATABASE_URL='<pooled URL with pgbouncer=true>' \
DIRECT_URL='<unpooled URL>' \
npx prisma db seed
```

The seed is idempotent and rewrites the password hashes on conflict — useful when migrating between hashing libs.

## 23 · Glossary

- **Tokenised link** — HMAC-signed URL that grants member-scoped access without a login. Used for RSVP, preferences, unsubscribe, survey, magic-login, ICS calendar feed.
- **`AudienceSpec`** — accepts `"all"` | `"rsvp_yes"` | `"tag:<name>"`. Type lives in `src/server/announcements.ts`.
- **`OrganiserUser` vs `Member`** — completely different tables. Organisers manage; members participate. Their auth flows are unrelated.
- **Inngest "step.run"** — wraps an async operation so it's durable. If it throws, Inngest retries that step alone, not the whole function.
- **Hobby tier** — Vercel's free tier. Daily cron limit, no custom function regions for the build, etc.
- **Magic link** — single-use, 15-min organiser sign-in flow that bypasses the password (useful for forgotten passwords).

## 24 · One-line motto

> **The data model is the spec; the audit log is the source of truth; consent is non-negotiable.**

If you remember nothing else, remember those three.

---

*Last meaningful update: 2026-05-09. The previous Claude session built this project from scratch and deployed it to production. The owner is friendly but tired. Be efficient, be specific, and don't repeat the deploy whack-a-mole — see [§ 15 · Gotchas](#15--gotchas--lessons-from-the-deploy).*
