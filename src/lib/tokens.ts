import { randomBytes, createHmac } from "crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { TokenPurpose } from "@prisma/client";

function sign(raw: string): string {
  return createHmac("sha256", env.TOKEN_SECRET).update(raw).digest("base64url");
}

function generateToken(): { raw: string; signed: string } {
  const raw = randomBytes(24).toString("base64url");
  const signed = `${raw}.${sign(raw)}`;
  return { raw, signed };
}

function verifySignature(signed: string): string | null {
  const [raw, mac] = signed.split(".");
  if (!raw || !mac) return null;
  const expected = sign(raw);
  if (expected.length !== mac.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  }
  return mismatch === 0 ? signed : null;
}

export async function issueToken(opts: {
  memberId: string;
  purpose: TokenPurpose;
  eventId?: string | null;
  ttlMinutes?: number | null;
}): Promise<string> {
  const { signed } = generateToken();
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
  const verified = verifySignature(signed);
  if (!verified) return null;

  const record = await prisma.token.findUnique({ where: { token: verified } });
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
  const verified = verifySignature(signed);
  if (!verified) return null;
  const record = await prisma.token.findUnique({ where: { token: verified } });
  if (!record || record.purpose !== purpose) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;
  if (purpose === "UNSUBSCRIBE" && record.consumedAt) return null;
  return { memberId: record.memberId, eventId: record.eventId };
}
