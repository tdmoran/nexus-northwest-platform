import { PublicShell } from "@/components/layout/PublicShell";

export default function PrivacyPage() {
  return (
    <PublicShell>
      <main id="main" className="mx-auto max-w-2xl px-4 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">Privacy</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-800 sm:text-4xl">
          We treat your data with respect.
        </h1>

        <div className="mt-8 space-y-5 text-base leading-relaxed text-brand-600">
          <p>
            Nexus Northwest stores the minimum personal data needed to run the community: your name,
            email, and any preferences or contact details you provide. We do not sell your data,
            and we only contact you with information about events you opted in to.
          </p>
          <p>
            You can update your preferences or unsubscribe at any time using the link in any email
            we send you. To request data export or deletion, contact{" "}
            <a
              className="font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline"
              href="mailto:hello@nexusnorthwest.org"
            >
              hello@nexusnorthwest.org
            </a>
            .
          </p>
          <p className="text-sm text-brand-500">
            Hosted in the EU. GDPR Article 17 (erasure) and Article 20 (portability) honoured via
            self-service tools on your preferences page.
          </p>
        </div>
      </main>
    </PublicShell>
  );
}
