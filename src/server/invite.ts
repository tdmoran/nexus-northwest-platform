import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

// 8-char base32 (~40 bits) — collision-resistant for the foreseeable future
// and short enough to read aloud. Generated lazily.
function generateSlug(): string {
  return randomBytes(5)
    .toString("base64")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase()
    .padEnd(8, "X");
}

export async function ensureInviteSlug(memberId: string): Promise<string> {
  const m = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { inviteSlug: true }
  });
  if (m.inviteSlug) return m.inviteSlug;

  // Loop with retries on the rare collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      const updated = await prisma.member.update({
        where: { id: memberId },
        data: { inviteSlug: slug },
        select: { inviteSlug: true }
      });
      return updated.inviteSlug!;
    } catch {
      // unique constraint hit — try again
    }
  }
  throw new Error("Failed to allocate invite slug");
}

export async function countReferralsBySlug(slug: string): Promise<number> {
  return prisma.member.count({
    where: { referralCode: slug, deletedAt: null, deletionRequestedAt: null }
  });
}
