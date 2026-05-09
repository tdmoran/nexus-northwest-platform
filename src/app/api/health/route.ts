// Liveness + readiness check.
// - Liveness: the process is up (returns 200 even if the DB is down).
// - Readiness: the DB responds to a trivial query.
//
// Container orchestrators can hit this once a few seconds; uptime monitors
// likewise. Returns 200 only when both are healthy, 503 otherwise.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    log.warn("health.db_unreachable", { err: dbError });
  }

  const body = {
    ok: dbOk,
    uptimeMs: Math.round(process.uptime() * 1000),
    db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
    durationMs: Date.now() - startedAt
  };
  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}
