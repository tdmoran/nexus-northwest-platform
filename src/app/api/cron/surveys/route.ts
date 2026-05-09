import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { dispatchPostEventSurveys } from "@/server/surveys";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const result = await dispatchPostEventSurveys();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
