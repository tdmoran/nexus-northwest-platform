// Capacity waitlist + auto-promotion.
//
// Flow:
// - When a member RSVPs YES and the event is at capacity, status is set to
//   WAITLISTED with waitlistedAt = now() so order is deterministic.
// - When a YES RSVP is cancelled (or flipped to NO/MAYBE), promote the oldest
//   WAITLISTED member to YES, set promotedAt = now(), and email them.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { issueToken } from "@/lib/tokens";
import { rsvpUrl, preferencesUrl, unsubscribeUrl } from "@/lib/urls";
import { announcementEmail } from "@/lib/templates";
import { log } from "@/lib/logger";
import { RSVPStatus, type Event, type Member } from "@prisma/client";

export interface RsvpDecision {
  status: RSVPStatus;
  channel?: string;
}

/**
 * Apply an RSVP decision honouring capacity. Returns the final status
 * actually written (which may be WAITLISTED if YES is requested at capacity).
 */
export async function applyRsvpDecision(
  event: Event,
  member: Member,
  decision: RsvpDecision
): Promise<{ status: RSVPStatus }> {
  const existing = await prisma.rSVP.findUnique({
    where: { eventId_memberId: { eventId: event.id, memberId: member.id } }
  });

  // Determine the YES count excluding the current member's prior YES (since
  // they're updating it, the slot they previously held is freed in the count).
  let finalStatus: RSVPStatus = decision.status;
  let waitlistedAt: Date | null = existing?.waitlistedAt ?? null;
  let promotedAt: Date | null = existing?.promotedAt ?? null;

  if (decision.status === RSVPStatus.YES && event.capacity != null) {
    const yesCount = await prisma.rSVP.count({
      where: {
        eventId: event.id,
        status: RSVPStatus.YES,
        NOT: { memberId: member.id }
      }
    });
    if (yesCount >= event.capacity) {
      finalStatus = RSVPStatus.WAITLISTED;
      if (!waitlistedAt) waitlistedAt = new Date();
    } else {
      // Joining at YES, so clear any waitlist marker.
      waitlistedAt = null;
    }
  }

  if (decision.status !== RSVPStatus.WAITLISTED && finalStatus !== RSVPStatus.WAITLISTED) {
    waitlistedAt = null;
  }

  await prisma.rSVP.upsert({
    where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
    update: {
      status: finalStatus,
      channel: decision.channel ?? existing?.channel ?? null,
      waitlistedAt,
      promotedAt
    },
    create: {
      eventId: event.id,
      memberId: member.id,
      status: finalStatus,
      channel: decision.channel ?? null,
      waitlistedAt
    }
  });

  // Promotion check: if the previous status was YES and the new one isn't, a
  // slot has freed up.
  const previousWasYes = existing?.status === RSVPStatus.YES;
  const newIsNotYes = finalStatus !== RSVPStatus.YES;
  if (previousWasYes && newIsNotYes) {
    await promoteFromWaitlist(event);
  }

  return { status: finalStatus };
}

export async function promoteFromWaitlist(event: Event): Promise<{ promotedMemberId: string | null }> {
  if (event.capacity == null) return { promotedMemberId: null };

  const yesCount = await prisma.rSVP.count({
    where: { eventId: event.id, status: RSVPStatus.YES }
  });
  if (yesCount >= event.capacity) return { promotedMemberId: null };

  // Pick the oldest waitlister.
  const next = await prisma.rSVP.findFirst({
    where: { eventId: event.id, status: RSVPStatus.WAITLISTED },
    orderBy: { waitlistedAt: "asc" },
    include: { member: true }
  });
  if (!next) return { promotedMemberId: null };

  await prisma.rSVP.update({
    where: { id: next.id },
    data: { status: RSVPStatus.YES, promotedAt: new Date(), waitlistedAt: null }
  });

  await audit({
    action: "rsvp.promoted_from_waitlist",
    memberId: next.member.id,
    meta: { eventId: event.id }
  });

  // Notify the promoted member by email so they know they're in.
  if (next.member.emailConsent && !next.member.emailOptOutAt) {
    try {
      const rsvpToken = await issueToken({
        memberId: next.member.id,
        purpose: "RSVP",
        eventId: event.id
      });
      const prefToken = await issueToken({ memberId: next.member.id, purpose: "PREFERENCES" });
      const unsubToken = await issueToken({ memberId: next.member.id, purpose: "UNSUBSCRIBE" });

      const tmpl = announcementEmail({
        memberName: next.member.name,
        eventTitle: `You're in: ${event.title}`,
        eventDate: event.startsAt.toLocaleString("en-IE", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: event.timezone
        }),
        eventLocation: event.location,
        description: `A spot opened up — you've been promoted from the waitlist. ${event.description}`,
        rsvpYesUrl: rsvpUrl(rsvpToken, "yes"),
        rsvpNoUrl: rsvpUrl(rsvpToken, "no"),
        rsvpMaybeUrl: rsvpUrl(rsvpToken, "maybe"),
        preferencesUrl: preferencesUrl(prefToken),
        unsubscribeUrl: unsubscribeUrl(unsubToken),
        heroImageUrl: event.heroImageUrl
      });
      await sendEmail({ to: next.member.email, subject: tmpl.subject, html: tmpl.html });
    } catch (err) {
      log.error("waitlist.promotion_email.failed", {
        memberId: next.member.id,
        err: String(err)
      });
    }
  }

  return { promotedMemberId: next.member.id };
}
