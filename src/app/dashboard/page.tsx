import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function OverviewPage() {
  await requireUser();

  const now = new Date();
  const [memberCount, upcomingEvents, recentMembers, openActions, recentAudit, signupsBySource] =
    await Promise.all([
      prisma.member.count(),
      prisma.event.findMany({
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: { _count: { select: { rsvps: true } } }
      }),
      prisma.member.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.actionItem.count({
        where: { status: { in: ["NEW", "CONTACTED", "CONFIRMED", "SCHEDULED"] } }
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true } } }
      }),
      prisma.member.groupBy({
        by: ["utmSource"],
        _count: { _all: true },
        orderBy: { _count: { utmSource: "desc" } },
        take: 5
      })
    ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Overview</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Members" value={memberCount} />
        <Stat label="Upcoming events" value={upcomingEvents.length} />
        <Stat label="Open actions" value={openActions} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming events" link={{ href: "/dashboard/events", label: "All events" }}>
          {upcomingEvents.length === 0 ? (
            <Empty msg="No upcoming events. Create one." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="py-3">
                  <Link
                    href={`/dashboard/events/${e.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {e.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {e.startsAt.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}{" "}
                    &middot; {e.location} &middot; {e._count.rsvps} RSVPs
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent sign-ups" link={{ href: "/dashboard/members", label: "All members" }}>
          {recentMembers.length === 0 ? (
            <Empty msg="No sign-ups yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentMembers.map((m) => (
                <li key={m.id} className="py-2">
                  <p className="text-sm font-medium text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">
                    {m.email} &middot; {m.utmSource ?? "direct"} &middot;{" "}
                    {m.createdAt.toLocaleDateString("en-IE")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Sign-ups by source">
          {signupsBySource.length === 0 ? (
            <Empty msg="Nothing tracked yet." />
          ) : (
            <ul className="space-y-1 text-sm">
              {signupsBySource.map((row) => (
                <li
                  key={row.utmSource ?? "direct"}
                  className="flex items-center justify-between"
                >
                  <span className="text-slate-700">{row.utmSource ?? "direct"}</span>
                  <span className="font-mono text-xs text-slate-500">
                    {row._count._all}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" link={{ href: "/dashboard/audit", label: "Audit log" }}>
          {recentAudit.length === 0 ? (
            <Empty msg="No activity yet." />
          ) : (
            <ul className="space-y-1 text-xs">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex items-baseline gap-2">
                  <span className="font-mono text-slate-500">
                    {a.createdAt.toLocaleTimeString("en-IE")}
                  </span>
                  <span className="font-medium text-slate-700">{a.action}</span>
                  {a.actor && <span className="text-slate-500">by {a.actor.name}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
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

function Card({
  title,
  link,
  children
}: {
  title: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {link && (
          <Link href={link.href} className="text-xs font-semibold text-brand-600 hover:underline">
            {link.label} &rarr;
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-slate-500">{msg}</p>;
}
