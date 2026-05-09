import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { announcementEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { rsvpUrl, preferencesUrl, unsubscribeUrl } from "@/lib/urls";
import { Channel, AnnouncementStatus, type Member } from "@prisma/client";
import { log } from "@/lib/logger";

export interface SendAnnouncementInput {
  eventId: string;
  audience: "all" | "rsvp_yes";
  channel: Channel;
  actorId: string;
}

export async function sendEventAnnouncement(input: SendAnnouncementInput): Promise<{
  announcementId: string;
  recipientCount: number;
  failedCount: number;
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
