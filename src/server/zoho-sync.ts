import { prisma } from "@/lib/db";
import { syncMember } from "@/lib/zoho";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";
import type { Member } from "@prisma/client";

function memberToZohoPayload(m: Member) {
  return {
    email: m.email,
    name: m.name,
    company: m.company,
    phone: m.phone,
    whatsappNumber: m.whatsappNumber,
    signalHandle: m.signalHandle,
    linkedinUrl: m.linkedinUrl,
    preferredChannel: m.preferredChannel,
    emailConsent: m.emailConsent,
    whatsappConsent: m.whatsappConsent,
    utmSource: m.utmSource,
    utmMedium: m.utmMedium,
    utmCampaign: m.utmCampaign,
    utmContent: m.utmContent,
    referralCode: m.referralCode
  };
}

export async function syncMemberAndTrack(member: Member): Promise<{ zohoId: string | null }> {
  const result = await syncMember(memberToZohoPayload(member));

  if (result.skipped) {
    return { zohoId: null };
  }

  if (result.error) {
    await prisma.zohoSyncFailure.upsert({
      where: { memberId: member.id },
      update: {
        attempts: { increment: 1 },
        lastError: result.error,
        resolvedAt: null
      },
      create: {
        memberId: member.id,
        attempts: 1,
        lastError: result.error
      }
    });
    return { zohoId: null };
  }

  // Success — clear any prior failure record.
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

  return { zohoId: result.zohoId };
}

export async function retryAllZohoFailures(actorId: string): Promise<{ retried: number; succeeded: number }> {
  const failures = await prisma.zohoSyncFailure.findMany({
    where: { resolvedAt: null },
    include: { member: true }
  });

  let succeeded = 0;
  for (const f of failures) {
    try {
      const result = await syncMemberAndTrack(f.member);
      if (result.zohoId) succeeded++;
    } catch (err) {
      log.error("zoho.retry.failed", { memberId: f.memberId, err: String(err) });
    }
  }

  await audit({
    action: "zoho.retry.batch",
    actorId,
    meta: { retried: failures.length, succeeded }
  });

  return { retried: failures.length, succeeded };
}
