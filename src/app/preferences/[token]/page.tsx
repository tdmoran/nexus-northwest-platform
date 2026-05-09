import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { lookupToken } from "@/lib/tokens";
import { PreferencesForm } from "./PreferencesForm";
import { GdprActions } from "./GdprActions";

export default async function PreferencesPage({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  const lookup = await lookupToken(token, "PREFERENCES");
  if (!lookup) notFound();

  const member = await prisma.member.findUnique({ where: { id: lookup.memberId } });
  if (!member) notFound();

  const calendarUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/calendar/${encodeURIComponent(token)}`;

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Communication preferences</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hi {member.name}, you can update how we keep in touch below.
        </p>
        <PreferencesForm
          token={token}
          initial={{
            preferredChannel: member.preferredChannel,
            phone: member.phone ?? "",
            whatsappNumber: member.whatsappNumber ?? "",
            whatsappConsent: member.whatsappConsent,
            emailConsent: member.emailConsent
          }}
        />

        <hr className="my-6 border-slate-200" />
        <h2 className="text-sm font-semibold text-slate-900">Calendar subscription</h2>
        <p className="mt-1 text-xs text-slate-600">
          Subscribe in Google Calendar, Apple Calendar, or Outlook to see every event you&rsquo;ve
          RSVPed Yes to. Your apps will refresh automatically.
        </p>
        <code className="mt-2 block break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
          {calendarUrl}
        </code>

        <hr className="my-6 border-slate-200" />
        <GdprActions
          token={token}
          deletionRequestedAt={member.deletionRequestedAt?.toISOString() ?? null}
        />
      </div>
    </main>
  );
}
