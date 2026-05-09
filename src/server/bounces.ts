import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

export type BounceKind = "bounce" | "complaint" | "unsubscribe";

export interface BounceEvent {
  email: string;
  kind: BounceKind;
  reason?: string;
  provider: string;
}

export async function recordBounces(events: BounceEvent[]): Promise<{ updated: number }> {
  if (events.length === 0) return { updated: 0 };
  let updated = 0;

  for (const evt of events) {
    const email = evt.email.toLowerCase().trim();
    if (!email) continue;

    const member = await prisma.member.findUnique({ where: { email } });
    if (!member) {
      log.warn("bounce.unknown_member", { email, kind: evt.kind, provider: evt.provider });
      continue;
    }

    const now = new Date();
    const data: Record<string, unknown> = {};
    if (evt.kind === "bounce") {
      data.emailBouncedAt = now;
      data.emailConsent = false;
      data.emailOptOutAt = now;
    } else if (evt.kind === "complaint") {
      data.emailConsent = false;
      data.emailOptOutAt = now;
    } else if (evt.kind === "unsubscribe") {
      data.emailConsent = false;
      data.emailOptOutAt = now;
    }

    await prisma.member.update({ where: { id: member.id }, data });
    await audit({
      action: `email.${evt.kind}`,
      memberId: member.id,
      channel: "email",
      meta: { provider: evt.provider, reason: evt.reason ?? null }
    });
    updated++;
  }

  return { updated };
}
