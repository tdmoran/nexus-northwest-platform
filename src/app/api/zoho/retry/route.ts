import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { retryAllZohoFailures } from "@/server/zoho-sync";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(session.user.role, "settings.integrations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await retryAllZohoFailures(session.user.id);
  return NextResponse.json({ ok: true, ...result });
}
