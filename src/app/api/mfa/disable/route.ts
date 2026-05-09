import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { disableMfa } from "@/server/mfa";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 6 digits" }, { status: 422 });
  }
  const ok = await disableMfa(session.user.id, code);
  if (!ok) return NextResponse.json({ error: "Code did not match" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
