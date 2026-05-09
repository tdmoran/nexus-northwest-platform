import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { engagementScore, engagementBand } from "@/lib/engagement";
import { countReferralsBySlug } from "@/server/invite";

async function updateMember(formData: FormData) {
  "use server";
  const actor = await requireUser();
  if (!can(actor.role, "members.edit")) redirect("/dashboard?error=forbidden");

  const memberId = String(formData.get("memberId") ?? "");
  const target = await prisma.member.findUnique({ where: { id: memberId } });
  if (!target) redirect("/dashboard/members?error=not_found");

  const isFullEdit = can(actor.role, "members.edit.full");

  // All roles with members.edit can edit notes + tags + speakerProspect.
  // Only members.edit.full can change consent / channel / contact details
  // beyond the member's own preference page.
  const notes = (formData.get("notes") as string) || null;
  const tags = ((formData.get("tags") as string) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const speakerProspect = formData.get("speakerProspect") === "on";

  const data: Record<string, unknown> = { notes, tags, speakerProspect };

  if (isFullEdit) {
    const company = (formData.get("company") as string) || null;
    const phone = (formData.get("phone") as string) || null;
    const linkedinUrl = (formData.get("linkedinUrl") as string) || null;
    Object.assign(data, { company, phone, linkedinUrl });
  }

  await prisma.member.update({ where: { id: memberId }, data });
  await audit({
    action: "member.updated",
    actorId: actor.id,
    memberId,
    meta: { fields: Object.keys(data) }
  });

  redirect(`/dashboard/members/${memberId}?ok=saved`);
}

export default async function MemberDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { ok?: string };
}) {
  const actor = await requireUser();
  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: {
      rsvps: { include: { event: true }, orderBy: { updatedAt: "desc" } },
      audit: { orderBy: { createdAt: "desc" }, take: 30 },
      addedBy: true
    }
  });
  if (!member) notFound();

  const canEdit = can(actor.role, "members.edit");
  const canEditFull = can(actor.role, "members.edit.full");
  const score = engagementScore(
    member.rsvps.map((r) => ({
      status: r.status,
      attendedAt: r.attendedAt,
      noShow: r.noShow
    }))
  );
  const band = engagementBand(score.score);
  const referralCount = member.inviteSlug ? await countReferralsBySlug(member.inviteSlug) : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{member.name}</h1>
        <p className="text-sm text-slate-600">{member.email}</p>
        <p className="mt-1 text-xs text-slate-500">
          Joined {member.createdAt.toLocaleDateString("en-IE")} &middot; source:{" "}
          {member.utmSource ?? "direct"}
          {member.referralCode && <> &middot; ref: {member.referralCode}</>}
          {member.addedBy && <> &middot; added by {member.addedBy.name}</>}
        </p>
      </header>

      {searchParams.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <Stat
          label="Email consent"
          value={
            member.emailConsent
              ? `yes${member.emailConsentAt ? ` since ${member.emailConsentAt.toLocaleDateString("en-IE")}` : ""}`
              : `no${member.emailOptOutAt ? ` since ${member.emailOptOutAt.toLocaleDateString("en-IE")}` : ""}`
          }
        />
        <Stat
          label="WhatsApp consent"
          value={member.whatsappConsent ? "yes" : "no"}
        />
        <Stat label="Channel" value={member.preferredChannel} />
      </section>

      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Engagement</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${bandColour(band)}`}
          >
            {band}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Score {score.score} &middot; {score.rsvpCount} RSVPs &middot; {score.yesCount} Yes
          &middot; {score.attendedCount} attended
          {score.noShowCount > 0 && ` · ${score.noShowCount} no-show`}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Friends introduced: <strong>{referralCount}</strong>
          {member.inviteSlug && (
            <> &middot; invite slug: <code className="font-mono">{member.inviteSlug}</code></>
          )}
        </p>
      </section>

      {canEdit && (
        <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Organiser-managed fields</h2>
          <form action={updateMember} className="space-y-3">
            <input type="hidden" name="memberId" value={member.id} />
            {canEditFull && (
              <>
                <Field name="company" label="Company" defaultValue={member.company ?? ""} />
                <Field name="phone" label="Phone" defaultValue={member.phone ?? ""} />
                <Field
                  name="linkedinUrl"
                  label="LinkedIn URL"
                  type="url"
                  defaultValue={member.linkedinUrl ?? ""}
                />
              </>
            )}
            <Field
              name="tags"
              label="Tags (comma-separated)"
              defaultValue={member.tags.join(", ")}
            />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                name="notes"
                rows={4}
                defaultValue={member.notes ?? ""}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="speakerProspect"
                defaultChecked={member.speakerProspect}
              />
              Mark as speaker prospect
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Save
            </button>
          </form>
          {!canEditFull && (
            <p className="mt-3 text-xs text-slate-500">
              Your role can edit notes, tags and speaker-prospect status. Contact details and
              consent are managed via the member&rsquo;s preference link.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Event history</h2>
        {member.rsvps.length === 0 ? (
          <p className="text-sm text-slate-500">No RSVPs yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {member.rsvps.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span className="text-slate-700">
                  {r.event.title}{" "}
                  <span className="text-xs text-slate-500">
                    ({r.event.startsAt.toLocaleDateString("en-IE")})
                  </span>
                </span>
                <span className="font-mono text-xs text-slate-500">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent activity</h2>
        {member.audit.length === 0 ? (
          <p className="text-sm text-slate-500">No activity logged for this member.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {member.audit.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2">
                <span className="font-mono text-slate-500">
                  {a.createdAt.toLocaleString("en-IE", {
                    dateStyle: "short",
                    timeStyle: "short"
                  })}
                </span>
                <span className="font-medium text-slate-700">{a.action}</span>
                {a.channel && <span className="text-slate-500">({a.channel})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function bandColour(band: "active" | "engaged" | "occasional" | "lapsed"): string {
  switch (band) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "engaged":
      return "bg-brand-50 text-brand-700";
    case "occasional":
      return "bg-amber-50 text-amber-700";
    case "lapsed":
      return "bg-slate-100 text-slate-500";
  }
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
