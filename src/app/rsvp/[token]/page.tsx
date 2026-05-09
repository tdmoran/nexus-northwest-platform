import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { lookupToken, consumeToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { applyRsvpDecision } from "@/server/waitlist";
import { RSVPStatus } from "@prisma/client";

interface Props {
  params: { token: string };
  searchParams: { response?: string };
}

const responseToStatus: Record<string, RSVPStatus> = {
  yes: RSVPStatus.YES,
  no: RSVPStatus.NO,
  maybe: RSVPStatus.MAYBE,
  cancel: RSVPStatus.CANCELLED
};

export default async function RsvpPage({ params, searchParams }: Props) {
  const tok = decodeURIComponent(params.token);
  const lookup = await lookupToken(tok, "RSVP");
  if (!lookup || !lookup.eventId) notFound();

  const event = await prisma.event.findUnique({ where: { id: lookup.eventId } });
  const member = await prisma.member.findUnique({ where: { id: lookup.memberId } });
  if (!event || !member) notFound();

  const responseRaw = (searchParams.response ?? "yes").toLowerCase();
  const requested = responseToStatus[responseRaw] ?? RSVPStatus.YES;

  // RSVP tokens stay valid — re-clicking works to flip the decision.
  await consumeToken(tok, "RSVP");

  const { status: finalStatus } = await applyRsvpDecision(event, member, {
    status: requested,
    channel: "email"
  });

  await audit({
    action: "rsvp.recorded",
    memberId: member.id,
    channel: "email",
    meta: { eventId: event.id, requested, finalStatus }
  });

  const dateStr = event.startsAt.toLocaleString("en-IE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone
  });

  const waitlistPosition =
    finalStatus === RSVPStatus.WAITLISTED
      ? await prisma.rSVP.count({
          where: {
            eventId: event.id,
            status: RSVPStatus.WAITLISTED,
            waitlistedAt: { lte: new Date() }
          }
        })
      : null;

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        {finalStatus === RSVPStatus.WAITLISTED ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900">
              You&rsquo;re on the waitlist, {member.name}.
            </h1>
            <p className="mt-3 text-slate-600">
              <strong>{event.title}</strong> is currently at capacity. We&rsquo;ll email you
              automatically if a spot opens up — no further action needed.
              {waitlistPosition && waitlistPosition > 0 && (
                <>
                  {" "}You&rsquo;re position <strong>#{waitlistPosition}</strong> on the waitlist.
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900">
              {labelFor(finalStatus)} &mdash; thanks {member.name}!
            </h1>
            <p className="mt-3 text-slate-700">
              Your response has been recorded for <strong>{event.title}</strong>.
            </p>
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              <li>
                <strong>When:</strong> {dateStr}
              </li>
              <li>
                <strong>Where:</strong> {event.location}
              </li>
            </ul>
            {finalStatus === RSVPStatus.YES && (
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`/api/events/${event.id}/calendar`}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Add to calendar (.ics)
                </a>
              </div>
            )}
          </>
        )}
        <p className="mt-6 text-xs text-slate-500">
          Need to change your mind?{" "}
          <a href={`/rsvp/${encodeURIComponent(tok)}?response=cancel`} className="underline">
            Cancel my RSVP
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function labelFor(status: RSVPStatus): string {
  switch (status) {
    case RSVPStatus.YES:
      return "You're in";
    case RSVPStatus.NO:
      return "Noted";
    case RSVPStatus.MAYBE:
      return "Got it — tentative";
    case RSVPStatus.CANCELLED:
      return "RSVP cancelled";
    case RSVPStatus.WAITLISTED:
      return "Waitlisted";
  }
}
