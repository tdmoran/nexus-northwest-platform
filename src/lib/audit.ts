import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export async function audit(opts: {
  action: string;
  actorId?: string | null;
  memberId?: string | null;
  channel?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action,
        actorId: opts.actorId ?? null,
        memberId: opts.memberId ?? null,
        channel: opts.channel ?? null,
        meta: opts.meta ?? undefined
      }
    });
  } catch (err) {
    // Audit must not break the user-facing flow — log and continue.
    log.error("audit.write_failed", { action: opts.action, err: String(err) });
  }
}
