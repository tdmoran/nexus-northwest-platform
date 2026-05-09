import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  sendEventAnnouncement,
  scheduleEventAnnouncement,
  type AudienceSpec
} from "@/server/announcements";
import { log } from "@/lib/logger";

// audience accepts "all", "rsvp_yes", or "tag:<name>"
const bodySchema = z.object({
  audience: z
    .string()
    .default("all")
    .refine(
      (v) => v === "all" || v === "rsvp_yes" || (v.startsWith("tag:") && v.length > 4),
      { message: "Audience must be all, rsvp_yes, or tag:<name>" }
    ),
  channel: z.enum(["EMAIL", "WHATSAPP"]).default("EMAIL"),
  scheduledFor: z.coerce.date().optional().nullable()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(session.user.role, "announcements.send")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const audience = parsed.data.audience as AudienceSpec;

  try {
    if (parsed.data.scheduledFor) {
      const result = await scheduleEventAnnouncement({
        eventId: params.id,
        audience,
        channel: parsed.data.channel,
        actorId: session.user.id,
        scheduledFor: parsed.data.scheduledFor
      });
      return NextResponse.json({ ...result, scheduled: true });
    }

    const result = await sendEventAnnouncement({
      eventId: params.id,
      audience,
      channel: parsed.data.channel,
      actorId: session.user.id
    });
    return NextResponse.json(result);
  } catch (err) {
    log.error("announce.failed", { err: String(err) });
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
