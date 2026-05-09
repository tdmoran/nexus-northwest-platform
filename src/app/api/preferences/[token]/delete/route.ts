import { NextResponse } from "next/server";
import { lookupToken } from "@/lib/tokens";
import { requestDeletion } from "@/server/gdpr";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const lookup = await lookupToken(decodeURIComponent(params.token), "PREFERENCES");
  if (!lookup) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  const { scheduledFor } = await requestDeletion(lookup.memberId);
  return NextResponse.json({ ok: true, scheduledFor: scheduledFor.toISOString() });
}
