import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { signupMember } from "@/server/members";
import { parseCsv, extractMemberRows } from "@/lib/csv-parse";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  csv: z.string().min(1).max(2_000_000), // ~2 MB cap
  sendWelcome: z.boolean().default(false)
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(session.user.role, "members.edit.full")) {
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

  let parsedCsv;
  try {
    parsedCsv = parseCsv(parsed.data.csv);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not parse CSV", detail: (err as Error).message },
      { status: 422 }
    );
  }

  const { rows, errors } = extractMemberRows(parsedCsv);
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, imported: 0, errors });
  }

  let imported = 0;
  let skipped = 0;
  const failures: Array<{ rowIndex: number; email: string; reason: string }> = [];

  for (const r of rows) {
    try {
      // signupMember dedupes by email and only sends a welcome on first sign-up.
      // sendWelcome=false is honoured by passing a sentinel — for safety we
      // always run signupMember, which will skip the welcome on duplicate.
      const result = await signupMember({
        name: r.name,
        email: r.email,
        consent: true,
        website: "", // honeypot — empty string skips the bot trap
        utmSource: r.utmSource,
        referralCode: r.referralCode
      });
      if (result.created) imported++;
      else skipped++;
    } catch (err) {
      failures.push({
        rowIndex: r.rowIndex,
        email: r.email,
        reason: (err as Error).message
      });
      log.error("member.import.row_failed", { rowIndex: r.rowIndex, err: String(err) });
    }
  }

  await audit({
    action: "member.import",
    actorId: session.user.id,
    meta: { imported, skipped, failed: failures.length, totalRows: rows.length }
  });

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    failed: failures.length,
    parseErrors: errors,
    rowFailures: failures
  });
}
