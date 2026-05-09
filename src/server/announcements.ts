import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { announcementEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { rsvpUrl, preferencesUrl, unsubscribeUrl } from "@/lib/urls";
import { Channel, AnnouncementStatus, type Member } from "@prisma/client";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { inngest } from "@/inngest/client";

export interface SendAnnouncementInput {
  eventId: string;
  audience: "all" | "rsvp_yes";
  channel: Channel;
  actorId: string;
  scheduledFor?: Date | null;   // when set, the announcement is queued for later
}

/**
 * Schedules an announcement for future dispatch. Records the recipient count
 * at scheduling time as an estimate; the actual recipients are re-selected at
 * fire time so opt-outs and new sign-ups in the interim are honoured.
 */
export async function scheduleEventAnnouncement(input: SendAnnouncementInput & {
  scheduledFor: Date;
}): Promise<{ announcementId: string; estimatedRecipients: number }> {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: input.eventId } });
  if (input.scheduledFor.getTime() <= Date.now()) {
    throw new Error("Scheduled time must be in the future");
  }
  if (event.startsAt.getTime() < input.scheduledFor.getTime()) {
    throw new Error("Cannot schedule an announcement after the event has started");
  }

  const recipients = await selectRecipients(event.id, input.channel, input.audience);

  const announcement = await prisma.announcement.create({
    data: {
      eventId: event.id,
      channel: input.channel,
      subject: event.title,
      body: event.description,
      audienceTag: input.audience,
      sentById: input.actorId,
      status: AnnouncementStatus.SCHEDULED,
      scheduledFor: input.scheduledFor,
      meta: { estimatedRecipients: recipients.length }
    }
  });

  await audit({
    action: "announcement.scheduled",
    actorId: input.actorId,
    channel: input.channel.toLowerCase(),
    meta: {
      announcementId: announcement.id,
      eventId: event.id,
      audience: input.audience,
      scheduledFor: input.scheduledFor.toISOString(),
      estimatedRecipients: recipients.length
    }
  });

  return { announcementId: announcement.id, estimatedRecipients: recipients.length };
}

/**
 * Cancels a SCHEDULED announcement. Returns true if cancelled, false if it
 * had already moved past the SCHEDULED state.
 */
export async function cancelScheduledAnnouncement(
  announcementId: string,
  actorId: string
): Promise<boolean> {
  const result = await prisma.announcement.updateMany({
    where: { id: announcementId, status: AnnouncementStatus.SCHEDULED },
    data: { status: AnnouncementStatus.CANCELLED }
  });
  if (result.count > 0) {
    await audit({
      action: "announcement.cancelled",
      actorId,
      meta: { announcementId }
    });
    return true;
  }
  return false;
}

/**
 * Fires every SCHEDULED announcement whose scheduledFor is in the past.
 * Returns the count of announcements moved to QUEUED. Designed to be called
 * by the Inngest cron or a Vercel Cron job.
 */
export async function dispatchDueScheduledAnnouncements(): Promise<{ fired: number }> {
  const due = await prisma.announcement.findMany({
    where: {
      status: AnnouncementStatus.SCHEDULED,
      scheduledFor: { lte: new Date() }
    },
    take: 50
  });

  for (const a of due) {
    if (!a.eventId) continue;
    // Re-resolve recipients now so we honour any opt-outs since scheduling.
    const recipients = await selectRecipients(a.eventId, a.channel, (a.audienceTag ?? "all") as "all" | "rsvp_yes");

    await prisma.announcement.update({
      where: { id: a.id },
      data: { status: AnnouncementStatus.QUEUED }
    });

    if (env.INNGEST_EVENT_KEY) {
      await inngest.send({
        name: "announcement/dispatch",
        data: {
          announcementId: a.id,
          eventId: a.eventId,
          memberIds: recipients.map((m) => m.id),
          channel: a.channel,
          actorId: a.sentById ?? "system"
        }
      });
    } else {
      // Synchronous fallback: deliver inline.
      const ev = await prisma.event.findUniqueOrThrow({ where: { id: a.eventId } });
      let sent = 0;
      let failed = 0;
      for (const m of recipients) {
        const ok =
          a.channel === Channel.EMAIL
            ? await deliverEmail(m, ev, a.id, a.sentById ?? "system")
            : await deliverWhatsApp(m, ev, a.id, a.sentById ?? "system");
        if (ok) sent++;
        else failed++;
      }
      await prisma.announcement.update({
        where: { id: a.id },
        data: {
          status: failed === 0 ? AnnouncementStatus.SENT : AnnouncementStatus.FAILED,
          sentAt: new Date(),
          recipientCount: sent,
          meta: { sent, failed, total: recipients.length }
        }
      });
    }
  }

  return { fired: due.length };
}

export async function sendEventAnnouncement(input: SendAnnouncementInput): Promise<{
  announcementId: string;
  recipientCount: number;
  failedCount: number;
  queued?: boolean;
}> {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: input.eventId } });

  const recipients = await selectRecipients(event.id, input.channel, input.audience);

  const announcement = await prisma.announcement.create({
    data: {
      eventId: event.id,
      channel: input.channel,
      subject: event.title,
      body: event.description,
      audienceTag: input.audience,
      sentById: input.actorId,
      status: AnnouncementStatus.QUEUED
    }
  });

  // When Inngest is wired up, hand the work off durably and return immediately.
  // The dashboard polls Announcement.status to see SENT / FAILED.
  if (env.INNGEST_EVENT_KEY) {
    await inngest.send({
      name: "announcement/dispatch",
      data: {
        announcementId: announcement.id,
        eventId: event.id,
        memberIds: recipients.map((m) => m.id),
        channel: input.channel,
        actorId: input.actorId
      }
    });
    return {
      announcementId: announcement.id,
      recipientCount: recipients.length,
      failedCount: 0,
      queued: true
    };
  }

  // Synchronous fallback (dev/test or single-instance without Inngest).
  let sent = 0;
  let failed = 0;

  for (const member of recipients) {
    const ok =
      input.channel === Channel.EMAIL
        ? await deliverEmail(member, event, announcement.id, input.actorId)
        : await deliverWhatsApp(member, event, announcement.id, input.actorId);
    if (ok) sent++;
    else failed++;
  }

  const status = failed === 0 ? AnnouncementStatus.SENT : AnnouncementStatus.FAILED;

  await prisma.announcement.update({
    where: { id: announcement.id },
    data: {
      status,
      sentAt: new Date(),
      recipientCount: sent,
      meta: { sent, failed, total: recipients.length }
    }
  });

  await audit({
    action: "announcement.send",
    actorId: input.actorId,
    channel: input.channel.toLowerCase(),
    meta: {
      announcementId: announcement.id,
      eventId: event.id,
      audience: input.audience,
      sent,
      failed
    }
  });

  return { announcementId: announcement.id, recipientCount: sent, failedCount: failed };
}

async function selectRecipients(
  eventId: string,
  channel: Channel,
  audience: "all" | "rsvp_yes"
): Promise<Member[]> {
  const audienceFilter =
    audience === "rsvp_yes" ? { rsvps: { some: { eventId, status: "YES" as const } } } : {};

  if (channel === Channel.EMAIL) {
    return prisma.member.findMany({
      where: { emailConsent: true, emailOptOutAt: null, emailBouncedAt: null, ...audienceFilter }
    });
  }
  // WhatsApp: must have consented + given a number.
  return prisma.member.findMany({
    where: {
      whatsappConsent: true,
      whatsappOptOutAt: null,
      OR: [{ whatsappNumber: { not: null } }, { phone: { not: null } }],
      ...audienceFilter
    }
  });
}

async function deliverEmail(
  member: Member,
  event: { id: string; title: string; description: string; startsAt: Date; location: string; timezone: string; heroImageUrl: string | null },
  announcementId: string,
  actorId: string
): Promise<boolean> {
  try {
    const rsvpToken = await issueToken({ memberId: member.id, purpose: "RSVP", eventId: event.id });
    const prefToken = await issueToken({ memberId: member.id, purpose: "PREFERENCES" });
    const unsubToken = await issueToken({ memberId: member.id, purpose: "UNSUBSCRIBE" });

    const tmpl = announcementEmail({
      memberName: member.name,
      eventTitle: event.title,
      eventDate: event.startsAt.toLocaleString("en-IE", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: event.timezone
      }),
      eventLocation: event.location,
      description: event.description,
      rsvpYesUrl: rsvpUrl(rsvpToken, "yes"),
      rsvpNoUrl: rsvpUrl(rsvpToken, "no"),
      rsvpMaybeUrl: rsvpUrl(rsvpToken, "maybe"),
      preferencesUrl: preferencesUrl(prefToken),
      unsubscribeUrl: unsubscribeUrl(unsubToken),
      heroImageUrl: event.heroImageUrl
    });
    await sendEmail({ to: member.email, subject: tmpl.subject, html: tmpl.html });
    return true;
  } catch (err) {
    log.error("announcement.email.failed", { email: member.email, err: String(err) });
    await audit({
      action: "announcement.send.member.failed",
      actorId,
      memberId: member.id,
      channel: "email",
      meta: { error: (err as Error).message, announcementId }
    });
    return false;
  }
}

async function deliverWhatsApp(
  member: Member,
  event: { id: string; title: string; description: string; startsAt: Date; location: string; timezone: string },
  announcementId: string,
  actorId: string
): Promise<boolean> {
  const phone = member.whatsappNumber ?? member.phone;
  if (!phone) {
    log.warn("announcement.whatsapp.skip_no_phone", { memberId: member.id });
    return false;
  }

  const rsvpToken = await issueToken({ memberId: member.id, purpose: "RSVP", eventId: event.id });
  const variables = [
    member.name,
    event.title,
    event.startsAt.toLocaleString("en-IE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: event.timezone
    }),
    event.location,
    rsvpUrl(rsvpToken, "yes")
  ];

  const message = await prisma.whatsAppMessage.create({
    data: {
      memberId: member.id,
      toPhone: phone,
      templateName: undefined,
      variables: variables as unknown as object
    }
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
  await audit({
    action: "announcement.send.member.failed",
    actorId,
    memberId: member.id,
    channel: "whatsapp",
    meta: { error: result.error, announcementId }
  });
  return false;
}
