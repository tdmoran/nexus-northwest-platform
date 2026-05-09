// Renders the announcement template against the actual event so the organiser
// can sanity-check before sending. The recipient is faked as the organiser so
// the preview shows a real name + a real-looking RSVP/preferences/unsubscribe
// URL set (using fresh tokens against the organiser's *own* member record if
// one exists — otherwise placeholder URLs).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { announcementEmail } from "@/lib/templates";
import { issueToken } from "@/lib/tokens";
import { rsvpUrl, preferencesUrl, unsubscribeUrl, publicUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(session.user.role, "announcements.send")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If a Member record exists for the organiser's email, mint real preview
  // tokens. Otherwise render with /preview placeholder URLs that won't work.
  const ownMember = await prisma.member.findUnique({ where: { email: session.user.email } });
  let urls = {
    rsvpYes: publicUrl("/rsvp/preview"),
    rsvpNo: publicUrl("/rsvp/preview"),
    rsvpMaybe: publicUrl("/rsvp/preview"),
    preferences: publicUrl("/preferences/preview"),
    unsubscribe: publicUrl("/unsubscribe/preview")
  };
  if (ownMember) {
    const rsvpToken = await issueToken({
      memberId: ownMember.id,
      purpose: "RSVP",
      eventId: event.id,
      ttlMinutes: 60
    });
    const prefToken = await issueToken({
      memberId: ownMember.id,
      purpose: "PREFERENCES",
      ttlMinutes: 60
    });
    const unsubToken = await issueToken({
      memberId: ownMember.id,
      purpose: "UNSUBSCRIBE",
      ttlMinutes: 60
    });
    urls = {
      rsvpYes: rsvpUrl(rsvpToken, "yes"),
      rsvpNo: rsvpUrl(rsvpToken, "no"),
      rsvpMaybe: rsvpUrl(rsvpToken, "maybe"),
      preferences: preferencesUrl(prefToken),
      unsubscribe: unsubscribeUrl(unsubToken)
    };
  }

  const tmpl = announcementEmail({
    memberName: session.user.name + " (preview)",
    eventTitle: event.title,
    eventDate: event.startsAt.toLocaleString("en-IE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: event.timezone
    }),
    eventLocation: event.location,
    description: event.description,
    rsvpYesUrl: urls.rsvpYes,
    rsvpNoUrl: urls.rsvpNo,
    rsvpMaybeUrl: urls.rsvpMaybe,
    preferencesUrl: urls.preferences,
    unsubscribeUrl: urls.unsubscribe,
    heroImageUrl: event.heroImageUrl
  });

  return new NextResponse(tmpl.html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
