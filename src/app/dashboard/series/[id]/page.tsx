import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { materialiseSeriesOccurrences } from "@/server/event-series";

async function toggleActive(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "events.edit")) redirect("/dashboard?error=forbidden");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await prisma.eventSeries.update({ where: { id }, data: { active } });
  await audit({
    action: active ? "event_series.activated" : "event_series.paused",
    actorId: user.id,
    meta: { seriesId: id }
  });
  redirect(`/dashboard/series/${id}`);
}

async function generateNow(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "events.edit")) redirect("/dashboard?error=forbidden");
  await materialiseSeriesOccurrences();
  await audit({
    action: "event_series.generate_now",
    actorId: user.id,
    meta: { seriesId: String(formData.get("id") ?? "") }
  });
  redirect(`/dashboard/series/${formData.get("id")}`);
}

export default async function SeriesDetailPage({ params }: { params: { id: string } }) {
  await requireUser();
  const series = await prisma.eventSeries.findUnique({
    where: { id: params.id },
    include: { events: { orderBy: { startsAt: "asc" } } }
  });
  if (!series) notFound();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{series.title}</h1>
          <p className="text-sm text-slate-600">
            {series.cadence.toLowerCase()} &middot; {series.startTimeLocal} ({series.timezone})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={toggleActive}>
            <input type="hidden" name="id" value={series.id} />
            <input type="hidden" name="active" value={(!series.active).toString()} />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {series.active ? "Pause" : "Resume"}
            </button>
          </form>
          <form action={generateNow}>
            <input type="hidden" name="id" value={series.id} />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Generate now
            </button>
          </form>
        </div>
      </header>

      <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Description</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{series.description}</p>
      </section>

      <section className="rounded-xl bg-white ring-1 ring-slate-200">
        <h2 className="px-6 pt-5 text-sm font-semibold text-slate-900">Generated occurrences</h2>
        <ul className="divide-y divide-slate-100 px-6 py-2 text-sm">
          {series.events.length === 0 && (
            <li className="py-4 text-slate-500">
              No occurrences yet. Click &ldquo;Generate now&rdquo; to materialise the first ones.
            </li>
          )}
          {series.events.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <Link
                href={`/dashboard/events/${e.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {e.startsAt.toLocaleString("en-IE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: series.timezone
                })}
              </Link>
              <span className="text-xs text-slate-500">{e.location}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
