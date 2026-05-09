// Server helpers for MFA enrollment.
//
// Flow:
// 1. POST /api/mfa/enroll  → creates a pending mfaSecret on the user (mfaEnrolled=false)
//                            and returns the otpauth:// URL + base32 secret for QR rendering.
// 2. POST /api/mfa/verify  → user submits a TOTP code; on success mfaEnrolled=true.
// 3. POST /api/mfa/disable → requires a fresh TOTP code (or password — kept simple here)
//                            and clears the secret.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { generateSecret, verifyTOTP, buildOtpauthUrl } from "@/lib/totp";
import { env } from "@/lib/env";

export async function startEnrollment(userId: string): Promise<{
  otpauthUrl: string;
  secret: string;
}> {
  const user = await prisma.organiserUser.findUniqueOrThrow({ where: { id: userId } });
  const secret = generateSecret();
  await prisma.organiserUser.update({
    where: { id: userId },
    data: { mfaSecret: secret, mfaEnrolled: false }
  });
  await audit({
    action: "mfa.enroll.started",
    actorId: userId,
    meta: { email: user.email }
  });
  return {
    secret,
    otpauthUrl: buildOtpauthUrl({
      secretBase32: secret,
      accountName: user.email,
      issuer: env.NEXT_PUBLIC_SITE_NAME
    })
  };
}

export async function completeEnrollment(userId: string, code: string): Promise<boolean> {
  const user = await prisma.organiserUser.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaSecret) return false;
  if (!verifyTOTP(user.mfaSecret, code)) return false;

  await prisma.organiserUser.update({
    where: { id: userId },
    data: { mfaEnrolled: true }
  });
  await audit({ action: "mfa.enroll.completed", actorId: userId });
  return true;
}

export async function disableMfa(userId: string, code: string): Promise<boolean> {
  const user = await prisma.organiserUser.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaEnrolled || !user.mfaSecret) return true;
  if (!verifyTOTP(user.mfaSecret, code)) return false;

  await prisma.organiserUser.update({
    where: { id: userId },
    data: { mfaEnrolled: false, mfaSecret: null }
  });
  await audit({ action: "mfa.disabled", actorId: userId });
  return true;
}
