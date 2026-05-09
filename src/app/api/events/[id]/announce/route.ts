import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { sendEventAnnouncement } from "@/server/announcements";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  audience: z.enum(["all", "rsvp_yes"]).default("all")
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

  try {
    const result = await sendEventAnnouncement({
      eventId: params.id,
      audience: parsed.data.audience,
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
