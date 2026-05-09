import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startEnrollment } from "@/server/mfa";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { otpauthUrl, secret } = await startEnrollment(session.user.id);
  return NextResponse.json({ ok: true, otpauthUrl, secret });
}
