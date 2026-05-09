import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { syncMemberAndTrack } from "@/server/zoho-sync";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { preferencesUrl, unsubscribeUrl } from "@/lib/urls";
import type { SignupInput } from "@/lib/validation";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { inngest } from "@/inngest/client";

const inngestActive = (): boolean => Boolean(env.INNGEST_EVENT_KEY);

export async function signupMember(input: SignupInput): Promise<{
  memberId: string;
  created: boolean;
}> {
  const existing = await prisma.member.findUnique({ where: { email: input.email } });

  const member = await prisma.member.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      utmSource: input.utmSource ?? existing?.utmSource ?? null,
      utmMedium: input.utmMedium ?? existing?.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? existing?.utmCampaign ?? null,
      utmContent: input.utmContent ?? existing?.utmContent ?? null,
      referralCode: input.referralCode ?? existing?.referralCode ?? null,
      emailConsent: true,
      emailConsentAt: existing?.emailConsentAt ?? new Date()
    },
    create: {
      email: input.email,
      name: input.name,
      preferredChannel: "EMAIL",
      emailConsent: true,
      emailConsentAt: new Date(),
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmContent: input.utmContent ?? null,
      referralCode: input.referralCode ?? null
    }
  });

  const created = !existing;

  await audit({
    action: created ? "member.signup" : "member.signup.duplicate",
    memberId: member.id,
    meta: {
      email: member.email,
      utm: {
        source: member.utmSource,
        medium: member.utmMedium,
        campaign: member.utmCampaign,
        content: member.utmContent
      },
      referralCode: member.referralCode
    }
  });

  // Side effects: when Inngest is wired up, fire-and-forget for durable retry.
  // Otherwise run synchronously (dev/test or single-instance setups without Inngest).
  if (inngestActive()) {
    await inngest.send([
      { name: "zoho/member.sync", data: { memberId: member.id } },
      ...(created ? [{ name: "member/welcome.send" as const, data: { memberId: member.id } }] : [])
    ]);
  } else {
    await syncMemberAndTrack(member);
    if (created) await sendWelcomeSync(member.id, member.name, member.email);
  }

  return { memberId: member.id, created };
}

async function sendWelcomeSync(
  memberId: string,
  name: string,
  emailAddr: string
): Promise<void> {
  const prefToken = await issueToken({ memberId, purpose: "PREFERENCES" });
  const unsubToken = await issueToken({ memberId, purpose: "UNSUBSCRIBE" });
  const tmpl = welcomeEmail({
    name,
    preferencesUrl: preferencesUrl(prefToken),
    unsubscribeUrl: unsubscribeUrl(unsubToken)
  });
  try {
    await sendEmail({ to: emailAddr, subject: tmpl.subject, html: tmpl.html });
    await audit({ action: "email.welcome.sent", memberId, channel: "email" });
  } catch (err) {
    log.error("welcome_email.failed", { memberId, err: String(err) });
    await audit({
      action: "email.welcome.failed",
      memberId,
      channel: "email",
      meta: { error: (err as Error).message }
    });
  }
}
