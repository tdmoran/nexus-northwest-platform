import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { syncMember } from "@/lib/zoho";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { preferencesUrl, unsubscribeUrl } from "@/lib/urls";
import type { SignupInput } from "@/lib/validation";

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

  // Best-effort Zoho sync; failures do not block sign-up.
  const zohoResult = await syncMember({
    email: member.email,
    name: member.name,
    preferredChannel: member.preferredChannel,
    emailConsent: member.emailConsent,
    whatsappConsent: member.whatsappConsent,
    utmSource: member.utmSource,
    utmMedium: member.utmMedium,
    utmCampaign: member.utmCampaign,
    utmContent: member.utmContent,
    referralCode: member.referralCode
  });
  if (zohoResult.zohoId && zohoResult.zohoId !== member.zohoId) {
    await prisma.member.update({
      where: { id: member.id },
      data: { zohoId: zohoResult.zohoId }
    });
  }

  // Issue long-lived tokens for preferences + unsubscribe.
  const prefToken = await issueToken({ memberId: member.id, purpose: "PREFERENCES" });
  const unsubToken = await issueToken({ memberId: member.id, purpose: "UNSUBSCRIBE" });

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

  if (created) {
    const tmpl = welcomeEmail({
      name: member.name,
      preferencesUrl: preferencesUrl(prefToken),
      unsubscribeUrl: unsubscribeUrl(unsubToken)
    });
    try {
      await sendEmail({ to: member.email, subject: tmpl.subject, html: tmpl.html });
      await audit({
        action: "email.welcome.sent",
        memberId: member.id,
        channel: "email"
      });
    } catch (err) {
      console.error("welcome email failed", err);
      await audit({
        action: "email.welcome.failed",
        memberId: member.id,
        channel: "email",
        meta: { error: (err as Error).message }
      });
    }
  }

  return { memberId: member.id, created };
}
