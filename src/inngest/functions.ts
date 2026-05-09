// Durable background jobs.
//
// Design principles:
// - Each job uses step.run() so individual operations are durable: a transient
//   failure retries that step only, not the whole job.
// - Jobs are idempotent — re-running them produces the same end state.
// - Service code in src/server/* and src/lib/* stays plain and synchronous;
//   Inngest is purely the wrapper.

import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { syncMember } from "@/lib/zoho";
import { welcomeEmail, announcementEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { rsvpUrl, preferencesUrl, unsubscribeUrl } from "@/lib/urls";
import { dispatchDueReminders } from "@/server/reminders";
import { dispatchDueScheduledAnnouncements } from "@/server/announcements";
import { processExpiredDeletions } from "@/server/gdpr";
import { materialiseSeriesOccurrences } from "@/server/event-series";
import { dispatchPostEventSurveys } from "@/server/surveys";
import { AnnouncementStatus } from "@prisma/client";

// ----------------------------- Welcome email --------------------------------

export const sendWelcomeEmail = inngest.createFunction(
  { id: "member-welcome-email", retries: 5 },
  { event: "member/welcome.send" },
  async ({ event, step }) => {
    const { memberId } = event.data;

    const member = await step.run("load-member", async () => {
      const m = await prisma.member.findUnique({ where: { id: memberId } });
      if (!m) throw new NonRetriableError(`Member ${memberId} not found`);
      return m;
    });

    if (!member.emailConsent || member.emailOptOutAt) {
      return { skipped: "no_consent" };
    }

    const tokens = await step.run("issue-tokens", async () => {
      const pref = await issueToken({ memberId: member.id, purpose: "PREFERENCES" });
      const unsub = await issueToken({ memberId: member.id, purpose: "UNSUBSCRIBE" });
      return { pref, unsub };
    });

    await step.run("send", async () => {
      const tmpl = welcomeEmail({
        name: member.name,
        preferencesUrl: preferencesUrl(tokens.pref),
        unsubscribeUrl: unsubscribeUrl(tokens.unsub)
      });
      await sendEmail({ to: member.email, subject: tmpl.subject, html: tmpl.html });
    });

    await step.run("audit", () =>
      audit({ action: "email.welcome.sent", memberId: member.id, channel: "email" })
    );

    return { ok: true, memberId };
  }
);

// ----------------------------- Zoho sync ------------------------------------

export const syncMemberToZoho = inngest.createFunction(
  {
    id: "zoho-member-sync",
    // Zoho rate limits per integration: cap concurrency hard.
    concurrency: { limit: 5 },
    retries: 8 // exponential backoff up to ~hours
  },
  { event: "zoho/member.sync" },
  async ({ event, step }) => {
    const { memberId } = event.data;

    const member = await step.run("load-member", async () => {
      const m = await prisma.member.findUnique({ where: { id: memberId } });
      if (!m) throw new NonRetriableError(`Member ${memberId} not found`);
      return m;
    });

    const result = await step.run("upsert-zoho", () =>
      syncMember({
        email: member.email,
        name: member.name,
        company: member.company,
        phone: member.phone,
        whatsappNumber: member.whatsappNumber,
        signalHandle: member.signalHandle,
        linkedinUrl: member.linkedinUrl,
        preferredChannel: member.preferredChannel,
        emailConsent: member.emailConsent,
        whatsappConsent: member.whatsappConsent,
        utmSource: member.utmSource,
        utmMedium: member.utmMedium,
        utmCampaign: member.utmCampaign,
        utmContent: member.utmContent,
        referralCode: member.referralCode
      })
    );

    if (result.skipped) {
      return { skipped: "zoho_disabled" };
    }

    if (result.error) {
      // Persist for visibility; throwing causes Inngest to retry with backoff.
      await step.run("record-failure", async () => {
        await prisma.zohoSyncFailure.upsert({
          where: { memberId: member.id },
          update: { attempts: { increment: 1 }, lastError: result.error!, resolvedAt: null },
          create: { memberId: member.id, attempts: 1, lastError: result.error! }
        });
      });
      throw new Error(`Zoho upsert failed: ${result.error}`);
    }

    await step.run("persist-success", async () => {
      if (result.zohoId && result.zohoId !== member.zohoId) {
        await prisma.member.update({
          where: { id: member.id },
          data: { zohoId: result.zohoId }
        });
      }
      await prisma.zohoSyncFailure.updateMany({
        where: { memberId: member.id, resolvedAt: null },
        data: { resolvedAt: new Date() }
      });
    });

    return { ok: true, zohoId: result.zohoId };
  }
);

// ----------------------------- Reminders cron -------------------------------

export const remindersCron = inngest.createFunction(
  { id: "reminders-cron", retries: 3 },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    return step.run("dispatch", () => dispatchDueReminders());
  }
);

// ------------------------ Scheduled announcements cron ---------------------

export const scheduledAnnouncementsCron = inngest.createFunction(
  { id: "scheduled-announcements-cron", retries: 3 },
  { cron: "*/2 * * * *" }, // every 2 minutes — scheduling granularity
  async ({ step }) => {
    return step.run("dispatch-due", () => dispatchDueScheduledAnnouncements());
  }
);

export const gdprDeletionCron = inngest.createFunction(
  { id: "gdpr-deletion-cron", retries: 3 },
  { cron: "0 3 * * *" }, // daily 03:00 — low-traffic window
  async ({ step }) => {
    return step.run("process-expired", () => processExpiredDeletions());
  }
);

export const eventSeriesCron = inngest.createFunction(
  { id: "event-series-cron", retries: 3 },
  { cron: "0 */6 * * *" }, // every 6 hours
  async ({ step }) => {
    return step.run("materialise", () => materialiseSeriesOccurrences());
  }
);

export const surveyDispatchCron = inngest.createFunction(
  { id: "survey-dispatch-cron", retries: 3 },
  { cron: "0 * * * *" }, // hourly
  async ({ step }) => {
    return step.run("dispatch", () => dispatchPostEventSurveys());
  }
);

// ----------------------------- Announcement dispatch -----------------------
// Per-recipient delivery is its own retryable step. Aggregate counts roll up
// into the Announcement record.

export const dispatchAnnouncement = inngest.createFunction(
  {
    id: "announcement-dispatch",
    retries: 3,
    // Throttle to keep email/WhatsApp providers happy.
    concurrency: { limit: 10 }
  },
  { event: "announcement/dispatch" },
  async ({ event, step }) => {
    const { announcementId, eventId, memberIds, channel, actorId } = event.data;

    const target = await step.run("load-event", async () => {
      const e = await prisma.event.findUnique({ where: { id: eventId } });
      if (!e) throw new NonRetriableError(`Event ${eventId} not found`);
      return e;
    });

    let sent = 0;
    let failed = 0;

    for (const memberId of memberIds) {
      const ok = await step.run(`send-${memberId}`, async () => {
        const member = await prisma.member.findUnique({ where: { id: memberId } });
        if (!member) return false;
        if (channel === "EMAIL") return deliverOneEmail(member, target);
        return deliverOneWhatsApp(member, target);
      });
      if (ok) sent++;
      else failed++;
    }

    await step.run("finalise", async () => {
      const status = failed === 0 ? AnnouncementStatus.SENT : AnnouncementStatus.FAILED;
      await prisma.announcement.update({
        where: { id: announcementId },
        data: {
          status,
          sentAt: new Date(),
          recipientCount: sent,
          meta: { sent, failed, total: memberIds.length }
        }
      });
      await audit({
        action: "announcement.send",
        actorId,
        channel: channel.toLowerCase(),
        meta: { announcementId, eventId, sent, failed, total: memberIds.length }
      });
    });

    return { announcementId, sent, failed };
  }
);

async function deliverOneEmail(
  member: { id: string; email: string; name: string },
  ev: {
    id: string;
    title: string;
    description: string;
    startsAt: Date;
    location: string;
    timezone: string;
    heroImageUrl: string | null;
  }
): Promise<boolean> {
  try {
    const rsvpToken = await issueToken({ memberId: member.id, purpose: "RSVP", eventId: ev.id });
    const prefToken = await issueToken({ memberId: member.id, purpose: "PREFERENCES" });
    const unsubToken = await issueToken({ memberId: member.id, purpose: "UNSUBSCRIBE" });

    const tmpl = announcementEmail({
      memberName: member.name,
      eventTitle: ev.title,
      eventDate: ev.startsAt.toLocaleString("en-IE", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: ev.timezone
      }),
      eventLocation: ev.location,
      description: ev.description,
      rsvpYesUrl: rsvpUrl(rsvpToken, "yes"),
      rsvpNoUrl: rsvpUrl(rsvpToken, "no"),
      rsvpMaybeUrl: rsvpUrl(rsvpToken, "maybe"),
      preferencesUrl: preferencesUrl(prefToken),
      unsubscribeUrl: unsubscribeUrl(unsubToken),
      heroImageUrl: ev.heroImageUrl
    });
    await sendEmail({ to: member.email, subject: tmpl.subject, html: tmpl.html });
    return true;
  } catch {
    return false;
  }
}

async function deliverOneWhatsApp(
  member: { id: string; name: string; whatsappNumber: string | null; phone: string | null },
  ev: { id: string; title: string; description: string; startsAt: Date; location: string; timezone: string }
): Promise<boolean> {
  const phone = member.whatsappNumber ?? member.phone;
  if (!phone) return false;

  const rsvpToken = await issueToken({ memberId: member.id, purpose: "RSVP", eventId: ev.id });
  const variables = [
    member.name,
    ev.title,
    ev.startsAt.toLocaleString("en-IE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: ev.timezone
    }),
    ev.location,
    rsvpUrl(rsvpToken, "yes")
  ];

  const message = await prisma.whatsAppMessage.create({
    data: { memberId: member.id, toPhone: phone, variables: variables as unknown as object }
  });
  const result = await sendWhatsAppTemplate({ toPhone: phone, variables });

  if (result.ok) {
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: result.skipped ? "QUEUED" : "SENT",
        providerId: result.providerId,
        sentAt: result.skipped ? null : new Date()
      }
    });
    return true;
  }
  await prisma.whatsAppMessage.update({
    where: { id: message.id },
    data: { status: "FAILED", errorMessage: result.error ?? null }
  });
  return false;
}

export const allFunctions = [
  sendWelcomeEmail,
  syncMemberToZoho,
  remindersCron,
  scheduledAnnouncementsCron,
  gdprDeletionCron,
  eventSeriesCron,
  surveyDispatchCron,
  dispatchAnnouncement
];
