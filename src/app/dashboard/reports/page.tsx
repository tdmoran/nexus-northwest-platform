import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

interface DailyBucket {
  day: string; // ISO YYYY-MM-DD
  count: number;
}

function bucketByDay(rows: Array<{ createdAt: Date }>): DailyBucket[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, count]) => ({ day, count }));
}

function bucketByWeek(rows: Array<{ createdAt: Date }>): DailyBucket[] {
  // ISO week start (Monday).
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const dow = (d.getUTCDay() + 6) % 7; // 0 = Mon
    d.setUTCDate(d.getUTCDate() - dow);
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, count]) => ({ day, count }));
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: { range?: string };
}) {
  await requireUser();

  const range = searchParams.range === "all" ? "all" : "90d";
  const since =
    range === "90d" ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) : new Date(0);

  const [members, sourceRows, eventStats] = await Promise.all([
    prisma.member.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, utmSource: true, referralCode: true }
    }),
    prisma.member.groupBy({
      by: ["utmSource"],
      where: { createdAt: { gte: since } },
      _count: { _all: true }
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      include: {
        _count: { select: { rsvps: true } },
        rsvps: { select: { status: true } },
        announcements: { select: { recipientCount: true } }
      },
      orderBy: { startsAt: "desc" },
      take: 30
    })
  ]);

  const dailyBuckets = bucketByDay(members);
  const weeklyBuckets = bucketByWeek(members);
  const peakDay = dailyBuckets.reduce((m, b) => Math.max(m, b.count), 0);

  const totalSignups = members.length;
  const totalReferrals = members.filter((m) => m.referralCode).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Acquisition reports</h1>
          <p className="text-sm text-slate-600">
            {range === "90d" ? "Last 90 days" : "All time"} &middot; {totalSignups} sign-ups,{" "}
            {totalReferrals} via referral code
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <RangeLink label="Last 90 days" href="/dashboard/reports?range=90d" active={range === "90d"} />
          <RangeLink label="All time" href="/dashboard/reports?range=all" active={range === "all"} />
        </div>
      </header>

      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Sign-ups per day</h2>
        {dailyBuckets.length === 0 ? (
          <Empty />
        ) : (
          <BarChart buckets={dailyBuckets.slice(-60)} max={peakDay} unit="sign-ups" />
        )}
      </section>

      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Sign-ups per week</h2>
        {weeklyBuckets.length === 0 ? (
          <Empty />
        ) : (
          <BarChart buckets={weeklyBuckets} max={Math.max(...weeklyBuckets.map((b) => b.count))} unit="sign-ups" />
        )}
      </section>

      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Sources</h2>
        {sourceRows.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5 text-sm">
            {sourceRows
              .sort((a, b) => b._count._all - a._count._all)
              .map((row) => {
                const label = row.utmSource ?? "direct";
                const pct = totalSignups === 0 ? 0 : Math.round((row._count._all / totalSignups) * 100);
                return (
                  <li key={label}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">{label}</span>
                      <span className="font-mono text-xs text-slate-500">
                        {row._count._all} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">RSVP conversion per event</h2>
        {eventStats.length === 0 ? (
          <Empty />
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left font-semibold">Event</th>
                <th className="px-2 py-2 text-left font-semibold">When</th>
                <th className="px-2 py-2 text-right font-semibold">Sent</th>
                <th className="px-2 py-2 text-right font-semibold">Yes</th>
                <th className="px-2 py-2 text-right font-semibold">Maybe</th>
                <th className="px-2 py-2 text-right font-semibold">No</th>
                <th className="px-2 py-2 text-right font-semibold">Yes %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventStats.map((e) => {
                const sent = e.announcements.reduce((s, a) => s + a.recipientCount, 0);
                const yes = e.rsvps.filter((r) => r.status === "YES").length;
                const maybe = e.rsvps.filter((r) => r.status === "MAYBE").length;
                const no = e.rsvps.filter((r) => r.status === "NO").length;
                const pct = sent === 0 ? null : Math.round((yes / sent) * 100);
                return (
                  <tr key={e.id}>
                    <td className="px-2 py-2 font-medium text-slate-800">{e.title}</td>
                    <td className="px-2 py-2 text-slate-600">
                      {e.startsAt.toLocaleDateString("en-IE")}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-600">{sent || "—"}</td>
                    <td className="px-2 py-2 text-right text-slate-600">{yes}</td>
                    <td className="px-2 py-2 text-right text-slate-600">{maybe}</td>
                    <td className="px-2 py-2 text-right text-slate-600">{no}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {pct === null ? "—" : `${pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function RangeLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`rounded-md border px-3 py-1.5 font-semibold ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </a>
  );
}

function Empty() {
  return <p className="text-sm text-slate-500">Nothing to report yet.</p>;
}

function BarChart({
  buckets,
  max,
  unit
}: {
  buckets: DailyBucket[];
  max: number;
  unit: string;
}) {
  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {buckets.map((b) => {
          const height = max === 0 ? 0 : Math.max(2, Math.round((b.count / max) * 100));
          return (
            <div
              key={b.day}
              title={`${b.day}: ${b.count} ${unit}`}
              className="flex-1 rounded-t bg-brand-500"
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{buckets[0]?.day}</span>
        <span>{buckets[buckets.length - 1]?.day}</span>
      </div>
    </div>
  );
}
