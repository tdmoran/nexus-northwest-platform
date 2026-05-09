import { NextResponse } from "next/server";
import { lookupToken } from "@/lib/tokens";
import { exportMemberData } from "@/server/gdpr";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const lookup = await lookupToken(decodeURIComponent(params.token), "PREFERENCES");
  if (!lookup) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

  const data = await exportMemberData(lookup.memberId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit({
    action: "gdpr.data.exported",
    memberId: lookup.memberId,
    meta: { method: "tokenized_link" }
  });

  const json = JSON.stringify(data, null, 2);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${lookup.memberId}.json"`
    }
  });
}
