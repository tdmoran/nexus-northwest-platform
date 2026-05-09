// Per-member ICS calendar subscription. The token is a long-lived PREFERENCES
// token (issued at sign-up and re-issued on every announcement). Calendar apps
// (Google, Apple, Outlook) poll this URL on their own schedule.
//
// Returns only events the member has RSVPed YES to.

import { NextResponse } from "next/server";
import { lookupToken } from "@/lib/tokens";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const lookup = await lookupToken(decodeURIComponent(params.token), "PREFERENCES");
  if (!lookup) {
    return new NextResponse("Invalid or expired calendar link", { status: 401 });
  }

  const rsvps = await prisma.rSVP.findMany({
    where: { memberId: lookup.memberId, status: "YES" },
    include: { event: true },
    orderBy: { event: { startsAt: "asc" } }
  });

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${env.NEXT_PUBLIC_SITE_NAME}//EN`, "CALSCALE:GREGORIAN"];
  const dtStamp = fmt(new Date());

  for (const r of rsvps) {
    const startsAt = r.event.startsAt;
    const endsAt = r.event.endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.event.id}@${env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${fmt(startsAt)}`,
      `DTEND:${fmt(endsAt)}`,
      `SUMMARY:${escapeIcs(r.event.title)}`,
      `LOCATION:${escapeIcs(r.event.location)}`,
      `DESCRIPTION:${escapeIcs(r.event.description.replace(/<[^>]+>/g, ""))}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  const ics = lines.join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="nexus-northwest.ics"`,
      "Cache-Control": "private, max-age=900"
    }
  });
}
