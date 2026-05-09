import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { dispatchDueReminders } from "@/server/reminders";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.CRON_SECRET}`;
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const result = await dispatchDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

// Allow GET as well so simple schedulers (Vercel Cron, GitHub Actions cron)
// can hit the endpoint without configuring a method.
export async function GET(req: Request) {
  return POST(req);
}
