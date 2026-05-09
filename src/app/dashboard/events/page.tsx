import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";

export default async function EventsListPage() {
  const user = await requireUser();
  const canEdit = can(user.role, "events.edit");

  const events = await prisma.event.findMany({
    orderBy: { startsAt: "desc" },
    include: {
      _count: { select: { rsvps: true, announcements: true } }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        {canEdit && (
          <Link
            href="/dashboard/events/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New event
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Title</Th>
              <Th>Starts</Th>
              <Th>Location</Th>
              <Th>RSVPs</Th>
              <Th>Sends</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No events yet.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/events/${e.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.startsAt.toLocaleString("en-IE", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.location}</td>
                  <td className="px-4 py-3 text-slate-600">{e._count.rsvps}</td>
                  <td className="px-4 py-3 text-slate-600">{e._count.announcements}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-semibold">{children}</th>;
}
