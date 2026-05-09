export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Privacy</h1>
      <p className="mt-3">
        Nexus Northwest stores the minimum personal data needed to run the community: your name,
        email, and any preferences or contact details you provide. We do not sell your data, and we
        only contact you with information about events you opted in to.
      </p>
      <p className="mt-3">
        You can update your preferences or unsubscribe at any time using the link in any email we
        send you. To request data export or deletion, contact{" "}
        <a className="text-brand-600 underline" href="mailto:hello@nexusnorthwest.org">
          hello@nexusnorthwest.org
        </a>
        .
      </p>
    </main>
  );
}
