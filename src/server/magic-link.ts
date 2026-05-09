import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { generateSignedToken, verifySignedToken } from "@/lib/token-crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { publicUrl } from "@/lib/urls";

const TTL_MINUTES = 15;

export async function requestMagicLink(opts: {
  email: string;
  ip?: string | null;
}): Promise<void> {
  const email = opts.email.toLowerCase().trim();
  if (!email) return;

  const user = await prisma.organiserUser.findUnique({ where: { email } });

  // Always return successfully — don't leak whether the email is on the org list.
  if (!user || !user.active) {
    log.info("magic_link.request.unknown_or_disabled", { email });
    return;
  }

  const token = generateSignedToken(env.TOKEN_SECRET);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  await prisma.magicLink.create({
    data: {
      token,
      organiserUserId: user.id,
      expiresAt,
      requestedFromIp: opts.ip ?? null
    }
  });

  const link = publicUrl(`/auth/magic/${encodeURIComponent(token)}`);
  const html = `
    <p>Hi ${escapeHtml(user.name)},</p>
    <p>Click the link below to sign in to ${escapeHtml(env.NEXT_PUBLIC_SITE_NAME)}. The link expires in ${TTL_MINUTES} minutes and can be used once.</p>
    <p><a href="${link}">Sign in</a></p>
    <p>If you didn't request this, you can ignore this email.</p>
  `;

  try {
    await sendEmail({ to: user.email, subject: `Sign in to ${env.NEXT_PUBLIC_SITE_NAME}`, html });
    await audit({
      action: "auth.magic_link.requested",
      actorId: user.id,
      meta: { ip: opts.ip ?? null }
    });
  } catch (err) {
    log.error("magic_link.send.failed", { userId: user.id, err: String(err) });
  }
}

export async function consumeMagicLink(token: string): Promise<{
  organiserUserId: string;
  email: string;
} | null> {
  if (!verifySignedToken(token, env.TOKEN_SECRET)) return null;

  const record = await prisma.magicLink.findUnique({
    where: { token },
    include: { organiserUser: true }
  });
  if (!record) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  if (!record.organiserUser.active) return null;

  await prisma.magicLink.update({
    where: { id: record.id },
    data: { consumedAt: new Date() }
  });
  await prisma.organiserUser.update({
    where: { id: record.organiserUserId },
    data: { lastLoginAt: new Date() }
  });
  await audit({
    action: "auth.magic_link.consumed",
    actorId: record.organiserUserId
  });

  return { organiserUserId: record.organiserUserId, email: record.organiserUser.email };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
