import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { announcementEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { rsvpUrl, preferencesUrl, unsubscribeUrl } from "@/lib/urls";

interface DispatchResult {
  scanned: number;
  fired: Array<{ eventId: string; offsetMinutes: number; recipientCount: number; failedCount: number }>;
}

const DEFAULT_AUDIENCE: "all" | "rsvp_yes" = "all";

export async function dispatchDueReminders(now: Date = new Date()): Promise<DispatchResult> {
  // Find events starting within the maximum offset window we care about.
  // We pull events whose start is in the future but within the largest
  // reminderOffsets minute window (default 7 days).
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      rsvpEnabled: true,
      startsAt: { gte: now, lte: horizon }
    },
    include: { reminders: true }
  });

  const fired: DispatchResult["fired"] = [];

  for (const event of events) {
    const minsUntilStart = Math.floor((event.startsAt.getTime() - now.getTime()) / 60_000);

    for (const offset of event.reminderOffsets) {
      // Reminder is due once minsUntilStart <= offset (i.e. we're within the
      // configured window) and we haven't already fired this offset.
      if (minsUntilStart > offset) continue;
      const already = event.reminders.find((r) => r.offsetMinutes === offset);
      if (already) continue;

      const result = await fireReminder(event.id, offset, DEFAULT_AUDIENCE);
      fired.push({ eventId: event.id, offsetMinutes: offset, ...result });
    }
  }

  return { scanned: events.length, fired };
}

async function fireReminder(
  eventId: string,
  offsetMinutes: number,
  audience: "all" | "rsvp_yes"
): Promise<{ recipientCount: number; failedCount: number }> {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });

  const recipients = await prisma.member.findMany({
    where: {
      emailConsent: true,
      emailOptOutAt: null,
      ...(audience === "rsvp_yes"
        ? { rsvps: { some: { eventId, status: "YES" } } }
        : {})
    }
  });

  // Idempotency guard: race-safe via unique (eventId, offsetMinutes).
  let reminder;
  try {
    reminder = await prisma.reminder.create({
      data: {
        eventId,
        offsetMinutes,
        audience
      }
    });
  } catch {
    // Another worker fired it.
    return { recipientCount: 0, failedCount: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const member of recipients) {
    try {
      const rsvpToken = await issueToken({ memberId: member.id, purpose: "RSVP", eventId });
      const prefToken = await issueToken({ memberId: member.id, purpose: "PREFERENCES" });
      const unsubToken = await issueToken({ memberId: member.id, purpose: "UNSUBSCRIBE" });

      const tmpl = announcementEmail({
        memberName: member.name,
        eventTitle: `Reminder: ${event.title}`,
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
      console.error("reminder send failed", { email: member.email, err });
    }
  }

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { recipientCount: sent, meta: { failed, total: recipients.length } }
  });

  await audit({
    action: "reminder.dispatched",
    channel: "email",
    meta: { eventId, offsetMinutes, audience, sent, failed }
  });

  return { recipientCount: sent, failedCount: failed };
}
