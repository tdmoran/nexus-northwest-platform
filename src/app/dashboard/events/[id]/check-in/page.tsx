import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";

async function toggleAttendance(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "events.edit")) redirect("/dashboard?error=forbidden");

  const rsvpId = String(formData.get("rsvpId") ?? "");
  const action = String(formData.get("action") ?? "");

  const rsvp = await prisma.rSVP.findUnique({ where: { id: rsvpId } });
  if (!rsvp) redirect("/dashboard?error=not_found");

  let data: { attendedAt: Date | null; noShow: boolean };
  if (action === "checkin") {
    data = { attendedAt: new Date(), noShow: false };
  } else if (action === "noshow") {
    data = { attendedAt: null, noShow: true };
  } else {
    data = { attendedAt: null, noShow: false };
  }

  await prisma.rSVP.update({ where: { id: rsvpId }, data });
  await audit({
    action: "rsvp.attendance.updated",
    actorId: user.id,
    memberId: rsvp.memberId,
    meta: { eventId: rsvp.eventId, action }
  });
  redirect(`/dashboard/events/${rsvp.eventId}/check-in`);
}

export default async function CheckInPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { q?: string };
}) {
  const user = await requireUser();
  if (!can(user.role, "events.edit")) redirect("/dashboard?error=forbidden");

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      rsvps: {
        include: { member: true },
        orderBy: { member: { name: "asc" } }
      }
    }
  });
  if (!event) notFound();

  const q = (searchParams.q ?? "").toLowerCase().trim();
  const filtered = q
    ? event.rsvps.filter(
        (r) =>
          r.member.name.toLowerCase().includes(q) ||
          r.member.email.toLowerCase().includes(q)
      )
    : event.rsvps;

  const counts = {
    yes: event.rsvps.filter((r) => r.status === "YES").length,
    attended: event.rsvps.filter((r) => r.attendedAt).length,
    noShow: event.rsvps.filter((r) => r.noShow).length
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Check-in &middot; {event.title}</h1>
          <p className="text-sm text-slate-600">
            {event.startsAt.toLocaleString("en-IE", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: event.timezone
            })}{" "}
            &middot; {event.location}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Stat label="RSVP Yes" value={counts.yes} />
          <Stat label="Checked in" value={counts.attended} tone="emerald" />
          <Stat label="No-show" value={counts.noShow} tone="amber" />
        </div>
      </header>

      <form className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Member</th>
              <th className="px-4 py-3 text-left font-semibold">RSVP</th>
              <th className="px-4 py-3 text-left font-semibold">Attended</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No matching RSVPs.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-900">{r.member.name}</p>
                  <p className="text-xs text-slate-500">{r.member.email}</p>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.status}</td>
                <td className="px-4 py-2 text-xs">
                  {r.attendedAt ? (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      ✓ {r.attendedAt.toLocaleTimeString("en-IE")}
                    </span>
                  ) : r.noShow ? (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">
                      no-show
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <ActionForm rsvpId={r.id} action="checkin" label="Check in" tone="emerald" />
                    <ActionForm rsvpId={r.id} action="noshow" label="No-show" tone="amber" />
                    <ActionForm rsvpId={r.id} action="reset" label="Reset" tone="slate" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  function ActionForm({
    rsvpId,
    action,
    label,
    tone
  }: {
    rsvpId: string;
    action: string;
    label: string;
    tone: "emerald" | "amber" | "slate";
  }) {
    const cls =
      tone === "emerald"
        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
        : tone === "amber"
          ? "bg-amber-600 hover:bg-amber-700 text-white"
          : "bg-slate-200 hover:bg-slate-300 text-slate-700";
    return (
      <form action={toggleAttendance}>
        <input type="hidden" name="rsvpId" value={rsvpId} />
        <input type="hidden" name="action" value={action} />
        <button type="submit" className={`rounded-md px-2 py-1 text-xs font-semibold ${cls}`}>
          {label}
        </button>
      </form>
    );
  }
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800"
        : "bg-slate-100 text-slate-800";
  return (
    <div className={`rounded-lg px-3 py-2 ${cls}`}>
      <p className="text-xs uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
