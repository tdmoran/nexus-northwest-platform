import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Upcoming events",
  description: "Public list of upcoming Nexus Northwest events.",
  alternates: { canonical: "/events" }
};

export const dynamic = "force-dynamic";

export default async function PublicEventsPage() {
  const now = new Date();
  const upcoming = await prisma.event.findMany({
    where: { startsAt: { gte: now }, rsvpEnabled: true },
    orderBy: { startsAt: "asc" },
    take: 30,
    include: { _count: { select: { rsvps: { where: { status: "YES" } } } } }
  });

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          {env.NEXT_PUBLIC_SITE_NAME}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Upcoming events
        </h1>
        <p className="mt-3 text-slate-600">
          Want to come along? <Link href="/" className="text-brand-600 underline">Sign up</Link> and
          you&rsquo;ll get an email with a one-click RSVP a few days before each event.
        </p>
      </header>

      {upcoming.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-slate-600">No events are scheduled right now. Check back soon.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {upcoming.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold text-slate-900">{e.title}</h2>
                <p className="text-sm font-mono text-slate-500">
                  {e.startsAt.toLocaleString("en-IE", {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: e.timezone
                  })}
                </p>
              </div>
              <p className="mt-1 text-sm text-slate-600">{e.location}</p>
              <p className="mt-3 line-clamp-3 text-sm text-slate-700">
                {stripHtml(e.description)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <a
                  href={`/api/events/${e.id}/calendar`}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Add to calendar (.ics)
                </a>
                {e.capacity ? (
                  <span className="text-xs text-slate-500">
                    {e._count.rsvps} / {e.capacity} attending
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">{e._count.rsvps} attending</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
