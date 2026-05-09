import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(session.user.role, "events.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rsvps = await prisma.rSVP.findMany({
    where: { eventId: event.id },
    include: { member: true },
    orderBy: { updatedAt: "desc" }
  });

  const rows = rsvps.map((r) => ({
    name: r.member.name,
    email: r.member.email,
    status: r.status,
    channel: r.channel ?? "",
    company: r.member.company ?? "",
    phone: r.member.phone ?? "",
    whatsapp: r.member.whatsappNumber ?? "",
    rsvpAt: r.updatedAt
  }));

  const csv = rowsToCsv(rows, [
    "name",
    "email",
    "status",
    "channel",
    "company",
    "phone",
    "whatsapp",
    "rsvpAt"
  ]);

  await audit({
    action: "export.event_rsvps",
    actorId: session.user.id,
    meta: { eventId: event.id, count: rows.length }
  });

  const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rsvps-${safeTitle}-${event.id}.csv"`
    }
  });
}
