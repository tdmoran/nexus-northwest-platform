import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { QrBuilder } from "./QrBuilder";

export default async function QrPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Tracked links + QR codes</h1>
        <p className="text-sm text-slate-600">
          Build a sharable join link with a campaign tag and a downloadable QR. Sign-ups from this
          link are attributed in Reports.
        </p>
      </header>
      <QrBuilder baseUrl={env.NEXT_PUBLIC_SITE_URL} />
    </div>
  );
}
