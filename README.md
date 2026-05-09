# Nexus Northwest Platform

MVP implementation of the Nexus Northwest Functional Specification (v1.2). One Next.js codebase covers both the public landing page (sign-up, RSVP, preference management) and the organiser dashboard (RBAC, events, announcements, members, actions, audit log).

## What's in the box

**Public surface**
- `/` — landing page with name + email + consent form (captures `utm_*` and `ref` from the URL)
- `/welcome` — post-sign-up confirmation
- `/preferences/[token]` — tokenised preference management (no login)
- `/rsvp/[token]?response=yes|no|maybe|cancel` — one-click RSVP
- `/unsubscribe/[token]` — one-click opt-out (single use)
- `/api/events/[id]/calendar` — `.ics` download for the event

**Organiser dashboard** (under `/dashboard`, behind login)
- Overview with member, event and action counts plus sign-up source breakdown
- Events list, create + edit forms, and detail page with RSVP roster + announcement sender + per-event RSVP CSV export
- Members search with consent badges and source attribution; CSV export; clickable detail page with notes/tags/speaker-prospect editing
- Actions module (tasks + speaker/contributor/theme prospects) with inline status + assignee updates and "mark complete"
- Audit log (visible per RBAC)
- Users page (Admin+ only) — invite, role-change, enable/disable, password-reset for manageable roles
- Settings (integration status + organiser users)

**Reminders**
- Cron-style endpoint `POST /api/cron/reminders` (or `GET`) protected by `Authorization: Bearer $CRON_SECRET`
- Idempotent per (event, offset) via the `Reminder` table — safe to fire every minute
- `vercel.json` ships with a Vercel Cron entry every 10 minutes. When `CRON_SECRET` is set in Vercel project env, Vercel automatically adds the bearer header
- Per-event reminder offsets and audience (all / RSVP-Yes-only) configurable in the event form

**Bounce / complaint webhook (`POST /api/webhooks/email`)**
- Verifies in this order: SendGrid Ed25519 signature (`SENDGRID_WEBHOOK_PUBLIC_KEY` set) → Resend Svix HMAC (`RESEND_WEBHOOK_SECRET` set) → fallback `Authorization: Bearer $EMAIL_WEBHOOK_SECRET`
- Replay protection: signed payloads older than 5 minutes are rejected
- Bounces flip `emailBouncedAt`; bounces, complaints, and group-unsubscribes clear `emailConsent` and stamp `emailOptOutAt`

**MFA / two-factor (`/dashboard/settings/mfa`)**
- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) — works with 1Password, Google Authenticator, Authy, etc.
- Self-enrollment with a QR code rendered via `/api/qr`; six-digit confirmation before enabling
- Login form auto-prompts for the code when an account has MFA enrolled
- Disable requires a current TOTP code; every state change is audited
- Strongly recommended for Admin and Super Admin (UI flag highlights this)

**SSO (optional)**
- Google OAuth (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`)
- Microsoft Azure AD / Entra ID (`AZURE_AD_CLIENT_ID` + `AZURE_AD_CLIENT_SECRET` + `AZURE_AD_TENANT_ID`, `common` for multi-tenant)
- Invite-only: SSO sign-in is allowed only when an active `OrganiserUser` already exists for the email — admins must invite first via `/dashboard/users`
- Login page auto-shows provider buttons when keys are present
- Every SSO sign-in is audited

**WhatsApp Business (Cloud API)**
- Direct messaging via Meta Cloud API, gated by `WHATSAPP_ENABLED=true`
- Stub mode (default) records outgoing messages without contacting Meta — flows can be exercised end-to-end
- Approved templates only (default `event_announcement`); template variables are member name, event title, date, location, RSVP-Yes URL — adjust to match your approved template
- `WhatsAppMessage` table tracks every send with provider id (`wamid`), status (queued → sent → delivered → read or failed), and delivery error
- `/api/webhooks/whatsapp` handles Meta's subscription handshake (`GET`), per-message status receipts (`POST`), and STOP / UNSUBSCRIBE keyword opt-outs (clears `whatsappConsent` + audits)
- See `docs/decisions.md` for the recommended rollout

**Operations**
- `GET /api/health` — liveness + readiness (200 only when DB responds; 503 with diagnostics otherwise). Suitable for container orchestrators and uptime monitors
- `/robots.txt` + `/sitemap.xml` — public site indexed; dashboard, API, and tokenised paths blocked

**Product decisions** — see [`docs/decisions.md`](./docs/decisions.md) for the recommendations against spec §16 open questions (Zoho module, email provider, WhatsApp rollout, RSVP options, cancellation, mandatory fields, multi-region scaling)

**Anti-abuse on sign-up**
- Per-IP rate limit (5 attempts / 60 s)
- Pluggable backend: in-memory by default, Redis-backed when `REDIS_URL` is set (ioredis is an optional dep — single-instance setups skip the install)
- Hidden honeypot field — bots that fill it get a 201 with no work done

**Acquisition / reporting (`/dashboard/reports`)**
- Sign-ups per day and per ISO week
- Sign-ups by source with proportional bars
- RSVP conversion per event (sent → Yes %)

**QR + tracked links (`/dashboard/qr`)**
- Build a tracked landing URL from `utm_*` + `ref`
- Live SVG/PNG QR rendered server-side via `/api/qr`

**Attendance (`/dashboard/events/[id]/check-in`)**
- Searchable RSVP roster with check-in / no-show / reset buttons
- Per-event live counts: RSVP-Yes, checked-in, no-show

**Zoho resilience (NFR-005)**
- `ZohoSyncFailure` table records every failed upsert with attempt count and last error
- Sign-up still succeeds even when Zoho is unreachable
- Dashboard banner shows unresolved count and a one-click retry (Super Admin only)
- Successful retry clears the failure record automatically

**Production deploy**
- Multi-stage `Dockerfile` (Next.js standalone, non-root, Prisma engines included)
- `docker-compose.prod.yml` brings up app + Postgres in one command
- Container start runs `prisma migrate deploy` then `node server.js`
- Initial migration is committed under `prisma/migrations/` so a fresh DB is one command away

**Boundaries kept clean**
- `src/lib/zoho.ts` — stubbed Zoho CRM upsert; flip `ZOHO_ENABLED=true` and provide credentials to use real API
- `src/lib/email.ts` — `stub | sendgrid | resend` providers; stub writes `.eml` files to `.mail/`
- `src/lib/tokens.ts` — HMAC-signed tokens with single-use semantics for unsubscribe, reusable for RSVP/preferences
- `src/lib/rbac.ts` — capability matrix matching the spec's RBAC table
- `src/lib/audit.ts` — append-only audit trail for every send, RBAC change, opt-out, etc.

## Roles seeded for development

| Email                           | Password      | Role         |
| ------------------------------- | ------------- | ------------ |
| `admin@nexusnorthwest.local`    | `ChangeMe!123` | SUPER_ADMIN |
| `manager@nexusnorthwest.local`  | `ChangeMe!123` | MANAGER     |
| `viewer@nexusnorthwest.local`   | `ChangeMe!123` | VIEWER      |

Rotate before any deployment.

## Local setup

### 1. Prerequisites

- Node.js 18.18+ or 20+
- Docker (or a local Postgres instance)
- pnpm or npm

### 2. Install

```bash
cd nexus-northwest
cp .env.example .env
# Edit .env: at minimum, set NEXTAUTH_SECRET and TOKEN_SECRET to long random strings.
# Generate with: openssl rand -base64 32
npm install
```

### 3. Start Postgres

```bash
docker compose up -d postgres
```

### 4. Migrate + seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Run

```bash
npm run dev
```

- Public site: <http://localhost:3000>
- Dashboard: <http://localhost:3000/dashboard> (sign in at `/login`)
- Welcome and announcement emails are written as `.eml` files under `./.mail/` while `EMAIL_PROVIDER=stub`

### 6. Try the flows end to end

1. Open `http://localhost:3000/?utm_source=meetup&ref=ABC123`
2. Sign up with a test name and email
3. Open `.mail/<id>.eml` to see the welcome email
4. Sign in to the dashboard, create an event, send an announcement
5. Open the announcement `.eml`, click an RSVP link
6. Refresh the event detail page — you'll see the RSVP

## Configuration reference

See `.env.example` for the full list. Key knobs:

| Var              | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `DATABASE_URL`   | Postgres connection                                            |
| `NEXTAUTH_SECRET`| JWT signing for organiser sessions                             |
| `TOKEN_SECRET`   | HMAC for tokenised RSVP / preferences / unsubscribe links      |
| `EMAIL_PROVIDER` | `stub` (default), `sendgrid`, or `resend`                      |
| `EMAIL_API_KEY`  | Provider API key when not using `stub`                         |
| `CRON_SECRET`    | Bearer token for `/api/cron/reminders`                         |
| `ZOHO_ENABLED`   | `true` enables real Zoho upserts (Leads/Contacts/CustomModule) |
| `ZOHO_*`         | OAuth credentials when `ZOHO_ENABLED=true`                     |
| `WHATSAPP_*`     | Group join links shown in welcome and elsewhere                |

## Architecture

```
src/
├── app/                                  Next.js App Router
│   ├── page.tsx                          Landing page
│   ├── welcome/                          Post-signup confirmation
│   ├── preferences/[token]/              Tokenised preference page
│   ├── rsvp/[token]/                     Tokenised one-click RSVP
│   ├── unsubscribe/[token]/              Single-use opt-out
│   ├── login/                            Organiser sign-in
│   ├── dashboard/                        RBAC-protected dashboard
│   │   ├── layout.tsx                    Auth gate + nav (Users tab visible to Admin+)
│   │   ├── events/                       List, new, [id] detail + announce, [id]/edit
│   │   ├── members/                      Search list, [id] detail with notes/tags edit
│   │   ├── actions/                      Pipeline with inline status + assignee updates
│   │   ├── users/                        Organiser-user management (Admin+)
│   │   ├── audit/                        Audit log table
│   │   └── settings/                     Integration + org users
│   └── api/
│       ├── auth/[...nextauth]/           NextAuth handler
│       ├── signup/                       Public sign-up
│       ├── preferences/[token]/          Save preferences
│       ├── events/[id]/announce/         Send announcement
│       ├── events/[id]/calendar/         .ics download
│       ├── exports/members/              Members CSV
│       ├── exports/events/[id]/rsvps/    Event RSVP CSV
│       └── cron/reminders/               Reminder dispatcher (bearer-auth)
├── lib/
│   ├── auth.ts                           NextAuth configuration
│   ├── db.ts                             Prisma client singleton
│   ├── env.ts                            Zod-validated env vars
│   ├── rbac.ts                           Capability matrix per spec §4
│   ├── session.ts                        currentUser / requireUser / requireCapability
│   ├── tokens.ts                         HMAC-signed token issue/lookup/consume
│   ├── audit.ts                          Append-only audit writes
│   ├── email.ts                          Provider-agnostic sender (stub/sendgrid/resend)
│   ├── templates.ts                      Welcome + announcement HTML templates
│   ├── urls.ts                           rsvpUrl / preferencesUrl / unsubscribeUrl
│   ├── validation.ts                     Zod schemas for inputs
│   └── zoho.ts                           Server-side Zoho upsert (no-op when disabled)
├── server/
│   ├── members.ts                        signupMember orchestration
│   └── announcements.ts                  sendEventAnnouncement orchestration
└── components/ui/                        Button, Field
```

### How it maps to the spec

| Spec section                                         | Implementation                                       |
| ---------------------------------------------------- | ---------------------------------------------------- |
| §6 Member journey: minimal sign-up                   | `src/app/page.tsx`, `src/app/api/signup/route.ts`    |
| §6.3 Progressive profiling (preferences)             | `src/app/preferences/[token]/`                       |
| §7 Communication preferences, consent, unsubscribe   | `preferencesSchema`, `Member.email/whatsappConsent`, `unsubscribe/[token]` |
| §8 Events, announcements, one-click RSVP             | `dashboard/events/*`, `rsvp/[token]/`, `templates.announcementEmail` |
| §8.3 Tokenised RSVP (no login)                       | `src/lib/tokens.ts`                                  |
| §8.4 Reminders                                       | Schema (`Event.reminderOffsets`) — scheduling worker is Phase 2 |
| §4 RBAC                                              | `src/lib/rbac.ts` capability matrix                  |
| §9 Organiser dashboard                               | `src/app/dashboard/`                                 |
| §10 Zoho integration boundary                        | `src/lib/zoho.ts` (stub by default)                  |
| §11 Email + WhatsApp                                 | `src/lib/email.ts`; WhatsApp group links in templates|
| §12 Data model                                       | `prisma/schema.prisma`                               |
| §13 Reporting (basic)                                | Overview cards (sign-ups by source, RSVP counts)     |
| §14 NFRs                                             | Zoho server-side only, RBAC server-checked, audit log on every send/edit, env-validated secrets |

### Phase 2 / not yet built

- Direct WhatsApp Business API messaging (group links cover MVP)
- QR code generator + acquisition dashboards beyond the basic stat
- MFA enforcement + SSO
- LinkedIn enrichment (intentionally deferred — compliance)
- Bounce/STOP keyword webhooks
- Pluggable reminder offsets per event in the UI (schema already supports it; only the default is exposed)

## Scripts

```bash
npm run dev          # next dev
npm run build        # next build
npm run start        # next start
npm run typecheck    # tsc --noEmit
npm test             # vitest run (unit tests)
npm run test:watch   # vitest in watch mode
npm run db:migrate   # prisma migrate dev
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio
```

## CI

`.github/workflows/ci.yml` runs two jobs on every PR and push to main:

1. **`validate`** — `prisma generate` + `prisma validate` + `npm run typecheck` + `npm test` + `npm run build`
2. **`integration`** — spins a real Postgres service, runs `prisma migrate deploy`, then `npm run test:integration` against the DB (sign-up flow, welcome-email side effect, token round-trip, idempotent dedupe)

All steps run with placeholder env vars defined in the workflow — no real secrets needed for CI.

## Notes

- Audit-log writes are wrapped in try/catch so a transient DB blip can't break a sign-up. Failures are logged.
- Sign-up dedupes by email; repeat sign-ups update the record without sending another welcome email.
- RSVP enforces capacity only when `Event.capacity` is set.
- `consent: true` is required by the schema — sign-up cannot succeed otherwise.
- Tokens are HMAC-signed with `TOKEN_SECRET`; rotate it to invalidate every outstanding link.
