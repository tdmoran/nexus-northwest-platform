import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lookupToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { preferencesSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const lookup = await lookupToken(decodeURIComponent(params.token), "PREFERENCES");
  if (!lookup) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = preferencesSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const existing = await prisma.member.findUnique({ where: { id: lookup.memberId } });
  if (!existing) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // If channel needs WhatsApp, require a number.
  const wantsWhatsapp =
    data.preferredChannel === "WHATSAPP" || data.preferredChannel === "BOTH" || data.whatsappConsent;
  if (wantsWhatsapp && !(data.whatsappNumber || existing.whatsappNumber || data.phone || existing.phone)) {
    return NextResponse.json(
      { error: "WhatsApp opt-in requires a phone or WhatsApp number." },
      { status: 422 }
    );
  }

  const now = new Date();
  await prisma.member.update({
    where: { id: existing.id },
    data: {
      preferredChannel: data.preferredChannel,
      phone: data.phone || existing.phone,
      whatsappNumber: data.whatsappNumber || existing.whatsappNumber,
      emailConsent: data.emailConsent ?? existing.emailConsent,
      emailConsentAt:
        data.emailConsent && !existing.emailConsent ? now : existing.emailConsentAt,
      emailOptOutAt: data.emailConsent === false ? now : null,
      whatsappConsent: data.whatsappConsent ?? existing.whatsappConsent,
      whatsappConsentAt:
        data.whatsappConsent && !existing.whatsappConsent ? now : existing.whatsappConsentAt,
      whatsappOptOutAt: data.whatsappConsent === false ? now : null,
      publicProfile: data.publicProfile ?? existing.publicProfile,
      headline: data.headline ?? existing.headline,
      bio: data.bio ?? existing.bio
    }
  });

  await audit({
    action: "member.preferences.updated",
    memberId: existing.id,
    meta: data
  });

  return NextResponse.json({ ok: true });
}
