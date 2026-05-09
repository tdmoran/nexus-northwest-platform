import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { lookupToken, consumeToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { applyRsvpDecision } from "@/server/waitlist";
import { TokenPageShell } from "@/components/layout/PublicShell";
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

  if (finalStatus === RSVPStatus.WAITLISTED) {
    return (
      <TokenPageShell
        eyebrow="Waitlist"
        title={`You're on the waitlist, ${member.name}.`}
        subtitle={`${event.title} is at capacity. We'll email you automatically if a spot opens up — nothing further needed.`}
      >
        {waitlistPosition && waitlistPosition > 0 && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
            You&rsquo;re position <strong>#{waitlistPosition}</strong> on the waitlist.
          </p>
        )}
        <CancelLink token={tok} />
      </TokenPageShell>
    );
  }

  return (
    <TokenPageShell
      eyebrow={labelEyebrow(finalStatus)}
      title={`${labelHeading(finalStatus)}, ${member.name}.`}
      subtitle={`Your response has been recorded for ${event.title}.`}
    >
      {finalStatus === RSVPStatus.YES && (
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-50 text-accent-600 ring-1 ring-accent-100">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      )}
      <dl className="mt-6 space-y-2 rounded-2xl bg-brand-50/60 p-4 text-sm">
        <Row label="When" value={dateStr} />
        <Row label="Where" value={event.location} />
      </dl>

      {finalStatus === RSVPStatus.YES && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href={`/api/events/${event.id}/calendar`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-accent-400 to-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:from-accent-300 hover:to-accent-500 sm:w-auto"
          >
            Add to calendar (.ics)
          </a>
        </div>
      )}

      <CancelLink token={tok} />
    </TokenPageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-brand-400">{label}</dt>
      <dd className="text-sm text-brand-700">{value}</dd>
    </div>
  );
}

function CancelLink({ token }: { token: string }) {
  return (
    <p className="mt-6 text-xs text-brand-400">
      Need to change your mind?{" "}
      <a
        href={`/rsvp/${encodeURIComponent(token)}?response=cancel`}
        className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-800 hover:underline"
      >
        Cancel my RSVP
      </a>
      .
    </p>
  );
}

function labelEyebrow(status: RSVPStatus): string {
  switch (status) {
    case RSVPStatus.YES:      return "You're in";
    case RSVPStatus.NO:       return "Noted";
    case RSVPStatus.MAYBE:    return "Tentative";
    case RSVPStatus.CANCELLED:return "Cancelled";
    case RSVPStatus.WAITLISTED:return "Waitlist";
  }
}

function labelHeading(status: RSVPStatus): string {
  switch (status) {
    case RSVPStatus.YES:      return "Thanks for confirming";
    case RSVPStatus.NO:       return "Thanks for letting us know";
    case RSVPStatus.MAYBE:    return "Got it — tentative";
    case RSVPStatus.CANCELLED:return "RSVP cancelled";
    case RSVPStatus.WAITLISTED:return "On the waitlist";
  }
}
