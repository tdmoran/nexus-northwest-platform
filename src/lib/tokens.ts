import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generateSignedToken, verifySignedToken } from "@/lib/token-crypto";
import type { TokenPurpose } from "@prisma/client";

export async function issueToken(opts: {
  memberId: string;
  purpose: TokenPurpose;
  eventId?: string | null;
  ttlMinutes?: number | null;
}): Promise<string> {
  const signed = generateSignedToken(env.TOKEN_SECRET);
  const expiresAt = opts.ttlMinutes
    ? new Date(Date.now() + opts.ttlMinutes * 60 * 1000)
    : null;
  await prisma.token.create({
    data: {
      token: signed,
      memberId: opts.memberId,
      purpose: opts.purpose,
      eventId: opts.eventId ?? null,
      expiresAt
    }
  });
  return signed;
}

export async function consumeToken(
  signed: string,
  purpose: TokenPurpose
): Promise<{ memberId: string; eventId: string | null } | null> {
  if (!verifySignedToken(signed, env.TOKEN_SECRET)) return null;

  const record = await prisma.token.findUnique({ where: { token: signed } });
  if (!record) return null;
  if (record.purpose !== purpose) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;

  // RSVP and PREFERENCES tokens are reusable. UNSUBSCRIBE consumed once.
  if (purpose === "UNSUBSCRIBE") {
    if (record.consumedAt) return null;
    await prisma.token.update({
      where: { id: record.id },
      data: { consumedAt: new Date() }
    });
  }

  return { memberId: record.memberId, eventId: record.eventId };
}

export async function lookupToken(
  signed: string,
  purpose: TokenPurpose
): Promise<{ memberId: string; eventId: string | null } | null> {
  if (!verifySignedToken(signed, env.TOKEN_SECRET)) return null;
  const record = await prisma.token.findUnique({ where: { token: signed } });
  if (!record || record.purpose !== purpose) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;
  if (purpose === "UNSUBSCRIBE" && record.consumedAt) return null;
  return { memberId: record.memberId, eventId: record.eventId };
}
