import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { env } from "@/lib/env";
import { AnnounceForm } from "./AnnounceForm";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const canSend = can(user.role, "announcements.send");

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      rsvps: { include: { member: true }, orderBy: { updatedAt: "desc" } },
      announcements: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!event) notFound();

  const yes = event.rsvps.filter((r) => r.status === "YES").length;
  const no = event.rsvps.filter((r) => r.status === "NO").length;
  const maybe = event.rsvps.filter((r) => r.status === "MAYBE").length;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
          <p className="text-sm text-slate-600">
            {event.startsAt.toLocaleString("en-IE", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: event.timezone
            })}{" "}
            &middot; {event.location}
          </p>
        </div>
        {can(user.role, "events.edit") && (
          <div className="flex gap-2">
            <Link
              href={`/dashboard/events/${event.id}/check-in`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Check in
            </Link>
            <Link
              href={`/dashboard/events/${event.id}/edit`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
          </div>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Yes" value={yes} />
        <Stat label="Maybe" value={maybe} />
        <Stat label="No" value={no} />
        <Stat label="Sends" value={event.announcements.length} />
      </section>

      {canSend && (
        <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Send announcement</h2>
          <p className="mt-1 text-xs text-slate-500">
            Sends to all email-consenting members (or RSVP-Yes only). Each recipient gets a unique
            tokenised RSVP link.
          </p>
          <AnnounceForm eventId={event.id} whatsappEnabled={env.WHATSAPP_ENABLED} />
        </section>
      )}

      <section className="rounded-xl bg-white ring-1 ring-slate-200">
        <h2 className="px-6 pt-5 text-sm font-semibold text-slate-900">Recent sends</h2>
        <ul className="divide-y divide-slate-100 px-6 py-2 text-sm">
          {event.announcements.length === 0 && (
            <li className="py-4 text-slate-500">No announcements sent yet.</li>
          )}
          {event.announcements.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-slate-900">{a.subject ?? "(no subject)"}</p>
                <p className="text-xs text-slate-500">
                  {a.channel} &middot; {a.audienceTag} &middot;{" "}
                  {a.sentAt
                    ? a.sentAt.toLocaleString("en-IE", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })
                    : "queued"}{" "}
                  &middot; {a.recipientCount} recipients
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  a.status === "SENT"
                    ? "bg-emerald-50 text-emerald-700"
                    : a.status === "FAILED"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-white ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-sm font-semibold text-slate-900">RSVPs</h2>
          <a
            href={`/api/exports/events/${event.id}/rsvps`}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </a>
        </div>
        <ul className="divide-y divide-slate-100 px-6 py-2 text-sm">
          {event.rsvps.length === 0 && (
            <li className="py-4 text-slate-500">No RSVPs yet.</li>
          )}
          {event.rsvps.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className="text-slate-700">
                {r.member.name}{" "}
                <span className="text-xs text-slate-500">&lt;{r.member.email}&gt;</span>
              </span>
              <span className="font-mono text-xs text-slate-500">{r.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
