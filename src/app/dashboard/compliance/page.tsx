import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { GDPR_GRACE_DAYS } from "@/server/gdpr";

export default async function CompliancePage() {
  const user = await requireUser();
  if (!can(user.role, "audit.view")) redirect("/dashboard?error=forbidden");

  const [pending, completed] = await Promise.all([
    prisma.member.findMany({
      where: { deletionRequestedAt: { not: null }, deletedAt: null },
      orderBy: { deletionRequestedAt: "asc" },
      take: 100
    }),
    prisma.member.count({ where: { deletedAt: { not: null } } })
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Compliance</h1>
        <p className="text-sm text-slate-600">
          GDPR Article 17 erasure requests. After a {GDPR_GRACE_DAYS}-day grace window each request
          is scrubbed automatically by the daily cron.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Stat label="Pending deletions" value={pending.length} />
        <Stat label="Completed (PII scrubbed)" value={completed} />
      </section>

      <section className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Member</th>
              <th className="px-4 py-3 text-left font-semibold">Requested</th>
              <th className="px-4 py-3 text-left font-semibold">Scheduled erase</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pending.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No pending deletion requests.
                </td>
              </tr>
            )}
            {pending.map((m) => {
              const scheduled = m.deletionRequestedAt
                ? new Date(
                    m.deletionRequestedAt.getTime() + GDPR_GRACE_DAYS * 24 * 60 * 60 * 1000
                  )
                : null;
              const overdue = scheduled && scheduled.getTime() < Date.now();
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {m.name}
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.deletionRequestedAt?.toLocaleDateString("en-IE")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {scheduled?.toLocaleDateString("en-IE")}
                  </td>
                  <td className="px-4 py-3">
                    {overdue ? (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        overdue — cron not running?
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        in grace window
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
