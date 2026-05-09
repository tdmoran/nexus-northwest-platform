# Open product decisions

These are recommendations against the seven open questions in §16 of the spec. Each one explains the trade-off and what the current code assumes — change the assumption in the code if the decision goes the other way.

---

## 1. Should Zoho store members as Leads, Contacts, or a dedicated custom module?

**Recommendation: Contacts.**

- A community member is not a sales lead. Leads carry sales-pipeline semantics (status, source, owner, conversion to opportunity) that don't map cleanly to "person who joined a meet-up". Using Leads forces you to ignore half the module's UX or repurpose fields and confuses future Zoho admins.
- Contacts are designed for ongoing relationships. They support custom fields, tags, deduplication on email, and integrate with Zoho Campaigns / Marketing Automation for free.
- A dedicated custom module is overkill for the current scale (hundreds of members) and adds permission and reporting complexity without obvious upside.
- If you outgrow Contacts (e.g., need multi-chapter scoping, complex per-member workflows, or a separate "active vs inactive" lifecycle), the migration to a custom module is mechanical.

**What the code assumes:** `ZOHO_MODULE` defaults to `Leads` in `.env.example` only because that's Zoho's default upsert target. Change to `Contacts` once a Zoho admin confirms the contact module has the custom fields the spec lists (Preferred_Communication, WhatsApp_Number, etc.). Field mapping lives in `src/lib/zoho.ts` (`toZohoRecord`).

---

## 2. What email delivery mechanism (Zoho Campaigns vs SendGrid vs Resend vs Mailgun)?

**Recommendation: Resend for transactional + Zoho Campaigns for newsletters (if you ever start sending them).**

- Resend has the cleanest API, modern HTML email tooling (React Email), and Svix-signed webhooks for bounces. It excels at *transactional* mail (welcome, RSVP confirmation, reminders) — which is what this platform sends.
- SendGrid is a fine alternative — equivalent API, slightly more legacy. Both are already wired in `src/lib/email.ts`. Pick whichever your team has experience with.
- Zoho Campaigns is a *marketing* tool. Per-event reminders are not marketing campaigns; they are event operations. Don't squeeze them through a campaign tool — you'll lose individual deliverability tracking and pay for features you don't need.
- Mailgun is functionally similar to SendGrid; choose it only if you already have a Mailgun account.

**What the code assumes:** `EMAIL_PROVIDER` env var with `stub | sendgrid | resend`. Set to `resend` and provide `EMAIL_API_KEY`. For bounce webhooks, set `RESEND_WEBHOOK_SECRET` (or `SENDGRID_WEBHOOK_PUBLIC_KEY`).

---

## 3. WhatsApp approach for MVP: groups only, or provider integration?

**Recommendation: Groups for MVP, Cloud API ready for activation when needed.**

- Group join links cost zero, require zero compliance work, and meet the immediate need: "tell me when the next event is on". Members already have WhatsApp open; groups are a behavioural fit.
- Direct WhatsApp Business Cloud API is now wired in (`src/lib/whatsapp.ts`, the `WhatsAppMessage` model, webhook handler) but defaults to disabled. Switch on with `WHATSAPP_ENABLED=true` once you have:
  - A verified Meta Business account
  - An approved message template (e.g. `event_announcement`) in Meta Business Manager — match the variable order in `deliverWhatsApp` in `src/server/announcements.ts`
  - A reasonable opt-in flow (already supported via the preferences page)
- The compliance burden of direct messaging — explicit opt-in audit trail, 24-hour conversation windows, template approval, STOP keyword handling — is real but already built. The barrier to switching is now Meta's onboarding, not engineering.

**What the code assumes:** Groups via `WHATSAPP_BROADCAST_GROUP_URL` / `WHATSAPP_DISCUSSION_GROUP_URL` rendered in the welcome email. Cloud API is `WHATSAPP_ENABLED=false`. STOP keyword opt-out is honoured via `/api/webhooks/whatsapp` once enabled.

---

## 4. Do organisers want RSVP No / Maybe options in MVP, or only Yes?

**Recommendation: Yes, No, and Maybe.**

- All three are already implemented and zero-cost. Removing options after the fact would be more work than supporting them.
- "Maybe" is operationally useful: organisers planning catering or seating can size to `Yes + 0.5 × Maybe` rather than guessing. The reports page already counts each separately.
- "No" reduces noise — if a member explicitly declines, reminders shouldn't keep nagging. The Reminder dispatcher respects RSVP-Yes filtering already.
- Cost: one extra row on the email template, one extra column in the RSVP report. Low.

**What the code assumes:** All three buttons render in the announcement email. The RSVP page accepts `?response=yes|no|maybe|cancel`. Reports treat each status independently.

---

## 5. RSVP cancellation policy (in-message vs confirmation page only)?

**Recommendation: Confirmation page only.**

- A "Cancel my RSVP" button in every email is a footgun: an unread email a week before the event with a stray click cancels someone's place. The misclick rate compounds over a hundred-member list.
- The confirmation page already includes a "Cancel my RSVP" link, which is the right place — the member is on the page deliberately, has just confirmed they intended to RSVP, and can change their mind in-context.
- If a member needs to cancel later, the same tokenised link still works (RSVP tokens are reusable) — they just open the original email and click "RSVP No" or "Cancel".

**What the code assumes:** The confirmation page (`/rsvp/[token]`) shows a "Cancel my RSVP" link; emails do not include a separate "cancel" button. Re-clicking a different status overwrites the RSVP cleanly.

---

## 6. Mandatory fields beyond Name / Email?

**Recommendation: None. Hold the line on the two-field policy.**

- Every additional mandatory field reduces conversion. Industry data on community sign-ups suggests 5–10% drop per added required field.
- Spec §6.2 explicitly mandates Name + Email + consent only — this isn't an oversight; it's a design choice.
- The progressive-profiling flow (§6.3) already collects everything else *after* the member is invested, when they're far more likely to complete it.
- The one exception worth considering: "Where did you hear about us?" as a *required* dropdown — but you already capture this passively via UTM/referral codes, which is more accurate than self-report. Don't add the field.

**What the code assumes:** Sign-up validates Name + Email + consent only. Phone, company, LinkedIn, and WhatsApp number are collected on the preferences page (post-confirmation).

---

## 7. Multi-region scalability (chapters beyond Nexus Northwest)?

**Recommendation: Not now. Refactor to multi-tenant only when you have a second chapter ready to onboard.**

- The platform is currently a single-tenant app: one members table, one events table, one set of organiser users. That's the right shape for now.
- Adding tenancy now would require: a `Chapter` model, FK from every business model, organiser users scoped to chapters, RBAC scoped to chapters, separate landing pages per chapter, separate email-from addresses, separate Zoho modules — at least a week of careful refactor.
- The right time to do that work is when the business case is concrete (someone says "we want to launch Nexus Galway in March"), not pre-emptively. Doing it speculatively almost always produces wrong abstractions.
- The data model migration is straightforward: add `chapterId` to `Member`, `Event`, `OrganiserUser`, etc.; backfill all rows to the original chapter; gate every query by chapter. Nothing in the current schema makes this hard later.

**What the code assumes:** Single chapter. Site name comes from `NEXT_PUBLIC_SITE_NAME`. Switch to multi-tenant only when there's a real second chapter to support.

---

## Bonus: LinkedIn enrichment is an explicit non-goal

The spec mentions LinkedIn URLs and profile pictures as optional fields, with a note that automatic enrichment is "best-effort/phase-2". After review, **LinkedIn enrichment is permanently deferred** unless requirements change.

Why:

- **Terms of service.** LinkedIn's User Agreement explicitly prohibits scraping and most forms of automated data extraction. The 2022 *hiQ Labs v. LinkedIn* ruling found that LinkedIn could ban scrapers under the CFAA, and the case settled with hiQ permanently barred from scraping.
- **GDPR risk.** Scraping public profiles for an EU community may not survive a Schrems-style data-minimisation challenge. The lawful basis is unclear: legitimate interest is contestable, and "consent" can't be inferred from a public profile.
- **Reliability.** LinkedIn aggressively rate-limits and CAPTCHA-walls automated traffic. Even where legally permissible, scraping breaks weekly.
- **Member-supplied is sufficient.** The progressive-profiling flow already prompts members to add a LinkedIn URL on the preferences page. Members who want to share, share. Members who don't, don't.

If a future requirement specifically calls for it (e.g., a Sales Navigator-style enrichment for paid-tier members), use **LinkedIn's official APIs** with a partnership agreement, not scraping. Add a `LinkedInEnrichment` model and a separate worker; do not put it in the sign-up path.

**Status:** Not implemented. No issue logged. Revisit only if the product team explicitly asks for it.

---

## Summary table

| §16 question | Recommendation |
| --- | --- |
| Zoho module | Contacts |
| Email provider | Resend (transactional) |
| WhatsApp MVP | Groups now; Cloud API wired and gated by `WHATSAPP_ENABLED` |
| RSVP options | Yes, No, Maybe |
| Cancellation | Confirmation page only (no in-email cancel button) |
| Mandatory fields | Name + Email + consent. No more. |
| Multi-region | Defer until a real second chapter is queued |
| LinkedIn enrichment | Permanently deferred — ToS + GDPR + reliability |
