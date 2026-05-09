import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { PublicShell } from "@/components/layout/PublicShell";

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
    <PublicShell>
      <main id="main" className="bg-soft-gradient">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <header className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
              What&rsquo;s on
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-brand-800 sm:text-5xl">
              Upcoming events
            </h1>
            <p className="mt-4 text-base text-brand-600">
              Want to come along?{" "}
              <Link
                href="/"
                className="font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline"
              >
                Sign up
              </Link>{" "}
              and you&rsquo;ll get an email with a one-click RSVP a few days before each event.
            </p>
          </header>

          {upcoming.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2">
              {upcoming.map((e) => (
                <EventCard
                  key={e.id}
                  id={e.id}
                  title={e.title}
                  startsAt={e.startsAt}
                  timezone={e.timezone}
                  location={e.location}
                  description={e.description}
                  capacity={e.capacity}
                  attending={e._count.rsvps}
                  heroImageUrl={e.heroImageUrl}
                />
              ))}
            </ul>
          )}
        </div>
      </main>
    </PublicShell>
  );
}

function EventCard({
  id,
  title,
  startsAt,
  timezone,
  location,
  description,
  capacity,
  attending,
  heroImageUrl
}: {
  id: string;
  title: string;
  startsAt: Date;
  timezone: string;
  location: string;
  description: string;
  capacity: number | null;
  attending: number;
  heroImageUrl: string | null;
}) {
  const dayParts = formatDayParts(startsAt, timezone);
  const dateStr = startsAt.toLocaleString("en-IE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone
  });

  return (
    <li className="group relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-brand-100 transition hover:-translate-y-1 hover:ring-accent-300">
      {heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImageUrl}
          alt=""
          className="h-32 w-full object-cover"
        />
      )}
      <div className="flex gap-5 p-6">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-xl bg-gradient-to-b from-brand-700 to-brand-800 text-white shadow-card"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-accent-300">
            {dayParts.month}
          </span>
          <span className="font-display text-2xl font-bold leading-none">{dayParts.day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-brand-800 line-clamp-2">{title}</h2>
          <p className="mt-1 text-xs font-mono text-brand-400">{dateStr}</p>
          <p className="mt-1 text-sm text-brand-600">{location}</p>
          <p className="mt-3 line-clamp-3 text-sm text-brand-600/85">{stripHtml(description)}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <a
              href={`/api/events/${id}/calendar`}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
            >
              Add to calendar
            </a>
            <span className="rounded-full bg-accent-50 px-2 py-1 font-semibold text-accent-700">
              {capacity ? `${attending} / ${capacity} attending` : `${attending} attending`}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-white p-12 text-center shadow-card ring-1 ring-brand-100">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-300">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <p className="mt-4 font-display text-xl font-semibold text-brand-800">No events scheduled</p>
      <p className="mt-2 text-sm text-brand-600">
        Sign up below and we&rsquo;ll email you the moment the next one&rsquo;s announced.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-accent-400 to-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:from-accent-300 hover:to-accent-500"
      >
        Join the community
      </Link>
    </div>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatDayParts(d: Date, tz: string): { month: string; day: string } {
  const month = d.toLocaleDateString("en-IE", { month: "short", timeZone: tz });
  const day = d.toLocaleDateString("en-IE", { day: "2-digit", timeZone: tz });
  return { month: month.toUpperCase(), day };
}
