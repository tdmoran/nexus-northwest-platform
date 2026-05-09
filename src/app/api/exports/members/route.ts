import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(session.user.role, "members.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.member.findMany({ orderBy: { createdAt: "desc" } });

  const rows = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    company: m.company ?? "",
    phone: m.phone ?? "",
    whatsapp: m.whatsappNumber ?? "",
    linkedin: m.linkedinUrl ?? "",
    preferredChannel: m.preferredChannel,
    emailConsent: m.emailConsent,
    whatsappConsent: m.whatsappConsent,
    optedOutEmailAt: m.emailOptOutAt,
    optedOutWhatsappAt: m.whatsappOptOutAt,
    utmSource: m.utmSource ?? "",
    utmMedium: m.utmMedium ?? "",
    utmCampaign: m.utmCampaign ?? "",
    utmContent: m.utmContent ?? "",
    referralCode: m.referralCode ?? "",
    tags: m.tags.join("|"),
    speakerProspect: m.speakerProspect,
    createdAt: m.createdAt
  }));

  const csv = rowsToCsv(rows, [
    "id",
    "name",
    "email",
    "company",
    "phone",
    "whatsapp",
    "linkedin",
    "preferredChannel",
    "emailConsent",
    "whatsappConsent",
    "optedOutEmailAt",
    "optedOutWhatsappAt",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmContent",
    "referralCode",
    "tags",
    "speakerProspect",
    "createdAt"
  ]);

  await audit({
    action: "export.members",
    actorId: session.user.id,
    meta: { count: rows.length }
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
