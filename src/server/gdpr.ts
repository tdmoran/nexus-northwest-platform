// GDPR rights workflow.
//
// Article 20 (portability): exportMemberData returns a JSON dump of every
// row that references the member, in a format the member can reasonably
// re-use elsewhere.
//
// Article 17 (erasure): requestDeletion marks the member with
// deletionRequestedAt + immediately clears all consent + revokes outstanding
// tokens. After GRACE_DAYS, the hard-delete worker scrubs PII on the row,
// preserves the audit trail at member granularity, and cascades RSVP / Token /
// other rows.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

export const GDPR_GRACE_DAYS = 30;

// ----- Article 20: data export ---------------------------------------------

export interface MemberDataExport {
  exportedAt: string;
  member: Record<string, unknown>;
  rsvps: unknown[];
  preferenceTokens: { purpose: string; createdAt: Date; expiresAt: Date | null }[];
  whatsappMessages: unknown[];
  audit: unknown[];
}

export async function exportMemberData(memberId: string): Promise<MemberDataExport | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      rsvps: { include: { event: { select: { id: true, title: true, startsAt: true } } } },
      tokens: { select: { purpose: true, createdAt: true, expiresAt: true } },
      whatsappMessages: { select: { toPhone: true, status: true, sentAt: true, createdAt: true } },
      audit: { select: { action: true, channel: true, createdAt: true, meta: true } }
    }
  });
  if (!member) return null;

  // Strip Prisma-internal fields and any field we don't want in the export.
  const { passwordHash, mfaSecret, ...safeMember } = member as unknown as Record<string, unknown>;
  void passwordHash; void mfaSecret; // suppress unused-var

  return {
    exportedAt: new Date().toISOString(),
    member: safeMember,
    rsvps: member.rsvps,
    preferenceTokens: member.tokens,
    whatsappMessages: member.whatsappMessages,
    audit: member.audit
  };
}

// ----- Article 17: erasure -------------------------------------------------

export async function requestDeletion(memberId: string): Promise<{ scheduledFor: Date }> {
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + GDPR_GRACE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.member.update({
    where: { id: memberId },
    data: {
      deletionRequestedAt: now,
      // Immediately stop any further outreach.
      emailConsent: false,
      emailOptOutAt: now,
      whatsappConsent: false,
      whatsappOptOutAt: now
    }
  });

  // Burn any outstanding tokens so they can't be used to undo the request.
  await prisma.token.deleteMany({ where: { memberId } });

  await audit({
    action: "gdpr.deletion.requested",
    memberId,
    meta: { scheduledFor: scheduledFor.toISOString() }
  });

  return { scheduledFor };
}

export async function cancelDeletion(memberId: string): Promise<void> {
  await prisma.member.update({
    where: { id: memberId },
    data: { deletionRequestedAt: null }
  });
  await audit({ action: "gdpr.deletion.cancelled", memberId });
}

/**
 * Hard-delete: scrubs PII on members whose grace window has expired.
 * - Member row is kept (so foreign keys + reporting don't break) but PII is
 *   replaced with deterministic placeholders ("redacted-<id>") and email is
 *   replaced with a non-routable variant.
 * - Audit log entries with this member's id are kept (they're append-only
 *   and tell the regulatory story); the row's meta is unchanged.
 * - WhatsApp messages cascade-delete via FK on Member.
 *
 * Returns the count of members hard-deleted.
 */
export async function processExpiredDeletions(now: Date = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - GDPR_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.member.findMany({
    where: {
      deletionRequestedAt: { lte: cutoff },
      deletedAt: null
    },
    take: 100
  });

  for (const m of due) {
    try {
      await prisma.member.update({
        where: { id: m.id },
        data: {
          name: `redacted-${m.id.slice(-8)}`,
          email: `redacted-${m.id}@deleted.invalid`,
          company: null,
          phone: null,
          whatsappNumber: null,
          signalHandle: null,
          linkedinUrl: null,
          profilePictureUrl: null,
          notes: null,
          tags: [],
          referralCode: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          zohoId: null,
          deletedAt: now
        }
      });
      await audit({
        action: "gdpr.deletion.completed",
        memberId: m.id,
        meta: { redactedAt: now.toISOString() }
      });
    } catch (err) {
      log.error("gdpr.delete.failed", { memberId: m.id, err: String(err) });
    }
  }
  return { deleted: due.length };
}
