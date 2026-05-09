import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";

export default async function AuditPage() {
  await requireCapability("audit.view");

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 250,
    include: { actor: true, member: true }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">When</th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
              <th className="px-4 py-3 text-left font-semibold">Actor</th>
              <th className="px-4 py-3 text-left font-semibold">Subject</th>
              <th className="px-4 py-3 text-left font-semibold">Channel</th>
              <th className="px-4 py-3 text-left font-semibold">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500 font-mono text-xs">
                  {e.createdAt.toLocaleString("en-IE", {
                    dateStyle: "short",
                    timeStyle: "medium"
                  })}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">{e.action}</td>
                <td className="px-4 py-2 text-slate-600">{e.actor?.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{e.member?.email ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{e.channel ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  <code>{e.meta ? JSON.stringify(e.meta) : ""}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
