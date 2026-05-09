import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";

export default async function SeriesListPage() {
  const user = await requireUser();
  const canEdit = can(user.role, "events.edit");

  const seriesList = await prisma.eventSeries.findMany({
    orderBy: [{ active: "desc" }, { title: "asc" }],
    include: { _count: { select: { events: true } } }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Event series</h1>
        {canEdit && (
          <Link
            href="/dashboard/series/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New series
          </Link>
        )}
      </div>

      <p className="text-sm text-slate-600">
        Series materialise upcoming Event rows on a cadence (weekly / biweekly / monthly). Each
        generated event behaves like a normal event — RSVPs, reminders, announcements all work.
      </p>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Title</th>
              <th className="px-4 py-3 text-left font-semibold">Cadence</th>
              <th className="px-4 py-3 text-left font-semibold">Time</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Generated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {seriesList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No series yet.
                </td>
              </tr>
            )}
            {seriesList.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/dashboard/series/${s.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {s.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.cadence.toLowerCase()}</td>
                <td className="px-4 py-3 text-slate-600">
                  {s.startTimeLocal} ({s.timezone})
                </td>
                <td className="px-4 py-3">
                  {s.active ? (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      active
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      paused
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{s._count.events}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
