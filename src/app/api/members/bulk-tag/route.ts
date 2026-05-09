import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const bodySchema = z.object({
  memberIds: z.array(z.string()).min(1).max(2000),
  add: z.array(z.string().trim().min(1).max(60)).optional().default([]),
  remove: z.array(z.string().trim().min(1).max(60)).optional().default([])
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(session.user.role, "members.edit")) {
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

  const { memberIds, add, remove } = parsed.data;
  if (add.length === 0 && remove.length === 0) {
    return NextResponse.json({ error: "Nothing to apply" }, { status: 422 });
  }

  // Postgres array_remove + array_cat with deduplication. Done per-member so
  // each row's tags evolve independently.
  const members = await prisma.member.findMany({
    where: { id: { in: memberIds }, deletedAt: null, deletionRequestedAt: null },
    select: { id: true, tags: true }
  });

  let updated = 0;
  for (const m of members) {
    const next = new Set(m.tags);
    for (const t of remove) next.delete(t);
    for (const t of add) next.add(t);
    const sorted = [...next].sort();
    await prisma.member.update({ where: { id: m.id }, data: { tags: sorted } });
    updated++;
  }

  await audit({
    action: "members.bulk_tag",
    actorId: session.user.id,
    meta: { count: updated, add, remove }
  });

  return NextResponse.json({ ok: true, updated });
}
