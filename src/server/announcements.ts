import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { announcementEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { rsvpUrl, preferencesUrl, unsubscribeUrl } from "@/lib/urls";
import { Channel, AnnouncementStatus } from "@prisma/client";

export interface SendAnnouncementInput {
  eventId: string;
  audience: "all" | "rsvp_yes";
  actorId: string;
}

export async function sendEventAnnouncement(input: SendAnnouncementInput): Promise<{
  announcementId: string;
  recipientCount: number;
  failedCount: number;
}> {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: input.eventId } });

  const recipients = await prisma.member.findMany({
    where: {
      emailConsent: true,
      emailOptOutAt: null,
      ...(input.audience === "rsvp_yes"
        ? { rsvps: { some: { eventId: event.id, status: "YES" } } }
        : {})
    }
  });

  const announcement = await prisma.announcement.create({
    data: {
      eventId: event.id,
      channel: Channel.EMAIL,
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
    try {
      const rsvpToken = await issueToken({
        memberId: member.id,
        purpose: "RSVP",
        eventId: event.id
      });
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
      sent++;
    } catch (err) {
      failed++;
      console.error(`announcement send failed for ${member.email}`, err);
      await audit({
        action: "announcement.send.member.failed",
        actorId: input.actorId,
        memberId: member.id,
        channel: "email",
        meta: { error: (err as Error).message, announcementId: announcement.id }
      });
    }
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
    channel: "email",
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
